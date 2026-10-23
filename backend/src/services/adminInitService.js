// src/services/adminInitService.js
// Tự động kiểm tra và khởi tạo tài khoản Admin từ biến môi trường khi khởi động server

import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/appConfig.js';

/**
 * Tự động kiểm tra và tạo tài khoản Admin từ .env nếu chưa tồn tại.
 * Nếu đã tồn tại, đảm bảo quyền role = 'admin' và bỏ qua.
 */
export async function ensureAdminUser() {
  const { email, password, role, displayName } = env.adminSeed;

  if (!email || !password) {
    console.log('ℹ️ [Admin Init] Bỏ qua: Không tìm thấy ADMIN_EMAIL / ADMIN_PASSWORD (hoặc Admin_User / Password) trong .env');
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const targetRole = (role || 'admin').toLowerCase();
  const adminDisplayName = displayName || 'Quản trị viên';

  try {
    // 1. Kiểm tra tài khoản trong bảng public.users
    const { data: existingUser, error: queryError } = await supabaseAdmin
      .from('users')
      .select('id, email, display_name, role, status')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (queryError) {
      console.warn('⚠️ [Admin Init] Lỗi truy vấn bảng users:', queryError.message);
    }

    if (existingUser) {
      // Tài khoản đã tồn tại trong public.users
      if (existingUser.role !== targetRole) {
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ role: targetRole, status: 'active' })
          .eq('id', existingUser.id);

        if (updateError) {
          console.error('❌ [Admin Init] Lỗi cập nhật quyền Admin:', updateError.message);
        } else {
          console.log(`👑 [Admin Init] Đã nâng cấp quyền '${targetRole}' cho tài khoản: ${normalizedEmail}`);
        }
      }
      return;
    }

    // 2. Nếu chưa có trong public.users, kiểm tra trong auth.users của Supabase
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.warn('⚠️ [Admin Init] Lỗi truy vấn danh sách auth.users:', listError.message);
    }

    let authUser = listData?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    // 3. Nếu chưa có trong auth.users -> tạo mới tài khoản
    if (!authUser) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: password,
        email_confirm: true,
        user_metadata: { display_name: adminDisplayName },
      });

      if (createError) {
        console.error('❌ [Admin Init] Không thể tạo tài khoản admin trong Supabase Auth:', createError.message);
        return;
      }
      authUser = createData.user;
      console.log(`✨ [Admin Init] Đã tạo mới tài khoản Auth: ${normalizedEmail}`);
    }

    // 4. Đồng bộ vào bảng public.users với role admin
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: authUser.id,
        email: authUser.email || normalizedEmail,
        display_name: adminDisplayName,
        role: targetRole,
        status: 'active',
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('❌ [Admin Init] Lỗi lưu vào bảng users:', profileError.message);
      return;
    }

    // 5. Khởi tạo user_profiles nếu chưa có
    await supabaseAdmin
      .from('user_profiles')
      .upsert({
        user_id: authUser.id,
        household_size: 1,
        taste_prefs: {},
      }, { onConflict: 'user_id' });

    console.log(`🎉 [Admin Init] Khởi tạo tài khoản admin thành công: ${normalizedEmail} (Role: ${targetRole})`);
  } catch (err) {
    console.error('❌ [Admin Init] Lỗi khởi tạo admin:', err.message);
  }
}
