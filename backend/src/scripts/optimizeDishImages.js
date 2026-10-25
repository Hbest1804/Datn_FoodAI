// src/scripts/optimizeDishImages.js
// Nén lại ảnh món đã có trong bucket "dishes" (thu về tối đa 1000px, WEBP) để trang người dùng tải nhanh hơn.
//   npm run images:optimize            → chạy thử, chỉ báo dung lượng tiết kiệm
//   npm run images:optimize -- --apply → tải bản nén lên file mới và đổi dishes.image_url
// Ảnh gốc được giữ nguyên trong bucket; dòng "old → new" in ra dùng để khôi phục nếu cần.

import { supabaseAdmin } from '../config/supabase.js';
import { isOwnDishImageUrl, optimizeDishImage, uploadDishImage } from '../services/imageStorageService.js';
import { inspectImage } from '../utils/image.js';

const apply = process.argv.includes('--apply');
const kb = (n) => `${Math.round(n / 1024)} KB`;

async function run() {
  // Trigger đặt lại updated_at khi sửa món: xử lý theo updated_at tăng dần để giữ thứ tự "Mới cập nhật"
  const { data: dishes, error } = await supabaseAdmin
    .from('dishes')
    .select('id, name, image_url')
    .not('image_url', 'is', null)
    .order('updated_at', { ascending: true });
  if (error) throw error;

  const targets = dishes.filter((d) => isOwnDishImageUrl(d.image_url) && !d.image_url.endsWith('.webp'));
  console.log(`${apply ? '' : '[Chạy thử] '}${targets.length}/${dishes.length} món có ảnh cần nén.\n`);

  let before = 0;
  let after = 0;
  let changed = 0;
  for (const dish of targets) {
    try {
      const res = await fetch(dish.image_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const info = inspectImage(buffer);
      if (!info) throw new Error('không phải ảnh JPG/PNG/WEBP');

      const optimized = await optimizeDishImage(buffer, info);
      before += buffer.length;
      after += optimized.buffer.length;
      if (optimized.buffer === buffer) {
        console.log(`= ${dish.name}: giữ nguyên (${kb(buffer.length)})`);
        continue;
      }
      console.log(`- ${dish.name}: ${kb(buffer.length)} → ${kb(optimized.buffer.length)}`);
      if (!apply) continue;

      const { url } = await uploadDishImage(buffer, info);
      const { error: updErr } = await supabaseAdmin.from('dishes').update({ image_url: url }).eq('id', dish.id);
      if (updErr) throw updErr;
      changed++;
      console.log(`    ${dish.id}: ${dish.image_url} → ${url}`);
    } catch (err) {
      console.warn(`! ${dish.name}: bỏ qua (${err.message})`);
    }
  }

  console.log(`\nTổng: ${kb(before)} → ${kb(after)}${apply ? `; đã cập nhật ${changed} món.` : '. Thêm --apply để lưu.'}`);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
