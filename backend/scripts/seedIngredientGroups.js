// scripts/seedIngredientGroups.js
// Nạp nhóm nguyên liệu (bảng ingredient_parents) cho dữ liệu hiện có, theo danh sách đã rà soát tay bên dưới.
// Người dùng kiêng nguyên liệu gốc (Tôm) thì mọi nguyên liệu trong nhóm (Tôm sú tươi, Mắm tôm, Mắm ruốc Huế…) bị loại.
//
// Chạy thử (chỉ in kế hoạch, không ghi):  node scripts/seedIngredientGroups.js
// Ghi vào CSDL:                           node scripts/seedIngredientGroups.js --apply
// Cần có bảng ingredient_parents (schema_chatbot_am_thuc.sql). Chạy lại nhiều lần không sao (chỉ thêm phần còn thiếu).

import { supabaseAdmin } from '../src/config/supabase.js';

const APPLY = process.argv.includes('--apply');

// Nguyên liệu gốc chưa có trong CSDL thì tạo mới
const NEW_ROOTS = [
  { name: 'Cua', allergen: 'seafood', aliases: ['cua biển', 'cua đồng'] },
  { name: 'Mực', allergen: 'seafood', aliases: ['mực ống', 'mực lá'] },
  { name: 'Hàu', allergen: 'seafood', aliases: [] },
  { name: 'Cá', allergen: null, aliases: [] },
  { name: 'Trứng', allergen: 'egg', aliases: [] },
  { name: 'Đậu phộng', allergen: 'peanut', aliases: ['lạc', 'đậu phọng'] },
  { name: 'Đậu nành', allergen: 'soy', aliases: [] },
  // Không đặt tên "Mè": bỏ dấu thành "me", trùng tên chuẩn hóa với "Mẻ"
  { name: 'Vừng', allergen: 'sesame', aliases: ['mè'] },
  { name: 'Nấm', allergen: null, aliases: [] },
  { name: 'Hành', allergen: null, aliases: [] },
];

// "trứng" đang là tên gọi khác của Trứng gà, chuyển sang nguyên liệu gốc Trứng
const REMOVE_ALIASES = { 'Trứng gà': ['trứng'] };

// Sửa nhóm dị ứng còn thiếu của một số nguyên liệu
const ALLERGEN_FIXES = { 'Nghêu': 'seafood', 'Thịt hến làm sẵn': 'seafood', 'Bạch tuộc tươi': 'seafood' };

