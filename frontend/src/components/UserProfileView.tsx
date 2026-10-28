import React, { useState, useEffect } from 'react';
import {
  User,
  Key,
  Heart,
  Clock,
  ShieldCheck,
  Trash2,
  Camera,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  ExternalLink,
  ChefHat,
  MessageSquare,
  Sparkles,
  Flame,
  Star,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { UserProfile, Recipe } from '../types';
import { apiService } from '../api';
import { formatVND, DEFAULT_AVATAR, formatMetric } from '../utils/dishUtils';
import { toast, showConfirm, showPrompt } from './NotificationModal';

interface UserProfileViewProps {
  currentUser: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onGoToChat: (prompt?: string) => void;
  onGoToTasteProfile: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  onUpdateUser,
  onOpenRecipe,
  onGoToChat,
  onGoToTasteProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'password' | 'favorites' | 'history' | 'privacy'>('info');

  const isPersonPhoto = (url?: string) => !url || url.includes('images.unsplash.com/photo-');

  // Profile fields state
  const [displayName, setDisplayName] = useState(currentUser.name || '');
  const [avatarUrl, setAvatarUrl] = useState(() => {
    return isPersonPhoto(currentUser.avatar) ? '' : (currentUser.avatar || '');
  });
  const [email, setEmail] = useState(currentUser.email || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Favorites state
  const [favoritesList, setFavoritesList] = useState<Recipe[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // View history state
  const [viewHistoryList, setViewHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Chat sessions state
  const [chatSessionsList, setChatSessionsList] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  // Global notice / error
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // 1. Load initial profile data from backend
  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const res = await apiService.me.getMyProfile();
        const p = res?.user || res?.data || res;
        if (isMounted && p) {
          if (p.display_name) setDisplayName(p.display_name);
          if (p.avatar_url && !isPersonPhoto(p.avatar_url)) setAvatarUrl(p.avatar_url);
          if (p.email) setEmail(p.email);
        }
      } catch (err) {
        console.warn('Could not fetch user profile:', err);
      }
    };

    loadProfile();
    return () => { isMounted = false; };
  }, []);

  // 2. Load tab-specific data
  useEffect(() => {
    if (activeTab === 'favorites') {
      loadFavorites();
    } else if (activeTab === 'history') {
      loadViewHistory();
    } else if (activeTab === 'privacy') {
      loadChatSessions();
    }
  }, [activeTab]);

  const loadFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const favs = await apiService.me.getFavorites();
      setFavoritesList(favs || []);
    } catch {
      setFavoritesList([]);
    } finally {
      setLoadingFavorites(false);
    }
  };

  const loadViewHistory = async () => {
    setLoadingHistory(true);
    try {
      const hist = await apiService.me.getViewHistory();
      setViewHistoryList(hist || []);
    } catch {
      setViewHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadChatSessions = async () => {
    setLoadingChat(true);
    try {
      const sessions = await apiService.chat.getSessions();
      setChatSessionsList(Array.isArray(sessions) ? sessions : (sessions as any).data || []);
    } catch {
      setChatSessionsList([]);
    } finally {
      setLoadingChat(false);
    }
  };

  // Handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSavingProfile(true);
    try {
      await apiService.me.updateMyProfile({
        display_name: displayName.trim(),
      });
      onUpdateUser({ name: displayName.trim() });
      setNotice('Đã cập nhật thông tin cá nhân thành công!');
      setTimeout(() => setNotice(''), 3500);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật thông tin cá nhân.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const res = await apiService.me.uploadAvatar(file);
      setAvatarUrl(res.avatar_url);
      onUpdateUser({ avatar: res.avatar_url });
      setNotice('Đã cập nhật ảnh đại diện mới!');
      setTimeout(() => setNotice(''), 3500);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải ảnh đại diện lên.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và chữ số.');
      return;
    }

    setChangingPassword(true);
    try {
      await apiService.me.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Đổi mật khẩu thành công!');
      setTimeout(() => setNotice(''), 3500);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleClearFavorites = async () => {
    const ok = await showConfirm({
      title: 'Xóa toàn bộ món yêu thích',
      message: 'Bạn có chắc chắn muốn xóa tất cả món ăn trong danh sách yêu thích? Thao tác này không thể hoàn tác.',
      confirmText: 'Xóa tất cả',
      cancelText: 'Giữ lại',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiService.me.clearFavorites();
      setFavoritesList([]);
      setNotice('Đã xóa sạch danh sách món ăn yêu thích.');
      toast.success('Đã xóa sạch danh sách món ăn yêu thích.');
      setTimeout(() => setNotice(''), 3500);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa món yêu thích.');
      toast.error(err.message || 'Lỗi khi xóa món yêu thích.');
    }
  };

  const handleClearHistory = async () => {
    const ok = await showConfirm({
      title: 'Xóa lịch sử xem món ăn',
      message: 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem món ăn? Danh sách gợi ý gần đây sẽ được làm mới.',
      confirmText: 'Xóa lịch sử',
      cancelText: 'Giữ lại',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiService.me.clearViewHistory();
      setViewHistoryList([]);
      setNotice('Đã xóa toàn bộ lịch sử duyệt món.');
      toast.success('Đã xóa toàn bộ lịch sử duyệt món.');
      setTimeout(() => setNotice(''), 3500);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa lịch sử xem.');
      toast.error(err.message || 'Lỗi khi xóa lịch sử xem.');
    }
  };

  const handleDeleteChatHistory = async () => {
    const ok = await showConfirm({
      title: 'Xóa lịch sử trò chuyện AI',
      message: 'Bạn có chắc muốn xóa tất cả các cuộc hội thoại với Chatbot AI? Toàn bộ các phiên trao đổi trước đây sẽ bị xóa.',
      confirmText: 'Xóa tất cả',
      cancelText: 'Giữ lại',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiService.me.deleteChatHistory();
      setChatSessionsList([]);
      setNotice('Đã xóa toàn bộ lịch sử trò chuyện AI.');
      toast.success('Đã xóa toàn bộ lịch sử trò chuyện AI.');
      setTimeout(() => setNotice(''), 3500);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa lịch sử chat.');
      toast.error(err.message || 'Lỗi khi xóa lịch sử chat.');
    }
  };

  const handleDeleteAccount = async () => {
    const input = await showPrompt({
      title: 'CẢNH BÁO NGUY HIỂM: XÓA TÀI KHOẢN',
      message: 'Tài khoản và toàn bộ dữ liệu vị giác, dinh dưỡng của bạn sẽ bị xóa vĩnh viễn! Nhập chính xác chữ "XÓA TÀI KHOẢN" để tiếp tục:',
      placeholder: 'XÓA TÀI KHOẢN',
      confirmText: 'Tiếp tục',
      cancelText: 'Hủy thao tác',
      variant: 'danger',
      required: true,
    });
    if (input === null) return;
    if (input.trim() !== 'XÓA TÀI KHOẢN') {
      toast.warning('Cụm từ xác nhận không chính xác. Đã hủy thao tác xóa tài khoản.');
      return;
    }

    const password = await showPrompt({
      title: 'Xác thực mật khẩu',
      message: 'Vui lòng nhập mật khẩu hiện tại của bạn để xác thực yêu cầu xóa tài khoản:',
      placeholder: 'Nhập mật khẩu hiện tại...',
      inputType: 'password',
      confirmText: 'Xóa tài khoản vĩnh viễn',
      cancelText: 'Hủy bỏ',
      variant: 'danger',
      required: true,
    });
    if (password === null) return;
    if (!password) {
      toast.warning('Chưa nhập mật khẩu. Đã hủy thao tác.');
      return;
    }

    try {
      await apiService.me.deleteAccount(password);
      toast.success('Tài khoản của bạn đã được xóa vĩnh viễn. Đang chuyển hướng...', 'Đã xóa tài khoản');
      localStorage.clear();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xóa tài khoản');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto">
      {/* ── Top Hero Profile Card ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-orange-500/15 relative overflow-hidden">
        {/* Subtle decorative background circle */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          {/* Avatar with Camera upload trigger */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white/80 shadow-md bg-slate-200 flex items-center justify-center">
              <img
                src={avatarUrl && !isPersonPhoto(avatarUrl) ? avatarUrl : DEFAULT_AVATAR}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <label className="absolute inset-0 rounded-full bg-black/40 flex flex-col items-center justify-center text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera className="w-5 h-5 mb-0.5" />
              Đổi ảnh
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarFile}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-white text-xs font-bold">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
          </div>

          {/* User details */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider backdrop-blur-xs">
                {currentUser.role === 'admin' ? 'Quản trị viên' : 'Thành viên ChefAI'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/20 text-orange-100 text-[11px] font-medium">
                ID: {currentUser.id ? currentUser.id.substring(0, 8) : 'user'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {displayName || 'Đầu bếp tại gia'}
            </h1>
            <p className="text-xs sm:text-sm text-orange-100 max-w-lg">
              {email || 'Chưa cập nhật email'} • Tham gia từ {currentUser.joinedDate || '—'}
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <button
                onClick={onGoToTasteProfile}
                className="px-4 py-2 bg-white hover:bg-orange-50 text-orange-700 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ChefHat className="w-3.5 h-3.5" />
                Hồ sơ khẩu vị & Dinh dưỡng
              </button>
              <button
                onClick={() => onGoToChat()}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl backdrop-blur-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Mở Chatbot AI
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {notice}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Subtabs Navigation ────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-4 overflow-x-auto no-scrollbar text-xs font-bold">
        <button
          onClick={() => setActiveTab('info')}
          className={`pb-3 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'info'
            ? 'border-orange-500 text-orange-600'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <User className="w-4 h-4" />
          Thông tin cá nhân
        </button>

        <button
          onClick={() => setActiveTab('password')}
          className={`pb-3 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'password'
            ? 'border-orange-500 text-orange-600'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Key className="w-4 h-4" />
          Đổi mật khẩu
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`pb-3 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'favorites'
            ? 'border-orange-500 text-orange-600'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Heart className="w-4 h-4 text-rose-500" />
          Món ăn yêu thích
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'history'
            ? 'border-orange-500 text-orange-600'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Clock className="w-4 h-4" />
          Lịch sử xem món
        </button>

        <button
          onClick={() => setActiveTab('privacy')}
          className={`pb-3 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'privacy'
            ? 'border-orange-500 text-orange-600'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Quyền riêng tư & Xóa dữ liệu
        </button>
      </div>

      {/* ── Subtab 1: Thông tin cá nhân ───────────────────────────────────────── */}
      {activeTab === 'info' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" />
              Chỉnh Sửa Hồ Sơ Cá Nhân
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cập nhật tên hiển thị của bạn trên hệ thống và số điện thoại liên lạc.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Họ và tên hiển thị *
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập tên của bạn"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-orange-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email tài khoản (định danh duy nhất)
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-500 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Email dùng để đăng nhập và nhận thông báo khôi phục mật khẩu.
              </span>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Subtab 2: Đổi mật khẩu ────────────────────────────────────────────── */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-orange-500" />
              Bảo Mật Tài Khoản & Đổi Mật Khẩu
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Đổi mật khẩu định kỳ giúp bảo vệ tài khoản và dữ liệu thực đơn cá nhân của bạn.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mật khẩu hiện tại *
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu đang sử dụng"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-orange-500 transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu mới *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-orange-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-orange-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 space-y-1">
              <span className="font-bold text-slate-700 block">Tiêu chuẩn mật khẩu an toàn:</span>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Tối thiểu 8 ký tự trở lên</li>
                <li>Gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số</li>
              </ul>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={changingPassword}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                {changingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu mới'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Subtab 3: Món ăn yêu thích ────────────────────────────────────────── */}
      {activeTab === 'favorites' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                Món Ăn Yêu Thích Của Bạn ({favoritesList.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Danh sách những món ăn bạn đã lưu lại để nấu hoặc tham khảo lại.
              </p>
            </div>

            {favoritesList.length > 0 && (
              <button
                onClick={handleClearFavorites}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa tất cả yêu thích
              </button>
            )}
          </div>

          {loadingFavorites ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
              Đang tải danh sách món yêu thích...
            </div>
          ) : favoritesList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Heart className="w-10 h-10 text-slate-200 mx-auto" />
              <p className="text-xs">Bạn chưa lưu món ăn nào vào danh sách yêu thích.</p>
              <p className="text-[11px] text-slate-400">
                Hãy nhấn biểu tượng trái tim khi xem công thức để lưu món vào đây!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {favoritesList.map((dish) => (
                <div
                  key={dish.id}
                  onClick={() => onOpenRecipe(dish)}
                  className="group bg-slate-50 hover:bg-white border border-slate-200 hover:border-orange-300 rounded-2xl overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative aspect-video overflow-hidden bg-slate-100">
                    <img
                      src={dish.image}
                      alt={dish.title}
                      loading="lazy" decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold backdrop-blur-xs">
                      {dish.category || 'Món ăn'}
                    </span>
                  </div>
                  <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-1">
                        {dish.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {dish.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>⏱ {formatMetric(dish.cookingTime)} phút</span>
                      <span className="font-bold text-orange-600">{formatMetric(dish.macros.calories, ' kcal')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Subtab 4: Lịch sử xem món ─────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                Lịch Sử Duyệt Món Ăn ({viewHistoryList.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Các món ăn bạn đã mở xem chi tiết gần đây. ChefAI dùng lịch sử này để tinh chỉnh gợi ý phù hợp.
              </p>
            </div>

            {viewHistoryList.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa lịch sử xem
              </button>
            )}
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
              Đang tải lịch sử xem...
            </div>
          ) : viewHistoryList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <Clock className="w-10 h-10 text-slate-200 mx-auto mb-1" />
              <p className="text-xs">Chưa có lịch sử xem món ăn nào.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {viewHistoryList.map((item, idx) => {
                const dish = item.dish || item;
                return (
                  <div
                    key={idx}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {dish.image_url && (
                        <img
                          src={dish.image_url}
                          alt={dish.name || 'Món'}
                          loading="lazy" decoding="async"
                          className="w-12 h-12 rounded-xl object-cover"
                        />
                      )}
                      <div>
                        <div className="font-bold text-xs text-slate-900">{dish.name || 'Món ăn'}</div>
                        <div className="text-[11px] text-slate-400">
                          {dish.calories ? `${dish.calories} kcal` : ''} • {(item.last_viewed_at || item.viewed_at) ? new Date(item.last_viewed_at || item.viewed_at).toLocaleString('vi-VN') : 'Gần đây'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Subtab 5: Quyền riêng tư & Xóa dữ liệu ─────────────────────── */}
      {activeTab === 'privacy' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Quyền Riêng Tư & Quản Lý Dữ Liệu Cá Nhân
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Toàn quyền kiểm soát và xóa các bản ghi lịch sử, phiên hội thoại AI hoặc xóa hoàn toàn tài khoản.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lịch sử Chatbot AI */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3">
              <div>
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-orange-500" />
                  Lịch Sử Hội Thoại Chatbot AI ({chatSessionsList.length})
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Bao gồm các đoạn chat tư vấn nguyên liệu, đề xuất bữa ăn và tinh chỉnh công thức cùng Trợ lý ChefAI.
                </p>
              </div>
              <button
                onClick={handleDeleteChatHistory}
                className="w-full py-2 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                Xóa tất cả lịch sử trò chuyện
              </button>
            </div>

            {/* Món ăn yêu thích */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3">
              <div>
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-500" />
                  Món Ăn Yêu Thích
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Xóa toàn bộ các món bạn đã thả tim lưu trong kho yêu thích cá nhân.
                </p>
              </div>
              <button
                onClick={handleClearFavorites}
                className="w-full py-2 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                Xóa danh sách yêu thích
              </button>
            </div>
          </div>

          {/* Danger zone: Delete Account */}
          <div className="mt-6 pt-6 border-t border-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-red-50/60 border border-red-200/60">
            <div>
              <span className="text-xs font-black text-red-700 flex items-center gap-1.5 uppercase tracking-wide">
                <AlertCircle className="w-4 h-4 text-red-600" />
                Vùng nguy hiểm: Xóa tài khoản vĩnh viễn
              </span>
              <p className="text-[11px] text-red-600/80 mt-1">
                Toàn bộ thông tin tài khoản, hồ sơ khẩu vị, danh sách dị ứng và các đoạn hội thoại sẽ bị xóa vĩnh viễn khỏi hệ thống.
              </p>
            </div>
            <button
              onClick={handleDeleteAccount}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa tài khoản cá nhân
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
