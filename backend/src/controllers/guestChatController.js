// src/controllers/guestChatController.js
// Chatbot chế độ khách – mục 4.4.1 và 5.2.1 của tài liệu API
// Lịch sử/hạn mức chỉ lưu tạm trong bộ nhớ theo X-Guest-Id (không ghi chat_sessions).

import crypto from 'crypto';
import { generateCulinaryReply } from '../services/aiService.js';
import { getSettings } from '../services/settingsService.js';
import { checkTopic, detectQuestionAllergens, getDietConstraints, parsePantry, retrieveDishes, toDishCard } from '../services/chatContextService.js';
import { sendError, sendOk } from '../utils/http.js';

const MAX_CONTENT_LENGTH = 1000;
const HOUR_MS = 60 * 60 * 1000;

// Hạn mức theo guest_id và theo IP (chống đổi X-Guest-Id để lách hạn mức): khóa → { số lượt đã dùng, thời điểm đặt lại }
const guestQuotaMap = new Map();
const ipQuotaMap = new Map();
// Số tin nhắn của khách theo ngày, dùng cho GET /admin/chatbot/overview: ngày (YYYY-MM-DD) → số tin nhắn
const guestDailyCounts = new Map();
// Lịch sử phiên khách theo guest_id (UC03): { messages: [{ role, content }], resetsAt }; hết chu kỳ hạn mức thì mất
const guestHistoryMap = new Map();
const MAX_GUEST_HISTORY = 8;
const MAX_GUEST_SESSIONS = 10000;

function readGuestHistory(guestId) {
  const record = guestHistoryMap.get(guestId);
  if (!record || record.resetsAt <= Date.now()) {
    guestHistoryMap.delete(guestId);
    return [];
  }
  return record.messages;
}

function appendGuestHistory(guestId, windowMs, ...messages) {
  let record = guestHistoryMap.get(guestId);
  if (!record || record.resetsAt <= Date.now()) {
    if (guestHistoryMap.size >= MAX_GUEST_SESSIONS) guestHistoryMap.delete(guestHistoryMap.keys().next().value);
    record = { messages: [], resetsAt: Date.now() + windowMs };
    guestHistoryMap.set(guestId, record);
  }
  record.messages.push(...messages);
  if (record.messages.length > MAX_GUEST_HISTORY) record.messages.splice(0, record.messages.length - MAX_GUEST_HISTORY);
}

// req.ip đã tính theo "trust proxy" (địa chỉ do proxy tin cậy ghi nhận); không đọc thẳng X-Forwarded-For
// vì phần đầu của header này do máy khách tự gửi, giả được để lách hạn mức theo IP
function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

setInterval(() => {
  const now = Date.now();
  for (const map of [guestQuotaMap, ipQuotaMap, guestHistoryMap]) {
    for (const [key, record] of map.entries()) {
      if (record.resetsAt <= now) map.delete(key);
    }
  }
}, HOUR_MS).unref();

function getRecord(map, key, windowMs) {
  const now = Date.now();
  let record = map.get(key);
  if (!record || record.resetsAt <= now) {
    record = { used: 0, resetsAt: now + windowMs };
    map.set(key, record);
  }
  return record;
}

function readQuota(guestId, ip, settings) {
  const limit = Math.max(0, Number(settings.guest_message_limit) || 0);
  const windowMs = Math.max(1, Number(settings.guest_window_hours) || 24) * HOUR_MS;
  const guest = getRecord(guestQuotaMap, guestId, windowMs);
  const byIp = getRecord(ipQuotaMap, ip, windowMs);
  const used = Math.max(guest.used, byIp.used);
  return {
    limit,
    used: Math.min(used, limit),
    remaining: Math.max(0, limit - used),
    resets_at: new Date(guest.resetsAt).toISOString(),
    _consume: () => { guest.used += 1; byIp.used += 1; },
    _refund: () => { guest.used = Math.max(0, guest.used - 1); byIp.used = Math.max(0, byIp.used - 1); },
  };
}

function publicQuota({ _consume, _refund, ...quota }) {
  return quota;
}

function resolveGuestId(req) {
  const header = req.headers['x-guest-id'];
  return typeof header === 'string' && header.trim() ? header.trim().slice(0, 100) : `guest_${crypto.randomUUID()}`;
}

/** Tổng số tin nhắn khách trong khoảng ngày [fromDate, toDate] (YYYY-MM-DD), kèm số theo ngày. */
export function getGuestMessageCounts(fromDate, toDate) {
  const byDate = {};
  let total = 0;
  for (const [date, count] of guestDailyCounts) {
    if (date >= fromDate && date <= toDate) {
      byDate[date] = count;
      total += count;
    }
  }
  return { total, byDate };
}

/**
 * 5.2.1 Xem hạn mức lượt hỏi còn lại – GET /chat/guest/quota
 */
