// src/services/imageStorageService.js
// Lưu ảnh món ăn vào bucket "dishes" của Supabase Storage: ảnh Admin tải lên và ảnh tải về từ link khi nhập file

import sharp from 'sharp';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/appConfig.js';
import { inspectImage } from '../utils/image.js';

const BUCKET = 'dishes';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15 * 1000;
// Ảnh món hiển thị lớn nhất ở khung chi tiết món (~1000px); lớn hơn chỉ làm trang tải chậm
const MAX_IMAGE_WIDTH = 1000;
const WEBP_QUALITY = 75;

/**
 * Xoay theo EXIF, thu về tối đa MAX_IMAGE_WIDTH px và chuyển sang WEBP.
 * Ảnh hỏng hoặc bản nén không nhỏ hơn thì giữ nguyên bản gốc.
 */
async function optimizeDishImage(buffer, info) {
  try {
    const out = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    if (out.length < buffer.length) return { buffer: out, info: { ...info, mime: 'image/webp', ext: 'webp' } };
  } catch (err) {
    console.warn('[Storage] Không nén được ảnh, dùng bản gốc:', err.message);
  }
  return { buffer, info };
}

/** Nén rồi tải bộ đệm ảnh đã kiểm tra (`info` từ inspectImage) lên bucket, trả về địa chỉ công khai. */
export async function uploadDishImage(original, originalInfo) {
  const { buffer, info } = await optimizeDishImage(original, originalInfo);
  const path = `dish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${info.ext}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, { contentType: info.mime });
  if (error) throw error;
  const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return { url: publicUrl, path };
}

/** Xóa các ảnh vừa tải lên (dùng khi hoàn tác thao tác nhập). */
export async function removeDishImages(paths) {
  if (paths.length === 0) return;
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths);
  if (error) console.warn('[Storage] Không xóa được ảnh khi hoàn tác:', error.message);
}

/** Link đã trỏ tới bucket ảnh món của hệ thống thì không cần tải lại. */
export function isOwnDishImageUrl(url) {
  return url.startsWith(`${env.supabase.url.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/`);
}

/** Đọc nội dung phản hồi, dừng ngay khi vượt quá giới hạn dung lượng. */
async function readLimited(res) {
  const declared = Number(res.headers.get('content-length'));
  if (declared > MAX_IMAGE_BYTES) return null;
  const chunks = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.length;
    if (total > MAX_IMAGE_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Tải ảnh từ `url` rồi lưu vào bucket. Chỉ nhận JPG/PNG/WEBP (nhận diện theo nội dung tệp), tối đa 5 MB.
 * Trả về { url, path } khi thành công, hoặc { error } mô tả lý do thất bại.
 */
export async function importRemoteDishImage(url) {
  let res;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      headers: { Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8' },
    });
  } catch (err) {
    return { error: err.name === 'TimeoutError' ? 'quá thời gian tải ảnh' : 'không tải được ảnh' };
  }
  if (!res.ok) return { error: `máy chủ ảnh trả về lỗi ${res.status}` };

  const buffer = await readLimited(res).catch(() => undefined);
  if (buffer === undefined) return { error: 'không tải được ảnh' };
  if (buffer === null) return { error: 'ảnh vượt quá 5 MB' };

  const info = inspectImage(buffer);
  if (!info) return { error: 'không phải ảnh JPG, PNG hoặc WEBP' };

  try {
    return await uploadDishImage(buffer, info);
  } catch (err) {
    return { error: `không lưu được ảnh vào Storage (${err.message})` };
  }
}
