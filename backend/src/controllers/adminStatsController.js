// src/controllers/adminStatsController.js
// Admin – Thống kê hệ thống (mục 4.13, 5.9). Mặc định 30 ngày gần nhất; không có dữ liệu thì trả 0/rỗng.

import fs from 'fs';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/appConfig.js';
import { fetchAll } from './adminChatbotController.js';
import { getGuestMessageCounts } from './guestChatController.js';
import { parseDateRange, sendError, sendOk } from '../utils/http.js';

const DAY_MS = 86400000;

function countIn(table, range, filter) {
  let q = supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
    .gte('created_at', range.fromIso).lte('created_at', range.toIso);
  if (filter) q = filter(q);
  return q.then(({ count, error }) => {
    if (error) throw error;
    return count || 0;
  });
}

function rowsIn(table, columns, range, filter) {
  return fetchAll(() => {
    let q = supabaseAdmin.from(table).select(columns).gte('created_at', range.fromIso).lte('created_at', range.toIso);
    if (filter) q = filter(q);
    return q;
  });
}

// ── Tính số liệu (dùng chung cho API và xuất báo cáo) ────────────────────────

async function computeOverview(range) {
  const [totalUsers, newUsers, totalDishes, publishedDishes, visits, favoritesNew, ratingsNew, sessions, messages, activity] = await Promise.all([
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).then((r) => r.count || 0),
    countIn('users', range),
    supabaseAdmin.from('dishes').select('*', { count: 'exact', head: true }).then((r) => r.count || 0),
    supabaseAdmin.from('dishes').select('*', { count: 'exact', head: true }).eq('is_published', true).then((r) => r.count || 0),
    countIn('interaction_logs', range, (q) => q.eq('event_type', 'page_view')),
    countIn('favorites', range),
    countIn('ratings', range),
    countIn('chat_sessions', range),
    countIn('chat_messages', range),
    // Người dùng hoạt động: có tương tác, hội thoại, đánh giá hoặc yêu thích trong kỳ
    Promise.all([
      rowsIn('interaction_logs', 'user_id', range, (q) => q.not('user_id', 'is', null)),
      fetchAll(() => supabaseAdmin.from('chat_sessions').select('user_id').gte('updated_at', range.fromIso).lte('updated_at', range.toIso)),
      rowsIn('ratings', 'user_id', range, (q) => q.not('user_id', 'is', null)),
      rowsIn('favorites', 'user_id', range),
    ]),
  ]);
  const activeUsers = new Set(activity.flat().map((r) => r.user_id)).size;
  return {
    range: { from: range.from, to: range.to },
    users: { total: totalUsers, new: newUsers, active: activeUsers },
    visits,
    dishes: { total: totalDishes, published: publishedDishes },
    favorites_new: favoritesNew,
    ratings_new: ratingsNew,
    chat: { sessions, messages },
  };
}

async function computeTopDishes(range, by, limit) {
  const [views, favs, ratings] = await Promise.all([
    rowsIn('interaction_logs', 'dish_id', range, (q) => q.eq('event_type', 'view').not('dish_id', 'is', null)),
    rowsIn('favorites', 'dish_id', range),
    rowsIn('ratings', 'dish_id, stars', range),
  ]);
  const stats = new Map();
  const get = (id) => {
    if (!stats.has(id)) stats.set(id, { views: 0, favorites: 0, starSum: 0, ratingCount: 0 });
    return stats.get(id);
  };
  views.forEach((v) => { get(v.dish_id).views += 1; });
  favs.forEach((f) => { get(f.dish_id).favorites += 1; });
  ratings.forEach((r) => { const s = get(r.dish_id); s.starSum += r.stars; s.ratingCount += 1; });

  const avg = (s) => (s.ratingCount ? Math.round((s.starSum / s.ratingCount) * 100) / 100 : 0);
  const sorters = {
    views: (a, b) => b[1].views - a[1].views,
    favorites: (a, b) => b[1].favorites - a[1].favorites,
    rating: (a, b) => avg(b[1]) - avg(a[1]) || b[1].ratingCount - a[1].ratingCount,
  };
  const metric = { views: 'views', favorites: 'favorites', rating: 'ratingCount' }[by];
  const top = [...stats.entries()].filter(([, s]) => s[metric] > 0).sort(sorters[by]).slice(0, limit);

  const ids = top.map(([id]) => id);
  const { data: dishes } = ids.length
    ? await supabaseAdmin.from('dishes').select('id, name, slug').in('id', ids)
    : { data: [] };
  const dishMap = new Map((dishes || []).map((d) => [d.id, d]));
  return top
    .filter(([id]) => dishMap.has(id))
    .map(([id, s], i) => ({ rank: i + 1, dish: dishMap.get(id), views: s.views, favorites: s.favorites, avg_rating: avg(s) }));
}

