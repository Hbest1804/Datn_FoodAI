//   4.3.1 Tìm kiếm & lọc món ăn (GET /dishes)
//   4.3.2 Xem chi tiết món ăn & công thức (GET /dishes/:idOrSlug)

import { supabaseAdmin } from '../config/supabase.js';
import { matchesSearchKeyword } from '../utils/textUtils.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Helper phân tích và kiểm tra tính hợp lệ của danh sách số nguyên dạng chuỗi phân cách bởi dấu phẩy
 * Ví dụ: "1,2,5" -> [1, 2, 5]
 * Trả về null nếu định dạng không hợp lệ.
 */
function parseCommaSeparatedInts(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const numbers = [];
  for (const part of parts) {
    const num = Number(part);
    if (!Number.isInteger(num) || num <= 0) return null;
    numbers.push(num);
  }
  return numbers;
}

/**
 * 4.3.1 Tìm kiếm & lọc món ăn
 * GET /dishes hoặc /api/dishes
 */
export async function getDishes(req, res, next) {
  try {
    const {
      q,
      category_id,
      ingredient_ids,
      ingredient_match = 'any',
      min_match_ratio,
      exclude_ingredient_ids,
      tag_ids,
      max_cook_time,
      difficulty,
      max_calories,
      min_protein_g,
      max_carbs_g,
      max_fat_g,
      sort,
      page = 1,
      limit = 20
    } = req.query;

    // ── 1. Validate tham số truy vấn (trả 400 INVALID_QUERY nếu sai) ──────────

    const parsedCategoryId = category_id !== undefined ? Number(category_id) : undefined;
    if (parsedCategoryId !== undefined && (!Number.isInteger(parsedCategoryId) || parsedCategoryId <= 0)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
      });
    }

    let parsedIngredientIds = null;
    if (ingredient_ids !== undefined) {
      parsedIngredientIds = parseCommaSeparatedInts(ingredient_ids);
      if (!parsedIngredientIds) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
        });
      }
    }

    if (ingredient_match !== 'any' && ingredient_match !== 'all') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
      });
    }

    let parsedMinMatchRatio = undefined;
    if (min_match_ratio !== undefined) {
      parsedMinMatchRatio = Number(min_match_ratio);
      if (isNaN(parsedMinMatchRatio) || parsedMinMatchRatio < 0 || parsedMinMatchRatio > 1) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
        });
      }
    }

    let parsedExcludeIngredientIds = null;
    if (exclude_ingredient_ids !== undefined) {
      parsedExcludeIngredientIds = parseCommaSeparatedInts(exclude_ingredient_ids);
      if (!parsedExcludeIngredientIds) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
        });
      }
    }

    let parsedTagIds = null;
    if (tag_ids !== undefined) {
      parsedTagIds = parseCommaSeparatedInts(tag_ids);
      if (!parsedTagIds) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
        });
      }
    }

    const parsedMaxCookTime = max_cook_time !== undefined ? Number(max_cook_time) : undefined;
    if (parsedMaxCookTime !== undefined && (isNaN(parsedMaxCookTime) || parsedMaxCookTime < 0)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
      });
    }

    if (difficulty !== undefined && !['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
      });
    }

    const parsedMaxCalories = max_calories !== undefined ? Number(max_calories) : undefined;
    if (parsedMaxCalories !== undefined && (isNaN(parsedMaxCalories) || parsedMaxCalories < 0)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
      });
    }

    const parsedMinProtein = min_protein_g !== undefined ? Number(min_protein_g) : undefined;
    if (parsedMinProtein !== undefined && (isNaN(parsedMinProtein) || parsedMinProtein < 0)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
      });
    }

    const parsedMaxCarbs = max_carbs_g !== undefined ? Number(max_carbs_g) : undefined;
    if (parsedMaxCarbs !== undefined && (isNaN(parsedMaxCarbs) || parsedMaxCarbs < 0)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
      });
    }

    const parsedMaxFat = max_fat_g !== undefined ? Number(max_fat_g) : undefined;
    if (parsedMaxFat !== undefined && (isNaN(parsedMaxFat) || parsedMaxFat < 0)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
      });
    }

    const validSorts = ['relevance', 'match', 'newest', 'rating', 'popular', 'cook_time', 'calories'];
    if (sort !== undefined && !validSorts.includes(sort)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
      });
    }

    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
      });
    }

    const limitNum = Number(limit);
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Tham số lọc sai kiểu hoặc giá trị không hợp lệ.' }
      });
    }

    // ── 2. Truy vấn dữ liệu món ăn xuất bản cùng quan hệ qua SQL ─────────────
    let query = supabaseAdmin
      .from('dishes')
      .select(`
        id,
        name,
        slug,
        description,
        image_url,
        category,
        category_normalized,
        cook_time_minutes,
        difficulty,
        servings,
        est_cost,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        is_published,
        created_at,
        updated_at,
        dish_tags(tag:tags(id, name)),
        dish_ingredients(
          quantity,
          unit,
          is_optional,
          ingredient:ingredients(
            id,
            name,
            aliases,
            allergen_group:allergen_groups(id, name)
          )
        )
      `)
      .eq('is_published', true);

    // Chuyển trực tiếp các điều kiện lọc sang SQL
    if (parsedCategoryId !== undefined) {
      const { data: cat } = await supabaseAdmin
        .from('categories')
        .select('name')
        .eq('id', parsedCategoryId)
        .maybeSingle();
      if (cat) {
        query = query.eq('category', cat.name);
      }
    }
    if (difficulty !== undefined) {
      query = query.eq('difficulty', difficulty);
    }
    if (parsedMaxCookTime !== undefined) {
      query = query.lte('cook_time_minutes', parsedMaxCookTime);
    }
    if (parsedMaxCalories !== undefined) {
      query = query.lte('calories', parsedMaxCalories);
    }
    if (parsedMinProtein !== undefined) {
      query = query.gte('protein_g', parsedMinProtein);
    }
    if (parsedMaxCarbs !== undefined) {
      query = query.lte('carbs_g', parsedMaxCarbs);
    }
    if (parsedMaxFat !== undefined) {
      query = query.lte('fat_g', parsedMaxFat);
    }

    if (sort === 'cook_time') {
      query = query.order('cook_time_minutes', { ascending: true });
    } else if (sort === 'calories') {
      query = query.order('calories', { ascending: true });
    } else if (sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    }

    const { data: rawDishes, error: dishesErr } = await query;
    if (dishesErr) throw dishesErr;

    // ── 3. Lấy thông tin ratings và favorites cho người dùng (nếu có) ─────────
    const allDishIds = (rawDishes || []).map((d) => d.id);
    const [ratingsRes, favsRes] = await Promise.all([
      allDishIds.length > 0
        ? supabaseAdmin.from('ratings').select('dish_id, stars').in('dish_id', allDishIds)
        : { data: [] },
      allDishIds.length > 0
        ? supabaseAdmin.from('favorites').select('dish_id, user_id').in('dish_id', allDishIds)
        : { data: [] }
    ]);

    const ratingsMap = new Map();
    (ratingsRes.data || []).forEach((r) => {
      if (!ratingsMap.has(r.dish_id)) {
        ratingsMap.set(r.dish_id, { count: 0, sum: 0 });
      }
      const entry = ratingsMap.get(r.dish_id);
      entry.count += 1;
      entry.sum += r.stars;
    });

    const favsMap = new Map();
    const userFavSet = new Set();
    const currentUserId = req.user?.id;

    (favsRes.data || []).forEach((f) => {
      favsMap.set(f.dish_id, (favsMap.get(f.dish_id) || 0) + 1);
      if (currentUserId && f.user_id === currentUserId) {
        userFavSet.add(f.dish_id);
      }
    });

    // ── 4. Áp dụng các bộ lọc còn lại (chỉ những gì không thể push xuống SQL) ──
    // Lưu ý: region, category, difficulty, cook_time, calories, protein, carbs, fat
    // đã được lọc bằng .eq()/.lte()/.gte() ở bước 2 → không lặp lại ở đây.
    const keyword = typeof q === 'string' ? q.trim() : '';

    const filtered = (rawDishes || []).filter((dish) => {
      // Lọc theo tags (khẩu vị, đặc sản...) — không hỗ trợ trực tiếp trên Supabase filter
      const dishTagIds = (dish.dish_tags || []).map((dt) => dt.tag?.id).filter(Boolean);
      if (parsedTagIds && parsedTagIds.length > 0) {
        const hasAllTags = parsedTagIds.every((tid) => dishTagIds.includes(tid));
        if (!hasAllTags) return false;
      }

      // Lọc loại trừ nguyên liệu (NOT IN trên nested relation — cần xử lý ở JS)
      const dishIngredients = dish.dish_ingredients || [];
      if (parsedExcludeIngredientIds && parsedExcludeIngredientIds.length > 0) {
        const hasExcluded = dishIngredients.some((di) =>
          parsedExcludeIngredientIds.includes(di.ingredient?.id)
        );
        if (hasExcluded) return false;
      }

      // Tìm kiếm từ khóa q: tên món, mô tả, hoặc tên/bí danh nguyên liệu (bỏ dấu)
      if (keyword) {
        const matchName = matchesSearchKeyword(dish.name, keyword);
        const matchDesc = matchesSearchKeyword(dish.description, keyword);
        const matchIng = dishIngredients.some((di) => {
          const ingName = di.ingredient?.name;
          if (matchesSearchKeyword(ingName, keyword)) return true;
          const aliases = di.ingredient?.aliases || [];
          return aliases.some((al) => matchesSearchKeyword(al, keyword));
        });

        if (!matchName && !matchDesc && !matchIng) return false;
      }

      // Lọc theo tủ lạnh / danh sách nguyên liệu có sẵn
      if (parsedIngredientIds && parsedIngredientIds.length > 0) {
        const dishIngIds = dishIngredients.map((di) => di.ingredient?.id).filter(Boolean);
        const matchedIngIds = dishIngIds.filter((id) => parsedIngredientIds.includes(id));

        if (ingredient_match === 'all') {
          const hasAll = parsedIngredientIds.every((id) => dishIngIds.includes(id));
          if (!hasAll) return false;
        } else {
          if (matchedIngIds.length === 0) return false;
        }
      }

      return true;
    });

    // ── 5. Tính toán match (cho Tủ lạnh thông minh) & gắn rating/favorite ─────
    const hasIngredientFilter = Boolean(parsedIngredientIds && parsedIngredientIds.length > 0);

    const enrichedDishes = filtered.map((dish) => {
      const rInfo = ratingsMap.get(dish.id) || { count: 0, sum: 0 };
      const avg_rating = rInfo.count > 0 ? Math.round((rInfo.sum / rInfo.count) * 10) / 10 : 0;
      const rating_count = rInfo.count;
      const favorite_count = favsMap.get(dish.id) || 0;
      const is_favorite = userFavSet.has(dish.id);

      let matchData = null;
      if (hasIngredientFilter) {
        const dishIngredients = dish.dish_ingredients || [];
        const matched = dishIngredients.filter((di) =>
          parsedIngredientIds.includes(di.ingredient?.id)
        );
        const matched_count = matched.length;

        // Các nguyên liệu bắt buộc (is_optional = false) bị thiếu
        const essentialMissing = dishIngredients.filter(
          (di) => !di.is_optional && !parsedIngredientIds.includes(di.ingredient?.id)
        );
        const missing_ingredients = essentialMissing
          .map((di) => di.ingredient?.name)
          .filter(Boolean);
        const missing_count = missing_ingredients.length;

        const essentialCount = dishIngredients.filter((di) => !di.is_optional).length;
        const matchedEssentialCount = dishIngredients.filter(
          (di) => !di.is_optional && parsedIngredientIds.includes(di.ingredient?.id)
        ).length;

        const ratio =
          essentialCount > 0
            ? Math.round((matchedEssentialCount / essentialCount) * 100) / 100
            : 1;

        matchData = {
          matched_count,
          missing_count,
          ratio,
          missing_ingredients
        };
      }

      return {
        id: dish.id,
        name: dish.name,
        slug: dish.slug,
        description: dish.description,
        image_url: dish.image_url,
        region: dish.region ? { id: dish.region.id, name: dish.region.name } : null,
        category: typeof dish.category === 'object' ? dish.category : (dish.category ? { name: dish.category } : null),
        cook_time_minutes: dish.cook_time_minutes,
        difficulty: dish.difficulty,
        calories: dish.calories,
        avg_rating,
        rating_count,
        favorite_count,
        is_favorite,
        ...(matchData ? { match: matchData } : {}),
        created_at: dish.created_at
      };
    });

    // Lọc theo min_match_ratio nếu có
    let finalDishes = enrichedDishes;
    if (hasIngredientFilter && parsedMinMatchRatio !== undefined) {
      finalDishes = finalDishes.filter((d) => d.match && d.match.ratio >= parsedMinMatchRatio);
    }

    // ── 6. Sắp xếp kết quả ───────────────────────────────────────────────────
    let activeSort = sort;
    if (!activeSort) {
      if (keyword) {
        activeSort = 'relevance';
      } else if (hasIngredientFilter) {
        activeSort = 'match';
      } else {
        activeSort = 'newest';
      }
    }

    finalDishes.sort((a, b) => {
      if (activeSort === 'match') {
        const ratioDiff = (b.match?.ratio || 0) - (a.match?.ratio || 0);
        if (ratioDiff !== 0) return ratioDiff;
        return (b.match?.matched_count || 0) - (a.match?.matched_count || 0);
      }
      if (activeSort === 'rating') {
        const rDiff = b.avg_rating - a.avg_rating;
        if (rDiff !== 0) return rDiff;
        return b.rating_count - a.rating_count;
      }
      if (activeSort === 'popular') {
        const popA = a.rating_count + a.favorite_count;
        const popB = b.rating_count + b.favorite_count;
        return popB - popA;
      }
      if (activeSort === 'cook_time') {
        return (a.cook_time_minutes ?? 999) - (b.cook_time_minutes ?? 999);
      }
      if (activeSort === 'calories') {
        return (a.calories ?? 9999) - (b.calories ?? 9999);
      }
      if (activeSort === 'relevance') {
        if (keyword) {
          const aNameMatch = matchesSearchKeyword(a.name, keyword);
          const bNameMatch = matchesSearchKeyword(b.name, keyword);
          if (aNameMatch && !bNameMatch) return -1;
          if (!aNameMatch && bNameMatch) return 1;
        }
        if (hasIngredientFilter) {
          const ratioDiff = (b.match?.ratio || 0) - (a.match?.ratio || 0);
          if (ratioDiff !== 0) return ratioDiff;
        }
        return new Date(b.created_at) - new Date(a.created_at);
      }
      // Mặc định: newest
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // ── 7. Phân trang ────────────────────────────────────────────────────────
    const total = finalDishes.length;
    const totalPages = Math.ceil(total / limitNum);
    const paginatedData = finalDishes.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Chuẩn bị suggestions và suggest_ai
    let suggestions = [];
    if (total === 0) {
      const { data: sqlSuggestions } = await supabaseAdmin
        .from('dishes')
        .select('name')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(4);
      suggestions = (sqlSuggestions || []).map((d) => d.name);
    }

    const suggestAi = Boolean(hasIngredientFilter && total === 0);

    // Cache ngắn 30 giây cho các request lọc giống nhau (không cache khi có ingredient filter do cá nhân hóa)
    if (!hasIngredientFilter) {
      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    } else {
      res.set('Cache-Control', 'private, no-store');
    }

    return res.json({
      success: true,
      data: paginatedData,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: totalPages,
        suggestions,
        suggest_ai: suggestAi
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.3.2 Xem chi tiết món ăn & công thức
 * GET /dishes/:idOrSlug hoặc /api/dishes/:idOrSlug
 */
export async function getDishDetail(req, res, next) {
  try {
    const { idOrSlug } = req.params;
    if (!idOrSlug) {
      return res.status(404).json({
        success: false,
        error: { code: 'DISH_NOT_FOUND', message: 'Món không tồn tại hoặc đã bị ẩn' }
      });
    }

    const isUuid = UUID_REGEX.test(idOrSlug);

    // ── 1. Tìm món theo id (uuid) hoặc slug ──────────────────────────────────
    let query = supabaseAdmin
      .from('dishes')
      .select(`
        id,
        name,
        slug,
        description,
        image_url,
        category,
        category_normalized,
        cook_time_minutes,
        difficulty,
        servings,
        est_cost,
        calories,
        protein_g,
        carbs_g,
        fat_g,
        is_published,
        created_at,
        updated_at,
        recipe_steps(step_order, content),
        dish_tags(tag:tags(id, name)),
        dish_ingredients(
          quantity,
          unit,
          is_optional,
          ingredient:ingredients(
            id,
            name,
            allergen_group:allergen_groups(id, name)
          )
        )
      `)
      .eq('is_published', true);

    if (isUuid) {
      query = query.eq('id', idOrSlug);
    } else {
      query = query.eq('slug', idOrSlug);
    }

    const { data: dish, error: dishErr } = await query.maybeSingle();

    if (dishErr) throw dishErr;

    if (!dish) {
      return res.status(404).json({
        success: false,
        error: { code: 'DISH_NOT_FOUND', message: 'Món không tồn tại hoặc đã bị ẩn' }
      });
    }

    const currentUserId = req.user?.id;

    // ── 2. Cập nhật view_history và interaction_logs nếu người dùng đã đăng nhập
    if (currentUserId) {
      (async () => {
        try {
          const { data: existingHistory } = await supabaseAdmin
            .from('view_history')
            .select('view_count')
            .match({ user_id: currentUserId, dish_id: dish.id })
            .maybeSingle();

          const newCount = (existingHistory?.view_count || 0) + 1;
          await supabaseAdmin.from('view_history').upsert({
            user_id: currentUserId,
            dish_id: dish.id,
            view_count: newCount,
            last_viewed_at: new Date().toISOString()
          });

          await supabaseAdmin.from('interaction_logs').insert({
            user_id: currentUserId,
            dish_id: dish.id,
            event_type: 'view',
            context: { source: 'dish_detail_api' }
          });
        } catch (logErr) {
          console.error('Lỗi ghi nhận lịch sử xem:', logErr.message);
        }
      })();
    }

    // ── 3. Lấy ratings và tính rating_summary, my_rating ─────────────────────
    const { data: ratingsData, error: ratingsErr } = await supabaseAdmin
      .from('ratings')
      .select('id, user_id, stars, comment, created_at')
      .eq('dish_id', dish.id);

    if (ratingsErr) throw ratingsErr;

    const ratingsList = ratingsData || [];
    const ratingCount = ratingsList.length;
    const ratingAvg =
      ratingCount > 0
        ? Math.round((ratingsList.reduce((acc, r) => acc + r.stars, 0) / ratingCount) * 10) / 10
        : 0;

    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    ratingsList.forEach((r) => {
      const key = String(r.stars);
      if (distribution[key] !== undefined) {
        distribution[key] += 1;
      }
    });

    const ratingSummary = {
      average: ratingAvg,
      count: ratingCount,
      distribution
    };

    let myRating = null;
    if (currentUserId) {
      const userRating = ratingsList.find((r) => r.user_id === currentUserId);
      if (userRating) {
        myRating = {
          id: userRating.id,
          stars: userRating.stars,
          comment: userRating.comment
        };
      }
    }

    // ── 4. Lấy số lượng yêu thích (favorite_count) và is_favorite ────────────
    const { count: favoriteCount, error: favCountErr } = await supabaseAdmin
      .from('favorites')
      .select('user_id', { count: 'exact', head: true })
      .eq('dish_id', dish.id);

    if (favCountErr) throw favCountErr;

    let isFavorite = false;
    if (currentUserId) {
      const { data: userFav } = await supabaseAdmin
        .from('favorites')
        .select('user_id')
        .match({ user_id: currentUserId, dish_id: dish.id })
        .maybeSingle();
      isFavorite = Boolean(userFav);
    }

    // ── 5. Lấy danh sách món liên quan (cùng danh mục hoặc cùng vùng miền) ────
    let relatedQuery = supabaseAdmin
      .from('dishes')
      .select('id, name, slug, image_url')
      .eq('is_published', true)
      .neq('id', dish.id)
      .limit(6);

    if (dish.category) {
      relatedQuery = relatedQuery.eq('category', dish.category);
    }

    const { data: relatedDishesData } = await relatedQuery;

    // ── 6. Chuẩn hóa cấu trúc dữ liệu trả về theo đặc tả ─────────────────────
    const formattedIngredients = (dish.dish_ingredients || []).map((di) => ({
      ingredient_id: di.ingredient?.id,
      name: di.ingredient?.name,
      quantity: Number(di.quantity),
      unit: di.unit,
      is_optional: di.is_optional,
      allergen_group: di.ingredient?.allergen_group
        ? {
          id: di.ingredient.allergen_group.id,
          name: di.ingredient.allergen_group.name
        }
        : null
    }));

    const rawSteps = (Array.isArray(dish.recipe_steps) && dish.recipe_steps.length > 0)
      ? dish.recipe_steps.map(s => ({ order: s.step_order, content: s.content }))
      : (Array.isArray(dish.steps) ? dish.steps : []);
    const formattedSteps = rawSteps.map((step, idx) => ({
      order: step.order ?? idx + 1,
      content: step.content || step.instruction || '',
      ...(step.duration_minutes !== undefined ? { duration_minutes: step.duration_minutes } : {})
    }));

    const formattedTags = (dish.dish_tags || [])
      .map((dt) => dt.tag)
      .filter(Boolean)
      .map((t) => ({ id: t.id, name: t.name }));

    const nutrition = {
      calories: dish.calories != null ? Number(dish.calories) : null,
      protein_g: dish.protein_g != null ? Number(dish.protein_g) : null,
      carbs_g: dish.carbs_g != null ? Number(dish.carbs_g) : null,
      fat_g: dish.fat_g != null ? Number(dish.fat_g) : null
    };

    const responseData = {
      id: dish.id,
      name: dish.name,
      slug: dish.slug,
      description: dish.description,
      image_url: dish.image_url,
      region: dish.region ? { id: dish.region.id, name: dish.region.name } : null,
      category: typeof dish.category === 'object' ? dish.category : (dish.category ? { name: dish.category } : null),
      cook_time_minutes: dish.cook_time_minutes,
      difficulty: dish.difficulty,
      calories: dish.calories,
      avg_rating: ratingSummary.average,
      rating_count: ratingSummary.count,
      favorite_count: favoriteCount || 0,
      is_favorite: isFavorite,
      servings: dish.servings,
      est_cost: dish.est_cost != null ? Number(dish.est_cost) : null,
      nutrition,
      ingredients: formattedIngredients,
      steps: formattedSteps,
      tags: formattedTags,
      rating_summary: ratingSummary,
      my_rating: myRating,
      related_dishes: relatedDishesData || [],
      created_at: dish.created_at,
      updated_at: dish.updated_at
    };

    return res.json({
      success: true,
      data: responseData
    });
  } catch (err) {
    next(err);
  }
}

