import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  Users, 
  Flame, 
  Bookmark, 
  Share2, 
  Printer, 
  Sparkles, 
  Volume2, 
  Star, 
  Plus, 
  Minus, 
  Play, 
  Pause, 
  CheckCircle2, 
  Lightbulb,
  Heart,
  Loader2,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { Recipe, UserProfile } from '../types';
import { apiService } from '../services/api';
import { formatVND } from '../utils/dishUtils';
import { toast } from './NotificationModal';

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  onClose: () => void;
  currentUser: UserProfile;
  onAddToPlanner: (recipe: Recipe) => void;
  onOpenAuth?: () => void;
  onOpenChatWithPrompt?: (prompt: string, fridgeContext?: string[]) => void;
}

interface CommunityReviewItem {
  id: string | number;
  author: string;
  avatar?: string;
  rating: number;
  comment: string;
  timeAgo: string;
}

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  recipe: initialRecipe,
  onClose,
  currentUser,
  onAddToPlanner,
  onOpenAuth,
  onOpenChatWithPrompt,
}) => {
  if (!initialRecipe) return null;

  const [recipe, setRecipe] = useState<Recipe>(initialRecipe);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [servings, setServings] = useState(initialRecipe.servings || 2);
  const [activeStep, setActiveStep] = useState(1);
  const [isCookingAudioMode, setIsCookingAudioMode] = useState(false);
  const [activeTimerSeconds, setActiveTimerSeconds] = useState(240);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isMarkedCooked, setIsMarkedCooked] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  // Nguyên liệu người dùng đánh dấu là đang có sẵn (theo tên)
  const [haveIngredients, setHaveIngredients] = useState<Set<string>>(new Set());

  // Review state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewsList, setReviewsList] = useState<CommunityReviewItem[]>([]);
  const [reviewSummary, setReviewSummary] = useState<{ average: number; count: number } | null>(null);
  const [myRatingId, setMyRatingId] = useState<number | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch full detail & live ratings on mount / recipe change
  useEffect(() => {
    let isMounted = true;
    const fetchFullData = async () => {
      setLoadingDetail(true);
      try {
        const detail = await apiService.dishes.getDetail(initialRecipe.id);
        if (isMounted && detail) {
          setRecipe(detail);
          setServings(detail.servings || 2);
          setIsFavorite(Boolean(detail.is_favorite));
          // Người dùng đã đánh giá món này: điền sẵn để sửa (mỗi người chỉ có một đánh giá cho một món)
          if (detail.my_rating) {
            setMyRatingId(detail.my_rating.id);
            setReviewRating(detail.my_rating.stars);
            setReviewComment(detail.my_rating.comment || '');
          }
        }
      } catch (err) {
        console.warn('Could not load detailed dish, using preview:', err);
      } finally {
        if (isMounted) setLoadingDetail(false);
      }

      // Fetch live ratings
      try {
        const ratingRes = await apiService.dishes.getRatings(initialRecipe.id);
        if (isMounted && ratingRes.data) {
          const { summary, items } = ratingRes.data as any;
          if (summary) {
            setReviewSummary({ average: summary.average, count: summary.count });
          }
          if (items && Array.isArray(items)) {
            const mapped: CommunityReviewItem[] = items.map((r: any) => ({
              id: r.id,
              author: r.user?.display_name || r.user?.name || 'Thành viên Culina',
              avatar: r.user?.avatar_url || r.user?.avatar,
              rating: r.stars || 5,
              comment: r.comment || '',
              timeAgo: new Date(r.created_at).toLocaleDateString('vi-VN'),
            }));
            setReviewsList(mapped);
          }
        }
      } catch (err) {
        console.warn('Could not load dish ratings from backend:', err);
      }
    };

    fetchFullData();
    return () => { isMounted = false; };
  }, [initialRecipe.id]);

  // Handle Timer Countdown
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && activeTimerSeconds > 0) {
      interval = setInterval(() => {
        setActiveTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (activeTimerSeconds === 0) {
      setIsTimerRunning(false);
      if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance('Đã hết thời gian nấu cho bước này!');
        msg.lang = 'vi-VN';
        window.speechSynthesis.speak(msg);
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, activeTimerSeconds]);

  // Dynamic ingredient scale factor
  const scale = servings / (recipe.servings || 2);

  const allIngredientNames = (recipe.ingredients || []).map(ing => ing.name).filter(Boolean);
  const missingIngredients = allIngredientNames.filter(name => !haveIngredients.has(name));

  const toggleHaveIngredient = (name: string) => {
    setHaveIngredients(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleAskSubstitutes = () => {
    if (!onOpenChatWithPrompt || missingIngredients.length === 0) return;
    const have = allIngredientNames.filter(name => haveIngredients.has(name));
    let prompt = `Mình muốn nấu món "${recipe.title}" nhưng đang thiếu: ${missingIngredients.join(', ')}. Có thể dùng nguyên liệu nào để thay thế?`;
    if (have.length > 0) prompt += ` Mình đang có sẵn: ${have.join(', ')}.`;
    onOpenChatWithPrompt(prompt, have);
  };

  const handleSpeechStep = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleStartTimer = (durationMinutes: number) => {
    setActiveTimerSeconds(Math.max(1, durationMinutes) * 60);
    setIsTimerRunning(true);
    setIsCookingAudioMode(true);
  };

  const handleToggleFavorite = async () => {
    if (!currentUser.isLoggedIn) {
      if (onOpenAuth) onOpenAuth();
      else toast.warning('Vui lòng đăng nhập để lưu món ăn yêu thích!');
      return;
    }
    try {
      setFavLoading(true);
      await apiService.dishes.toggleFavorite(recipe.id, isFavorite);
      setIsFavorite(!isFavorite);
      toast.success(
        !isFavorite ? `Đã lưu "${recipe.title}" vào danh sách yêu thích!` : `Đã bỏ lưu món "${recipe.title}"`,
        'Yêu thích'
      );
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật danh sách yêu thích');
    } finally {
      setFavLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reviewRating < 1 || reviewRating > 5) return;

    if (!currentUser.isLoggedIn) {
      if (onOpenAuth) onOpenAuth();
      else toast.warning('Vui lòng đăng nhập để đánh giá món ăn!');
      return;
    }

    try {
      setIsSubmittingReview(true);
      setReviewMessage(null);
      const comment = reviewComment.trim();

      if (myRatingId) {
        await apiService.dishes.updateRating(myRatingId, reviewRating, comment || null);
        setReviewsList(prev => prev.map(r => r.id === myRatingId
          ? { ...r, rating: reviewRating, comment: comment || `Đã chấm ${reviewRating} sao`, timeAgo: 'Vừa cập nhật' }
          : r));
        setReviewMessage({ type: 'success', text: 'Đã cập nhật đánh giá của bạn!' });
      } else {
        const res = await apiService.dishes.createRating(recipe.id, reviewRating, comment || undefined);
        const created = res.data?.rating;
        if (created) setMyRatingId(created.id);
        if (res.data?.rating_summary) setReviewSummary(res.data.rating_summary);

        const newRev: CommunityReviewItem = {
          id: created?.id ?? `rev-${Date.now()}`,
          author: currentUser.name || 'Bạn',
          rating: reviewRating,
          comment: comment || `Đã chấm ${reviewRating} sao`,
          timeAgo: 'Vừa xong',
        };
        setReviewsList([newRev, ...reviewsList]);
        setReviewMessage({ type: 'success', text: 'Cảm ơn bạn đã gửi đánh giá món ăn thành công!' });
      }
    } catch (err: any) {
      setReviewMessage({ type: 'error', text: err.message || 'Lỗi khi gửi đánh giá. Vui lòng thử lại.' });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex justify-center p-2 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-200/80">
        {/* Sticky Top Action Bar */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button onClick={onClose} className="font-bold text-slate-700 hover:text-orange-600 cursor-pointer">
              ← Quay lại
            </button>
            <span>/</span>
            <span>Khám phá món ăn</span>
            <span>/</span>
            <span className="font-semibold text-orange-600">{recipe.category}</span>
            {loadingDetail && (
              <span className="flex items-center gap-1 text-[11px] text-orange-500 font-medium">
                <Loader2 className="w-3 h-3 animate-spin" /> Đang cập nhật...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFavorite}
              disabled={favLoading}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isFavorite 
                  ? 'bg-rose-50 text-rose-600' 
                  : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50'
              }`}
              title={isFavorite ? 'Bỏ yêu thích' : 'Lưu vào yêu thích'}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
            <button
              onClick={() => onAddToPlanner(recipe)}
              className="p-2 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer"
              title="Lưu vào thực đơn"
            >
              <Bookmark className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: recipe.title, text: recipe.description, url: window.location.href });
                } else {
                  navigator.clipboard?.writeText(window.location.href);
                  toast.success('Đã sao chép liên kết công thức vào bộ nhớ tạm!', 'Chia sẻ');
                }
              }}
              className="p-2 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer"
              title="Chia sẻ"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.print()}
              className="p-2 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer"
              title="In công thức"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-10 space-y-10 max-h-[85vh] overflow-y-auto">
          {/* ===================== HERO SECTION ===================== */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {recipe.matchPercentage ? (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  AI Match {recipe.matchPercentage}% khẩu vị
                </span>
              ) : null}
              {recipe.tags && recipe.tags.map(t => (
                <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  #{t}
                </span>
              ))}
            </div>

            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                {recipe.title}
              </h1>
              {recipe.englishTitle && (
                <p className="text-sm font-medium text-slate-400 italic mt-0.5">
                  {recipe.englishTitle}
                </p>
              )}
              {recipe.description && (
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  {recipe.description}
                </p>
              )}
            </div>

            {/* Quick Meta Row */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 pt-1">
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-slate-900 font-bold">{recipe.rating || (reviewSummary?.average || 5.0)}</span>
                <span className="text-slate-400 font-normal">
                  ({recipe.reviewCount || (reviewSummary?.count || reviewsList.length)} đánh giá)
                </span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <span>Độ khó: <strong className="text-slate-800">{recipe.difficulty}</strong></span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-orange-500" />
                <span>Nấu: <strong className="text-slate-800">{recipe.cookingTime} phút</strong></span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-orange-500" />
                <span>Khẩu phần: <strong className="text-slate-800">{servings} Người</strong></span>
              </div>
              {recipe.pricePerServing ? (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1 text-emerald-700 font-bold">
                    <span>Ước tính: {formatVND(recipe.pricePerServing * servings)}</span>
                  </div>
                </>
              ) : null}
            </div>

            {/* Hero Image */}
            <div className="relative rounded-3xl overflow-hidden aspect-16/9 sm:aspect-21/9 group shadow-sm border border-slate-100">
              <img
                src={recipe.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80'}
                alt={recipe.title}
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
              />
              <div className="absolute bottom-4 left-4 right-4 sm:right-auto bg-slate-900/85 backdrop-blur-md p-3 rounded-2xl text-white flex items-center justify-between gap-4 border border-white/10 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white font-bold shrink-0">
                    <Play className="w-5 h-5 ml-0.5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold">Video hướng dẫn chuẩn Chef</h5>
                    <p className="text-[11px] text-slate-300">Độ phân giải Full HD • Phụ đề tiếng Việt chuẩn xác</p>
                  </div>
                </div>
                <button
                  onClick={() => toast.info('Chức năng video hướng dẫn 4K sẽ phát trực tiếp tại bản cập nhật tiếp theo!', 'Video chuẩn Chef')}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Xem ngay
                </button>
              </div>
            </div>

            {/* Nutrients & Macro Dashboard */}
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  Chỉ số Dinh dưỡng Tính toán Theo Khẩu phần
                </h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Chuẩn Macro / {servings} người
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Năng lượng</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{Math.round(recipe.macros.calories * (servings / (recipe.servings || 2)))}</div>
                  <span className="text-[10px] text-slate-400">kcal</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Protein (Đạm)</span>
                  <div className="text-lg font-black text-orange-600 mt-0.5">{Math.round(recipe.macros.protein * (servings / (recipe.servings || 2)))}g</div>
                  <span className="text-[10px] text-emerald-600 font-semibold">Tốt cho cơ bắp</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Carbs (Tinh bột)</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{Math.round(recipe.macros.carbs * (servings / (recipe.servings || 2)))}g</div>
                  <span className="text-[10px] text-slate-400">Năng lượng sạch</span>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Chất béo (Fat)</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{Math.round(recipe.macros.fat * (servings / (recipe.servings || 2)))}g</div>
                  <span className="text-[10px] text-slate-400">Lipid lành mạnh</span>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => handleStartTimer(recipe.steps[0]?.durationMinutes || 5)}
                  className="px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  Bắt đầu nấu (AI Audio Hướng dẫn)
                </button>
                <button
                  onClick={() => onAddToPlanner(recipe)}
                  className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs sm:text-sm rounded-2xl transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Bookmark className="w-4 h-4 text-orange-500" />
                  Thêm vào Thực đơn tuần
                </button>
              </div>
            </div>
          </div>

          {/* ===================== TWO-COLUMN BODY ===================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 5 Cols: Ingredients & Utensils */}
            <div className="lg:col-span-5 space-y-6">
              {/* Ingredients Card */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Nguyên liệu chuẩn bị
                    </h3>
                    <p className="text-[11px] text-slate-400">Tick vào nguyên liệu bạn đang có sẵn</p>
                  </div>
                  {/* Servings Stepper */}
                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setServings(Math.max(1, servings - 1))}
                      className="w-7 h-7 rounded-lg bg-white shadow-2xs flex items-center justify-center text-slate-700 hover:text-orange-600 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-slate-900 w-6 text-center">{servings}</span>
                    <button
                      onClick={() => setServings(servings + 1)}
                      className="w-7 h-7 rounded-lg bg-white shadow-2xs flex items-center justify-center text-slate-700 hover:text-orange-600 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Ingredients List */}
                <div className="space-y-2.5 text-xs">
                  {recipe.ingredients && recipe.ingredients.length > 0 ? (
                    recipe.ingredients.map(ing => (
                      <label key={ing.id || ing.name} className="flex items-center justify-between py-2 border-b border-slate-50 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={haveIngredients.has(ing.name)}
                            onChange={() => toggleHaveIngredient(ing.name)}
                            className="accent-emerald-600 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className={`font-medium ${haveIngredients.has(ing.name) ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{ing.name}</span>
                          {ing.isSafe === false ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                              Bạn kiêng
                            </span>
                          ) : ing.allergen && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
                              {ing.allergen}
                            </span>
                          )}
                        </div>
                        <span className="font-extrabold text-slate-900">
                          {Math.round((ing.amount || 1) * scale * 10) / 10} {ing.unit || 'phần'}
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">Nguyên liệu đang được cập nhật từ nhà bếp.</p>
                  )}
                </div>

                {/* AI Substitution */}
                {allIngredientNames.length > 0 && (
                  <div className="p-3.5 bg-orange-50/70 rounded-2xl border border-orange-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-orange-900">
                        <Lightbulb className="w-4 h-4 text-orange-600" />
                        Đã có {allIngredientNames.length - missingIngredients.length}/{allIngredientNames.length} nguyên liệu
                      </div>
                    </div>
                    {missingIngredients.length > 0 ? (
                      <>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Còn thiếu: <strong className="text-slate-800">{missingIngredients.join(', ')}</strong>
                        </p>
                        {onOpenChatWithPrompt && (
                          <button
                            type="button"
                            onClick={handleAskSubstitutes}
                            className="w-full px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Hỏi Trợ lý nguyên liệu thay thế
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-[11px] text-emerald-700 font-semibold">
                        Bạn đã có đủ nguyên liệu, bắt đầu nấu thôi!
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Recommended Utensils */}
              {recipe.utensils && recipe.utensils.length > 0 && (
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 space-y-2.5 text-xs">
                  <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                    DỤNG CỤ KHUYÊN DÙNG
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {recipe.utensils.map(u => (
                      <span key={u} className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-slate-700 font-medium shadow-2xs">
                        {u}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right 7 Cols: Step by Step Cooking Procedure */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Quy trình Chế biến từng bước
                  </h3>
                  <p className="text-xs text-slate-500">
                    Theo sát các chỉ dẫn để đảm bảo độ tươi ngon và hương vị chuẩn nhất.
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg">
                  {recipe.steps ? recipe.steps.length : 0} Bước tổng cộng
                </span>
              </div>

              {/* Steps List */}
              <div className="space-y-4">
                {recipe.steps && recipe.steps.length > 0 ? (
                  recipe.steps.map((step, idx) => (
                    <div
                      key={step.stepNumber || idx + 1}
                      onClick={() => setActiveStep(step.stepNumber || idx + 1)}
                      className={`p-5 rounded-3xl border transition-all cursor-pointer ${
                        activeStep === (step.stepNumber || idx + 1)
                          ? 'bg-white border-orange-400 shadow-md ring-2 ring-orange-500/10'
                          : 'bg-white border-slate-200/80 shadow-2xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-2xl bg-orange-500 text-white font-black text-sm flex items-center justify-center shrink-0">
                            {(step.stepNumber || idx + 1) < 10 ? `0${step.stepNumber || idx + 1}` : step.stepNumber || idx + 1}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{step.title || `Bước ${step.stepNumber || idx + 1}`}</h4>
                            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-orange-500" />
                              Thời gian: {step.durationMinutes || 5} phút
                              {step.temperature && ` • Nhiệt độ: ${step.temperature}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSpeechStep(step.instruction || step.content || '');
                            }}
                            className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer"
                            title="Đọc to chỉ dẫn"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartTimer(step.durationMinutes || 5);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-orange-50 hover:text-orange-700 text-slate-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Hẹn giờ {step.durationMinutes || 5}m
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-slate-800 leading-relaxed mt-2.5 pl-11">
                        {step.instruction}
                      </p>

                      {step.chefTip && (
                        <div className="mt-2.5 ml-11 p-3 bg-orange-50/80 rounded-2xl border border-orange-200/60 text-xs sm:text-sm text-orange-950 flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                          <span>{step.chefTip}</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-400">
                    Chưa có hướng dẫn từng bước chi tiết cho món ăn này.
                  </div>
                )}
              </div>

              {/* Cooked Completed Toggle Card */}
              <div className="p-5 bg-emerald-50/80 rounded-3xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs sm:text-sm font-bold text-emerald-950">
                      Bạn đã hoàn thành món này chưa?
                    </h5>
                    <p className="text-[11px] text-emerald-800">
                      Ghi nhận hoàn thành để ChefAI học khẩu vị và nâng cao độ chính xác gợi ý thực đơn.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMarkedCooked(!isMarkedCooked)}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all shrink-0 cursor-pointer ${
                    isMarkedCooked
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-800 text-white hover:bg-emerald-900'
                  }`}
                >
                  {isMarkedCooked ? '✓ Đã hoàn tất món ăn' : 'Đánh dấu Đã Nấu Xong'}
                </button>
              </div>
            </div>
          </div>

          {/* ===================== COMMUNITY REVIEWS ===================== */}
          <div className="pt-8 border-t border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                  Đánh giá từ Cộng đồng Culina ({reviewsList.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Trải nghiệm thực tế, cảm nhận hương vị và đóng góp từ những người đã nấu món ăn này.
                </p>
              </div>
              <div className="flex items-center gap-3 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-200">
                <span className="text-2xl font-black text-amber-600">
                  {reviewSummary?.average ? reviewSummary.average.toFixed(1) : (recipe.rating || 5.0)}
                </span>
                <div className="text-xs">
                  <div className="flex text-amber-400">★★★★★</div>
                  <span className="text-slate-500 font-semibold">Được đánh giá cao</span>
                </div>
              </div>
            </div>

            {/* Reviews Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviewsList.length === 0 ? (
                <div className="col-span-2 p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                  Chưa có đánh giá nào cho món ăn này từ cộng đồng. Hãy là người đầu tiên nấu và chia sẻ cảm nhận của bạn bên dưới!
                </div>
              ) : (
                reviewsList.map(rev => (
                  <div key={rev.id} className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-xs">
                          {rev.author.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{rev.author}</div>
                          <div className="text-[10px] text-slate-400">{rev.timeAgo}</div>
                        </div>
                      </div>
                      <div className="flex text-amber-400 text-xs font-bold">
                        {'★'.repeat(rev.rating)}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      "{rev.comment}"
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Submit New Review Box */}
            <form onSubmit={handleReviewSubmit} className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-900">
                  Chia sẻ trải nghiệm nấu món ăn của bạn
                </h4>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 font-semibold mr-1">Chấm điểm:</span>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className={`text-lg transition-transform hover:scale-125 cursor-pointer ${
                        reviewRating >= star ? 'text-amber-400' : 'text-slate-300'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {reviewMessage && (
                <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  reviewMessage.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {reviewMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{reviewMessage.text}</span>
                </div>
              )}

              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Bạn đã nêm nếm gia vị thế nào? Món ăn có phù hợp với khẩu vị gia đình bạn không? Viết nhận xét tại đây..."
                rows={3}
                className="w-full p-3.5 bg-white border border-slate-200 focus:border-orange-500 rounded-2xl text-xs font-medium outline-none"
              />

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingReview && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {myRatingId ? 'Cập Nhật Đánh Giá' : 'Gửi Đánh Giá'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Floating Interactive Audio Cooking Modal if activated */}
        {isCookingAudioMode && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white p-4 rounded-3xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in slide-in-from-bottom-4">
            <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center font-bold">
              <Volume2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-orange-400">Đang nấu: Bước 0{activeStep}</div>
              <div className="text-sm font-black">
                {Math.floor(activeTimerSeconds / 60)}:{activeTimerSeconds % 60 < 10 ? '0' : ''}{activeTimerSeconds % 60}
              </div>
            </div>
            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white cursor-pointer"
            >
              {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsCookingAudioMode(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