const METRICS = {
  users: { table: 'users' },
  visits: { table: 'interaction_logs', filter: (q) => q.eq('event_type', 'page_view') },
  searches: { table: 'interaction_logs', filter: (q) => q.eq('event_type', 'search') },
  favorites: { table: 'favorites' },
  ratings: { table: 'ratings' },
  chat_messages: { table: 'chat_messages' },
};

function bucketOf(dateStr, interval) {
  if (interval === 'month') return `${dateStr.slice(0, 7)}-01`;
  if (interval === 'week') {
    const d = new Date(`${dateStr}T00:00:00Z`);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS);
    return monday.toISOString().slice(0, 10);
  }
  return dateStr;
}

async function computeTimeseries(range, metric, interval) {
  const { table, filter } = METRICS[metric];
  const rows = await rowsIn(table, 'created_at', range, filter);
  const counts = new Map();
  for (let t = Date.parse(`${range.from}T00:00:00Z`); t <= Date.parse(`${range.to}T00:00:00Z`); t += DAY_MS) {
    counts.set(bucketOf(new Date(t).toISOString().slice(0, 10), interval), 0);
  }
  rows.forEach((r) => {
    const key = bucketOf(r.created_at.slice(0, 10), interval);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });
  return { metric, interval, points: [...counts.entries()].map(([date, value]) => ({ date, value })) };
}

function countKeywords(rows) {
  const counts = new Map();
  rows.forEach((r) => {
    const kw = String(r.context?.query || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (kw) counts.set(kw, (counts.get(kw) || 0) + 1);
  });
  return counts;
}

/** change_pct so với kỳ liền trước có cùng độ dài; null khi kỳ trước không có lượt tìm nào. */
async function computeSearchTrends(range, limit) {
  const lengthMs = Date.parse(range.toIso) - Date.parse(range.fromIso) + 1;
  const prevRange = {
    fromIso: new Date(Date.parse(range.fromIso) - lengthMs).toISOString(),
    toIso: new Date(Date.parse(range.fromIso) - 1).toISOString(),
  };
  const searchFilter = (q) => q.eq('event_type', 'search');
  const [cur, prev] = await Promise.all([
    rowsIn('interaction_logs', 'context', range, searchFilter),
    rowsIn('interaction_logs', 'context', prevRange, searchFilter),
  ]);
  const curCounts = countKeywords(cur);
  const prevCounts = countKeywords(prev);
  return [...curCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword, count]) => {
      const before = prevCounts.get(keyword) || 0;
      return { keyword, count, change_pct: before ? Math.round(((count - before) / before) * 1000) / 10 : null };
    });
}

async function computeChatbotUsage(range) {
  const [userMessages, sessions, tokens] = await Promise.all([
    countIn('chat_messages', range, (q) => q.eq('role', 'user')),
    countIn('chat_sessions', range),
    rowsIn('chat_messages', 'tokens', range, (q) => q.not('tokens', 'is', null)),
  ]);
  const sessionMessages = await countIn('chat_messages', range);
  return {
    guest_messages: getGuestMessageCounts(range.from, range.to).total,
    user_messages: userMessages,
    sessions,
    tokens_total: tokens.reduce((s, r) => s + (r.tokens || 0), 0),
    avg_messages_per_session: sessions ? Math.round((sessionMessages / sessions) * 10) / 10 : 0,
  };
}

