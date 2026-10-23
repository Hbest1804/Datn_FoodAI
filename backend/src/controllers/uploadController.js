// src/controllers/uploadController.js
// Xử lý tải ảnh lên Supabase Storage (Avatar & Ảnh món ăn)

import { supabaseAdmin } from '../config/supabase.js';

/**
 * 5.6.1 POST /api/me/avatar (hoặc /me/avatar)
 * Tải ảnh đại diện người dùng lên bucket 'avatars'
 * Yêu cầu: Đăng nhập (req.user)
 */
export async function uploadUserAvatar(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để tải ảnh đại diện.' },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Vui lòng chọn tệp ảnh để tải lên (trường "file").' },
      });
    }

    const file = req.file;
    const rawExt = file.originalname?.split('.').pop()?.toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];
    const ext = validExts.includes(rawExt) ? rawExt : 'png';
    const filePath = `${userId}_${Date.now()}.${ext}`;

    // Upload lên bucket 'avatars' của Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('🔥 Supabase storage error (avatars):', uploadError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'STORAGE_UPLOAD_ERROR',
          message: `Không thể lưu ảnh vào Storage: ${uploadError.message}`,
        },
      });
    }

    // Lấy link ảnh Public URL trực tiếp
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Lưu avatar_url vào metadata tài khoản Supabase Auth
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { avatar_url: publicUrl },
      });
    } catch (metaErr) {
      console.warn('Cập nhật user_metadata cảnh báo:', metaErr.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        avatar_url: publicUrl,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4.10.6 POST /api/admin/uploads/images (hoặc /admin/uploads/images)
 * Tải ảnh món ăn / danh mục lên bucket 'dishes'
 * Yêu cầu: Admin
 */
export async function uploadDishImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Vui lòng chọn tệp ảnh để tải lên (trường "file").' },
      });
    }

    const file = req.file;
    const rawExt = file.originalname?.split('.').pop()?.toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];
    const ext = validExts.includes(rawExt) ? rawExt : 'png';
    const filePath = `dish_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    // Upload lên bucket 'dishes' của Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('dishes')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('🔥 Supabase storage error (dishes):', uploadError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'STORAGE_UPLOAD_ERROR',
          message: `Không thể lưu ảnh vào Storage: ${uploadError.message}`,
        },
      });
    }

    // Lấy link ảnh Public URL trực tiếp
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('dishes')
      .getPublicUrl(filePath);

    return res.status(201).json({
      success: true,
      data: {
        url: publicUrl,
        size: file.size,
      },
    });
  } catch (err) {
    next(err);
  }
}
