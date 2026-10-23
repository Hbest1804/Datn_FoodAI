// src/scripts/seedDatabase.js
// Nạp toàn bộ dữ liệu mẫu (Master data + Món ăn + Công thức + Nguyên liệu) vào Supabase theo Schema v3

import { supabaseAdmin } from '../config/supabase.js';

async function seed() {
  console.log('🚀 Bắt đầu nạp dữ liệu mẫu vào Supabase...\n');

  // 1. REGIONS (Nạp nếu bảng regions tồn tại)
  try {
    console.log('📍 1. Đang nạp Regions...');
    const regionsData = [
      { code: 'north', name: 'Miền Bắc' },
      { code: 'central', name: 'Miền Trung' },
      { code: 'south', name: 'Miền Nam' },
    ];
    const { data: regions, error: regErr } = await supabaseAdmin
      .from('regions')
      .upsert(regionsData, { onConflict: 'code' })
      .select();
    if (!regErr && regions) {
      console.log(`   ✅ Đã nạp ${regions.length} vùng miền.`);
    }
  } catch (err) {
    console.log('   ℹ️ Bỏ qua nạp regions (không bắt buộc trong schema v3).');
  }

  // 2. CATEGORIES
  try {
    console.log('📁 2. Đang nạp Categories...');
    const categoriesData = [
      { name: 'Món nước', slug: 'mon-nuoc' },
      { name: 'Món xào', slug: 'mon-xao' },
      { name: 'Món kho', slug: 'mon-kho' },
      { name: 'Món canh', slug: 'mon-canh' },
      { name: 'Món nướng / chiên', slug: 'mon-nuong-chien' },
      { name: 'Món gỏi / nộm', slug: 'mon-goi-nom' },
      { name: 'Món tráng miệng', slug: 'mon-trang-mieng' },
      { name: 'Đồ uống', slug: 'do-uong' },
    ];
    const { data: categories, error: catErr } = await supabaseAdmin
      .from('categories')
      .upsert(categoriesData, { onConflict: 'slug' })
      .select();
    if (!catErr && categories) {
      console.log(`   ✅ Đã nạp ${categories.length} danh mục món ăn.`);
    }
  } catch (err) {
    console.log('   ℹ️ Bỏ qua categories.');
  }

  // 3. TAGS (Bao gồm id chỉ định rõ để tránh lỗi NOT NULL constraint)
  console.log('🏷️  3. Đang nạp Tags...');
  const tagsData = [
    { id: 1, name: 'Cay' },
    { id: 2, name: 'Chua ngọt' },
    { id: 3, name: 'Thanh đạm' },
    { id: 4, name: 'Bổ dưỡng' },
    { id: 5, name: 'Nhanh gọn' },
    { id: 6, name: 'Tiết kiệm' },
    { id: 7, name: 'Dễ làm' },
    { id: 8, name: 'Đặc sản' },
  ];
  const { data: tags, error: tagErr } = await supabaseAdmin
    .from('tags')
    .upsert(tagsData, { onConflict: 'name' })
    .select();
  if (tagErr) throw new Error(`Lỗi tags: ${tagErr.message}`);
  const tagMap = Object.fromEntries(tags.map(t => [t.name, t.id]));
  console.log(`   ✅ Đã nạp ${tags.length} tags.`);

  // 4. DIET TYPES
  console.log('🥗 4. Đang nạp Diet Types...');
  const dietData = [
    { id: 1, code: 'normal', name: 'Bình thường' },
    { id: 2, code: 'eat_clean', name: 'Eat Clean' },
    { id: 3, code: 'vegetarian', name: 'Ăn chay' },
    { id: 4, code: 'vegan', name: 'Thuần chay' },
    { id: 5, code: 'keto', name: 'Keto / Low-Carb' },
    { id: 6, code: 'high_protein', name: 'Tăng cơ (High Protein)' },
    { id: 7, code: 'low_sugar', name: 'Tiểu đường / Ít đường' },
  ];
  const { error: dietErr } = await supabaseAdmin
    .from('diet_types')
    .upsert(dietData, { onConflict: 'code' });
  if (dietErr) throw new Error(`Lỗi diet_types: ${dietErr.message}`);
  console.log(`   ✅ Đã nạp ${dietData.length} chế độ ăn.`);

  // 5. ALLERGEN GROUPS
  console.log('⚠️  5. Đang nạp Allergen Groups...');
  const allergenData = [
    { id: 1, code: 'seafood', name: 'Hải sản có vỏ' },
    { id: 2, code: 'peanut', name: 'Đậu phộng' },
    { id: 3, code: 'dairy', name: 'Sữa bò / Lactose' },
    { id: 4, code: 'gluten', name: 'Gluten' },
    { id: 5, code: 'egg', name: 'Trứng' },
    { id: 6, code: 'soy', name: 'Đậu nành' },
    { id: 7, code: 'sesame', name: 'Vừng mè' },
  ];
  const { data: allergens, error: algErr } = await supabaseAdmin
    .from('allergen_groups')
    .upsert(allergenData, { onConflict: 'code' })
    .select();
  if (algErr) throw new Error(`Lỗi allergen_groups: ${algErr.message}`);
  const algMap = Object.fromEntries(allergens.map(a => [a.code, a.id]));
  console.log(`   ✅ Đã nạp ${allergens.length} nhóm dị ứng.`);

  // 6. INGREDIENTS
  console.log('🥩 6. Đang nạp Ingredients...');
  const ingredientsData = [
    { name: 'Thịt bò', default_unit: 'g', aliases: ['thịt bò', 'thit bo', 'bò'], is_common: true, allergen_group_id: null },
    { name: 'Thịt heo', default_unit: 'g', aliases: ['thịt lợn', 'thit heo', 'thit lon', 'heo', 'lợn'], is_common: true, allergen_group_id: null },
    { name: 'Thịt gà', default_unit: 'g', aliases: ['thit ga', 'gà'], is_common: true, allergen_group_id: null },
    { name: 'Trứng gà', default_unit: 'quả', aliases: ['trung ga', 'trứng'], is_common: true, allergen_group_id: algMap['egg'] },
    { name: 'Tôm', default_unit: 'g', aliases: ['tom', 'tôm sú', 'tôm thẻ'], is_common: true, allergen_group_id: algMap['seafood'] },
    { name: 'Cá hồi', default_unit: 'g', aliases: ['ca hoi'], is_common: false, allergen_group_id: algMap['seafood'] },
    { name: 'Đậu phụ', default_unit: 'bìa', aliases: ['dau phu', 'đậu hũ', 'dau hu'], is_common: false, allergen_group_id: algMap['soy'] },
    { name: 'Cà chua', default_unit: 'quả', aliases: ['ca chua'], is_common: true, allergen_group_id: null },
    { name: 'Khoai tây', default_unit: 'củ', aliases: ['khoai tay'], is_common: true, allergen_group_id: null },
    { name: 'Hành tây', default_unit: 'củ', aliases: ['hanh tay'], is_common: true, allergen_group_id: null },
    { name: 'Hành lá', default_unit: 'nhánh', aliases: ['hanh la'], is_common: true, allergen_group_id: null },
    { name: 'Tỏi', default_unit: 'tép', aliases: ['toi'], is_common: true, allergen_group_id: null },
    { name: 'Ớt', default_unit: 'quả', aliases: ['ot'], is_common: true, allergen_group_id: null },
    { name: 'Gừng', default_unit: 'củ', aliases: ['gung'], is_common: false, allergen_group_id: null },
    { name: 'Cà rốt', default_unit: 'củ', aliases: ['ca rot'], is_common: true, allergen_group_id: null },
    { name: 'Nấm hương', default_unit: 'g', aliases: ['nam huong', 'nấm đông cô'], is_common: false, allergen_group_id: null },
    { name: 'Rau muống', default_unit: 'bó', aliases: ['rau muong'], is_common: false, allergen_group_id: null },
    { name: 'Bắp cải', default_unit: 'bắp', aliases: ['bap cai'], is_common: false, allergen_group_id: null },
    { name: 'Chanh', default_unit: 'quả', aliases: ['chanh'], is_common: false, allergen_group_id: null },
    { name: 'Nước mắm', default_unit: 'thìa canh', aliases: ['nuoc mam'], is_common: false, allergen_group_id: null },
  ];
  const { data: ingredients, error: ingErr } = await supabaseAdmin
    .from('ingredients')
    .upsert(ingredientsData, { onConflict: 'name' })
    .select();
  if (ingErr) throw new Error(`Lỗi ingredients: ${ingErr.message}`);
  const ingMap = Object.fromEntries(ingredients.map(i => [i.name, i.id]));
  console.log(`   ✅ Đã nạp ${ingredients.length} nguyên liệu.`);

  // 7. DISHES
  console.log('🍲 7. Đang nạp Món ăn (Dishes)...');
  const dishesDefinition = [
    {
      name: 'Phở Bò Tái Lăn Hà Nội Chuẩn Vị',
      slug: 'pho-bo-tai-lan-ha-noi',
      description: 'Bánh phở mềm mượt, thịt bò thăn thái mỏng xào lăn thơm nức mùi gừng tỏi cháy cạnh, chan nước dùng ninh xương ống thơm hồi quế.',
      image_url: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=1000&q=80',
      category: 'Món nước',
      cook_time_minutes: 45,
      difficulty: 'medium',
      servings: 2,
      est_cost: 75000,
      calories: 510,
      protein_g: 34,
      carbs_g: 62,
      fat_g: 14,
      steps: [
        { order: 1, content: 'Thịt bò thái thật mỏng ngang thớ. Gừng đập dập, tỏi băm nhỏ. Ướp thịt bò với 1 thìa nước mắm, tiêu và nửa phần gừng tỏi.' },
        { order: 2, content: 'Đun sôi nồi nước dùng bò thảo mộc, giữ nóng liu riu trên bếp.' },
        { order: 3, content: 'Làm nóng chảo lớn với dầu ăn, phi thơm gừng tỏi còn lại rồi cho thịt bò vào xào lăn lửa lớn trong 1 phút vừa chín tới.' },
        { order: 4, content: 'Trần bánh phở qua nước sôi, xếp vào tô, cho thịt bò xào lăn, hành tây thái mỏng và hành lá lên trên rồi chan nước dùng thật sôi.' },
      ],
    },
    {
      name: 'Cá Hồi Áp Chảo Măng Tây Sốt Chanh Bơ',
      slug: 'ca-hoi-ap-chao-mang-tay',
      description: 'Phi lê cá hồi tươi áp chảo giòn da mềm ngọt thịt, sốt chanh bơ tỏi thơm ngậy, món ăn thanh đạm giàu omega 3.',
      image_url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1000&q=80',
      category: 'Món nướng / chiên',
      cook_time_minutes: 15,
      difficulty: 'easy',
      servings: 2,
      est_cost: 150000,
      calories: 420,
      protein_g: 38,
      carbs_g: 8,
      fat_g: 26,
      steps: [
        { order: 1, content: 'Rửa sạch cá hồi, dùng khăn giấy thấm thật khô bề mặt thịt và da. Rắc chút muối tiêu lên 2 mặt cá, ướp 5 phút.' },
        { order: 2, content: 'Làm nóng chảo với dầu ô liu ở lửa vừa-lớn. Áp chảo mặt da trong 4 phút cho vàng giòn rụm rồi lật mặt áp tiếp 3 phút.' },
        { order: 3, content: 'Hạ nhỏ lửa, cho tỏi băm và nước cốt chanh vào chảo rưới đều lên mặt cá trước khi tắt bếp.' },
      ],
    },
    {
      name: 'Bò Xào Hành Tây Cần Tỏi',
      slug: 'bo-xao-hanh-tay-can-toi',
      description: 'Thịt bò xào mềm ngọt tự nhiên kết hợp cùng hành tây giòn thơm, dậy mùi thơm của tỏi phi, bữa cơm gia đình nhanh gọn.',
      image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=80',
      category: 'Món xào',
      cook_time_minutes: 15,
      difficulty: 'easy',
      servings: 2,
      est_cost: 60000,
      calories: 320,
      protein_g: 28,
      carbs_g: 12,
      fat_g: 16,
      steps: [
        { order: 1, content: 'Thịt bò thái mỏng ướp với tỏi băm, hạt nêm, tiêu và 1 thìa dầu ăn cho mềm.' },
        { order: 2, content: 'Hành tây bóc vỏ bổ múi cau, tỏi đập dập.' },
        { order: 3, content: 'Phi thơm tỏi, xào thịt bò trên lửa lớn vừa chín tái thì trút ra đĩa riêng.' },
        { order: 4, content: 'Xào hành tây chín tới rồi đổ thịt bò vào đảo nhanh tay 30 giây, nêm nước mắm vừa ăn rồi tắt bếp.' },
      ],
    },
    {
      name: 'Thịt Heo Kho Trứng Cút Đậm Đà',
      slug: 'thit-heo-kho-trung-cut',
      description: 'Món thịt kho trứng truyền thống màu nâu cánh gián óng ả, thịt ba chỉ béo ngậy mềm tan cùng trứng thơm bùi ngấm vị.',
      image_url: 'https://images.unsplash.com/photo-1514944298352-fa5a5658e265?auto=format&fit=crop&w=1000&q=80',
      category: 'Món kho',
      cook_time_minutes: 40,
      difficulty: 'medium',
      servings: 4,
      est_cost: 65000,
      calories: 480,
      protein_g: 32,
      carbs_g: 6,
      fat_g: 36,
      steps: [
        { order: 1, content: 'Thịt heo cắt miếng vuông vừa ăn, luộc sơ qua nước sôi để khử mùi hôi.' },
        { order: 2, content: 'Trứng luộc chín, bóc sạch vỏ.' },
        { order: 3, content: 'Thắng nước màu đường cánh gián, cho tỏi băm vào phi thơm rồi trút thịt heo vào xào săn.' },
        { order: 4, content: 'Thêm nước mắm, nước sôi ngập thịt, cho trứng vào kho lửa nhỏ 25 phút đến khi nước cạn sánh.' },
      ],
    },
    {
      name: 'Canh Cà Chua Trứng (Canh Mây)',
      slug: 'canh-ca-chua-trung-canh-may',
      description: 'Món canh thanh ngọt giải nhiệt, vân trứng vàng óng bồng bềnh như mây, vị chua dịu nhẹ của cà chua tươi.',
      image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=1000&q=80',
      category: 'Món canh',
      cook_time_minutes: 10,
      difficulty: 'easy',
      servings: 2,
      est_cost: 20000,
      calories: 150,
      protein_g: 13,
      carbs_g: 8,
      fat_g: 8,
      steps: [
        { order: 1, content: 'Cà chua rửa sạch bổ múi cau. Hành lá cắt nhỏ. Đập trứng vào bát đánh tan nhẹ.' },
        { order: 2, content: 'Phi thơm đầu hành, xào cà chua mềm ra màu đỏ đẹp rồi đổ 600ml nước vào đun sôi.' },
        { order: 3, content: 'Nêm nước mắm vừa ăn, từ từ rót trứng vào nồi đồng thời khuấy nhẹ theo một chiều tạo vân mây.' },
        { order: 4, content: 'Rắc hành lá tiêu thơm rồi tắt bếp múc ra tô.' },
      ],
    },
    {
      name: 'Tôm Rim Mặn Ngọt Đậm Đà',
      slug: 'tom-rim-man-ngot',
      description: 'Tôm tươi rim vàng óng, vỏ giòn ngọt thịt ngấm vị mặn mòi của nước mắm thơm lừng và ngọt ngào vị đường thắng.',
      image_url: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=1000&q=80',
      category: 'Món kho',
      cook_time_minutes: 20,
      difficulty: 'easy',
      servings: 3,
      est_cost: 80000,
      calories: 230,
      protein_g: 26,
      carbs_g: 5,
      fat_g: 10,
      steps: [
        { order: 1, content: 'Tôm rửa sạch cắt râu và ngạnh, để ráo nước.' },
        { order: 2, content: 'Phi thơm tỏi băm, cho tôm vào đảo đều tay đến khi tôm chuyển màu đỏ au săn lại.' },
        { order: 3, content: 'Thêm hỗn hợp nước mắm, đường, tiêu và rim lửa nhỏ đến khi nước sốt keo bám bóng quanh mình tôm.' },
        { order: 4, content: 'Rắc hành lá thái nhỏ và ớt xắt lên trên rồi tắt bếp.' },
      ],
    },
    {
      name: 'Gà Xào Nấm Hương Gừng Tươi',
      slug: 'ga-xao-nam-huong-gung',
      description: 'Thịt gà ta săn ngọt xào cùng nấm hương thơm lừng và gừng cay ấm, món ăn bổ dưỡng thích hợp cho cả gia đình.',
      image_url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1000&q=80',
      category: 'Món xào',
      cook_time_minutes: 20,
      difficulty: 'easy',
      servings: 3,
      est_cost: 55000,
      calories: 310,
      protein_g: 35,
      carbs_g: 6,
      fat_g: 14,
      steps: [
        { order: 1, content: 'Thịt gà chặt miếng vừa ăn, ướp với nước mắm, gừng thái chỉ và tiêu.' },
        { order: 2, content: 'Nấm hương ngâm nở, rửa sạch cắt chân và khía hoa.' },
        { order: 3, content: 'Phi tỏi thơm, xào thịt gà săn rồi cho nấm hương vào xào chung trên lửa vừa.' },
        { order: 4, content: 'Nêm lại gia vị cho vừa miệng, rắc hành lá đảo đều rồi tắt bếp.' },
      ],
    },
    {
      name: 'Rau Muống Xào Tỏi Xanh Mướt',
      slug: 'rau-muong-xao-toi',
      description: 'Rau muống non giòn ngọt xào lửa lớn giữ trọn màu xanh mướt mát, thơm nức mùi tỏi phi giòn tan.',
      image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1000&q=80',
      category: 'Món xào',
      cook_time_minutes: 8,
      difficulty: 'easy',
      servings: 2,
      est_cost: 15000,
      calories: 95,
      protein_g: 4,
      carbs_g: 6,
      fat_g: 6,
      steps: [
        { order: 1, content: 'Rau muống nhặt sạch lá úa, rửa nhiều lần với nước rồi để ráo.' },
        { order: 2, content: 'Tỏi bóc vỏ đập dập. Chần sơ rau muống qua nước sôi 30 giây rồi vớt ra ngâm nước đá lạnh.' },
        { order: 3, content: 'Phi vàng tỏi, cho rau muống vào xào lửa lớn đảo nhanh tay trong 2 phút.' },
        { order: 4, content: 'Nêm 1 thìa nước mắm ngon, rắc thêm tỏi phi thơm lên mặt rồi trút ra đĩa thưởng thức.' },
      ],
    },
    {
      name: 'Đậu Phụ Sốt Cà Chua Hành Lá',
      slug: 'dau-phu-sot-ca-chua',
      description: 'Miếng đậu phụ rán vàng giòn ngập trong sốt cà chua sánh mịn chua ngọt thanh tao, thơm dịu hương hành lá.',
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=80',
      category: 'Món kho',
      cook_time_minutes: 15,
      difficulty: 'easy',
      servings: 2,
      est_cost: 20000,
      calories: 180,
      protein_g: 14,
      carbs_g: 9,
      fat_g: 10,
      steps: [
        { order: 1, content: 'Đậu phụ cắt miếng vuông vừa ăn, rán vàng đều các mặt.' },
        { order: 2, content: 'Cà chua băm nhỏ xào nhừ tạo sốt sánh mịn.' },
        { order: 3, content: 'Cho đậu phụ đã rán vào chảo sốt cà chua, nêm nước mắm rim nhỏ lửa 3 phút cho ngấm đều.' },
        { order: 4, content: 'Rắc hành lá thái nhỏ lên trên rồi tắt bếp.' },
      ],
    },
    {
      name: 'Bò Hầm Khoai Tây Cà Rốt',
      slug: 'bo-ham-khoai-tay-ca-rot',
      description: 'Thịt bò dẻ sườn hầm mềm tan trong miệng, khoai tây và cà rốt bở bùi ngọt tự nhiên, nước canh sóng sánh thơm lừng.',
      image_url: 'https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=1000&q=80',
      category: 'Món canh',
      cook_time_minutes: 50,
      difficulty: 'medium',
      servings: 3,
      est_cost: 85000,
      calories: 420,
      protein_g: 30,
      carbs_g: 35,
      fat_g: 16,
      steps: [
        { order: 1, content: 'Thịt bò cắt khối vuông ướp gừng, tỏi và nước mắm 15 phút.' },
        { order: 2, content: 'Khoai tây, cà rốt gọt vỏ cắt miếng vừa ăn ngâm nước muối loãng.' },
        { order: 3, content: 'Xào săn thịt bò rồi đổ 800ml nước ninh nhỏ lửa 30 phút cho thịt mềm.' },
        { order: 4, content: 'Cho khoai tây, cà rốt vào hầm thêm 15 phút đến khi bở bùi, nêm nếm lại gia vị rồi tắt bếp.' },
      ],
    },
    {
      name: 'Bún Bò Huế Cay Nồng Đậm Đà',
      slug: 'bun-bo-hue-cay-nong',
      description: 'Tô bún bò xứ Huế trứ danh với nước dùng cay nồng hương sả ớt, màu điều đỏ rực rỡ, thịt bò mềm ngọt hòa quyện cùng mùi mắm ruốc đặc trưng.',
      image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1000&q=80',
      category: 'Món nước',
      cook_time_minutes: 60,
      difficulty: 'hard',
      servings: 4,
      est_cost: 95000,
      calories: 580,
      protein_g: 38,
      carbs_g: 65,
      fat_g: 18,
      steps: [
        { order: 1, content: 'Thịt bắp bò và giò heo rửa sạch, luộc sơ rồi rửa lại nước lạnh cho sạch bọt.' },
        { order: 2, content: 'Ninh thịt với gừng, hành tây và nước sôi trong 40 phút cho mềm ngọt.' },
        { order: 3, content: 'Phi dầu màu điều với tỏi, sả và ớt bột cho thơm cay nồng rồi trút vào nồi nước dùng.' },
        { order: 4, content: 'Xếp bún vào tô, thêm thịt thái lát, rắc hành lá hành tây rồi chan nước dùng nóng hổi, ăn kèm chanh ớt.' },
      ],
    },
  ];

  // Nạp món ăn với is_published = false để tránh vi phạm trigger check_published_has_recipe
  const dishesPayload = dishesDefinition.map(({ steps, ...rest }) => ({
    ...rest,
    is_published: false,
  }));

  const { data: dishes, error: dishErr } = await supabaseAdmin
    .from('dishes')
    .upsert(dishesPayload, { onConflict: 'slug' })
    .select();
  if (dishErr) throw new Error(`Lỗi dishes: ${dishErr.message}`);
  const dishMap = Object.fromEntries(dishes.map(d => [d.slug, d.id]));
  console.log(`   ✅ Đã nạp ${dishes.length} món ăn vào bảng dishes.`);

  // 8. DISH TAGS
  console.log('🏷️  8. Đang nạp Dish Tags...');
  const dishTagsPairs = [
    { slug: 'pho-bo-tai-lan-ha-noi', tags: ['Bổ dưỡng', 'Đặc sản'] },
    { slug: 'ca-hoi-ap-chao-mang-tay', tags: ['Thanh đạm', 'Bổ dưỡng', 'Nhanh gọn'] },
    { slug: 'bo-xao-hanh-tay-can-toi', tags: ['Nhanh gọn', 'Dễ làm'] },
    { slug: 'thit-heo-kho-trung-cut', tags: ['Tiết kiệm', 'Đặc sản'] },
    { slug: 'canh-ca-chua-trung-canh-may', tags: ['Thanh đạm', 'Nhanh gọn', 'Tiết kiệm', 'Dễ làm'] },
    { slug: 'tom-rim-man-ngot', tags: ['Cay', 'Nhanh gọn', 'Dễ làm'] },
    { slug: 'ga-xao-nam-huong-gung', tags: ['Bổ dưỡng', 'Dễ làm'] },
    { slug: 'rau-muong-xao-toi', tags: ['Thanh đạm', 'Nhanh gọn', 'Tiết kiệm', 'Dễ làm'] },
    { slug: 'dau-phu-sot-ca-chua', tags: ['Thanh đạm', 'Tiết kiệm', 'Dễ làm'] },
    { slug: 'bo-ham-khoai-tay-ca-rot', tags: ['Bổ dưỡng', 'Đặc sản'] },
    { slug: 'bun-bo-hue-cay-nong', tags: ['Cay', 'Bổ dưỡng', 'Đặc sản'] },
  ];
  const dishTagsData = [];
  for (const item of dishTagsPairs) {
    const dishId = dishMap[item.slug];
    if (!dishId) continue;
    for (const tagName of item.tags) {
      const tagId = tagMap[tagName];
      if (tagId) {
        dishTagsData.push({ dish_id: dishId, tag_id: tagId });
      }
    }
  }
  const { error: dtErr } = await supabaseAdmin
    .from('dish_tags')
    .upsert(dishTagsData, { onConflict: 'dish_id,tag_id' });
  if (dtErr) throw new Error(`Lỗi dish_tags: ${dtErr.message}`);
  console.log(`   ✅ Đã nạp ${dishTagsData.length} liên kết tag cho món ăn.`);

  // 9. RECIPE STEPS (Bảng recipe_steps chuẩn v3)
  console.log('📝 9. Đang nạp Recipe Steps...');
  const recipeStepsData = [];
  for (const item of dishesDefinition) {
    const dishId = dishMap[item.slug];
    if (!dishId || !item.steps) continue;
    for (const s of item.steps) {
      recipeStepsData.push({
        dish_id: dishId,
        step_order: s.order,
        content: s.content,
      });
    }
  }
  const { error: stepErr } = await supabaseAdmin
    .from('recipe_steps')
    .upsert(recipeStepsData, { onConflict: 'dish_id,step_order' });
  if (stepErr) throw new Error(`Lỗi recipe_steps: ${stepErr.message}`);
  console.log(`   ✅ Đã nạp ${recipeStepsData.length} bước thực hiện công thức.`);

  // 10. DISH INGREDIENTS
  console.log('🧂 10. Đang nạp Dish Ingredients...');
  const dishIngRaw = [
    // Phở Bò Tái Lăn Hà Nội
    ['pho-bo-tai-lan-ha-noi', 'Thịt bò', 250, 'g', false],
    ['pho-bo-tai-lan-ha-noi', 'Hành lá', 50, 'g', false],
    ['pho-bo-tai-lan-ha-noi', 'Hành tây', 1, 'củ', false],
    ['pho-bo-tai-lan-ha-noi', 'Gừng', 1, 'củ', false],
    ['pho-bo-tai-lan-ha-noi', 'Tỏi', 3, 'tép', false],
    ['pho-bo-tai-lan-ha-noi', 'Nước mắm', 2, 'thìa canh', false],
    ['pho-bo-tai-lan-ha-noi', 'Ớt', 1, 'quả', true],
    ['pho-bo-tai-lan-ha-noi', 'Chanh', 1, 'quả', true],

    // Cá Hồi Áp Chảo
    ['ca-hoi-ap-chao-mang-tay', 'Cá hồi', 300, 'g', false],
    ['ca-hoi-ap-chao-mang-tay', 'Tỏi', 3, 'tép', false],
    ['ca-hoi-ap-chao-mang-tay', 'Chanh', 1, 'quả', false],

    // Bò Xào Hành Tây
    ['bo-xao-hanh-tay-can-toi', 'Thịt bò', 200, 'g', false],
    ['bo-xao-hanh-tay-can-toi', 'Hành tây', 1, 'củ', false],
    ['bo-xao-hanh-tay-can-toi', 'Tỏi', 4, 'tép', false],
    ['bo-xao-hanh-tay-can-toi', 'Nước mắm', 1, 'thìa canh', false],
    ['bo-xao-hanh-tay-can-toi', 'Ớt', 1, 'quả', true],

    // Thịt Heo Kho Trứng Cút
    ['thit-heo-kho-trung-cut', 'Thịt heo', 400, 'g', false],
    ['thit-heo-kho-trung-cut', 'Trứng gà', 3, 'quả', false],
    ['thit-heo-kho-trung-cut', 'Tỏi', 3, 'tép', false],
    ['thit-heo-kho-trung-cut', 'Nước mắm', 3, 'thìa canh', false],
    ['thit-heo-kho-trung-cut', 'Hành lá', 2, 'nhánh', true],
    ['thit-heo-kho-trung-cut', 'Ớt', 2, 'quả', true],

    // Canh Cà Chua Trứng
    ['canh-ca-chua-trung-canh-may', 'Cà chua', 2, 'quả', false],
    ['canh-ca-chua-trung-canh-may', 'Trứng gà', 2, 'quả', false],
    ['canh-ca-chua-trung-canh-may', 'Hành lá', 2, 'nhánh', false],
    ['canh-ca-chua-trung-canh-may', 'Nước mắm', 1, 'thìa canh', false],

    // Tôm Rim Mặn Ngọt
    ['tom-rim-man-ngot', 'Tôm', 300, 'g', false],
    ['tom-rim-man-ngot', 'Tỏi', 3, 'tép', false],
    ['tom-rim-man-ngot', 'Hành lá', 2, 'nhánh', false],
    ['tom-rim-man-ngot', 'Nước mắm', 2, 'thìa canh', false],
    ['tom-rim-man-ngot', 'Ớt', 1, 'quả', true],

    // Gà Xào Nấm Hương Gừng Tươi
    ['ga-xao-nam-huong-gung', 'Thịt gà', 350, 'g', false],
    ['ga-xao-nam-huong-gung', 'Nấm hương', 50, 'g', false],
    ['ga-xao-nam-huong-gung', 'Gừng', 1, 'củ', false],
    ['ga-xao-nam-huong-gung', 'Tỏi', 3, 'tép', false],
    ['ga-xao-nam-huong-gung', 'Hành lá', 2, 'nhánh', false],
    ['ga-xao-nam-huong-gung', 'Nước mắm', 1.5, 'thìa canh', false],

    // Rau Muống Xào Tỏi
    ['rau-muong-xao-toi', 'Rau muống', 1, 'bó', false],
    ['rau-muong-xao-toi', 'Tỏi', 6, 'tép', false],
    ['rau-muong-xao-toi', 'Nước mắm', 1, 'thìa canh', false],
    ['rau-muong-xao-toi', 'Ớt', 1, 'quả', true],

    // Đậu Phụ Sốt Cà Chua
    ['dau-phu-sot-ca-chua', 'Đậu phụ', 3, 'bìa', false],
    ['dau-phu-sot-ca-chua', 'Cà chua', 3, 'quả', false],
    ['dau-phu-sot-ca-chua', 'Hành lá', 3, 'nhánh', false],
    ['dau-phu-sot-ca-chua', 'Nước mắm', 1.5, 'thìa canh', false],

    // Bò Hầm Khoai Tây Cà Rốt
    ['bo-ham-khoai-tay-ca-rot', 'Thịt bò', 300, 'g', false],
    ['bo-ham-khoai-tay-ca-rot', 'Khoai tây', 2, 'củ', false],
    ['bo-ham-khoai-tay-ca-rot', 'Cà rốt', 1, 'củ', false],
    ['bo-ham-khoai-tay-ca-rot', 'Hành tây', 1, 'củ', false],
    ['bo-ham-khoai-tay-ca-rot', 'Tỏi', 3, 'tép', false],
    ['bo-ham-khoai-tay-ca-rot', 'Gừng', 1, 'củ', false],
    ['bo-ham-khoai-tay-ca-rot', 'Nước mắm', 2, 'thìa canh', false],

    // Bún Bò Huế Cay Nồng
    ['bun-bo-hue-cay-nong', 'Thịt bò', 300, 'g', false],
    ['bun-bo-hue-cay-nong', 'Thịt heo', 200, 'g', false],
    ['bun-bo-hue-cay-nong', 'Ớt', 3, 'quả', false],
    ['bun-bo-hue-cay-nong', 'Hành lá', 3, 'nhánh', false],
    ['bun-bo-hue-cay-nong', 'Hành tây', 1, 'củ', false],
    ['bun-bo-hue-cay-nong', 'Tỏi', 4, 'tép', false],
    ['bun-bo-hue-cay-nong', 'Gừng', 1, 'củ', false],
    ['bun-bo-hue-cay-nong', 'Nước mắm', 2, 'thìa canh', false],
    ['bun-bo-hue-cay-nong', 'Chanh', 1, 'quả', true],
  ];

  const dishIngredientsData = [];
  for (const [slug, ingName, qty, unit, opt] of dishIngRaw) {
    const dishId = dishMap[slug];
    const ingId = ingMap[ingName];
    if (dishId && ingId) {
      dishIngredientsData.push({
        dish_id: dishId,
        ingredient_id: ingId,
        quantity: qty,
        unit,
        is_optional: opt,
      });
    }
  }

  const { error: diErr } = await supabaseAdmin
    .from('dish_ingredients')
    .upsert(dishIngredientsData, { onConflict: 'dish_id,ingredient_id' });
  if (diErr) throw new Error(`Lỗi dish_ingredients: ${diErr.message}`);
  console.log(`   ✅ Đã nạp ${dishIngredientsData.length} nguyên liệu cho các món ăn.`);

  // 11. CÔNG KHAI CÁC MÓN ĂN (Kích hoạt trigger check_published_has_recipe)
  console.log('🌟 11. Đang công khai tất cả món ăn (is_published = true)...');
  const allDishIds = Object.values(dishMap);
  const { error: pubErr } = await supabaseAdmin
    .from('dishes')
    .update({ is_published: true })
    .in('id', allDishIds);
  if (pubErr) throw new Error(`Lỗi công khai dishes: ${pubErr.message}`);
  console.log(`   ✅ Đã công khai thành công ${allDishIds.length} món ăn.`);

  console.log('\n🎉 NẠP TOÀN BỘ DỮ LIỆU THÀNH CÔNG VÀO SUPABASE!');
  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌ Thất bại khi nạp dữ liệu:', err);
  process.exit(1);
});