function readLimit(query, def, max) {
  const limit = query.limit === undefined ? def : Number(query.limit);
  return Number.isInteger(limit) && limit >= 1 ? Math.min(limit, max) : null;
}

// ── Handlers ────────────────────────────────────────────────────────────────

/** 4.13.1 Thống kê tổng quan – GET /admin/stats/overview?from=&to= */
export async function adminGetStatsOverview(req, res) {
  return sendOk(res, await computeOverview(parseDateRange(req.query)));
}

/** 4.13.2 Món được xem/yêu thích nhiều – GET /admin/stats/top-dishes?by=&limit=&from=&to= */
export async function adminGetStatsTopDishes(req, res) {
  const range = parseDateRange(req.query);
  const by = req.query.by ?? 'views';
  if (!['views', 'favorites', 'rating'].includes(by)) return sendError(res, 400, 'INVALID_QUERY', 'by phải là views, favorites hoặc rating.');
  const limit = readLimit(req.query, 10, 50);
  if (!limit) return sendError(res, 400, 'INVALID_QUERY', 'limit không hợp lệ.');
  return sendOk(res, await computeTopDishes(range, by, limit));
}

/** 4.13.3 Biểu đồ theo thời gian – GET /admin/stats/timeseries?metric=&interval=&from=&to= */
export async function adminGetStatsTimeseries(req, res) {
  const range = parseDateRange(req.query);
  const { metric } = req.query;
  const interval = req.query.interval ?? 'day';
  if (!METRICS[metric] || !['day', 'week', 'month'].includes(interval)) {
    return sendError(res, 400, 'INVALID_QUERY', 'metric hoặc interval không hợp lệ.');
  }
  return sendOk(res, await computeTimeseries(range, metric, interval));
}

/** 4.13.4 Xu hướng tìm kiếm – GET /admin/stats/search-trends?limit=&from=&to= */
export async function adminGetStatsSearchTrends(req, res) {
  const range = parseDateRange(req.query);
  const limit = readLimit(req.query, 10, 50);
  if (!limit) return sendError(res, 400, 'INVALID_QUERY', 'limit không hợp lệ.');
  return sendOk(res, await computeSearchTrends(range, limit));
}

/** 5.9.1 Thống kê sử dụng chatbot – GET /admin/stats/chatbot-usage?from=&to= */
export async function adminGetStatsChatbotUsage(req, res) {
  return sendOk(res, await computeChatbotUsage(parseDateRange(req.query)));
}

// ── 4.13.5 Xuất báo cáo ─────────────────────────────────────────────────────

const REPORT_TITLES = {
  overview: 'Thống kê tổng quan',
  'top-dishes': 'Món được xem nhiều nhất',
  'search-trends': 'Xu hướng tìm kiếm',
  'chatbot-usage': 'Sử dụng chatbot',
};

/** Bảng [tiêu đề cột, ...dòng] cho từng loại báo cáo. */
async function buildReportTable(type, range) {
  if (type === 'overview') {
    const o = await computeOverview(range);
    return [['Chỉ số', 'Giá trị'],
      ['Tổng người dùng', o.users.total], ['Người dùng mới', o.users.new], ['Người dùng hoạt động', o.users.active],
      ['Lượt truy cập', o.visits], ['Tổng số món', o.dishes.total], ['Món đang hiển thị', o.dishes.published],
      ['Lượt yêu thích mới', o.favorites_new], ['Đánh giá mới', o.ratings_new],
      ['Hội thoại chatbot', o.chat.sessions], ['Tin nhắn chatbot', o.chat.messages]];
  }
  if (type === 'top-dishes') {
    const rows = await computeTopDishes(range, 'views', 50);
    return [['Hạng', 'Món', 'Lượt xem', 'Lượt yêu thích', 'Điểm TB'],
      ...rows.map((r) => [r.rank, r.dish.name, r.views, r.favorites, r.avg_rating])];
  }
  if (type === 'search-trends') {
    const rows = await computeSearchTrends(range, 50);
    return [['Từ khóa', 'Số lượt', 'Thay đổi (%)'], ...rows.map((r) => [r.keyword, r.count, r.change_pct ?? ''])];
  }
  const u = await computeChatbotUsage(range);
  return [['Chỉ số', 'Giá trị'],
    ['Tin nhắn của khách', u.guest_messages], ['Tin nhắn của người dùng', u.user_messages],
    ['Số hội thoại', u.sessions], ['Tổng token', u.tokens_total], ['Tin nhắn TB mỗi hội thoại', u.avg_messages_per_session]];
}