// Nguyên liệu gốc → các nguyên liệu thuộc nhóm. Nhóm lồng nhau được (Mắm tôm ngon → Mắm tôm → Tôm).
const GROUPS = {
  'Tôm': ['mì tôm', 'Mắm ruốc Huế', 'Mắm tôm', 'Tôm tươi', 'Tôm sú tươi'],
  'Mắm tôm': ['Mắm tôm ngon'],
  'Cua': ['Cua đồng xay', 'Thịt cua biển', 'Thịt cua gỡ sẵn', 'Thịt cua bể'],
  'Mực': ['Mực tươi', 'Mực một nắng', 'Mực ống tươi'],
  'Nghêu': ['Ngao (nghêu) tươi', 'Nghêu tươi'],
  'Hàu': ['Ruột hàu sữa tươi', 'Dầu hào'],
  'Dầu hào': ['Dầu hào, nước tương', 'Nước tương, dầu hào'],
  'Cá': ['Cá hồi', 'Chả cá Nha Trang', 'Cá thu', 'Cá lóc', 'Cá bống tươi', 'Cá nục tươi', 'Đầu và thân cá',
    'Cá diêu hồng', 'Phi lê cá lăng', 'Khô cá sặc', 'Cá chép tươi', 'Mắm cá linh', 'Nước mắm'],
  'Cá lóc': ['Cá lóc đồng'],
  'Cá thu': ['Cá thu cắt khúc'],
  'Nước mắm': ['Nước mắm, đường', 'Nước mắm, chanh, đường', 'Nước mắm, mật ong, tỏi', 'Chanh, nước mắm',
    'Rau sống, nước mắm chua ngọt', 'Nước mắm, đường, giấm'],
  'Thịt bò': ['Bắp bò', 'Thịt nạm bò', 'Thịt thăn bò', 'Xương ống bò', 'Thịt bò nạm gân', 'Thịt bò bằm'],
  'Thịt heo': ['Giò heo', 'Thịt ba chỉ', 'Thịt nạc vai xay', 'Xương ống heo', 'Thịt heo bằm', 'Thịt heo quay',
    'Xương heo', 'Sườn non heo', 'Giò sống', 'Thịt đùi heo', 'Tóp mỡ giòn', 'Thịt mỡ heo', 'Sườn heo',
    'Thịt nạc vai heo', 'Thịt heo xay', 'Sườn cốt lết', 'Sườn cốt lết heo', 'Thịt nạc vai giòn', 'Gan heo, đậu phộng',
    'Mỡ heo hạt lựu', 'Tai heo', 'Bì heo trộn thính', 'Lạp xưởng', 'Chả lụa, giá đỗ', 'Chả lá lốt',
    'Thịt bằm và trứng (làm chả)'],
  'Giò heo': ['Giò heo chặt khoanh'],
  'Thịt heo xay': ['Thịt heo xay có mỡ'],
  'Thịt gà': ['Thịt gà ta', 'Lòng mề gà', 'Cánh gà', 'Gà ta nguyên con'],
  'Trứng': ['Trứng gà', 'Trứng cút', 'Trứng vịt', 'Trứng bắc thảo', 'Thịt bằm và trứng (làm chả)', 'Tương ớt, mayonnaise'],
  'Đậu phộng': ['Đậu phộng rang', 'Gan heo, đậu phộng', 'Tương đen, đậu phộng', 'Đậu phộng, rau răm', 'Hành phi, đậu phộng'],
  'Đậu nành': ['Đậu phụ', 'Nước tương', 'Tương đen, đậu phộng'],
  'Đậu phụ': ['Đậu hũ trắng', 'Đậu hũ non', 'Đậu hũ chiên'],
  'Nước tương': ['Dầu hào, nước tương', 'Nước tương, dầu hào'],
  'Vừng': ['Mè trắng', 'Dầu mè', 'Rau thơm, mè rang'],
  'Nấm': ['Nấm hương', 'Nấm kim châm', 'Nấm đùi gà', 'Nấm rơm', 'Mộc nhĩ'],
  'Nấm hương': ['Nấm hương khô', 'Nấm đông cô tươi', 'Mộc nhĩ, nấm hương'],
  'Nấm rơm': ['Nấm rơm tươi'],
  'Mộc nhĩ': ['Mộc nhĩ, nấm hương', 'Mộc nhĩ, miến'],
  'Hành': ['Hành tây', 'Hành lá', 'Hành tím', 'Hành khô', 'Hành boa-rô'],
  'Hành lá': ['Hành lá, thì là', 'Hành lá, rau răm', 'Tỏi, hành lá', 'Hành lá, ngò rí', 'Bột nghệ, hành lá', 'Thì là, hành hoa'],
  'Hành tím': ['Hành phi', 'Sả, tỏi, hành tím', 'Hành tím, tỏi'],
  'Hành phi': ['Hành phi, đậu phộng'],
  'Tỏi': ['Tỏi phi', 'Tỏi, ớt', 'Sả, tỏi, hành tím', 'Hành tím, tỏi', 'Sả, tỏi', 'Chanh, ớt, tỏi', 'Chanh, tỏi, ớt',
    'Nước mắm, mật ong, tỏi', 'Tỏi, gừng', 'Tỏi, hành lá'],
  'Ớt': ['Ớt sa tế', 'Ớt hiểm', 'Tương ớt', 'Tỏi, ớt', 'Chanh, ớt, tỏi', 'Chanh, sả, ớt', 'Chanh, tỏi, ớt',
    'Đường, ớt', 'Đường, chanh, ớt', 'Ớt, tiêu xay'],
  'Ớt hiểm': ['Ớt hiểm đỏ'],
  'Tương ớt': ['Tương ớt, mayonnaise'],
  'Chanh': ['Chanh, ớt, tỏi', 'Nước mắm, chanh, đường', 'Chanh, sả, ớt', 'Chanh, tỏi, ớt', 'Chanh hoặc tắc',
    'Đường, chanh, ớt', 'Muối, tiêu, chanh', 'Muối tiêu chanh', 'Chanh, nước mắm'],
  'Sả': ['Sả cây', 'Sả, tỏi, hành tím', 'Sả, tỏi', 'Chanh, sả, ớt'],
  'Gừng': ['Tỏi, gừng'],
  'Đường': ['Nước mắm, đường', 'Nước mắm, chanh, đường', 'Đường, ớt', 'Đường, chanh, ớt', 'Nước mắm, đường, giấm', 'Đường phèn'],
  'Mật ong': ['Nước mắm, mật ong, tỏi'],
  'Muối': ['Muối hạt', 'Muối, tiêu, chanh', 'Muối tiêu chanh'],
  'Tiêu xay': ['Tiêu đen xay', 'Muối, tiêu, chanh', 'Muối tiêu chanh', 'Ớt, tiêu xay'],
  'Rau răm': ['Rau răm, thì là', 'Hành lá, rau răm', 'Rau răm, dưa leo', 'Đậu phộng, rau răm'],
  'Thì là': ['Rau răm, thì là', 'Hành lá, thì là', 'Thì là, hành hoa'],
  'Ngò rí': ['Hành lá, ngò rí'],
  'Hẹ': ['Lá hẹ', 'Xà lách, hẹ, rau thơm'],
  'Dưa leo': ['Rau răm, dưa leo', 'Dưa leo, rau kinh giới', 'Đồ chua, dưa leo'],
  'Cà rốt': ['Đu đủ xanh, cà rốt', 'Đậu Hà Lan, cà rốt, bắp', 'Cà rốt, đậu cô ve'],
  'Đậu cô ve': ['Cà rốt, đậu cô ve'],
  'Đu đủ xanh': ['Đu đủ xanh, cà rốt'],
  'Giá đỗ': ['Giá đỗ, củ đậu', 'Chả lụa, giá đỗ'],
  'Bắp cải': ['Bắp cải trắng', 'Bắp cải trắng và tím', 'Lá bắp cải to'],
  'Bột nghệ': ['Bột nghệ, hành lá'],
  'Ngũ vị hương': ['Bột ngũ vị hương'],
  'Gạo tẻ': ['Gạo tẻ ngon'],
  'Cơm nguội': ['Cơm nguội hạt tơi'],
  'Hạt sen': ['Hạt sen tươi'],
  'Lá chanh': ['Lá chanh tươi'],
};

