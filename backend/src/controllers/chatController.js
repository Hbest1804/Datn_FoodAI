// src/controllers/chatController.js
// Chatbot cá nhân hóa – mục 4.6, 5.4 của tài liệu API

import { supabaseAdmin } from '../config/supabase.js';
import { generatePersonalizedReply } from '../services/aiService.js';
import { getSettings } from '../services/settingsService.js';
import {
  checkTopic,
  getForbiddenIngredientIds,
  parsePantry,
  retrieveDishes,
  toDishCard,
} from '../services/chatContextService.js';
import {
  pageMeta,
  parsePagination,
  requireConfirm,
  sendError,
  sendOk,
} from '../utils/http.js';

const MAX_CONTENT_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;
const AI_ERROR_REPLY = 'Xin lỗi, dịch vụ AI đang gặp sự cố nên chưa trả lời được. Bạn vui lòng gửi lại câu hỏi sau ít phút.';

function sessionNotFound(res) {
  return sendError(res, 404, 'CHAT_SESSION_NOT_FOUND', 'Hội thoại không tồn tại hoặc không thuộc người dùng.');
}

async function findOwnSession(sessionId, userId) {
  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, title, user_id, created_at, updated_at')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data && data.user_id === userId ? data : null;
}

function readTitle(title) {
  if (title === undefined || title === null) return null;
  if (typeof title !== 'string') return undefined;
  const trimmed = title.trim();
  if (trimmed.length > MAX_TITLE_LENGTH) return undefined;
  return trimmed || null;
}

/**
 * 4.6.1 Tạo hội thoại mới – POST /chat/sessions
 */
export async function createChatSession(req, res) {
  const title = readTitle(req.body?.title);
  if (title === undefined) {
    return sendError(res, 422, 'VALIDATION_ERROR', `Tiêu đề phải là chuỗi tối đa ${MAX_TITLE_LENGTH} ký tự.`);
  }
  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .insert({ user_id: req.user.id, title })
    .select('id, title, created_at, updated_at')
    .single();
  if (error) throw error;
  return sendOk(res, data, { status: 201 });
}

/**
 * 4.6.2 Danh sách hội thoại – GET /chat/sessions
 */
export async function getChatSessions(req, res) {
  const pg = parsePagination(req.query);
  const { data, count, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, title, created_at, updated_at', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false })
    .range(pg.from, pg.to);
  if (error) throw error;
  return sendOk(res, data || [], { meta: pageMeta(pg, count) });
}

/**
 * 4.6.3 Mở lại hội thoại cũ – GET /chat/sessions/:sessionId
 */
export async function getChatSessionById(req, res) {
  const session = await findOwnSession(req.params.sessionId, req.user.id);
  if (!session) return sessionNotFound(res);

  const pg = parsePagination(req.query, { defaultLimit: 50 });
  const { data: messages, count, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, role, content, referenced_dish_ids, feedback, feedback_reason, outcome, tokens, created_at', { count: 'exact' })
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })
    .range(pg.from, pg.to);
  if (error) throw error;

  // Gắn thẻ món để giao diện dựng lại hội thoại
  const dishIds = [...new Set((messages || []).flatMap((m) => m.referenced_dish_ids || []))];
  const dishMap = new Map();
  if (dishIds.length > 0) {
    const { data: dishes } = await supabaseAdmin
      .from('dishes')
      .select('id, name, slug, description, image_url, category, cook_time_minutes, difficulty')
      .in('id', dishIds);
    (dishes || []).forEach((d) => dishMap.set(d.id, toDishCard(d)));
  }

  return sendOk(res, {
    id: session.id,
    title: session.title,
    created_at: session.created_at,
    updated_at: session.updated_at,
    messages: (messages || []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      referenced_dishes: (m.referenced_dish_ids || []).map((id) => dishMap.get(id)).filter(Boolean),
      feedback: m.feedback,
      feedback_reason: m.feedback_reason,
      outcome: m.outcome,
      tokens: m.tokens,
      created_at: m.created_at,
    })),
  }, { meta: pageMeta(pg, count) });
}

// ── Ngữ cảnh cá nhân hóa (luồng 2–3) ─────────────────────────────────────────