/** Chống CSV injection: thoát ô bắt đầu bằng = + - @ (lưu ý bảo mật 6). */
function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function findPdfFont() {
  const candidates = [
    'C:/Windows/Fonts/arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/Library/Fonts/Arial Unicode.ttf',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function renderPdf(title, range, table) {
  return new Promise((resolve, reject) => {
    const font = findPdfFont();
    if (!font) {
      reject(new Error('Không tìm thấy font hỗ trợ tiếng Việt (cần Arial hoặc DejaVu Sans trên máy chủ).'));
      return;
    }
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font(font);

    doc.fontSize(16).text(`Báo cáo: ${title}`);
    doc.fontSize(10).text(`Khoảng thời gian: ${range.from} – ${range.to}`).text(`Ngày xuất: ${new Date().toISOString().slice(0, 10)}`);
    doc.moveDown();

    const [header, ...rows] = table;
    const width = (doc.page.width - 80) / header.length;
    const drawRow = (cells, bold) => {
      if (doc.y > doc.page.height - 60) doc.addPage();
      const y = doc.y;
      let height = 0;
      cells.forEach((c, i) => {
        const h = doc.heightOfString(String(c ?? ''), { width: width - 6 });
        height = Math.max(height, h);
        doc.fontSize(bold ? 10 : 9).text(String(c ?? ''), 40 + i * width + 3, y + 3, { width: width - 6 });
      });
      doc.moveTo(40, y + height + 6).lineTo(doc.page.width - 40, y + height + 6).strokeColor('#cccccc').stroke();
      doc.y = y + height + 8;
    };
    drawRow(header, true);
    rows.forEach((r) => drawRow(r, false));
    if (rows.length === 0) doc.moveDown().text('Chưa có dữ liệu.');
    doc.end();
  });
}

/**
 * 4.13.5 Xuất báo cáo – GET /admin/stats/export?type=&format=csv|pdf&from=&to= (thêm xlsx cho bảng tính)
 */
export async function adminExportStats(req, res) {
  const range = parseDateRange(req.query);
  const { type, format } = req.query;
  if (!REPORT_TITLES[type] || !['csv', 'pdf', 'xlsx'].includes(format)) {
    return sendError(res, 400, 'INVALID_QUERY', 'type hoặc format không hợp lệ.');
  }

  let table;
  try {
    table = await buildReportTable(type, range);
  } catch (err) {
    console.error('[Export] Lỗi truy vấn số liệu:', err);
    return sendError(res, 500, 'EXPORT_FAILED', 'Không xuất được báo cáo. Vui lòng thử lại.');
  }
  const fileBase = `thong-ke-${type}-${range.from}_${range.to}`;

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.csv"`);
    return res.send(`\uFEFF${table.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`);
  }

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(table), 'Bao_cao');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.xlsx"`);
    return res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  try {
    const pdf = await renderPdf(REPORT_TITLES[type], range, table);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}.pdf"`);
    return res.send(pdf);
  } catch (err) {
    console.error('[Export] Lỗi sinh PDF:', err);
    return sendError(res, 500, 'EXPORT_FAILED', 'Không xuất được báo cáo PDF. Vui lòng thử lại.');
  }
}