const key = (s) => String(s ?? '').normalize('NFC').trim().toLowerCase();

const [ingRes, groupRes, linkRes] = await Promise.all([
  supabaseAdmin.from('ingredients').select('id, name, aliases, allergen_group_id').order('id'),
  supabaseAdmin.from('allergen_groups').select('id, code, name'),
  supabaseAdmin.from('ingredient_parents').select('ingredient_id, parent_id'),
]);
for (const r of [ingRes, groupRes]) if (r.error) { console.error(r.error.message); process.exit(1); }
if (linkRes.error) {
  if (APPLY) {
    console.error('Chưa có bảng ingredient_parents – hãy tạo bảng theo schema_chatbot_am_thuc.sql trước.');
    process.exit(1);
  }
  console.warn('(Chưa có bảng ingredient_parents – chạy thử như thể bảng đang trống.)\n');
}
const groupByCode = new Map(groupRes.data.map((g) => [g.code, g]));
const groupById = new Map(groupRes.data.map((g) => [g.id, g]));
const byName = new Map(ingRes.data.map((i) => [key(i.name), i]));
const existingLinks = new Set((linkRes.data || []).map((l) => `${l.ingredient_id}>${l.parent_id}`));

// Kiểm tra mọi tên trong danh sách đều có (hoặc sẽ được tạo)
const newRootKeys = new Set(NEW_ROOTS.map((r) => key(r.name)));
const missing = new Set();
for (const [root, members] of Object.entries(GROUPS)) {
  for (const n of [root, ...members]) if (!byName.has(key(n)) && !newRootKeys.has(key(n))) missing.add(n);
}
if (missing.size) {
  console.error('Không tìm thấy nguyên liệu:', [...missing].join(', '));
  process.exit(1);
}

const rootsToCreate = NEW_ROOTS.filter((r) => !byName.has(key(r.name)));
console.log(`Nguyên liệu gốc tạo mới (${rootsToCreate.length}): ${rootsToCreate.map((r) => r.name).join(', ') || '—'}`);
for (const [n, aliases] of Object.entries(REMOVE_ALIASES)) console.log(`Bỏ tên gọi khác của ${n}: ${aliases.join(', ')}`);
for (const [n, code] of Object.entries(ALLERGEN_FIXES)) console.log(`Gán nhóm dị ứng ${n}: ${groupByCode.get(code).name}`);
console.log('\nNhóm nguyên liệu:');
for (const [root, members] of Object.entries(GROUPS)) console.log(`  ${root}  ←  ${members.join(' | ')}`);

if (!APPLY) {
  console.log('\nChạy thử: chưa ghi gì. Thêm --apply để ghi vào CSDL.');
  process.exit(0);
}

