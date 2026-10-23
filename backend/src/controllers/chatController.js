// src/controllers/chatController.js
// Xử lý Chatbot cá nhân hóa theo mục 4.6 của tài liệu đặc tả API

import { supabaseAdmin } from '../config/supabase.js';
import { generatePersonalizedReply } from '../services/aiService.js';

/**
 * 4.6.1 Tạo hội thoại mới
 * POST /chat/sessions hoặc /api/chat/sessions
 */
export async function createChatSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { title } = req.body || {};

    const sessionTitle = (typeof title === 'string' && title.trim())
      ? title.trim()
      : null;

    const { data: session, error } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        user_id: userId,
        title: sessionTitle,
      })
      .select('id, title, created_at, updated_at')
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({
      success: true,
      data: {
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.6.2 Danh sách hội thoại
 * GET /chat/sessions hoặc /api/chat/sessions
 */
export async function getChatSessions(req, res, next) {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '20', 10) || 20));
    const offset = (page - 1) * limit;

    // Đếm tổng số hội thoại của người dùng
    const { count, error: countErr } = await supabaseAdmin
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countErr) {
      throw countErr;
    }

    const total = count || 0;

    // Lấy danh sách hội thoại sắp xếp theo updated_at mới nhất
    const { data: sessions, error: listErr } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, title, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (listErr) {
      throw listErr;
    }

    return res.status(200).json({
      success: true,
      data: sessions || [],
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.6.3 Mở lại hội thoại cũ
 * GET /chat/sessions/:sessionId hoặc /api/chat/sessions/:sessionId
 */
export async function getChatSessionById(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // 1. Kiểm tra session tồn tại và thuộc về user
    const { data: session, error: sessErr } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, title, created_at, updated_at, user_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessErr || !session || session.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAT_SESSION_NOT_FOUND',
          message: 'Hội thoại không tồn tại hoặc không thuộc người dùng.',
        },
      });
    }

    const page = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '50', 10) || 50));
    const offset = (page - 1) * limit;

    // 2. Đếm số tin nhắn
    const { count, error: countErr } = await supabaseAdmin
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (countErr) {
      throw countErr;
    }

    const total = count || 0;

    // 3. Lấy tin nhắn theo thứ tự thời gian
    const { data: rawMessages, error: msgErr } = await supabaseAdmin
      .from('chat_messages')
      .select('id, role, content, referenced_dish_ids, feedback, feedback_reason, outcome, tokens, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (msgErr) {
      throw msgErr;
    }

    const messages = rawMessages || [];

    // 4. Thu thập thông tin món ăn từ referenced_dish_ids để hiển thị thẻ món
    const allDishIds = [...new Set(messages.flatMap((m) => m.referenced_dish_ids || []))];
    const dishMap = new Map();

    if (allDishIds.length > 0) {
      const { data: dishRows } = await supabaseAdmin
        .from('dishes')
        .select('id, name, slug, description, image_url, cook_time_minutes, difficulty')
        .in('id', allDishIds);

      if (dishRows) {
        dishRows.forEach((d) => dishMap.set(d.id, d));
      }
    }

    // Format tin nhắn trả về
    const formattedMessages = messages.map((m) => {
      const referencedDishes = (m.referenced_dish_ids || [])
        .map((id) => dishMap.get(id))
        .filter(Boolean);

      // Chuyển feedback DB 'helpful'/'unhelpful' sang 'like'/'dislike' theo API doc
      let feedback = m.feedback;
      if (feedback === 'helpful') feedback = 'like';
      else if (feedback === 'unhelpful') feedback = 'dislike';

      return {
        id: m.id,
        role: m.role,
        content: m.content,
        referenced_dishes: referencedDishes,
        feedback,
        feedback_reason: m.feedback_reason,
        outcome: m.outcome,
        tokens: m.tokens,
        created_at: m.created_at,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at,
        messages: formattedMessages,
      },
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.6.4 Gửi câu hỏi cho chatbot (cá nhân hóa)
 * POST /chat/sessions/:sessionId/messages
 */
export async function sendChatMessage(req, res, next) {
  let userMessageSaved = null;
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // ── 1. Kiểm tra session tồn tại và thuộc về user ─────────────────────────
    const { data: session, error: sessErr } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, title, user_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessErr || !session || session.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAT_SESSION_NOT_FOUND',
          message: 'Hội thoại không tồn tại hoặc không thuộc người dùng.',
        },
      });
    }

    // ── 2. Validate nội dung câu hỏi ─────────────────────────────────────────
    const { content, fridge } = req.body || {};

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Nội dung câu hỏi không được để trống.',
        },
      });
    }

    if (content.length > 2000) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Nội dung câu hỏi không được vượt quá 2000 ký tự.',
        },
      });
    }

    // Validate tủ lạnh thông minh nếu có (Quy tắc 7: Tối đa 20 nguyên liệu)
    const fridgePayload = {
      ingredient_ids: [],
      ingredient_names: [],
      custom_ingredients: [],
    };

    if (fridge && typeof fridge === 'object') {
      const ingIds = Array.isArray(fridge.ingredient_ids) ? fridge.ingredient_ids : [];
      const customIngs = Array.isArray(fridge.custom_ingredients) ? fridge.custom_ingredients : [];

      if (ingIds.length + customIngs.length > 20) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Danh sách nguyên liệu có sẵn không được vượt quá 20 nguyên liệu.',
          },
        });
      }

      fridgePayload.ingredient_ids = ingIds
        .filter((id) => Number.isInteger(Number(id)) && Number(id) > 0)
        .map(Number);
      fridgePayload.custom_ingredients = customIngs
        .filter((s) => typeof s === 'string' && s.trim())
        .map((s) => s.trim());
    }

    // Kiểm tra số câu hỏi trước đó của người dùng trong phiên này
    const { count: priorUserMsgCount } = await supabaseAdmin
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('role', 'user');

    const isFirstUserQuestion = (priorUserMsgCount || 0) === 0;

    // ── 3. Lưu tin nhắn người dùng vào chat_messages (luồng chính & luồng 3a) ─
    const { data: userMsg, error: insertUserErr } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: content.trim(),
      })
      .select('id, role, content, created_at')
      .single();

    if (insertUserErr) {
      throw insertUserErr;
    }
    userMessageSaved = userMsg;

    // Đồng bộ tiêu đề hội thoại với câu hỏi người dùng nhập vào LẦN ĐẦU TIÊN
    // Nếu người dùng hỏi các câu tiếp theo trong cùng phiên đó thì giữ nguyên, không đồng bộ lại
    let activeSessionTitle = session.title;
    if (isFirstUserQuestion) {
      const autoTitle = content.trim().length > 45
        ? content.trim().slice(0, 42) + '...'
        : content.trim();

      await supabaseAdmin
        .from('chat_sessions')
        .update({ title: autoTitle, updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      activeSessionTitle = autoTitle;
    }

    // ── 4. Thu thập ngữ cảnh cá nhân hóa của người dùng (Quy tắc 1 & 2) ────────
    const [userProfile, favoriteDishes, chatHistory] = await Promise.all([
      fetchUserPersonalizationProfile(userId),
      fetchUserFavorites(userId),
      fetchRecentChatHistory(sessionId, userMsg.id),
    ]);

    // Giải mã tên nguyên liệu trong tủ lạnh
    if (fridgePayload.ingredient_ids.length > 0) {
      const { data: ingRows } = await supabaseAdmin
        .from('ingredients')
        .select('id, name')
        .in('id', fridgePayload.ingredient_ids);

      if (ingRows) {
        fridgePayload.ingredient_names = ingRows.map((r) => r.name);
      }
    }

    // ── 5. Lọc món ăn an toàn cho người dùng (Quy tắc 2) ───────────────────────
    // Món chứa nguyên liệu thuộc nhóm dị ứng hoặc nguyên liệu không thích BỊ LOẠI KHỎI referenced_dishes
    const dishesContext = await fetchSafeDishesContext(userProfile, fridgePayload, content);

    // ── 6. Gọi AI sinh câu trả lời cá nhân hóa ───────────────────────────────
    let aiResult;
    try {
      aiResult = await generatePersonalizedReply({
        content: content.trim(),
        userProfile,
        favoriteDishes,
        chatHistory,
        fridge: fridgePayload,
        dishesContext,
      });
    } catch (aiErr) {
      // Tin nhắn người dùng đã được lưu an toàn ở bước 3, sẵn sàng để gửi lại (luồng 3a)
      if (aiErr.name === 'AIServiceError') {
        return res.status(aiErr.status).json({
          success: false,
          error: {
            code: aiErr.code,
            message: aiErr.message,
          },
        });
      }
      throw aiErr;
    }

    // ── 7. Lưu tin nhắn trợ lý vào chat_messages ──────────────────────────────
    const matchedDishIds = (aiResult.dishes || []).map((d) => d.id);

    const { data: assistantMsg, error: insertAsstErr } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: aiResult.content,
        referenced_dish_ids: matchedDishIds,
        outcome: aiResult.outcome || 'answered',
        tokens: aiResult.tokens || null,
      })
      .select('id, role, content, outcome, tokens, created_at')
      .single();

    if (insertAsstErr) {
      throw insertAsstErr;
    }

    // Cập nhật updated_at cho session
    await supabaseAdmin
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    // Chuẩn hóa định dạng referenced_dishes
    const formattedDishes = (aiResult.dishes || []).map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      image_url: d.image_url,
      description: d.description,
      cook_time_minutes: d.cook_time_minutes,
      difficulty: d.difficulty,
    }));

    return res.status(201).json({
      success: true,
      data: {
        session_title: activeSessionTitle,
        user_message: {
          id: userMsg.id,
          role: userMsg.role,
          content: userMsg.content,
          created_at: userMsg.created_at,
        },
        assistant_message: {
          id: assistantMsg.id,
          role: assistantMsg.role,
          content: assistantMsg.content,
          referenced_dishes: formattedDishes,
          outcome: assistantMsg.outcome,
          tokens: assistantMsg.tokens,
          created_at: assistantMsg.created_at,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.6.5 Xóa một hội thoại
 * DELETE /chat/sessions/:sessionId
 */
export async function deleteChatSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    // Kiểm tra session tồn tại và thuộc về user
    const { data: session, error: sessErr } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessErr || !session || session.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAT_SESSION_NOT_FOUND',
          message: 'Hội thoại không tồn tại.',
        },
      });
    }

    // Xóa hội thoại (cascade xóa tất cả chat_messages)
    const { error: delErr } = await supabaseAdmin
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (delErr) {
      throw delErr;
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}


