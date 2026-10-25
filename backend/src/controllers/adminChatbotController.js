// src/controllers/adminChatbotController.js
// Admin – Giám sát chatbot (mục 4.12). Số liệu lấy từ chat_sessions, chat_messages (kết quả, phản hồi, số token,
// latency_ms, flagged); chat khách chỉ có số liệu tổng hợp.

import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/appConfig.js';
import { getSettings, updateSettings } from '../services/settingsService.js';
import { recordAuditLog } from '../services/auditService.js';
import { getGuestMessageCounts } from './guestChatController.js';
import { normalizeText, matchesSearchKeyword } from '../utils/textUtils.js';
import {
  UUID_REGEX,
  pageMeta,
  parseBool,
  parseDateRange,
  parsePagination,
  sendError,
  sendOk,
} from '../utils/http.js';

const PAGE_SIZE = 1000;

/** Đọc hết các dòng thỏa điều kiện (PostgREST giới hạn 1000 dòng mỗi lần). */
export async function fetchAll(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function eachDate(from, to) {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * 4.12.1 Tổng quan hoạt động chatbot – GET /admin/chatbot/overview?from=&to=
 */
export async function adminGetChatbotOverview(req, res) {
  const range = parseDateRange(req.query);
  const [messages, sessions] = await Promise.all([
    fetchAll(() => supabaseAdmin.from('chat_messages')
      .select('role, outcome, feedback, tokens, latency_ms, flagged, created_at')
      .gte('created_at', range.fromIso).lte('created_at', range.toIso)),
    supabaseAdmin.from('chat_sessions').select('*', { count: 'exact', head: true })
      .gte('created_at', range.fromIso).lte('created_at', range.toIso),
  ]);

  const replies = messages.filter((m) => m.role === 'assistant');
  const outcomes = { answered: 0, no_match: 0, out_of_scope: 0, error: 0 };
  replies.forEach((m) => { if (outcomes[m.outcome] !== undefined) outcomes[m.outcome] += 1; });
  const latencies = replies.map((m) => m.latency_ms).filter((v) => v != null);
  const guest = getGuestMessageCounts(range.from, range.to);

  const byDate = {};
  messages.forEach((m) => {
    const d = m.created_at.slice(0, 10);
    byDate[d] = byDate[d] || { messages: 0, errors: 0 };
    byDate[d].messages += 1;
    if (m.outcome === 'error') byDate[d].errors += 1;
  });
  const series = Object.keys(byDate).length || guest.total
    ? eachDate(range.from, range.to).map((date) => ({
      date,
      messages: (byDate[date]?.messages || 0) + (guest.byDate[date] || 0),
      errors: byDate[date]?.errors || 0,
    }))
    : [];

  return sendOk(res, {
    total_sessions: sessions.count || 0,
    total_messages: messages.length,
    guest_messages: guest.total,
    avg_response_ms: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
    error_rate: replies.length ? Math.round((outcomes.error / replies.length) * 10000) / 10000 : 0,
    outcomes,
    feedback: {
      like: replies.filter((m) => m.feedback === 'like').length,
      dislike: replies.filter((m) => m.feedback === 'dislike').length,
    },
    flagged_count: replies.filter((m) => m.flagged).length,
    tokens_total: messages.reduce((sum, m) => sum + (m.tokens || 0), 0),
    series,
  });
}

/**
 * 4.12.2 Nhật ký hội thoại – GET /admin/chatbot/conversations?status=&q=&user_id=&from=&to=&page=&limit=
 */
export async function adminGetConversations(req, res) {
  const pg = parsePagination(req.query);
  const range = parseDateRange(req.query);
  const status = req.query.status ?? 'all';
  if (!['all', 'error', 'flagged', 'disliked'].includes(status)) {
    return sendError(res, 400, 'INVALID_QUERY', 'status phải là all, error, flagged hoặc disliked.');
  }
  if (req.query.user_id && !UUID_REGEX.test(req.query.user_id)) {
    return sendError(res, 400, 'INVALID_QUERY', 'user_id phải là uuid.');
  }

  const sessions = await fetchAll(() => {
    let query = supabaseAdmin
      .from('chat_sessions')
      .select('id, title, updated_at, user:users(id, display_name), messages:chat_messages(content, outcome, feedback, flagged)')
      .gte('updated_at', range.fromIso)
      .lte('updated_at', range.toIso)
      .order('updated_at', { ascending: false });
    if (req.query.user_id) query = query.eq('user_id', req.query.user_id);
    return query;
  });

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rows = sessions
    .filter((s) => {
      const msgs = s.messages || [];
      if (status === 'error' && !msgs.some((m) => m.outcome === 'error')) return false;
      if (status === 'flagged' && !msgs.some((m) => m.flagged)) return false;
      if (status === 'disliked' && !msgs.some((m) => m.feedback === 'dislike')) return false;
      if (q && !msgs.some((m) => matchesSearchKeyword(m.content, q)) && !matchesSearchKeyword(s.title, q)) return false;
      return true;
    })
    .map((s) => ({
      id: s.id,
      user: s.user || null,
      title: s.title,
      message_count: (s.messages || []).length,
      has_error: (s.messages || []).some((m) => m.outcome === 'error'),
      flagged_count: (s.messages || []).filter((m) => m.flagged).length,
      updated_at: s.updated_at,
    }));

  return sendOk(res, rows.slice(pg.from, pg.to + 1), { meta: pageMeta(pg, rows.length) });
}

/**
 * 4.12.3 Chi tiết hội thoại – GET /admin/chatbot/conversations/:sessionId
 */
export async function adminGetConversationDetail(req, res) {
  const { data: session, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('id, title, user:users(id, display_name)')
    .eq('id', req.params.sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!session) return sendError(res, 404, 'CHAT_SESSION_NOT_FOUND', 'Hội thoại không tồn tại.');

  const { data: messages, error: msgErr } = await supabaseAdmin
    .from('chat_messages')
    .select('id, role, content, referenced_dish_ids, feedback, feedback_reason, outcome, tokens, latency_ms, flagged, flag_reason, created_at')
    .eq('session_id', session.id)
    .order('created_at');
  if (msgErr) throw msgErr;
  return sendOk(res, { id: session.id, title: session.title, user: session.user || null, messages: messages || [] });
}

function publicSettings(s) {
  const latest = Object.values(s._meta || {}).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  return {
    guest_message_limit: Number(s.guest_message_limit),
    guest_window_hours: Number(s.guest_window_hours),
    system_prompt: s.system_prompt,
    max_context_dishes: Number(s.max_context_dishes),
    updated_by: latest?.updated_by ?? null,
    updated_at: latest?.updated_at ?? null,
  };
}

/**
 * 4.12.4 Xem cấu hình chatbot – GET /admin/chatbot/settings
 */
export async function adminGetChatbotSettings(req, res) {
  return sendOk(res, publicSettings(await getSettings()));
}

/**
 * 4.12.5 Cập nhật cấu hình chatbot – PUT /admin/chatbot/settings. Có hiệu lực ngay cho lượt hỏi sau.
 */
export async function adminUpdateChatbotSettings(req, res) {
  const body = req.body || {};
  const details = [];
  const add = (field, message) => details.push({ field, code: 'INVALID_VALUE', message });
  const isInt = (v) => Number.isInteger(v);

  if (!isInt(body.guest_message_limit) || body.guest_message_limit < 0) add('guest_message_limit', 'Số nguyên ≥ 0 (0 = tắt chatbot cho khách).');
  if (!isInt(body.guest_window_hours) || body.guest_window_hours < 1 || body.guest_window_hours > 168) add('guest_window_hours', 'Số nguyên từ 1 đến 168.');
  if (typeof body.system_prompt !== 'string' || !body.system_prompt.trim() || body.system_prompt.length > 4000) {
    add('system_prompt', 'Không rỗng, tối đa 4000 ký tự.');
  }
  if (!isInt(body.max_context_dishes) || body.max_context_dishes < 1 || body.max_context_dishes > 50) add('max_context_dishes', 'Số nguyên từ 1 đến 50.');
  if (details.length > 0) return sendError(res, 422, 'VALIDATION_ERROR', 'Cấu hình không hợp lệ, chưa được lưu.', details);

  const patch = {
    guest_message_limit: body.guest_message_limit,
    guest_window_hours: body.guest_window_hours,
    system_prompt: body.system_prompt.trim(),
    max_context_dishes: body.max_context_dishes,
  };
  const settings = await updateSettings(patch, req.user.id);
  recordAuditLog(req.user, 'chatbot.settings_update', 'app_settings', null, patch);
  const { updated_by: _u, ...data } = publicSettings(settings);
  return sendOk(res, data);
}

/**
 * 4.12.6 Gắn cờ câu trả lời không phù hợp – PATCH /admin/chatbot/messages/:messageId/flag { flagged, reason }
 */
export async function adminFlagMessage(req, res) {
  const flagged = parseBool(req.body?.flagged);
  if (flagged === undefined) {
    return sendError(res, 422, 'VALIDATION_ERROR', 'flagged phải là boolean.', [
      { field: 'flagged', code: 'INVALID_VALUE', message: 'true | false' },
    ]);
  }
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim().slice(0, 500) : null;

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .update(flagged
      ? { flagged: true, flag_reason: reason, flagged_by: req.user.id, flagged_at: new Date().toISOString() }
      : { flagged: false, flag_reason: null, flagged_by: null, flagged_at: null })
    .eq('id', req.params.messageId)
    .select('id, flagged, flag_reason')
    .maybeSingle();
  if (error) throw error;
  if (!data) return sendError(res, 404, 'MESSAGE_NOT_FOUND', 'Tin nhắn không tồn tại.');

  recordAuditLog(req.user, flagged ? 'chatbot.flag' : 'chatbot.unflag', 'chat_message', data.id, { reason });
  return sendOk(res, data);
}

const STOP_WORDS = new Set(['toi', 'minh', 'ban', 'la', 'cho', 'co', 'khong', 'gi', 'nao', 'the', 'va', 'voi', 'cua', 'nhe', 'a', 'oi', 'di', 'duoc', 'nen', 'muon', 'can', 'hay']);

/**
 * 4.12.7 Câu hỏi thường gặp – GET /admin/chatbot/frequent-questions?limit=&from=&to=
 * Gom câu hỏi theo bộ từ khóa chính (bỏ dấu, bỏ từ dừng); question là câu gốc xuất hiện nhiều nhất trong nhóm.
 */
export async function adminGetFrequentQuestions(req, res) {
  const range = parseDateRange(req.query);
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1) return sendError(res, 400, 'INVALID_QUERY', 'limit không hợp lệ.');

  const questions = await fetchAll(() => supabaseAdmin
    .from('chat_messages')
    .select('content')
    .eq('role', 'user')
    .gte('created_at', range.fromIso)
    .lte('created_at', range.toIso));

  const groups = new Map();
  for (const { content } of questions) {
    const words = normalizeText(content).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
    const key = [...new Set(words)].sort().slice(0, 6).join(' ');
    if (!key) continue;
    const g = groups.get(key) || { count: 0, samples: new Map() };
    g.count += 1;
    const text = content.trim();
    g.samples.set(text, (g.samples.get(text) || 0) + 1);
    groups.set(key, g);
  }

  const data = [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.min(limit, 50))
    .map((g) => ({ question: [...g.samples.entries()].sort((a, b) => b[1] - a[1])[0][0], count: g.count }));
  return sendOk(res, data);
}

/**
 * 4.12.8 Tình trạng dịch vụ AI – GET /admin/chatbot/health. Dịch vụ không phản hồi vẫn trả 200 với status = down.
 */
export async function adminGetChatbotHealth(req, res) {
  const model = env.gemini.model;
  const started = Date.now();
  let status = 'down';
  if (env.gemini.apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, {
        headers: { 'x-goog-api-key': env.gemini.apiKey },
        signal: controller.signal,
      });
      status = response.ok ? 'up' : 'down';
    } catch {
      status = 'down';
    } finally {
      clearTimeout(timer);
    }
  }
  return sendOk(res, { status, latency_ms: Date.now() - started, model, checked_at: new Date().toISOString() });
}
