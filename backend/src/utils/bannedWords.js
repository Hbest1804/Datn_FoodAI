// src/utils/bannedWords.js
// Kiểm duyệt bình luận theo bảng banned_words (mục 4.8.4 của tài liệu API)

import { supabaseAdmin } from '../config/supabase.js';

// Danh sách dự phòng khi bảng banned_words chưa có dữ liệu khởi tạo
const FALLBACK_WORDS = [
  'địt', 'đm', 'dcm', 'đcm', 'đkm', 'vcl', 'lồn', 'cặc', 'buồi', 'đéo', 'đếch',
  'chó chết', 'khốn nạn', 'đĩ', 'ngu lồn', 'óc chó',
  'bắn cá đổi thưởng', 'cá độ', 'đánh bạc', 'porn', 'fuck', 'shit', 'bitch', 'asshole',
];

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = null;

async function loadWords() {
  if (cache && cache.expiresAt > Date.now()) return cache.words;
  let words = FALLBACK_WORDS;
  const { data, error } = await supabaseAdmin.from('banned_words').select('word');
  if (!error && data && data.length > 0) words = data.map((r) => r.word);
  // So khớp trên chuỗi có dấu đã hạ chữ thường để không chặn nhầm từ không dấu trùng mặt chữ (vd "lon bia")
  const patterns = words
    .map((w) => String(w).trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean)
    .map((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u'));
  cache = { words: patterns, expiresAt: Date.now() + CACHE_TTL_MS };
  return patterns;
}

/**
 * Kiểm tra chuỗi có chứa từ ngữ bị cấm không (so khớp nguyên từ, hỗ trợ ký tự tiếng Việt)
 */
export async function containsBannedWords(text) {
  if (!text || typeof text !== 'string') return false;
  const patterns = await loadWords();
  const lowered = text.toLowerCase().normalize('NFC').replace(/\s+/g, ' ');
  return patterns.some((re) => re.test(lowered));
}
