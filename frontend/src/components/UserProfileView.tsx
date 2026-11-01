import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  KeyRound,
  Heart,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Camera,
  Upload,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChefHat,
  MessageSquare,
  Flame,
  Loader2,
  ChevronRight,
  Fingerprint,
  IdCard,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import { UserProfile, Recipe } from '../types';
import { apiService } from '../api';
import { DEFAULT_AVATAR, formatMetric } from '../utils/dishUtils';
import { toast, showConfirm, showPrompt } from './NotificationModal';

interface UserProfileViewProps {
  currentUser: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onGoToChat: (prompt?: string) => void;
  onGoToTasteProfile: () => void;
}

type SectionId = 'info' | 'security' | 'activity' | 'danger';
type ActivityTab = 'favorites' | 'history' | 'chats';

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  onUpdateUser,
  onOpenRecipe,
  onGoToChat,
  onGoToTasteProfile,
}) => {
  const [activeSection, setActiveSection] = useState<SectionId>('info');
  const [activityTab, setActivityTab] = useState<ActivityTab>('favorites');
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

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

  // 2. Tải sẵn dữ liệu hoạt động để hiện số lượng trên các tab của Phần 3
  useEffect(() => {
    loadFavorites();
    loadViewHistory();
    loadChatSessions();
  }, []);

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

  const avatarSrc = avatarUrl && !isPersonPhoto(avatarUrl) ? avatarUrl : DEFAULT_AVATAR;
  const shortId = currentUser.id ? currentUser.id.substring(0, 8).toUpperCase() : '—';

  // Độ mạnh mật khẩu mới: đủ 8 ký tự, có chữ hoa, có chữ số, có ký tự đặc biệt
  const passwordStrength = [
    newPassword.length >= 8,
    /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword),
    /\d/.test(newPassword),
    /[^A-Za-z0-9]/.test(newPassword),
  ].filter(Boolean).length;
  const strengthLabel = ['Độ mạnh mật khẩu', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'][newPassword ? passwordStrength : 0];
  const strengthColor = passwordStrength <= 1 ? 'bg-red-500' : passwordStrength === 2 ? 'bg-orange-400' : passwordStrength === 3 ? 'bg-orange-500' : 'bg-emerald-500';

  const scrollTo = (id: SectionId) => {
    setActiveSection(id);
    document.getElementById(`account-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navItem = (id: SectionId, icon: React.ReactNode, label: string, trailing?: React.ReactNode, danger = false) => (
    <button
      onClick={() => scrollTo(id)}
      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-left transition-colors cursor-pointer ${
        danger
          ? 'text-danger hover:bg-danger-soft/50'
          : activeSection === id
            ? 'bg-orange-50 text-orange-600'
            : 'text-slate-600 hover:bg-surface'
      }`}
    >
      <span className="flex items-center gap-2.5">
        {icon}
        {label}
      </span>
      {trailing ?? <ChevronRight className="w-4 h-4 opacity-60" />}
    </button>
  );

  const sectionHeading = (part: string, title: string, aside?: React.ReactNode, danger = false) => (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className={`text-[11px] font-bold uppercase tracking-wider ${danger ? 'text-danger' : 'text-orange-600'}`}>{part}</div>
        <h2 className="text-2xl sm:text-[28px] sm:leading-[36px] font-bold text-ink">{title}</h2>
      </div>
      {aside}
    </div>
  );

  const fieldClass = 'w-full h-12 px-4 bg-surface rounded-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] font-display text-sm text-ink placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-500/30 transition-shadow';

  const passwordField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    key: 'current' | 'new' | 'confirm',
  ) => (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-ink">{label}</label>
      <div className="relative">
        <input
          type={showPasswords[key] ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${fieldClass} pr-11`}
          required
        />
        <button
          type="button"
          onClick={() => setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          aria-label={showPasswords[key] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {showPasswords[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  const emptyState = (icon: React.ReactNode, text: string, hint?: string) => (
    <div className="py-12 text-center space-y-2 rounded-2xl bg-surface">
      <div className="flex justify-center text-slate-300">{icon}</div>
      <p className="text-sm text-slate-500">{text}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );

  const loadingState = (text: string) => (
    <div className="py-12 text-center text-sm text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
      {text}
    </div>
  );

  const activityTabButton = (tab: ActivityTab, label: string, count: number) => (
    <button
      onClick={() => setActivityTab(tab)}
      className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
        activityTab === tab ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-ink'
      }`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Banner hồ sơ ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-surface rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full blur-[40px] bg-gradient-to-br from-orange-500/15 via-orange-400/10 to-transparent pointer-events-none" />

        <div className="relative flex items-center gap-4">
          <div className="relative shrink-0">
            <img
              src={avatarSrc}
              alt={displayName}
              className="w-20 h-20 rounded-2xl object-cover bg-line shadow-[0_0_0_4px_white,0_4px_6px_-1px_rgba(0,0,0,0.1)]"
            />
            <label
              className="absolute -right-1 -bottom-1 w-7 h-7 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-md cursor-pointer"
              title="Đổi ảnh đại diện"
            >
              {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              <input type="file" accept="image/*" onChange={handleAvatarFile} disabled={uploadingAvatar} className="hidden" />
            </label>
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] leading-[30px] font-bold text-ink truncate">{displayName || 'Đầu bếp tại gia'}</h1>
            <div className="flex flex-wrap items-center gap-2 font-display text-sm text-slate-600">
              <span className="truncate">{email || 'Chưa cập nhật email'}</span>
              <span className="w-1 h-1 rounded-full bg-slate-400" />
              <span>{currentUser.role === 'admin' ? 'Quản trị viên' : 'Thành viên ChefAI'}</span>
              {currentUser.joinedDate && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-400" />
                  <span>Tham gia từ {currentUser.joinedDate}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          <button
            onClick={onGoToTasteProfile}
            className="px-4 py-2 bg-white hover:bg-orange-50 text-ink text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ChefHat className="w-4 h-4 text-orange-500" />
            Hồ sơ khẩu vị
          </button>
          <button
            onClick={() => onGoToChat()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4" />
            Mở Chatbot AI
          </button>
        </div>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-[222px_1fr] gap-6 items-start">
        {/* ── Menu phụ bên trái ─────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="bg-white rounded-2xl p-2 shadow-[0_1px_1px_rgba(0,0,0,0.05)] space-y-1">
            <div className="px-4 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Quản trị cá nhân
            </div>
            {navItem('info', <IdCard className="w-4 h-4" />, 'Thông tin cá nhân')}
            {navItem('security', <KeyRound className="w-4 h-4" />, 'Mật khẩu & Bảo mật')}
            {navItem(
              'activity',
              <Heart className="w-4 h-4" />,
              'Yêu thích & Lịch sử',
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-surface-2 text-[11px] font-bold text-slate-600 flex items-center justify-center">
                {favoritesList.length}
              </span>,
            )}
            <div className="py-1"><div className="h-px bg-line" /></div>
            {navItem('danger', <ShieldAlert className="w-4 h-4" />, 'Vùng nguy hiểm', <span className="text-danger font-bold">!</span>, true)}
          </div>
        </div>

        {/* ── Nội dung bên phải ─────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {/* PHẦN 1: Thông tin tài khoản & ảnh đại diện */}
          <section id="account-info" className="scroll-mt-24 bg-white rounded-2xl p-6 shadow-[0_1px_1px_rgba(0,0,0,0.05)] space-y-6">
            {sectionHeading(
              'Phần 1',
              'Thông tin tài khoản & Ảnh đại diện',
              <span className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-line text-[11px] font-bold text-slate-600">
                <Fingerprint className="w-3.5 h-3.5" />
                ID: {shortId}
              </span>,
            )}

            <div className="bg-surface rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className="w-20 h-24 rounded-2xl object-cover bg-line shadow-[0_0_0_2px_rgba(249,115,22,0.3),0_4px_6px_-1px_rgba(0,0,0,0.1)]"
                />
                <div>
                  <div className="text-lg font-display font-bold text-ink">Ảnh đại diện ChefAI</div>
                  <p className="text-xs text-slate-600 mt-0.5">Hỗ trợ JPG, PNG, WEBP. Kích thước khuyến nghị tối đa 5MB.</p>
                </div>
              </div>
              <label className="shrink-0 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploadingAvatar ? 'Đang tải lên...' : 'Tải ảnh mới'}
                <input type="file" accept="image/*" onChange={handleAvatarFile} disabled={uploadingAvatar} className="hidden" />
              </label>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-ink">
                    Họ và tên hiển thị <span className="text-orange-600">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nhập tên của bạn"
                      className={`${fieldClass} pl-11`}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-ink">Địa chỉ Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input type="email" value={email} disabled className={`${fieldClass} pl-11 text-slate-500 cursor-not-allowed`} />
                  </div>
                  <span className="text-[11px] text-slate-400 block">Email dùng để đăng nhập và khôi phục mật khẩu.</span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-8 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </section>

          {/* PHẦN 2: Đổi mật khẩu */}
          <section id="account-security" className="scroll-mt-24 bg-white rounded-2xl p-6 shadow-[0_1px_1px_rgba(0,0,0,0.05)] space-y-6">
            {sectionHeading('Phần 2', 'Đổi mật khẩu & Bảo mật', <ShieldCheck className="w-6 h-6 text-orange-500 shrink-0" />)}

            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {passwordField('Mật khẩu hiện tại', currentPassword, setCurrentPassword, '••••••••', 'current')}
                <div className="space-y-1">
                  {passwordField('Mật khẩu mới', newPassword, setNewPassword, 'Tối thiểu 8 ký tự', 'new')}
                  <div className="flex gap-1 pt-1">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`flex-1 h-1 rounded-full ${newPassword && i < passwordStrength ? strengthColor : 'bg-surface-2'}`} />
                    ))}
                  </div>
                  <div className="text-[11px] font-bold text-slate-400">{strengthLabel}</div>
                </div>
                {passwordField('Xác nhận mật khẩu mới', confirmPassword, setConfirmPassword, 'Nhập lại mật khẩu', 'confirm')}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                  Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số.
                </span>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {changingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          </section>

          {/* PHẦN 3: Món yêu thích & lịch sử hoạt động */}
          <section id="account-activity" className="scroll-mt-24 bg-white rounded-2xl p-6 shadow-[0_1px_1px_rgba(0,0,0,0.05)] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {sectionHeading('Phần 3', 'Món yêu thích & Lịch sử hoạt động')}
              <div className="flex items-center gap-1 p-1 bg-surface rounded-xl overflow-x-auto no-scrollbar shrink-0">
                {activityTabButton('favorites', 'Yêu thích', favoritesList.length)}
                {activityTabButton('history', 'Đã xem', viewHistoryList.length)}
                {activityTabButton('chats', 'Hội thoại AI', chatSessionsList.length)}
              </div>
            </div>

            {activityTab === 'favorites' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-sm text-slate-600">Bộ sưu tập công thức bạn đã thả tim:</p>
                  {favoritesList.length > 0 && (
                    <button onClick={handleClearFavorites} className="text-xs font-semibold text-red-600 hover:underline cursor-pointer flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa tất cả
                    </button>
                  )}
                </div>
                {loadingFavorites ? loadingState('Đang tải danh sách món yêu thích...') : favoritesList.length === 0 ? (
                  emptyState(<Heart className="w-10 h-10" />, 'Bạn chưa lưu món ăn nào vào danh sách yêu thích.', 'Hãy nhấn biểu tượng trái tim khi xem công thức để lưu món vào đây!')
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {favoritesList.map((dish) => (
                      <button
                        key={dish.id}
                        onClick={() => onOpenRecipe(dish)}
                        className="group text-left bg-surface hover:bg-orange-50/60 rounded-2xl p-2 space-y-2 transition-colors cursor-pointer"
                      >
                        <div className="relative h-36 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] bg-line">
                          <img
                            src={dish.image}
                            alt={dish.title}
                            loading="lazy" decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {dish.category && (
                            <span className="absolute left-2 top-2 px-1.5 py-0.5 rounded-full bg-mint text-[11px] font-bold text-emerald-800">
                              {dish.category}
                            </span>
                          )}
                          <span className="absolute right-2 top-2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center">
                            <Heart className="w-4 h-4 text-orange-500 fill-orange-500" />
                          </span>
                        </div>
                        <div className="px-1 pb-1">
                          <div className="font-display text-lg font-bold text-ink truncate group-hover:text-orange-600 transition-colors">{dish.title}</div>
                          <div className="flex items-center justify-between pt-1 text-[11px] font-bold text-slate-600">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatMetric(dish.cookingTime)} phút</span>
                            <span className="flex items-center gap-1"><Flame className="w-3 h-3" />{formatMetric(dish.macros.calories, ' kcal')}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activityTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-sm text-slate-600">Món bạn mở xem gần đây — ChefAI dùng để tinh chỉnh gợi ý.</p>
                  {viewHistoryList.length > 0 && (
                    <button onClick={handleClearHistory} className="text-xs font-semibold text-red-600 hover:underline cursor-pointer flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa lịch sử
                    </button>
                  )}
                </div>
                {loadingHistory ? loadingState('Đang tải lịch sử xem...') : viewHistoryList.length === 0 ? (
                  emptyState(<Clock className="w-10 h-10" />, 'Chưa có lịch sử xem món ăn nào.')
                ) : (
                  <div className="space-y-2">
                    {viewHistoryList.map((item, idx) => {
                      const dish = item.dish || item;
                      return (
                        <div key={idx} className="flex items-center gap-3 p-2 rounded-xl bg-surface">
                          {dish.image_url && (
                            <img src={dish.image_url} alt={dish.name || 'Món'} loading="lazy" decoding="async" className="w-12 h-12 rounded-xl object-cover" />
                          )}
                          <div className="min-w-0">
                            <div className="font-display font-bold text-sm text-ink truncate">{dish.name || 'Món ăn'}</div>
                            <div className="text-[11px] text-slate-500">
                              {dish.calories ? `${dish.calories} kcal • ` : ''}
                              {(item.last_viewed_at || item.viewed_at) ? new Date(item.last_viewed_at || item.viewed_at).toLocaleString('vi-VN') : 'Gần đây'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activityTab === 'chats' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-sm text-slate-600">Các phiên trò chuyện với Trợ lý ChefAI.</p>
                  {chatSessionsList.length > 0 && (
                    <button onClick={handleDeleteChatHistory} className="text-xs font-semibold text-red-600 hover:underline cursor-pointer flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa tất cả hội thoại
                    </button>
                  )}
                </div>
                {loadingChat ? loadingState('Đang tải lịch sử hội thoại...') : chatSessionsList.length === 0 ? (
                  emptyState(<MessageSquare className="w-10 h-10" />, 'Bạn chưa có cuộc hội thoại nào với Trợ lý AI.')
                ) : (
                  <div className="space-y-2">
                    {chatSessionsList.map((session, idx) => (
                      <div key={session.id || idx} className="flex items-center gap-3 p-3 rounded-xl bg-surface">
                        <span className="w-9 h-9 rounded-xl bg-white text-orange-500 flex items-center justify-center shrink-0">
                          <MessageSquare className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-display font-bold text-sm text-ink truncate">{session.title || 'Cuộc trò chuyện'}</div>
                          <div className="text-[11px] text-slate-500">
                            {(session.updated_at || session.created_at) ? new Date(session.updated_at || session.created_at).toLocaleString('vi-VN') : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* PHẦN 4: Vùng nguy hiểm */}
          <section id="account-danger" className="scroll-mt-24 bg-white rounded-2xl p-6 shadow-[0_1px_1px_rgba(0,0,0,0.05)] space-y-4">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-danger">
              <AlertTriangle className="w-4 h-4" />
              Phần 4 - Vùng nhạy cảm & Quyền riêng tư
            </div>
            <h2 className="text-2xl sm:text-[28px] sm:leading-[36px] font-bold text-ink">Xóa tài khoản vĩnh viễn</h2>

            <div className="bg-danger-soft rounded-2xl p-4 flex gap-4">
              <AlertTriangle className="w-6 h-6 text-danger shrink-0" />
              <div className="space-y-1 text-[#93000a]">
                <div className="font-display text-lg font-bold">Cảnh báo quan trọng trước khi tiếp tục:</div>
                <p className="font-display text-sm leading-[22.75px]">
                  Hành động này sẽ xóa vĩnh viễn toàn bộ hồ sơ khẩu vị, danh sách dị ứng, món đã lưu và lịch sử hội thoại với Trợ lý AI.
                  Dữ liệu một khi đã xóa sẽ <span className="font-bold underline">không thể phục hồi</span>.
                </p>
              </div>
            </div>

            <div className="bg-surface rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-ink">Bạn muốn hủy tư cách thành viên?</div>
                <p className="text-xs text-slate-600">Bạn sẽ cần nhập cụm từ xác nhận và mật khẩu hiện tại để hoàn tất.</p>
              </div>
              <button
                onClick={handleDeleteAccount}
                className="shrink-0 px-6 py-2.5 bg-white hover:bg-danger-soft/60 text-danger text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Yêu cầu xóa tài khoản
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