export async function getGuestQuota(req, res) {
  const settings = await getSettings();
  const quota = readQuota(resolveGuestId(req), getClientIp(req), settings);
  return sendOk(res, publicQuota(quota));
}

/**
 * 4.4.1 Gửi câu hỏi (khách) – POST /chat/guest/messages
 */
export async function sendGuestMessage(req, res) {
  const guestId = resolveGuestId(req);
  const settings = await getSettings();

  // 1. Kiểm tra hạn mức trước khi gọi AI (luồng 2, 2a, 2b)
  const quota = readQuota(guestId, getClientIp(req), settings);
  if (quota.limit === 0) {
    return sendError(res, 429, 'GUEST_LIMIT_EXCEEDED', 'Chatbot cho khách tạm thời không khả dụng. Vui lòng đăng nhập để tiếp tục.', {
      disabled: true,
      cta: ['register', 'login'],
    });
  }
  if (quota.remaining <= 0) {
    return sendError(res, 429, 'GUEST_LIMIT_EXCEEDED', 'Bạn đã dùng hết lượt hỏi ở chế độ khách. Vui lòng đăng ký hoặc đăng nhập để tiếp tục.', {
      cta: ['register', 'login'],
      resets_at: quota.resets_at,
    });
  }

  // 2. Kiểm tra nội dung
  const { content } = req.body || {};
  if (typeof content !== 'string' || !content.trim()) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Nội dung câu hỏi không được để trống.', [
      { field: 'content', code: 'REQUIRED', message: 'Nội dung câu hỏi không được để trống.' },
    ]);
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return sendError(res, 422, 'VALIDATION_ERROR', `Nội dung câu hỏi tối đa ${MAX_CONTENT_LENGTH} ký tự.`, [
      { field: 'content', code: 'TOO_LONG', message: `Tối đa ${MAX_CONTENT_LENGTH} ký tự.` },
    ]);
  }
  const question = content.trim();
  const pantry = await parsePantry(req.body);

  // Giữ trước một lượt ngay khi câu hỏi hợp lệ: các yêu cầu gửi song song không cùng lọt qua bước kiểm tra hạn mức.
  // Không trả lời được (AI lỗi) thì trả lại lượt.
  quota._consume();

  // 3. Chặn câu hỏi ngoài chủ đề rồi truy hồi món liên quan theo véc-tơ
  let reply;
  try {
    reply = await answerGuestQuestion({ question, pantry, settings, guestId });
  } catch (err) {
    quota._refund();
    throw err;
  }

  // 4. Lưu lịch sử phiên khách trong bộ nhớ (không ghi CSDL) và cập nhật số liệu tổng hợp
  const windowMs = Math.max(1, Number(settings.guest_window_hours) || 24) * HOUR_MS;
  appendGuestHistory(guestId, windowMs, { role: 'user', content: question }, { role: 'assistant', content: reply.content });
  const today = new Date().toISOString().slice(0, 10);
  guestDailyCounts.set(today, (guestDailyCounts.get(today) || 0) + 1);

  return sendOk(res, {
    guest_id: guestId,
    reply,
    quota: publicQuota(readQuota(guestId, getClientIp(req), settings)),
  });
}

/** Sinh câu trả lời cho khách: chặn ngoài chủ đề, truy hồi món an toàn rồi gọi AI. */
async function answerGuestQuestion({ question, pantry, settings, guestId }) {
  const topic = await checkTopic(question, settings);
  let reply;
  if (topic.outOfScope) {
    reply = { type: 'out_of_scope', outcome: 'out_of_scope', content: topic.reply, dishes: [] };
  } else {
    // Khách không có hồ sơ: chỉ lọc theo dị ứng và chế độ ăn bắt buộc (chay) nêu ngay trong câu hỏi
    const asked = await detectQuestionAllergens(question);
    const diet = await getDietConstraints({ content: question });
    const forbidden = new Set([...asked.ingredientIds, ...diet.forbiddenIngredientIds]);
    const dishesContext = await retrieveDishes({
      questionVector: topic.questionVector,
      content: question,
      pantry,
      forbiddenIngredientIds: forbidden,
      dishFilter: diet.dishFilter,
      limit: Number(settings.max_context_dishes) || 8,
    });
    const aiResult = await generateCulinaryReply({
      content: question,
      fridge: pantry,
      allergens: asked.allergens,
      strictDiets: diet.strict,
      dishesContext,
      chatHistory: readGuestHistory(guestId),
      systemPrompt: settings.system_prompt,
    });
    // outcome cùng bộ giá trị với chatbot người dùng; type (recipe | general | out_of_scope) giữ để tương thích
    const outcome = aiResult.type === 'out_of_scope' ? 'out_of_scope' : 'answered';
    reply = { type: aiResult.type, outcome, content: aiResult.content, dishes: aiResult.dishes.map(toDishCard) };
  }
  return reply;
}