async function loadUserContext(userId, sessionId, excludeMessageId) {
  const [profileRes, dietsRes, allergiesRes, dislikesRes, favsRes, historyRes] = await Promise.all([
    supabaseAdmin.from('user_profiles').select('taste_prefs, calorie_goal, budget_min, budget_max, household_size').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('user_diets').select('diet_types(id, name)').eq('user_id', userId),
    supabaseAdmin.from('user_allergies').select('allergen_groups(id, code, name)').eq('user_id', userId),
    supabaseAdmin.from('user_disliked_ingredients').select('ingredients(id, name)').eq('user_id', userId),
    supabaseAdmin.from('favorites').select('dishes(id, name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('chat_messages').select('role, content').eq('session_id', sessionId).neq('id', excludeMessageId)
      .order('created_at', { ascending: false }).limit(8),
  ]);

  const profile = profileRes.data || {};
  const allergenGroups = (allergiesRes.data || []).map((r) => r.allergen_groups).filter(Boolean);
  const dislikedIngredients = (dislikesRes.data || []).map((r) => r.ingredients).filter(Boolean);

  return {
    userProfile: {
      taste_prefs: profile.taste_prefs || {},
      calorie_goal: profile.calorie_goal ?? null,
      budget_min: profile.budget_min ?? null,
      budget_max: profile.budget_max ?? null,
      household_size: profile.household_size || 1,
      diet_types: (dietsRes.data || []).map((r) => r.diet_types).filter(Boolean),
      allergen_groups: allergenGroups,
      disliked_ingredients: dislikedIngredients,
    },
    allergenGroupIds: allergenGroups.map((a) => a.id),
    dislikedIngredientIds: dislikedIngredients.map((i) => i.id),
    favoriteDishes: (favsRes.data || []).map((r) => r.dishes).filter(Boolean),
    chatHistory: (historyRes.data || []).reverse(),
  };
}

function wantsStream(req) {
  return String(req.headers.accept || '').includes('text/event-stream');
}

function writeEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * 4.6.4 Gửi câu hỏi cho chatbot – POST /chat/sessions/:sessionId/messages
 * Mặc định trả JSON một lần; nếu gửi Accept: text/event-stream thì trả dần theo các sự kiện token, dishes, done.
 */
export async function sendChatMessage(req, res) {
  const userId = req.user.id;
  const session = await findOwnSession(req.params.sessionId, userId);
  if (!session) return sessionNotFound(res);

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
  const startedAt = Date.now();

  // 1. Lưu tin nhắn người dùng trước để vẫn còn khi AI lỗi (luồng 3a)
  const { data: userMsg, error: userMsgErr } = await supabaseAdmin
    .from('chat_messages')
    .insert({ session_id: session.id, role: 'user', content: question })
    .select('id, role, content, created_at')
    .single();
  if (userMsgErr) throw userMsgErr;

  // Không gửi title khi tạo thì tự đặt tiêu đề từ tin nhắn đầu tiên
  let sessionTitle = session.title;
  if (!sessionTitle) {
    sessionTitle = question.length > 60 ? `${question.slice(0, 57)}...` : question;
    await supabaseAdmin.from('chat_sessions').update({ title: sessionTitle }).eq('id', session.id);
  }

  const settings = await getSettings();
  const ctx = await loadUserContext(userId, session.id, userMsg.id);

  // 2. Chặn ngoài chủ đề, truy hồi món an toàn rồi gọi AI
  let result;
  try {
    const topic = await checkTopic(question, settings);
    if (topic.outOfScope) {
      result = { outcome: 'out_of_scope', content: topic.reply, dishes: [], tokens: 0 };
    } else {
      const forbidden = await getForbiddenIngredientIds(ctx);
      const dishesContext = await retrieveDishes({
        questionVector: topic.questionVector,
        content: question,
        pantry,
        forbiddenIngredientIds: forbidden,
        limit: Number(settings.max_context_dishes) || 8,
      });
      result = await generatePersonalizedReply({
        content: question,
        userProfile: ctx.userProfile,
        favoriteDishes: ctx.favoriteDishes,
        chatHistory: ctx.chatHistory,
        fridge: pantry,
        dishesContext,
        systemPrompt: settings.system_prompt,
      });
      if (result.outcome === 'answered' && dishesContext.length === 0) result.outcome = 'no_match';
    }
  } catch (err) {
    if (err.name !== 'AIServiceError') throw err;
    // Ghi nhận lỗi để Admin theo dõi tỉ lệ lỗi; tin nhắn người dùng đã được lưu
    await supabaseAdmin.from('chat_messages').insert({
      session_id: session.id,
      role: 'assistant',
      content: AI_ERROR_REPLY,
      outcome: 'error',
      latency_ms: Date.now() - startedAt,
    });
    await supabaseAdmin.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', session.id);
    return sendError(res, err.status || 502, err.code || 'AI_SERVICE_ERROR', err.message, { user_message_id: userMsg.id });
  }

  // 3. Lưu câu trả lời
  const dishes = (result.dishes || []).map(toDishCard);
  const { data: assistantMsg, error: asstErr } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      session_id: session.id,
      role: 'assistant',
      content: result.content,
      referenced_dish_ids: dishes.map((d) => d.id),
      outcome: result.outcome || 'answered',
      tokens: result.tokens ?? null,
      latency_ms: Date.now() - startedAt,
    })
    .select('id, role, content, outcome, tokens, created_at')
    .single();
  if (asstErr) throw asstErr;
  await supabaseAdmin.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', session.id);

  const data = {
    session_title: sessionTitle,
    user_message: userMsg,
    assistant_message: { ...assistantMsg, referenced_dishes: dishes },
  };

  if (wantsStream(req)) {
    res.status(201);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Câu trả lời đã sinh xong; gửi theo từng đoạn để giao diện hiển thị dần
    const chunks = result.content.match(/[\s\S]{1,40}/g) || [];
    for (const text of chunks) writeEvent(res, 'token', { text });
    writeEvent(res, 'dishes', dishes);
    writeEvent(res, 'done', data);
    return res.end();
  }

  return sendOk(res, data, { status: 201 });
}

