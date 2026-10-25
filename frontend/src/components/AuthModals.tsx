import React, { useState, useEffect } from 'react';
import { 
  X, 
  UtensilsCrossed, 
  Check, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  Sparkles, 
  User, 
  ArrowRight,
  Clock,
  Flame,
  AlertCircle,
  HelpCircle,
  Phone
} from 'lucide-react';
import { UserProfile } from '../types';
import { ChefLogo3D } from './ChefLogo3D';
import { apiService } from '../services/api';

interface AuthModalsProps {
  isOpen: boolean;
  type: 'login' | 'register' | 'forgot-password';
  onClose: () => void;
  onSwitchType: (type: 'login' | 'register' | 'forgot-password') => void;
  onLoginSuccess: (user: Partial<UserProfile>) => void;
  /** Token lấy từ liên kết /reset-password?token=... trong email → mở thẳng bước nhập mật khẩu mới */
  initialResetToken?: string;
}

export const AuthModals: React.FC<AuthModalsProps> = ({
  isOpen,
  type,
  onClose,
  onSwitchType,
  onLoginSuccess,
  initialResetToken,
}) => {
  // Common states
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Register taste questionnaire states
  const [selectedDiet, setSelectedDiet] = useState('Eat Clean');

  // Forgot password states
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!initialResetToken) return;
    setResetToken(initialResetToken);
    setForgotStep(2);
    setErrorMessage('');
  }, [initialResetToken]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const data = await apiService.auth.login(email.trim(), password);
      const user = data.user;
      onLoginSuccess({
        id: user.id,
        name: user.display_name || user.email.split('@')[0],
        email: user.email,
        ...(user.avatar_url ? { avatar: user.avatar_url, avatar_url: user.avatar_url } : {}),
        role: user.role,
        roleLabel: user.role === 'admin' ? 'Super Admin' : 'Đầu bếp tại gia',
        isPro: true,
      });
      onClose();
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại email và mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const data = await apiService.auth.register({
        email: email.trim(),
        password,
        displayName: name.trim(),
      });
      const user = data.user;
      onLoginSuccess({
        id: user.id,
        name: user.display_name || name.trim(),
        email: user.email,
        role: 'user',
        roleLabel: 'Đầu bếp tại gia',
        isPro: true,
        dietPreference: selectedDiet,
        allergiesHardLock: [],
      });
      onClose();
    } catch (err: any) {
      console.error('Register error:', err);
      setErrorMessage(err.message || 'Đăng ký tài khoản không thành công. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setErrorMessage('Vui lòng nhập địa chỉ email.');
      return;
    }
    setErrorMessage('');
    setLoading(true);
    try {
      const res = await apiService.auth.forgotPassword(forgotEmail.trim());
      setSuccessMessage(res.message);
      setForgotStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể gửi yêu cầu đặt lại mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tokenVal = resetToken.trim() || otpCode.join('').trim();
    if (!tokenVal) {
      setErrorMessage('Vui lòng nhập mã OTP hoặc Token xác thực.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.');
      return;
    }
    setErrorMessage('');
    setLoading(true);
    try {
      const res = await apiService.auth.resetPassword({
        token: tokenVal,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccessMessage(res.message);
      setForgotStep(3);
    } catch (err: any) {
      setErrorMessage(err.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col md:flex-row">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ===================== LOGIN MODAL ===================== */}
        {type === 'login' && (
          <>
            {/* Left Column: Brand Hero */}
            <div className="md:w-5/12 bg-gradient-to-br from-orange-50/80 via-amber-50/50 to-orange-100/50 p-8 flex flex-col justify-between border-r border-orange-100/60">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <ChefLogo3D size="md" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-lg">Chef AI</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-200 text-orange-800 uppercase">
                        PRO AI
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Bếp trưởng AI thông minh</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-orange-600 tracking-wide uppercase flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Khởi tạo lối sống ẩm thực thế hệ mới
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-snug">
                    Khám phá ẩm thực thông minh, cá nhân hóa <span className="text-orange-500">từng bữa ăn</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed pt-1">
                    Tối ưu dinh dưỡng và khơi gợi cảm hứng nấu nướng với trợ lý AI phân tích khẩu vị, dị ứng và nguyên liệu sẵn có trong tủ lạnh của bạn.
                  </p>
                </div>

                {/* Preview Meal Card */}
                <div className="p-3.5 bg-white/90 backdrop-blur-xs rounded-2xl border border-orange-200/60 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Gợi ý bữa trưa
                    </span>
                    <span className="text-orange-600 font-bold">98% Tương thích</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <img
                      src="https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=150&q=80"
                      alt="Cá hồi"
                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                    />
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Cá hồi áp chảo sốt bơ chanh</h5>
                      <p className="text-[11px] text-slate-500">15p • 420 kcal • Protein 36g • Low Carb</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-orange-100/50 rounded-xl border border-orange-200/40 text-xs text-orange-800 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <span>Tự cân bằng calo, hạn chế dị ứng & cá nhân hóa dinh dưỡng theo từng ngày.</span>
                </div>
              </div>

              <div className="pt-6 text-[11px] text-slate-400">
                © 2026 ChefAI Platform • Trợ lý ẩm thực thông minh
              </div>
            </div>

            {/* Right Column: Form */}
            <div className="md:w-7/12 p-8 sm:p-10 flex flex-col justify-center">
              <div className="flex items-center justify-between pb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Đăng nhập tài khoản</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Tiếp tục hành trình nấu ngon và lành cùng Bếp trưởng Chef AI.
                  </p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button className="px-3 py-1.5 rounded-lg bg-white shadow-xs text-orange-600">
                    Đăng nhập
                  </button>
                  <button
                    onClick={() => onSwitchType('register')}
                    className="px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Đăng ký
                  </button>
                </div>
              </div>

              {/* Social Login Button */}
              <button
                type="button"
                onClick={handleLoginSubmit}
                className="w-full py-2.5 px-4 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                Tiếp tục với Google
              </button>

              <div className="relative my-5 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  HOẶC TIẾP TỤC VỚI EMAIL
                </span>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700">EMAIL TÀI KHOẢN</label>
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="ten@vidu.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700">MẬT KHẨU</label>
                    <button
                      type="button"
                      onClick={() => onSwitchType('forgot-password')}
                      className="text-[11px] font-bold text-orange-600 hover:underline cursor-pointer"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Nhập mật khẩu"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-medium outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="terms-login"
                    defaultChecked
                    className="mt-0.5 rounded text-orange-500 focus:ring-orange-500"
                  />
                  <label htmlFor="terms-login" className="text-[11px] text-slate-500 leading-tight">
                    Tôi đồng ý với <span className="font-semibold text-slate-700 underline">Điều khoản dịch vụ</span> và <span className="font-semibold text-slate-700 underline">Chính sách bảo mật khẩu vị</span> của ChefAI.
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Đăng nhập
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Chưa có tài khoản?</span>
                <button
                  onClick={() => onSwitchType('register')}
                  className="font-bold text-orange-600 hover:underline cursor-pointer"
                >
                  Tạo tài khoản mới ngay
                </button>
              </div>
            </div>
          </>
        )}

        {/* ===================== REGISTER MODAL ===================== */}
        {type === 'register' && (
          <>
            {/* Left Column: Benefits */}
            <div className="md:w-5/12 bg-gradient-to-br from-orange-50/80 via-amber-50/50 to-orange-100/50 p-8 flex flex-col justify-between border-r border-orange-100/60">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <ChefLogo3D size="md" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-lg">Chef AI</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-200 text-orange-800 uppercase">
                        PRO AI
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Trợ lý dinh dưỡng & Bếp trưởng số</p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  HỆ SINH THÁI ẨM THỰC THÔNG MINH
                </div>

                <div className="space-y-3.5 pt-2">
                  <div className="p-3 bg-white/80 rounded-xl border border-orange-200/50 space-y-1">
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                      Hỏi đáp AI không giới hạn & Quét tủ lạnh
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Tải ảnh tủ lạnh, ChefAI tức thì lên thực đơn vừa khít đồ sẵn có trong 15 giây.
                    </p>
                  </div>

                  <div className="p-3 bg-white/80 rounded-xl border border-orange-200/50 space-y-1">
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Phân tích chuyên sâu Vi chất & Macro
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Kiểm soát chính xác Calo, Đạm tinh khiết, Xơ và Tinh bột cân bằng theo mục tiêu thể hình.
                    </p>
                  </div>

                  <div className="p-3 bg-white/80 rounded-xl border border-orange-200/50 space-y-1">
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Lọc dị ứng & Hoán đổi gia vị chuẩn xác
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      Tự động loại bỏ hải sản, gluten, đậu phộng hoặc đường sữa; gợi ý gia vị thay thế an toàn.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 text-[11px] text-slate-400">
                © 2026 ChefAI Platform • Hoàn tất trong 1 phút
              </div>
            </div>

            {/* Right Column: Register Form with Initial Taste Profile Step 1/2 */}
            <div className="md:w-7/12 p-8 sm:p-10 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Đăng ký tài khoản mới</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Khởi tạo hồ sơ vị giác độc bản và nhận thực đơn thông minh.
                  </p>
                </div>
                <button
                  onClick={() => onSwitchType('login')}
                  className="text-xs font-bold text-orange-600 hover:underline cursor-pointer"
                >
                  Đăng nhập ngay
                </button>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">HỌ VÀ TÊN</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Nguyễn Văn A"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">EMAIL CỦA BẠN</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="ban@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">MẬT KHẨU</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Tối thiểu 8 ký tự"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-medium outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">XÁC NHẬN MẬT KHẨU</label>
                    <input
                      type="password"
                      defaultValue={password}
                      required
                      placeholder="Nhập lại mật khẩu"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Step 1/2: Taste Profile Onboarding Quick Module */}
                <div className="p-4 bg-orange-50/70 rounded-2xl border border-orange-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                      Khởi tạo khẩu vị ban đầu (Bước 1/2)
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">Tùy biến sau</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1.5">CHẾ ĐỘ ĂN ƯU TIÊN CỦA BẠN:</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Eat Clean', 'Giảm cân / Low Carb', 'Ăn chay / Vegan', 'Tăng cơ giàu đạm'].map(diet => (
                        <button
                          key={diet}
                          type="button"
                          onClick={() => setSelectedDiet(diet)}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                            selectedDiet === diet
                              ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {diet}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="terms-register"
                    defaultChecked
                    className="mt-0.5 rounded text-orange-500 focus:ring-orange-500"
                  />
                  <label htmlFor="terms-register" className="text-[11px] text-slate-500 leading-tight">
                    Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật dữ liệu ẩm thực của Chef AI. Tôi hiểu AI không thay thế chỉ định y khoa.
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Tạo tài khoản
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}

        {/* ===================== FORGOT PASSWORD MODAL ===================== */}
        {type === 'forgot-password' && (
          <>
            {/* Left Column: Security Benefits */}
            <div className="md:w-5/12 bg-gradient-to-br from-orange-50/80 via-amber-50/50 to-orange-100/50 p-8 flex flex-col justify-between border-r border-orange-100/60">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <ChefLogo3D size="md" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-lg">Chef AI</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-200 text-orange-800 uppercase">
                        PRO AI
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Trợ lý công thức & Dinh dưỡng thông minh</p>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    BẢO MẬT HỒ SƠ ẨM THỰC
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Bảo vệ trọn vẹn <span className="font-bold">hồ sơ khẩu vị</span> & thực đơn độc bản. Định mức dinh dưỡng vi lượng và tủ nguyên liệu ảo của bạn đều được mã hóa an toàn.
                  </p>
                </div>

                <div className="space-y-3 pt-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-[11px] shrink-0">123</span>
                    <div>
                      <h5 className="font-bold text-slate-800">Mã xác thực 2 lớp linh hoạt</h5>
                      <p className="text-[11px] text-slate-500">Xác minh tức thì qua Email hoặc SMS chỉ trong 30 giây.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-[11px] shrink-0">AI</span>
                    <div>
                      <h5 className="font-bold text-slate-800">Bảo toàn dữ liệu tủ lạnh & AI Memory</h5>
                      <p className="text-[11px] text-slate-500">Giữ nguyên lịch sử học hỏi vị giác, danh sách dị ứng và công thức đã ghim.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Cần trợ giúp khẩn cấp?</span>
                <span className="font-bold text-orange-600">1900 6868 (Miễn phí)</span>
              </div>
            </div>

            {/* Right Column: 3 Steps Recovery Wizard */}
            <div className="md:w-7/12 p-8 sm:p-10 flex flex-col justify-center">
              <div className="flex items-center justify-between pb-6">
                <button
                  onClick={() => onSwitchType('login')}
                  className="text-xs font-bold text-slate-600 hover:text-orange-600 cursor-pointer"
                >
                  ← Quay lại Đăng nhập
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">VN</span>
                </div>
              </div>

              {/* 3 Step Breadcrumb */}
              <div className="flex items-center gap-3 pb-6 border-b border-slate-100 mb-6">
                <div className={`flex items-center gap-1.5 text-xs font-bold ${forgotStep >= 1 ? 'text-orange-600' : 'text-slate-400'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${forgotStep >= 1 ? 'bg-orange-500 text-white' : 'bg-slate-200'}`}>1</span>
                  Yêu cầu mã
                </div>
                <span className="text-slate-300">/</span>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${forgotStep >= 2 ? 'text-orange-600' : 'text-slate-400'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${forgotStep >= 2 ? 'bg-orange-500 text-white' : 'bg-slate-200'}`}>2</span>
                  Đặt mật khẩu mới
                </div>
                <span className="text-slate-300">/</span>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${forgotStep >= 3 ? 'text-orange-600' : 'text-slate-400'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${forgotStep >= 3 ? 'bg-orange-500 text-white' : 'bg-slate-200'}`}>3</span>
                  Hoàn tất
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Step 1: Nhập email */}
              {forgotStep === 1 && (
                <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                  <div>
                    <h4 className="text-lg font-black text-slate-900">Quên mật khẩu?</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Nhập địa chỉ email đã đăng ký. Hệ thống sẽ tạo liên kết hoặc mã đặt lại mật khẩu gửi tới email của bạn.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">EMAIL TÀI KHOẢN *</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="ten@vidu.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-medium outline-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {loading ? 'Đang gửi...' : 'Gửi yêu cầu đặt lại mật khẩu'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Step 2: Nhập token/mã + mật khẩu mới */}
              {forgotStep === 2 && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div>
                    <h4 className="text-lg font-black text-slate-900">Đặt lại mật khẩu</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Vui lòng nhập mã xác thực (hoặc token gửi trong email) và mật khẩu mới cho tài khoản {forgotEmail}.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">MÃ XÁC THỰC / TOKEN *</label>
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Nhập mã 6 số hoặc chuỗi token đặt lại..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-mono outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">MẬT KHẨU MỚI *</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Tối thiểu 8 ký tự"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">XÁC NHẬN MẬT KHẨU *</label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 flex flex-wrap gap-2">
                    <span className="text-emerald-700">✓ Ít nhất 8 ký tự</span>
                    <span className="text-emerald-700">✓ Có chữ hoa, thường & số</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Quay lại
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {loading ? 'Đang xác thực...' : 'Xác nhận đổi mật khẩu'}
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Hoàn tất */}
              {forgotStep === 3 && (
                <div className="text-center py-6 space-y-4">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900">Đặt lại mật khẩu thành công!</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Mật khẩu mới đã được cập nhật thành công. Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchType('login');
                      setForgotStep(1);
                    }}
                    className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-orange-500/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    Đăng nhập ngay
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