// 1. Tạo nguyên liệu gốc còn thiếu
if (rootsToCreate.length) {
  const { data, error } = await supabaseAdmin.from('ingredients').insert(rootsToCreate.map((r) => ({
    name: r.name,
    default_unit: 'g',
    allergen_group_id: r.allergen ? groupByCode.get(r.allergen).id : null,
    aliases: r.aliases,
    is_common: true,
    needs_review: false,
  }))).select('id, name, aliases, allergen_group_id');
  if (error) { console.error('Lỗi tạo nguyên liệu gốc:', error.message); process.exit(1); }
  data.forEach((i) => byName.set(key(i.name), i));
}

// 2. Bỏ tên gọi khác đã chuyển sang nguyên liệu gốc, sửa nhóm dị ứng
for (const [n, aliases] of Object.entries(REMOVE_ALIASES)) {
  const ing = byName.get(key(n));
  const remove = new Set(aliases.map(key));
  const kept = (ing.aliases || []).filter((a) => !remove.has(key(a)));
  if (kept.length !== (ing.aliases || []).length) {
    const { error } = await supabaseAdmin.from('ingredients').update({ aliases: kept }).eq('id', ing.id);
    if (error) { console.error(`Lỗi sửa tên gọi khác của ${n}:`, error.message); process.exit(1); }
  }
}
for (const [n, code] of Object.entries(ALLERGEN_FIXES)) {
  const ing = byName.get(key(n));
  const gid = groupByCode.get(code).id;
  if (ing.allergen_group_id === gid) continue;
  const { error } = await supabaseAdmin.from('ingredients').update({ allergen_group_id: gid }).eq('id', ing.id);
  if (error) { console.error(`Lỗi gán nhóm dị ứng ${n}:`, error.message); process.exit(1); }
  ing.allergen_group_id = gid;
}

// 3. Thêm liên kết nhóm còn thiếu
const links = [];
for (const [root, members] of Object.entries(GROUPS)) {
  const pid = Number(byName.get(key(root)).id);
  for (const m of members) {
    const id = Number(byName.get(key(m)).id);
    if (!existingLinks.has(`${id}>${pid}`)) links.push({ ingredient_id: id, parent_id: pid });
  }
}
if (links.length) {
  const { error } = await supabaseAdmin.from('ingredient_parents').upsert(links, { onConflict: 'ingredient_id,parent_id', ignoreDuplicates: true });
  if (error) { console.error('Lỗi thêm nhóm nguyên liệu:', error.message); process.exit(1); }
}

// 4. Nguyên liệu chưa có nhóm dị ứng nhận nhóm của nguyên liệu gốc gần nhất (Mắm tôm → Hải sản có vỏ)
const parentsOf = new Map();
for (const [root, members] of Object.entries(GROUPS)) {
  const pid = Number(byName.get(key(root)).id);
  for (const m of members) {
    const id = Number(byName.get(key(m)).id);
    if (!parentsOf.has(id)) parentsOf.set(id, []);
    parentsOf.get(id).push(pid);
  }
}
const byId = new Map([...byName.values()].map((i) => [Number(i.id), i]));
const nearestGroup = (id) => {
  const seen = new Set([id]);
  let level = parentsOf.get(id) || [];
  while (level.length) {
    const hit = level.map((p) => byId.get(p)?.allergen_group_id).find((g) => g != null);
    if (hit != null) return hit;
    level = level.flatMap((p) => parentsOf.get(p) || []).filter((p) => !seen.has(p) && seen.add(p));
  }
  return null;
};
let inherited = 0;
for (const id of parentsOf.keys()) {
  const ing = byId.get(id);
  if (ing.allergen_group_id != null) continue;
  const gid = nearestGroup(id);
  if (gid == null) continue;
  const { error } = await supabaseAdmin.from('ingredients').update({ allergen_group_id: gid }).eq('id', id);
  if (error) { console.error(`Lỗi gán nhóm dị ứng ${ing.name}:`, error.message); process.exit(1); }
  console.log(`  ${ing.name} nhận nhóm dị ứng "${groupById.get(gid).name}"`);
  inherited++;
}

console.log(`\nXong: tạo ${rootsToCreate.length} nguyên liệu gốc, thêm ${links.length} liên kết nhóm, ${inherited} nguyên liệu nhận nhóm dị ứng.`);
console.log('Khởi động lại backend (hoặc chờ 60 giây) để bộ nhớ đệm cập nhật.');