/**
 * 4.6.5 Xóa một hội thoại – DELETE /chat/sessions/:sessionId
 */
export async function deleteChatSession(req, res) {
  const session = await findOwnSession(req.params.sessionId, req.user.id);
  if (!session) return sessionNotFound(res);
  const { error } = await supabaseAdmin.from('chat_sessions').delete().eq('id', session.id);
  if (error) throw error;
  return res.status(204).send();
}

/**
 * 5.4.2 Xóa toàn bộ lịch sử hội thoại – DELETE /chat/sessions?confirm=true
 */
export async function deleteAllChatSessions(req, res) {
  requireConfirm(req.query.confirm);
  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .delete()
    .eq('user_id', req.user.id)
    .select('id');
  if (error) throw error;
  return sendOk(res, { deleted_sessions: (data || []).length });
}

/**
 * 4.6.6 Đánh giá câu trả lời của chatbot – POST /chat/messages/:messageId/feedback
 */
export async function sendChatMessageFeedback(req, res) {
  const { feedback, reason } = req.body || {};
  if (!['like', 'dislike'].includes(feedback)) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'feedback phải là like hoặc dislike.', [
      { field: 'feedback', code: 'INVALID_VALUE', message: 'Chỉ nhận like | dislike.' },
    ]);
  }
  if (reason !== undefined && reason !== null && (typeof reason !== 'string' || reason.length > 500)) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Lý do tối đa 500 ký tự.', [
      { field: 'reason', code: 'TOO_LONG', message: 'Tối đa 500 ký tự.' },
    ]);
  }

  const { data: msg, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, role, chat_sessions(user_id)')
    .eq('id', req.params.messageId)
    .maybeSingle();
  if (error) throw error;
  if (!msg || msg.chat_sessions?.user_id !== req.user.id) {
    return sendError(res, 404, 'MESSAGE_NOT_FOUND', 'Tin nhắn không tồn tại hoặc không thuộc người dùng.');
  }
  if (msg.role !== 'assistant') {
    return sendError(res, 422, 'VALIDATION_ERROR', 'Chỉ đánh giá được tin nhắn có role = assistant.');
  }

  const feedbackReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('chat_messages')
    .update({ feedback, feedback_reason: feedbackReason })
    .eq('id', msg.id)
    .select('id, feedback, feedback_reason')
    .single();
  if (updErr) throw updErr;
  return sendOk(res, updated);
}

/**
 * 5.4.1 Đổi tên hội thoại – PATCH /chat/sessions/:sessionId
 */
export async function updateChatSession(req, res) {
  const title = readTitle(req.body?.title);
  if (!title) {
    return sendError(res, 422, 'VALIDATION_ERROR', `Tiêu đề không được để trống và tối đa ${MAX_TITLE_LENGTH} ký tự.`);
  }
  const session = await findOwnSession(req.params.sessionId, req.user.id);
  if (!session) return sessionNotFound(res);

  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .update({ title })
    .eq('id', session.id)
    .select('id, title, created_at, updated_at')
    .single();
  if (error) throw error;
  return sendOk(res, data);
}