/**
 * 4.6.6 Đánh giá câu trả lời của chatbot
 * POST /chat/messages/:messageId/feedback
 */
export async function sendChatMessageFeedback(req, res, next) {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { feedback, reason } = req.body || {};

    // Validate feedback
    const normalizedFeedback = typeof feedback === 'string' ? feedback.trim().toLowerCase() : '';
    if (!['like', 'dislike', 'helpful', 'unhelpful'].includes(normalizedFeedback)) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Trường feedback phải là "like" hoặc "dislike".',
        },
      });
    }

    if (reason && typeof reason === 'string' && reason.length > 500) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Lý do đánh giá không được vượt quá 500 ký tự.',
        },
      });
    }

    // 1. Tìm tin nhắn và kiểm tra quyền sở hữu qua session
    const { data: msg, error: msgErr } = await supabaseAdmin
      .from('chat_messages')
      .select('id, role, session_id, chat_sessions(user_id)')
      .eq('id', messageId)
      .maybeSingle();

    if (msgErr || !msg || msg.chat_sessions?.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: 'Tin nhắn không tồn tại hoặc không thuộc người dùng.',
        },
      });
    }

    // 2. Chỉ đánh giá được tin nhắn có role = assistant
    if (msg.role !== 'assistant') {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Chỉ đánh giá được tin nhắn có role = assistant.',
        },
      });
    }

    // Map 'like'/'dislike' sang giá trị check constraint của DB: 'helpful'/'unhelpful'
    const dbFeedback = (normalizedFeedback === 'like' || normalizedFeedback === 'helpful')
      ? 'helpful'
      : 'unhelpful';

    const feedbackReason = (typeof reason === 'string' && reason.trim())
      ? reason.trim()
      : null;

    const { error: updateErr } = await supabaseAdmin
      .from('chat_messages')
      .update({
        feedback: dbFeedback,
        feedback_reason: feedbackReason,
      })
      .eq('id', messageId);

    if (updateErr) {
      throw updateErr;
    }

    const clientFeedback = (normalizedFeedback === 'helpful' || normalizedFeedback === 'like')
      ? 'like'
      : 'dislike';

    return res.status(200).json({
      success: true,
      data: {
        id: messageId,
        feedback: clientFeedback,
        feedback_reason: feedbackReason,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * API Bổ sung: Cập nhật tiêu đề hội thoại
 * PATCH /chat/sessions/:sessionId
 */
export async function updateChatSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { title } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Tiêu đề hội thoại không được để trống.',
        },
      });
    }

    const { data: session, error: sessErr } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessErr || !session || session.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAT_SESSION_NOT_FOUND',
          message: 'Hội thoại không tồn tại.',
        },
      });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('chat_sessions')
      .update({
        title: title.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select('id, title, created_at, updated_at')
      .single();

    if (updateErr) {
      throw updateErr;
    }

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS CHO NGỮ CẢNH CÁ NHÂN HÓA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lấy hồ sơ khẩu vị chi tiết của người dùng
 */
async function fetchUserPersonalizationProfile(userId) {
  try {
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const [
      { data: dietsData },
      { data: allergiesData },
      { data: dislikesData },
    ] = await Promise.all([
      supabaseAdmin.from('user_diets').select('diet_type_id, diet_types(id, name)').eq('user_id', userId),
      supabaseAdmin.from('user_allergies').select('allergen_group_id, allergen_groups(id, code, name)').eq('user_id', userId),
      supabaseAdmin.from('user_disliked_ingredients').select('ingredient_id, ingredients(id, name)').eq('user_id', userId),
    ]);

    const dietTypes = (dietsData || []).map((d) => d.diet_types).filter(Boolean);
    const allergenGroups = (allergiesData || []).map((a) => a.allergen_groups).filter(Boolean);
    const dislikedIngredients = (dislikesData || []).map((i) => i.ingredients).filter(Boolean);

    return {
      taste_prefs: profile?.taste_prefs || {},
      calorie_goal: profile?.calorie_goal || null,
      budget_min: profile?.budget_min || null,
      budget_max: profile?.budget_max || null,
      household_size: profile?.household_size || 1,
      diet_types: dietTypes,
      allergen_groups: allergenGroups,
      disliked_ingredients: dislikedIngredients,
      allergen_group_ids: allergenGroups.map((a) => a.id),
      disliked_ingredient_ids: dislikedIngredients.map((d) => d.id),
    };
  } catch (err) {
    console.error('Lỗi khi lấy hồ sơ khẩu vị:', err);
    return {
      diet_types: [],
      allergen_groups: [],
      disliked_ingredients: [],
      allergen_group_ids: [],
      disliked_ingredient_ids: [],
    };
  }
}

/**
 * Lấy danh sách món yêu thích của người dùng
 */
async function fetchUserFavorites(userId) {
  try {
    const { data } = await supabaseAdmin
      .from('favorites')
      .select('dish_id, dishes(id, name)')
      .eq('user_id', userId)
      .limit(10);

    return (data || []).map((row) => row.dishes).filter(Boolean);
  } catch (err) {
    console.error('Lỗi khi lấy món yêu thích:', err);
    return [];
  }
}

/**
 * Lấy các tin nhắn gần nhất trong hội thoại làm ngữ cảnh
 */
async function fetchRecentChatHistory(sessionId, excludeMessageId) {
  try {
    const { data } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .neq('id', excludeMessageId)
      .order('created_at', { ascending: false })
      .limit(8);

    return (data || []).reverse();
  } catch (err) {
    console.error('Lỗi khi lấy lịch sử hội thoại:', err);
    return [];
  }
}

/**
 * Truy vấn danh sách món ăn an toàn cho người dùng (Quy tắc 2: loại bỏ triệt để dị ứng và kiêng kỵ)
 */
async function fetchSafeDishesContext(userProfile, fridge, content) {
  try {
    // 1. Tìm các nguyên liệu thuộc nhóm dị ứng của người dùng
    const allergenGroupIds = userProfile.allergen_group_ids || [];
    const dislikedIngredientIds = userProfile.disliked_ingredient_ids || [];

    let forbiddenIngredientIds = new Set(dislikedIngredientIds);

    if (allergenGroupIds.length > 0) {
      const { data: allergenIngs } = await supabaseAdmin
        .from('ingredients')
        .select('id')
        .in('allergen_group_id', allergenGroupIds);

      if (allergenIngs) {
        allergenIngs.forEach((row) => forbiddenIngredientIds.add(row.id));
      }
    }

    // 2. Tìm tất cả các món ăn chứa nguyên liệu cấm
    const forbiddenDishIds = new Set();
    if (forbiddenIngredientIds.size > 0) {
      const { data: forbiddenDishRows } = await supabaseAdmin
        .from('dish_ingredients')
        .select('dish_id')
        .in('ingredient_id', Array.from(forbiddenIngredientIds));

      if (forbiddenDishRows) {
        forbiddenDishRows.forEach((row) => forbiddenDishIds.add(row.dish_id));
      }
    }

    // 3. Nếu người dùng có nguyên liệu trong tủ lạnh, tìm món tận dụng nguyên liệu đó
    let fridgeMatchedDishIds = new Set();
    if (fridge.ingredient_ids.length > 0) {
      const { data: dishIngs } = await supabaseAdmin
        .from('dish_ingredients')
        .select('dish_id')
        .in('ingredient_id', fridge.ingredient_ids);

      if (dishIngs) {
        dishIngs.forEach((row) => {
          if (!forbiddenDishIds.has(row.dish_id)) {
            fridgeMatchedDishIds.add(row.dish_id);
          }
        });
      }
    }

    // 4. Truy vấn các món ăn an toàn đã xuất bản
    let safeDishes = [];

    if (fridgeMatchedDishIds.size > 0) {
      const { data: matchedDishes } = await supabaseAdmin
        .from('dishes')
        .select('id, name, slug, description, image_url, cook_time_minutes, difficulty')
        .eq('is_published', true)
        .in('id', Array.from(fridgeMatchedDishIds))
        .limit(8);

      if (matchedDishes) {
        safeDishes.push(...matchedDishes);
      }
    }

    // Bổ sung các món xuất bản khác không nằm trong danh sách cấm
    if (safeDishes.length < 8) {
      const { data: extraDishes } = await supabaseAdmin
        .from('dishes')
        .select('id, name, slug, description, image_url, cook_time_minutes, difficulty')
        .eq('is_published', true)
        .limit(20);

      if (extraDishes) {
        for (const dish of extraDishes) {
          if (!forbiddenDishIds.has(dish.id) && !safeDishes.some((d) => d.id === dish.id)) {
            safeDishes.push(dish);
            if (safeDishes.length >= 10) break;
          }
        }
      }
    }

    return safeDishes;
  } catch (err) {
    console.error('Lỗi khi lọc món ăn an toàn:', err);
    return [];
  }
}
