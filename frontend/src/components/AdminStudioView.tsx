import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  UtensilsCrossed,
  BookOpen,
  FolderTree,
  Users,
  Bot,
  Sparkles,
  ShieldCheck,
  Check,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  Flame,
  Volume2,
  Lock,
  ChevronRight,
  ChevronLeft,
  ThumbsDown,
  ThumbsUp,
  Database,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  Flag,
  FileText,
  UserCheck,
  MessageSquare,
  Edit3,
  Upload,
  Image as ImageIcon,
  Camera,
  X,
  Settings
} from 'lucide-react';
import { Recipe, AdminStats } from '../types';
import { apiService } from '../api';
import { normalizeDish, formatVND, formatMetric } from '../utils/dishUtils';
import { toast, showConfirm, showPrompt } from './NotificationModal';
import type { DishImportResult } from '../api/admin.api';
import RecipeImportModal from './RecipeImportModal';

// Tên hiển thị của các cột trong file nhập món
const IMPORT_FIELD_LABELS: Record<string, string> = {
  name: 'Tên món',
  description: 'Mô tả',
  category: 'Danh mục',
  cook_time_minutes: 'Thời gian nấu',
  difficulty: 'Độ khó',
  servings: 'Khẩu phần',
  est_cost: 'Chi phí',
  calories: 'Calo',
  protein_g: 'Đạm',
  carbs_g: 'Tinh bột',
  fat_g: 'Chất béo',
  tags: 'Thẻ',
  image_url: 'URL ảnh',
  slug: 'Mã món (slug)',
  source_url: 'Nguồn tham khảo',
};

const DEFAULT_ADMIN_STATS: AdminStats = {
  chatbotInteractions: 0,
  chatSessions: 0,
  activeUsers: 0,
  newUsers: 0,
  totalUsers: 0,
  visits: 0,
  dishesCount: 0,
  hiddenDishesCount: 0,
  aiSuccessRate: null,
  avgResponseMs: 0,
  flaggedMessagesCount: 0,
  chatHourly: [],
  dietDistribution: [],
};

// Màu cho các dòng phân phối chế độ ăn (lặp lại nếu nhiều hơn 4 chế độ)
const DIET_COLORS = [
  { text: 'text-emerald-600', bar: 'bg-emerald-500' },
  { text: 'text-orange-600', bar: 'bg-orange-500' },
  { text: 'text-blue-600', bar: 'bg-blue-500' },
  { text: 'text-purple-600', bar: 'bg-purple-500' },
];

/** Đường cong mượt (Catmull-Rom → Bézier) đi qua 24 điểm theo giờ, khung vẽ 500×120. */
function buildHourlyCurve(hourly: Array<{ hour: number; count: number }>) {
  const counts = Array.from({ length: 24 }, (_, h) => hourly.find(x => x.hour === h)?.count || 0);
  const max = Math.max(...counts);
  const pts = counts.map((c, h) => ({ x: (h / 23) * 500, y: max > 0 ? 105 - (c / max) * 85 : 105 }));
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = Math.min(110, Math.max(10, p1.y + (p2.y - p0.y) / 6));
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = Math.min(110, Math.max(10, p2.y - (p3.y - p1.y) / 6));
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  // Giờ cao điểm trong khung trưa (11h–13h) và tối (17h–20h)
  const peakIn = (from: number, to: number) => {
    let best = from;
    for (let h = from; h <= to; h++) if (counts[h] > counts[best]) best = h;
    return counts[best] > 0 ? { hour: best, ...pts[best] } : null;
  };
  return { d, total: counts.reduce((a, b) => a + b, 0), lunch: peakIn(11, 13), dinner: peakIn(17, 20) };
}

interface AdminStudioViewProps {
  onBackToUserMode: () => void;
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
}

export const AdminStudioView: React.FC<AdminStudioViewProps> = ({
  onBackToUserMode,
  recipes: initialRecipes,
  onOpenRecipe,
}) => {
  const [adminTab, setAdminTab] = useState<'overview' | 'dishes' | 'recipes' | 'categories' | 'users' | 'chatbot'>('overview');

  // Stats state
  const [stats, setStats] = useState<AdminStats>(DEFAULT_ADMIN_STATS);
  const [loadingStats, setLoadingStats] = useState(false);
  // Trạng thái dịch vụ AI (GET /admin/chatbot/health); null khi chưa kiểm tra được
  const [systemHealthy, setSystemHealthy] = useState<boolean | null>(null);
  const [topDishes, setTopDishes] = useState<any[]>([]);
  const [statsDays, setStatsDays] = useState<number>(30);
  const [topDishesBy, setTopDishesBy] = useState<'views' | 'favorites' | 'rating'>('views');

  // Dishes state
  const [dishesList, setDishesList] = useState<Recipe[]>(initialRecipes);
  const [dishSearch, setDishSearch] = useState('');
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(false);
  // Phân trang phía máy chủ: dishesList chỉ chứa các món của trang hiện tại
  const [dishPage, setDishPage] = useState(1);
  const [dishTotal, setDishTotal] = useState(0);
  const DISHES_PER_PAGE = 10;
  const totalDishPages = Math.max(1, Math.ceil(dishTotal / DISHES_PER_PAGE));
  const dishRequestSeq = useRef(0);
  // Toàn bộ món cho ô chọn món ở tab Công thức (không phụ thuộc trang của bảng)
  const [recipeDishOptions, setRecipeDishOptions] = useState<Recipe[]>(initialRecipes);
  const [showAddDishModal, setShowAddDishModal] = useState(false);
  const [reindexingDishId, setReindexingDishId] = useState<string | null>(null);

  // Nhập món từ Excel/CSV
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRecipeImportModal, setShowRecipeImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<DishImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [isCheckingImport, setIsCheckingImport] = useState(false);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // Users state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Audit Logs
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Chatbot overview & monitoring state
  const [chatbotOverview, setChatbotOverview] = useState<any>(null);
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingSessionDetail, setLoadingSessionDetail] = useState(false);
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | 'error' | 'flagged' | 'disliked'>('all');
  const [chatbotConfig, setChatbotConfig] = useState({
    guest_message_limit: 10,
    guest_window_hours: 24,
    system_prompt: '',
    max_context_dishes: 8,
  });
  const [frequentQuestions, setFrequentQuestions] = useState<any[]>([]);
  const [chatbotHealth, setChatbotHealth] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Recipe Management State
  const [selectedRecipeDishId, setSelectedRecipeDishId] = useState<string>('');
  const [recipeServings, setRecipeServings] = useState<number>(2);
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{
    ingredient_id?: number;
    name: string;
    quantity: string | number;
    unit: string;
  }>>([]);
  const [recipeSteps, setRecipeSteps] = useState<Array<{ step_number: number; title: string; instruction: string; duration_minutes: number }>>([]);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [recipeNotice, setRecipeNotice] = useState('');
  const [recipeError, setRecipeError] = useState('');

  // Quick add recipe ingredient & step
  const [newIngName, setNewIngName] = useState('');
  const [newIngQty, setNewIngQty] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('g');
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepInstruction, setNewStepInstruction] = useState('');
  const [newStepDuration, setNewStepDuration] = useState('10');

  // Popular Categories
  const popularCategories = [
    'Eat Clean',
    'Món chính',
    'Món chay',
    'Món xào',
    'Món canh',
    'Món kho',
    'Món nướng',
    'Salad',
    'Tráng miệng',
    'Đồ uống',
    'Keto / Low-carb'
  ];

  // New dish form state
  const [newDishName, setNewDishName] = useState('');
  const [newDishDesc, setNewDishDesc] = useState('');
  const [newDishCategory, setNewDishCategory] = useState('Eat Clean');
  const [newDishImageUrl, setNewDishImageUrl] = useState('');
  const [newDishServings, setNewDishServings] = useState('2');
  const [newDishCalo, setNewDishCalo] = useState('450');
  const [newDishProtein, setNewDishProtein] = useState('35');
  const [newDishCarbs, setNewDishCarbs] = useState('45');
  const [newDishFat, setNewDishFat] = useState('15');
  const [newDishTime, setNewDishTime] = useState('25');
  const [newDishDifficulty, setNewDishDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isCreatingDish, setIsCreatingDish] = useState(false);
  const [isUploadingNewImage, setIsUploadingNewImage] = useState(false);

  // Edit dish form state
  const [showEditDishModal, setShowEditDishModal] = useState(false);
  const [editingDish, setEditingDish] = useState<Recipe | null>(null);
  const [editDishName, setEditDishName] = useState('');
  const [editDishDesc, setEditDishDesc] = useState('');
  const [editDishCategory, setEditDishCategory] = useState('Eat Clean');
  const [editDishImageUrl, setEditDishImageUrl] = useState('');
  const [editDishTime, setEditDishTime] = useState('25');
  const [editDishDifficulty, setEditDishDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [editDishServings, setEditDishServings] = useState('2');
  const [editDishCalo, setEditDishCalo] = useState('450');
  const [editDishProtein, setEditDishProtein] = useState('35');
  const [editDishCarbs, setEditDishCarbs] = useState('45');
  const [editDishFat, setEditDishFat] = useState('15');
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
  const [isUpdatingDish, setIsUpdatingDish] = useState(false);

  const hourlyCurve = buildHourlyCurve(stats.chatHourly);
  const dietPicks = stats.dietDistribution.reduce((sum, d) => sum + d.users, 0) || 1;

  // Fetch admin stats & top dishes
  const fetchStats = async (days = statsDays, by = topDishesBy) => {
    setLoadingStats(true);
    try {
      const [statsRes, topData, chatRes, healthRes] = await Promise.all([
        apiService.admin.getStats({ days }),
        apiService.admin.getTopDishes({ by, days }),
        apiService.admin.getChatbotOverview({ days }),
        apiService.admin.getChatbotHealth().catch(() => null),
      ]);
      setSystemHealthy(healthRes ? (healthRes.data || healthRes).status === 'up' : null);
      if (statsRes) {
        const errorRate = Number(chatRes?.error_rate) || 0;
        const repliesCount = Object.values(chatRes?.outcomes || {}).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);
        setStats({
          chatbotInteractions: (statsRes.chat?.messages || 0) + (chatRes?.guest_messages || 0),
          chatSessions: statsRes.chat?.sessions || 0,
          activeUsers: statsRes.users?.active || 0,
          newUsers: statsRes.users?.new || 0,
          totalUsers: statsRes.users?.total || 0,
          visits: statsRes.visits || 0,
          dishesCount: statsRes.dishes?.total || 0,
          hiddenDishesCount: Math.max(0, (statsRes.dishes?.total || 0) - (statsRes.dishes?.published || 0)),
          aiSuccessRate: repliesCount > 0 ? Math.round((1 - errorRate) * 1000) / 10 : null,
          avgResponseMs: chatRes?.avg_response_ms || 0,
          flaggedMessagesCount: chatRes?.flagged_count || 0,
          chatHourly: statsRes.chat_hourly || [],
          dietDistribution: statsRes.diet_distribution?.items || [],
        });
      }
      if (topData && Array.isArray(topData)) {
        setTopDishes(topData);
      }
    } catch (err) {
      console.warn('Admin stats fallback:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats(statsDays, topDishesBy);
  }, [statsDays, topDishesBy]);

  // Fetch dishes from admin endpoint
  const loadAdminDishes = async (page = dishPage) => {
    const seq = ++dishRequestSeq.current;
    setLoadingDishes(true);
    try {
      const res = await apiService.admin.getDishes({ q: dishSearch, page, limit: DISHES_PER_PAGE });
      if (seq !== dishRequestSeq.current) return; // Đã có yêu cầu mới hơn
      if (res && res.data) {
        const total = res.meta?.total ?? res.data.length;
        const lastPage = Math.max(1, Math.ceil(total / DISHES_PER_PAGE));
        // Trang hiện tại không còn món (vd. vừa xóa món cuối) → lùi về trang cuối cùng
        if (res.data.length === 0 && page > lastPage) {
          loadAdminDishes(lastPage);
          return;
        }
        setDishesList(res.data.map(normalizeDish));
        setDishTotal(total);
        setDishPage(page);
      }
    } catch {
      // Keep initialRecipes fallback
    } finally {
      if (seq === dishRequestSeq.current) setLoadingDishes(false);
    }
  };

  // Tải toàn bộ món (theo từng đợt 100 món) cho ô chọn món ở tab Công thức
  const loadRecipeDishOptions = async () => {
    try {
      const all: Recipe[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await apiService.admin.getDishes({ page, limit: 100, sort: 'name' });
        all.push(...(res?.data || []).map(normalizeDish));
        totalPages = res?.meta?.total_pages || 1;
        page++;
      } while (page <= totalPages);
      setRecipeDishOptions(all);
      if (!selectedRecipeDishId && all.length > 0) {
        setSelectedRecipeDishId(all[0].id);
        loadDishRecipe(all[0].id);
      }
    } catch {
      // Keep initialRecipes fallback
    }
  };

  useEffect(() => {
    if (adminTab === 'dishes') {
      loadAdminDishes();
    } else if (adminTab === 'recipes') {
      loadRecipeDishOptions();
    } else if (adminTab === 'users') {
      loadAdminUsers();
    } else if (adminTab === 'chatbot') {
      loadChatbotOverview();
      loadChatSessions();
      loadChatbotConfig();
    }
  }, [adminTab]);

  // Load users
  const loadAdminUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await apiService.admin.getUsers({ q: userSearch, limit: 100 });
      if (res && res.data) {
        setUsersList(res.data);
      }
    } catch (err) {
      console.warn('Error loading users from backend:', err);
      setUsersList([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadChatbotOverview = async () => {
    try {
      const data = await apiService.admin.getChatbotOverview();
      if (data) setChatbotOverview(data);
    } catch {
      // Ignored
    }
  };

  // Export stats handler (.xlsx default)
  const handleExportStats = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    try {
      const blob = await apiService.admin.exportStats({ format, days: statsDays });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chefai_stats_${statsDays}d_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Đã xuất file báo cáo ${format.toUpperCase()} thành công!`);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xuất báo cáo thống kê');
    }
  };

  // Import dishes from Excel/CSV
  const openImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    setImportError('');
    setShowImportModal(true);
  };

  const closeImportModal = () => {
    if (isCheckingImport || isSubmittingImport) return;
    setShowImportModal(false);
  };

  const handleDownloadImportTemplate = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    setIsDownloadingTemplate(true);
    try {
      const blob = await apiService.admin.downloadImportTemplate(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mau-nhap-mon-an.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || 'Không tải được file mẫu');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  // Chọn file xong thì kiểm tra ngay (dry run), chưa ghi dữ liệu
  const handleImportFileSelect = async (file: File | undefined) => {
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    setImportError('');
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setImportError('Chỉ chấp nhận file .xlsx hoặc .csv.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImportError('File vượt quá 5 MB.');
      return;
    }
    setIsCheckingImport(true);
    try {
      const result = await apiService.admin.importDishes(file, true);
      setImportResult(result);
    } catch (err: any) {
      setImportError(err.message || 'Không kiểm tra được file');
    } finally {
      setIsCheckingImport(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile || !importResult || importResult.valid_dishes === 0) return;
    setIsSubmittingImport(true);
    setImportError('');
    try {
      const result = await apiService.admin.importDishes(importFile, false);
      setImportResult(result);
      toast.success(`Đã nhập ${result.created_count} món ăn (đang ẩn, cần bổ sung công thức).`);
      loadAdminDishes(1);
      loadRecipeDishOptions();
    } catch (err: any) {
      setImportError(err.message || 'Lỗi khi nhập món ăn');
    } finally {
      setIsSubmittingImport(false);
    }
  };

  // Recipe methods
  const loadDishRecipe = async (dishId: string) => {
    if (!dishId) return;
    setLoadingRecipe(true);
    setRecipeError('');
    setRecipeNotice('');
    try {
      const res = await apiService.admin.getRecipe(dishId);
      const data = res.data || res;
      setRecipeServings(data.servings || 2);
      if (Array.isArray(data.ingredients)) {
        setRecipeIngredients(data.ingredients.map((ing: any) => ({
          ingredient_id: ing.ingredient_id,
          name: ing.name || ing.ingredient?.name || '',
          quantity: ing.quantity || ing.amount || 1,
          unit: ing.unit || '',
        })));
      } else {
        setRecipeIngredients([]);
      }
      if (Array.isArray(data.steps)) {
        setRecipeSteps(data.steps.map((st: any, idx: number) => ({
          step_number: st.step_number || idx + 1,
          title: st.title || `Bước ${idx + 1}`,
          instruction: st.instruction || st.content || '',
          duration_minutes: st.duration_minutes || 5,
        })));
      } else {
        setRecipeSteps([]);
      }
    } catch (err: any) {
      // Món chưa có công thức (RECIPE_NOT_FOUND) không phải lỗi: Admin nhập mới bên dưới
      if (err?.code === 'RECIPE_NOT_FOUND') {
        setRecipeNotice('Món chưa có công thức. Bạn có thể thêm mới bên dưới.');
        const dish = recipeDishOptions.find(d => d.id === dishId);
        if (dish?.servings) setRecipeServings(dish.servings);
      } else {
        setRecipeError(err.message || 'Không tải được công thức.');
      }
      setRecipeIngredients([]);
      setRecipeSteps([]);
    } finally {
      setLoadingRecipe(false);
    }
  };

  const handleSaveRecipe = async (publish = false) => {
    if (!selectedRecipeDishId) {
      toast.warning('Vui lòng chọn món ăn trước.');
      return;
    }
    if (recipeIngredients.length === 0) {
      toast.warning('Công thức cần có ít nhất 1 nguyên liệu.');
      return;
    }
    if (recipeSteps.length === 0) {
      toast.warning('Công thức cần có ít nhất 1 bước chế biến.');
      return;
    }
    setSavingRecipe(true);
    setRecipeError('');
    try {
      // Khẩu phần thuộc thông tin món, công thức chỉ gồm nguyên liệu và các bước
      const dish = recipeDishOptions.find(d => d.id === selectedRecipeDishId);
      if (dish && dish.servings !== recipeServings) {
        await apiService.admin.updateDish(selectedRecipeDishId, { servings: recipeServings });
      }
      await apiService.admin.updateRecipe(selectedRecipeDishId, {
        ingredients: recipeIngredients.map(ing => ({
          ...(ing.ingredient_id ? { ingredient_id: ing.ingredient_id } : { name: ing.name }),
          quantity: Number(ing.quantity) || 1,
          unit: ing.unit || undefined,
        })),
        steps: recipeSteps.map((st, idx) => ({ order: idx + 1, content: st.instruction })),
        publish,
      });
      const msg = publish
        ? 'Đã lưu công thức và công khai món ăn thành công!'
        : 'Đã lưu công thức thành công lên hệ thống!';
      setRecipeNotice(msg);
      toast.success(msg);
      setTimeout(() => setRecipeNotice(''), 3500);
      loadRecipeDishOptions();
    } catch (err: any) {
      setRecipeError(err.message || 'Lỗi khi lưu công thức');
      toast.error(err.message || 'Lỗi khi lưu công thức');
    } finally {
      setSavingRecipe(false);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipeDishId) return;
    const ok = await showConfirm({
      title: 'Xóa công thức món ăn',
      message: 'Bạn có chắc muốn xóa công thức của món này? Hệ thống sẽ tự động chuyển món ăn sang trạng thái ẩn khỏi người dùng.',
      confirmText: 'Xóa công thức',
      cancelText: 'Giữ lại',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      setSavingRecipe(true);
      await apiService.admin.deleteRecipe(selectedRecipeDishId);
      setRecipeIngredients([]);
      setRecipeSteps([]);
      setRecipeNotice('Đã xóa công thức thành công và ẩn món ăn.');
      toast.success('Đã xóa công thức thành công và chuyển món ăn sang trạng thái ẩn.');
      setTimeout(() => setRecipeNotice(''), 3500);
      loadRecipeDishOptions();
    } catch (err: any) {
      setRecipeError(err.message || 'Lỗi khi xóa công thức');
      toast.error(err.message || 'Lỗi khi xóa công thức');
    } finally {
      setSavingRecipe(false);
    }
  };


  const handleAddIngredient = () => {
    if (!newIngName.trim()) return;
    setRecipeIngredients(prev => [
      ...prev,
      {
        name: newIngName.trim(),
        quantity: newIngQty.trim() || 1,
        unit: newIngUnit.trim() || 'g',
      }
    ]);
    setNewIngName('');
    setNewIngQty('');
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipeIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddStep = () => {
    if (!newStepInstruction.trim()) return;
    setRecipeSteps(prev => [
      ...prev,
      {
        step_number: prev.length + 1,
        title: newStepTitle.trim() || `Bước ${prev.length + 1}`,
        instruction: newStepInstruction.trim(),
        duration_minutes: parseInt(newStepDuration, 10) || 5,
      }
    ]);
    setNewStepTitle('');
    setNewStepInstruction('');
  };

  const handleRemoveStep = (index: number) => {
    setRecipeSteps(prev => prev.filter((_, i) => i !== index).map((s, idx) => ({ ...s, step_number: idx + 1 })));
  };

  // User management handlers
  const handleToggleUserRole = async (user: any) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const ok = await showConfirm({
      title: 'Thay đổi vai trò người dùng',
      message: `Xác nhận chuyển vai trò người dùng "${user.display_name || user.email}" thành "${nextRole === 'admin' ? 'Quản trị viên' : 'Thành viên'}"?`,
      confirmText: 'Xác nhận đổi',
      cancelText: 'Hủy bỏ',
      variant: 'info',
    });
    if (!ok) return;
    try {
      await apiService.admin.updateUserRole(user.id, nextRole as any);
      setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, role: nextRole } : u));
      toast.success(`Đã đổi vai trò thành ${nextRole === 'admin' ? 'Quản trị viên' : 'Thành viên'}`);
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật vai trò người dùng');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const ok = await showConfirm({
      title: 'Xóa vĩnh viễn người dùng',
      message: 'CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản người dùng này? Thao tác không thể hoàn tác.',
      confirmText: 'Xóa vĩnh viễn',
      cancelText: 'Hủy bỏ',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiService.admin.deleteUser(userId);
      setUsersList(prev => prev.filter(u => u.id !== userId));
      toast.success('Đã xóa người dùng thành công.');
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa người dùng');
    }
  };

  const loadAuditLogs = async () => {
    setLoadingAuditLogs(true);
    setShowAuditLogs(true);
    try {
      const res = await apiService.admin.getAuditLogs({ limit: 50 });
      setAuditLogs(res.data || []);
    } catch (err: any) {
      console.warn('Lỗi tải nhật ký thao tác:', err);
      setAuditLogs([]);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  // Chatbot handlers
  const loadChatSessions = async (status = sessionStatusFilter) => {
    setLoadingSessions(true);
    try {
      const res = await apiService.admin.getChatSessions({
        limit: 30,
        status: status !== 'all' ? status : undefined,
      });
      setChatSessions(res.data || []);
    } catch (err) {
      console.warn('Lỗi tải lịch sử chat:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadChatSessionDetail = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setLoadingSessionDetail(true);
    try {
      const res = await apiService.admin.getChatSessionDetail(sessionId);
      const session = res.data || res;
      setSessionMessages((session.messages || []).map((m: any) => ({ ...m, is_flagged: m.flagged ?? m.is_flagged })));
    } catch (err) {
      console.warn('Lỗi tải chi tiết hội thoại:', err);
    } finally {
      setLoadingSessionDetail(false);
    }
  };

  const handleFlagMessage = async (messageId: string, currentFlagged: boolean) => {
    try {
      const nextFlag = !currentFlagged;
      let reason = '';
      if (nextFlag) {
        reason = prompt('Nhập lý do gắn cờ tin nhắn (ví dụ: Sai dị ứng, Ảo giác thông tin, Ngôn từ không chuẩn):') || '';
      }
      await apiService.admin.flagChatMessage(messageId, nextFlag, reason);
      setSessionMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_flagged: nextFlag } : m));
      toast.success(nextFlag ? 'Đã gắn cờ tin nhắn cần kiểm tra.' : 'Đã bỏ cờ tin nhắn.');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi gắn cờ tin nhắn');
    }
  };

  const loadChatbotConfig = async () => {
    setLoadingConfig(true);
    try {
      const [cfgRes, healthRes, freqRes] = await Promise.all([
        apiService.admin.getChatbotConfig().catch(() => null),
        apiService.admin.getChatbotHealth().catch(() => null),
        apiService.admin.getFrequentQuestions().catch(() => null),
      ]);
      if (cfgRes) {
        const d = cfgRes.data || cfgRes;
        setChatbotConfig({
          guest_message_limit: d.guest_message_limit ?? d.guest_daily_limit ?? 10,
          guest_window_hours: d.guest_window_hours ?? 24,
          system_prompt: d.system_prompt || '',
          max_context_dishes: d.max_context_dishes ?? 8,
        });
      }
      if (healthRes) setChatbotHealth(healthRes.data || healthRes);
      if (freqRes) setFrequentQuestions(Array.isArray(freqRes) ? freqRes : ((freqRes as any).data || []));
    } catch (err) {
      console.warn('Lỗi tải cấu hình chatbot:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSaveChatbotConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await apiService.admin.updateChatbotConfig(chatbotConfig);
      toast.success('Đã cập nhật cấu hình Chatbot AI thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu cấu hình');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleReindexDish = async (dishId: string) => {
    setReindexingDishId(dishId);
    try {
      await apiService.admin.reindexDish(dishId);
      toast.success('Đã cập nhật chỉ mục tìm kiếm thông minh cho món ăn thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Không thể reindex món ăn');
    } finally {
      setReindexingDishId(null);
    }
  };

  // Toggle publish dish
  const handleTogglePublish = async (dish: Recipe) => {
    try {
      const newStatus = !(dish.is_published ?? true);
      await apiService.admin.togglePublishDish(dish.id, newStatus);
      setDishesList(prev => prev.map(d => d.id === dish.id ? { ...d, is_published: newStatus } : d));
      toast.success(`Đã ${newStatus ? 'công khai' : 'ẩn'} món ăn "${dish.title}"`);
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật trạng thái món ăn');
    }
  };

  // Delete dish
  const handleDeleteDish = async (dishId: string) => {
    const ok = await showConfirm({
      title: 'Xóa món ăn',
      message: 'Bạn có chắc chắn muốn xóa món ăn này khỏi hệ thống? Dữ liệu công thức liên quan cũng sẽ bị ảnh hưởng.',
      confirmText: 'Xóa món ăn',
      cancelText: 'Hủy bỏ',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res: any = await apiService.admin.deleteDish(dishId);
      // Món đã có đánh giá không bị xóa mà chỉ bị ẩn
      if (res?.data?.hidden) {
        setDishesList(prev => prev.map(d => d.id === dishId ? { ...d, is_published: false } : d));
        toast.warning(res.data.reason || 'Món đã có đánh giá nên chỉ được ẩn khỏi người dùng.');
      } else {
        setRecipeDishOptions(prev => prev.filter(d => d.id !== dishId));
        // Tải lại trang hiện tại để món của trang sau được kéo lên
        loadAdminDishes();
        toast.success('Đã xóa món ăn khỏi hệ thống.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa món ăn');
    }
  };

  // Toggle user status
  const handleToggleUserStatus = async (user: any) => {
    const nextStatus: 'active' | 'locked' = user.status === 'active' ? 'locked' : 'active';
    let reason: string | undefined;
    if (nextStatus === 'locked') {
      const input = await showPrompt({
        title: 'Khóa tài khoản người dùng',
        message: `Nhập lý do khóa tài khoản "${user.display_name || user.email}":`,
        placeholder: 'Ví dụ: Bình luận vi phạm nhiều lần',
        confirmText: 'Khóa tài khoản',
        cancelText: 'Hủy bỏ',
        variant: 'danger',
        required: true,
      });
      if (input === null || !input.trim()) return;
      reason = input.trim();
    }
    try {
      await apiService.admin.updateUserStatus(user.id, nextStatus, reason);
      setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, status: nextStatus } : u));
      toast.success(`Đã chuyển trạng thái sang ${nextStatus === 'active' ? 'hoạt động' : 'tạm khóa'}`);
    } catch (err: any) {
      toast.error(err.message || 'Không thể đổi trạng thái người dùng');
    }
  };

  // Handle dish image upload
  const handleUploadDishImageFile = async (file: File, isEdit: boolean) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.warning('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('Dung lượng hình ảnh tối đa cho phép là 5MB.');
      return;
    }

    if (isEdit) {
      setIsUploadingEditImage(true);
    } else {
      setIsUploadingNewImage(true);
    }

    try {
      const res = await apiService.admin.uploadDishImage(file);
      if (res && res.image_url) {
        if (isEdit) {
          setEditDishImageUrl(res.image_url);
        } else {
          setNewDishImageUrl(res.image_url);
        }
        toast.success('Đã tải hình ảnh món ăn lên máy chủ thành công!');
      } else {
        throw new Error('Máy chủ không trả về liên kết ảnh.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tải ảnh món ăn lên máy chủ');
    } finally {
      if (isEdit) {
        setIsUploadingEditImage(false);
      } else {
        setIsUploadingNewImage(false);
      }
    }
  };

  // Open edit dish modal
  const handleOpenEditDishModal = (dish: Recipe) => {
    setEditingDish(dish);
    setEditDishName(dish.title || '');
    setEditDishDesc(dish.description || '');
    setEditDishCategory(dish.category || 'Món chính');
    setEditDishImageUrl(dish.image && !dish.image.includes('placeholder') ? dish.image : '');
    setEditDishTime(dish.cookingTime != null ? String(dish.cookingTime) : '');
    // dish.difficulty đã được đổi sang chữ hiển thị (Dễ/Vừa/Nâng cao) → đổi lại mã cho ô chọn
    const difficultyCode: Record<string, 'easy' | 'medium' | 'hard'> = {
      'Dễ': 'easy', 'Vừa': 'medium', 'Nâng cao': 'hard', easy: 'easy', medium: 'medium', hard: 'hard',
    };
    setEditDishDifficulty(difficultyCode[dish.difficulty as string] || 'medium');
    setEditDishServings(String((dish as any).servings || 2));
    setEditDishCalo(dish.macros.calories != null ? String(dish.macros.calories) : '');
    setEditDishProtein(dish.macros.protein != null ? String(dish.macros.protein) : '');
    setEditDishCarbs(dish.macros.carbs != null ? String(dish.macros.carbs) : '');
    setEditDishFat(dish.macros.fat != null ? String(dish.macros.fat) : '');
    setShowEditDishModal(true);
  };

  // Ô số để trống → null (món chưa có chỉ số này)
  const optionalNumber = (v: string) => (v.trim() === '' || isNaN(Number(v)) ? null : Number(v));

  // Update dish submit
  const handleUpdateDishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDish) return;
    if (!editDishName.trim()) {
      toast.warning('Vui lòng nhập tên món ăn.');
      return;
    }

    try {
      setIsUpdatingDish(true);
      await apiService.admin.updateDish(editingDish.id, {
        name: editDishName.trim(),
        description: editDishDesc.trim() || undefined,
        category: editDishCategory.trim() || 'Món chính',
        image_url: editDishImageUrl.trim() || undefined,
        cook_time_minutes: optionalNumber(editDishTime),
        difficulty: editDishDifficulty,
        servings: parseInt(editDishServings, 10) || 2,
        calories: optionalNumber(editDishCalo),
        protein_g: optionalNumber(editDishProtein),
        carbs_g: optionalNumber(editDishCarbs),
        fat_g: optionalNumber(editDishFat),
      });

      await loadAdminDishes();
      loadRecipeDishOptions();

      setShowEditDishModal(false);
      setEditingDish(null);
      toast.success(`Đã cập nhật món ăn "${editDishName.trim()}" thành công!`);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật món ăn');
    } finally {
      setIsUpdatingDish(false);
    }
  };

  // Create dish submit
  const handleCreateDishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName.trim()) {
      toast.warning('Vui lòng nhập tên món ăn.');
      return;
    }

    try {
      setIsCreatingDish(true);
      const res = await apiService.admin.createDish({
        name: newDishName.trim(),
        description: newDishDesc.trim() || undefined,
        category: newDishCategory.trim() || 'Món chính',
        image_url: newDishImageUrl.trim() || undefined,
        servings: parseInt(newDishServings, 10) || 2,
        cook_time_minutes: parseInt(newDishTime, 10) || 20,
        difficulty: newDishDifficulty,
        calories: parseInt(newDishCalo, 10) || 400,
        protein_g: parseFloat(newDishProtein) || 20,
        carbs_g: parseFloat(newDishCarbs) || 30,
        fat_g: parseFloat(newDishFat) || 10,
      });

      // Món mới nhất nằm ở trang 1 (sắp xếp theo updated_at giảm dần)
      await loadAdminDishes(1);
      loadRecipeDishOptions();

      setShowAddDishModal(false);
      setNewDishName('');
      setNewDishDesc('');
      setNewDishImageUrl('');
      setNewDishCategory('Eat Clean');
      setNewDishServings('2');
      toast.success('Đã thêm món ăn mới. Món sẽ được hiển thị sau khi bạn thêm công thức.');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tạo món ăn mới');
    } finally {
      setIsCreatingDish(false);
    }
  };

  return (
    <div className="admin-studio-view flex flex-col lg:flex-row gap-5 min-h-[800px] animate-in fade-in duration-300">
      {/* Admin Sidebar Navigation */}
      <div className="w-full lg:w-64 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-6 shrink-0 h-fit">
        <div className="space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3">
            QUẢN LÝ ĐIỀU HÀNH
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setAdminTab('overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${adminTab === 'overview'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              <BarChart3 className="w-4 h-4" />
              Xem thống kê hệ thống
            </button>
            <button
              onClick={() => setAdminTab('dishes')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${adminTab === 'dishes'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              Quản lý món ăn
            </button>
            <button
              onClick={() => setAdminTab('recipes')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${adminTab === 'recipes'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              <BookOpen className="w-4 h-4" />
              Quản lý công thức
            </button>
            <button
              onClick={() => setAdminTab('users')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${adminTab === 'users'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              <Users className="w-4 h-4" />
              Quản lý người dùng
            </button>
            <button
              onClick={() => setAdminTab('chatbot')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${adminTab === 'chatbot'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              <Bot className="w-4 h-4" />
              Giám sát Chatbot AI
              <span className="w-2 h-2 rounded-full bg-emerald-500 ml-auto" />
            </button>
          </nav>
        </div>

        {/* Back to user mode shortcut */}
        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={onBackToUserMode}
            className="w-full p-3 bg-slate-50 hover:bg-orange-50 hover:text-orange-600 text-slate-700 text-xs font-bold rounded-2xl border border-slate-200/80 transition-all flex items-center justify-between cursor-pointer"
          >
            <span>Về trang người dùng</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="mt-3 px-3 text-[10px] text-slate-400">
            ChefAI Admin Studio • Hệ Thống Trực Tuyến
          </div>
        </div>
      </div>

      {/* Admin Content Area */}
      <div className="flex-1 space-y-8">
        {/* ===================== TAB 1: SYSTEM OVERVIEW & STATS ===================== */}
        {adminTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full animate-pulse ${systemHealthy === false ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  HỆ THỐNG TRỰC TUYẾN • {systemHealthy === null ? 'ĐANG KIỂM TRA' : systemHealthy ? 'HOẠT ĐỘNG ỔN ĐỊNH' : 'DỊCH VỤ AI KHÔNG PHẢN HỒI'}
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  Tổng Quan & Thống Kê Hệ Thống ChefAI
                </h2>
                <p className="text-xs text-slate-500">
                  Phân tích thời gian thực hiệu suất AI, hành vi dinh dưỡng ẩm thực và lưu lượng hội thoại toàn nền tảng.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                  {[7, 30, 90].map(d => (
                    <button
                      key={d}
                      onClick={() => setStatsDays(d)}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${statsDays === d ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                      {d} ngày
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExportStats('xlsx')}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    title="Xuất báo cáo định dạng Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Xuất báo cáo (Excel .xlsx)
                  </button>
                  <button
                    onClick={() => handleExportStats('csv')}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    title="Xuất báo cáo định dạng CSV"
                  >
                    CSV
                  </button>
                </div>
              </div>
            </div>

            {/* 4 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">TƯƠNG TÁC CHATBOT AI</span>
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">{stats.chatbotInteractions.toLocaleString('vi-VN')}</div>
                <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <span>{stats.chatSessions.toLocaleString('vi-VN')} phiên hội thoại</span>
                  <span className="text-slate-400 font-normal">trong {statsDays} ngày</span>
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">NGƯỜI DÙNG HOẠT ĐỘNG</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">{stats.activeUsers.toLocaleString('vi-VN')}</div>
                <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <span>+{stats.newUsers.toLocaleString('vi-VN')} người dùng mới</span>
                  <span className="text-slate-400 font-normal">/ {stats.totalUsers.toLocaleString('vi-VN')} tài khoản • {stats.visits.toLocaleString('vi-VN')} lượt truy cập</span>
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">KHO MÓN ĂN & CÔNG THỨC</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">{stats.dishesCount}</div>
                <div className="text-[11px] text-orange-600 font-bold">
                  {stats.hiddenDishesCount} món đang ẩn
                </div>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">TỈ LỆ TRẢ LỜI THÀNH CÔNG</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">{stats.aiSuccessRate != null ? `${stats.aiSuccessRate}%` : '—'}</div>
                <div className="text-[11px] text-emerald-600 font-bold">
                  Độ trễ phản hồi: {stats.avgResponseMs > 0 ? `${stats.avgResponseMs}ms` : '—'}
                </div>
              </div>
            </div>

            {/* Graphs Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Traffic Curve */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Xu Hướng Người Dùng & Phiên Hỏi Đáp Chatbot
                    </h3>
                    <p className="text-xs text-slate-500">Mật độ hội thoại tìm công thức theo chu kỳ 24 giờ</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="flex items-center gap-1 text-orange-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                      Trưa 11h - 13h
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Tối 17h - 20h
                    </span>
                  </div>
                </div>

                <div className="h-44 w-full flex items-end pt-4 pb-2 relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120">
                    <path
                      d={hourlyCurve.d}
                      fill="none"
                      stroke="#F97316"
                      strokeWidth="3.5"
                    />
                    {hourlyCurve.lunch && <circle cx={hourlyCurve.lunch.x} cy={hourlyCurve.lunch.y} r="5" fill="#F97316" />}
                    {hourlyCurve.dinner && <circle cx={hourlyCurve.dinner.x} cy={hourlyCurve.dinner.y} r="5" fill="#10B981" />}
                  </svg>
                  {hourlyCurve.total === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                      Chưa có câu hỏi chatbot nào trong {statsDays} ngày qua.
                    </div>
                  )}
                </div>

                <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-100">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span className="font-bold text-orange-600">{hourlyCurve.lunch ? `${String(hourlyCurve.lunch.hour).padStart(2, '0')}:00` : '—'} (Trưa)</span>
                  <span>15:00</span>
                  <span className="font-bold text-emerald-600">{hourlyCurve.dinner ? `${String(hourlyCurve.dinner.hour).padStart(2, '0')}:00` : '—'} (Tối đỉnh)</span>
                  <span>23:59</span>
                </div>
              </div>

              {/* Diet Trends */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Phân Phối Chế Độ Ăn</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Sở thích ẩm thực do người dùng thiết lập</p>

                  <div className="space-y-3 text-xs pt-4">
                    {stats.dietDistribution.length === 0 ? (
                      <div className="py-6 text-center text-slate-400">Chưa có người dùng nào thiết lập chế độ ăn.</div>
                    ) : (
                      stats.dietDistribution.map((diet, idx) => {
                        const color = DIET_COLORS[idx % DIET_COLORS.length];
                        const pct = Math.round((diet.users / dietPicks) * 100);
                        return (
                          <div key={diet.id} className="space-y-1">
                            <div className="flex justify-between font-semibold">
                              <span>{diet.name}</span>
                              <span className={`font-bold ${color.text}`} title={`${diet.users} người dùng`}>{pct}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full ${color.bar}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="p-3 bg-orange-50 rounded-2xl border border-orange-200/60 text-[11px] text-orange-950 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <span>{stats.flaggedMessagesCount > 0 ? `Có ${stats.flaggedMessagesCount} câu trả lời của chatbot bị gắn cờ cần kiểm tra.` : 'Chưa có câu trả lời nào của chatbot bị gắn cờ trong kỳ này.'}</span>
                </div>
              </div>
            </div>

            {/* Top Dishes Ranking Section */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    Bảng Xếp Hạng Món Ăn Nổi Bật (Top Dishes)
                  </h3>
                  <p className="text-xs text-slate-500">Món ăn được quan tâm nhiều nhất trong {statsDays} ngày qua</p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
                  <span className="text-[11px] font-bold text-slate-400 px-2">Xếp theo:</span>
                  {(['views', 'favorites', 'rating'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setTopDishesBy(mode)}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${topDishesBy === mode
                        ? 'bg-white text-orange-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      {mode === 'views' ? 'Lượt xem' : mode === 'favorites' ? 'Yêu thích' : 'Đánh giá sao'}
                    </button>
                  ))}
                </div>
              </div>

              {topDishes.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Chưa có dữ liệu thống kê cho tiêu chí này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {topDishes.map((item, idx) => (
                    <div
                      key={item.id || item.dish_id || idx}
                      className="p-3 bg-slate-50 hover:bg-orange-50/40 rounded-2xl border border-slate-200/80 flex items-center gap-3 transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${idx === 0 ? 'bg-amber-400 text-amber-950 shadow-xs' :
                        idx === 1 ? 'bg-slate-300 text-slate-800' :
                          idx === 2 ? 'bg-orange-200 text-orange-900' :
                            'bg-slate-200 text-slate-600'
                        }`}>
                        {idx + 1}
                      </div>
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                        <img
                          src={item.image_url || item.dish?.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&q=80'}
                          alt={item.name || item.dish?.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&q=80';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate">
                          {item.name || item.dish?.name || 'Món ăn'}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{item.category || item.dish?.category || '—'}</span>
                          <span>•</span>
                          <span className="font-bold text-orange-600">
                            {topDishesBy === 'views' && `${item.views || 0} lượt xem`}
                            {topDishesBy === 'favorites' && `${item.favorites ?? item.favorite_count ?? 0} yêu thích`}
                            {topDishesBy === 'rating' && `★ ${item.avg_rating ?? 0}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 2: DISH WAREHOUSE MANAGEMENT ===================== */}
        {adminTab === 'dishes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  QUẢN LÝ KHO DỮ LIỆU MÓN ĂN & CÔNG THỨC
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  Danh Sách Món Ăn Trong Hệ Thống
                </h2>
                <p className="text-xs text-slate-500">
                  Cập nhật nguyên liệu, trạng thái xuất bản, calo, và độ khó cho từng món ăn.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadAdminDishes()}
                  className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors cursor-pointer"
                  title="Tải lại"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingDishes ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={openImportModal}
                  className="px-4 py-2 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Nhập nhiều món ăn từ file Excel (.xlsx) hoặc CSV"
                >
                  <Upload className="w-4 h-4" />
                  Nhập từ Excel
                </button>
                <button
                  onClick={() => setShowAddDishModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Thêm Món Ăn Mới
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadAdminDishes(1)}
                  placeholder="Tìm kiếm theo tên món ăn..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-orange-500"
                />
              </div>
              <button
                onClick={() => loadAdminDishes(1)}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 cursor-pointer"
              >
                Tìm kiếm
              </button>
            </div>

            {/* Dishes Catalog Table */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-4 pl-6">MÓN ĂN</th>
                      <th className="py-4">DANH MỤC</th>
                      <th className="py-4">THỜI GIAN & ĐỘ KHÓ</th>
                      <th className="py-4">NĂNG LƯỢNG</th>
                      <th className="py-4 text-center">TRẠNG THÁI</th>
                      <th className="py-4 text-right pr-6">HÀNH ĐỘNG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingDishes ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
                          Đang tải kho món ăn từ máy chủ...
                        </td>
                      </tr>
                    ) : dishesList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Không tìm thấy món ăn nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      dishesList.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 pl-6 flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80">
                              <img
                                src={r.image}
                                alt={r.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&q=80';
                                }}
                              />
                            </div>
                            <div>
                              <div
                                onClick={() => handleOpenEditDishModal(r)}
                                className="font-bold text-slate-900 text-sm hover:text-orange-600 cursor-pointer flex items-center gap-1.5"
                                title="Nhấp để chỉnh sửa thông tin món ăn"
                              >
                                {r.title}
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium">
                                {r.code ? <span className="font-mono text-slate-500 mr-1">{r.code} •</span> : null}
                                {r.ingredient_count ?? r.ingredients?.length ?? 0} nguyên liệu
                                {r.has_recipe === false && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                                    Chưa có công thức
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                                {r.category || 'Món ăn'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 text-slate-600">
                            <div>⏱ {r.cookingTime} phút</div>
                            <div className="text-[10px] text-slate-400">Độ khó: {r.difficulty}</div>
                          </td>
                          <td className="py-4">
                            <div className="font-black text-slate-900">{formatMetric(r.macros.calories, ' kcal')}</div>
                            <div className="text-[10px] text-slate-400">
                              P: {formatMetric(r.macros.protein, 'g')} | C: {formatMetric(r.macros.carbs, 'g')} | F: {formatMetric(r.macros.fat, 'g')}
                            </div>
                          </td>
                          <td className="py-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${(r.is_published ?? true)
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}>
                              {(r.is_published ?? true) ? 'Công khai' : 'Đã ẩn'}
                            </span>
                          </td>
                          <td className="py-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditDishModal(r)}
                                className="p-1.5 hover:bg-orange-50 rounded-lg text-slate-500 hover:text-orange-600 cursor-pointer transition-colors"
                                title="Chỉnh sửa thông tin & ảnh món ăn"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRecipeDishId(r.id);
                                  loadDishRecipe(r.id);
                                  setAdminTab('recipes');
                                }}
                                className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-500 hover:text-blue-600 cursor-pointer transition-colors"
                                title="Soạn công thức chi tiết cho món này"
                              >
                                <BookOpen className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReindexDish(r.id)}
                                disabled={reindexingDishId === r.id}
                                className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-500 hover:text-amber-600 cursor-pointer transition-colors"
                                title="Cập nhật lại chỉ mục tìm kiếm thông minh"
                              >
                                <Sparkles className={`w-4 h-4 ${reindexingDishId === r.id ? 'animate-spin text-amber-500' : ''}`} />
                              </button>
                              <button
                                onClick={() => handleTogglePublish(r)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
                                title={(r.is_published ?? true) ? 'Ẩn món khỏi người dùng' : 'Công khai món'}
                              >
                                {(r.is_published ?? true) ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-emerald-600" />}
                              </button>
                              <button
                                onClick={() => handleDeleteDish(r.id)}
                                className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                                title="Xóa món ăn"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {dishTotal > DISHES_PER_PAGE && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 text-xs">
                  <div className="text-slate-500">
                    Hiển thị <span className="font-bold text-slate-900">{(dishPage - 1) * DISHES_PER_PAGE + 1}–{Math.min(dishPage * DISHES_PER_PAGE, dishTotal)}</span> trên <span className="font-bold text-slate-900">{dishTotal}</span> món
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => loadAdminDishes(dishPage - 1)}
                      disabled={dishPage === 1 || loadingDishes}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Trang trước"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalDishPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalDishPages || Math.abs(p - dishPage) <= 1)
                      .map((p, idx, arr) => (
                        <React.Fragment key={p}>
                          {idx > 0 && p - arr[idx - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
                          <button
                            onClick={() => p !== dishPage && loadAdminDishes(p)}
                            disabled={loadingDishes}
                            className={`min-w-[32px] h-8 px-2 rounded-lg font-bold transition-colors cursor-pointer ${p === dishPage
                              ? 'bg-orange-500 text-white'
                              : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      ))}
                    <button
                      onClick={() => loadAdminDishes(dishPage + 1)}
                      disabled={dishPage === totalDishPages || loadingDishes}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Trang sau"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB: RECIPE MANAGEMENT ===================== */}
        {adminTab === 'recipes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  QUẢN LÝ CÔNG THỨC CHI TIẾT
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  Thiết Lập Công Thức & Quy Trình Chế Biến
                </h2>
                <p className="text-xs text-slate-500">
                  Quản lý định lượng nguyên liệu, đơn vị, trạng thái bắt buộc và các bước nấu theo chuẩn hệ thống.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowRecipeImportModal(true)}
                  title="Nhập nguyên liệu và các bước cho nhiều món cùng lúc từ file Excel (.xlsx)"
                  className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Nhập công thức từ file
                </button>
                <button
                  onClick={handleDeleteRecipe}
                  disabled={savingRecipe || !selectedRecipeDishId}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa công thức
                </button>
                <button
                  onClick={() => handleSaveRecipe(false)}
                  disabled={savingRecipe || !selectedRecipeDishId}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-slate-600" />
                  {savingRecipe ? 'Đang lưu...' : 'Lưu công thức'}
                </button>
                <button
                  onClick={() => handleSaveRecipe(true)}
                  disabled={savingRecipe || !selectedRecipeDishId}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {savingRecipe ? 'Đang lưu...' : 'Lưu & Công khai món'}
                </button>
              </div>
            </div>

            {/* Notifications */}
            {recipeNotice && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {recipeNotice}
              </div>
            )}
            {recipeError && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-800 flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                {recipeError}
              </div>
            )}

            {/* Dish selector & Servings */}
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chọn món ăn cần chỉnh sửa công thức:
                </label>
                <select
                  value={selectedRecipeDishId}
                  onChange={(e) => {
                    setSelectedRecipeDishId(e.target.value);
                    loadDishRecipe(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-orange-500 cursor-pointer"
                >
                  {recipeDishOptions.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.title}{d.category ? ` (${d.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full md:w-48">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Khẩu phần ăn (người):
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={recipeServings}
                  onChange={(e) => setRecipeServings(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-orange-500 text-center"
                />
              </div>
            </div>

            {/* 2 Columns: Ingredients & Steps */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Column 1: Ingredients */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-orange-500" />
                    Danh sách nguyên liệu ({recipeIngredients.length})
                  </h3>
                </div>

                {/* Quick Add Ingredient */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-600 block">Thêm nguyên liệu mới:</span>
                  <div className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="Tên nguyên liệu (thịt gà, tôm...)"
                      value={newIngName}
                      onChange={(e) => setNewIngName(e.target.value)}
                      className="col-span-8 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500"
                    />
                    <input
                      type="text"
                      placeholder="Số lượng (200, 1...)"
                      value={newIngQty}
                      onChange={(e) => setNewIngQty(e.target.value)}
                      className="col-span-2 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500 text-center"
                    />
                    <input
                      type="text"
                      placeholder="Đơn vị (g, ml...)"
                      value={newIngUnit}
                      onChange={(e) => setNewIngUnit(e.target.value)}
                      className="col-span-2 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500 text-center"
                    />
                  </div>
                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddIngredient}
                      className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Thêm
                    </button>
                  </div>
                </div>

                {/* List of Ingredients */}
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {recipeIngredients.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Chưa có nguyên liệu nào trong công thức này.
                    </div>
                  ) : (
                    recipeIngredients.map((ing, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 hover:bg-orange-50/40 rounded-xl border border-slate-200/70 flex items-center justify-between text-xs transition-colors">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-[70%]">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-800">{ing.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-600 font-bold">
                            {ing.quantity} {ing.unit}
                          </span>
                          <button
                            onClick={() => handleRemoveIngredient(idx)}
                            className="text-slate-400 hover:text-red-500 cursor-pointer p-1"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: Cooking Steps */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    Các bước chế biến ({recipeSteps.length})
                  </h3>
                </div>

                {/* Quick Add Step */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-600 block">Thêm bước thực hiện:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Tiêu đề bước (Sơ chế, Nấu canh...)"
                      value={newStepTitle}
                      onChange={(e) => setNewStepTitle(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500"
                    />
                    <div className="flex items-center gap-1 w-28">
                      <input
                        type="number"
                        placeholder="Thời gian"
                        value={newStepDuration}
                        onChange={(e) => setNewStepDuration(e.target.value)}
                        className="w-14 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500 text-center"
                      />
                      <span className="text-[11px] text-slate-500">phút</span>
                    </div>
                  </div>
                  <textarea
                    placeholder="Hướng dẫn chi tiết thao tác chế biến..."
                    rows={2}
                    value={newStepInstruction}
                    onChange={(e) => setNewStepInstruction(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-orange-500"
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Thêm bước
                    </button>
                  </div>
                </div>

                {/* List of Steps */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {recipeSteps.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Chưa có bước thực hiện nào được thiết lập.
                    </div>
                  ) : (
                    recipeSteps.map((st, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold">
                              {st.step_number || idx + 1}
                            </span>
                            {st.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 font-medium">⏱ {st.duration_minutes || 5} phút</span>
                            <button
                              onClick={() => handleRemoveStep(idx)}
                              className="text-slate-400 hover:text-red-500 cursor-pointer p-1"
                              title="Xóa bước"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed pl-6.5">
                          {st.instruction}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: USERS & PERMISSIONS ===================== */}
        {adminTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                  ĐIỀU HÀNH / TÀI KHOẢN NGƯỜI DÙNG
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  Quản Lý Người Dùng & Phân Quyền
                </h2>
                <p className="text-xs text-slate-500">
                  Quản lý danh sách thành viên, vai trò truy cập và khóa/mở khóa tài khoản.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadAuditLogs}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Nhật ký thao tác (Audit Logs)
                </button>
                <button
                  onClick={loadAdminUsers}
                  className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors cursor-pointer"
                  title="Tải lại"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* User Table */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-4 pl-6">NGƯỜI DÙNG</th>
                      <th className="py-4">EMAIL</th>
                      <th className="py-4">VAI TRÒ</th>
                      <th className="py-4 text-center">TRẠNG THÁI</th>
                      <th className="py-4 text-right pr-6">HÀNH ĐỘNG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500 mb-2" />
                          Đang tải danh sách người dùng...
                        </td>
                      </tr>
                    ) : usersList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Chưa có người dùng nào.
                        </td>
                      </tr>
                    ) : (
                      usersList.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 pl-6">
                            <div className="font-bold text-slate-900">{u.display_name || u.name || 'Người dùng'}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{u.id}</div>
                          </td>
                          <td className="py-4 text-slate-600">{u.email}</td>
                          <td className="py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${u.role === 'admin'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-slate-100 text-slate-700'
                              }`}>
                              {u.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                            </span>
                          </td>
                          <td className="py-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                              {u.status === 'active' ? 'Đang hoạt động' : 'Đã khóa'}
                            </span>
                          </td>
                          <td className="py-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleToggleUserRole(u)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer bg-slate-100 hover:bg-orange-100 hover:text-orange-800 text-slate-700"
                                title="Đổi vai trò giữa Thành viên và Admin"
                              >
                                {u.role === 'admin' ? 'Hạ quyền user' : 'Lên admin'}
                              </button>
                              <button
                                onClick={() => handleToggleUserStatus(u)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${u.status === 'active'
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                              >
                                {u.status === 'active' ? 'Khóa' : 'Mở khóa'}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-1 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Xóa người dùng"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 4: CHATBOT AI MONITORING ===================== */}
        {adminTab === 'chatbot' && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                GIÁM SÁT HỆ THỐNG / AI SAFETY & QUALITY
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                Giám Sát Chatbot ChefAI
              </h2>
              <p className="text-xs text-slate-500">
                Theo dõi độ trễ hệ thống AI, tỷ lệ giải đáp thành công và hệ thống bộ lọc cảnh báo dị ứng.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">ĐỘ TRỄ PHẢN HỒI AI</span>
                <div className="text-2xl font-black text-slate-900">{chatbotOverview?.avg_response_ms ? `${chatbotOverview.avg_response_ms} ms` : '—'}</div>
                <div className="text-xs text-emerald-600 font-semibold">
                  {chatbotOverview?.avg_response_ms ? (chatbotOverview.avg_response_ms < 3000 ? 'Tốc độ phản hồi nhanh' : 'Phản hồi còn chậm') : 'Chưa có dữ liệu trong 30 ngày'}
                </div>
              </div>
              <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">TỶ LỆ KHÁCH CHUYỂN ĐỔI</span>
                <div className="text-2xl font-black text-slate-900">—</div>
                <div className="text-xs text-orange-600 font-semibold">Đạt giới hạn {chatbotConfig.guest_message_limit} tin nhắn/{chatbotConfig.guest_window_hours} giờ</div>
              </div>
              <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">CHẶN DỊ ỨNG NGUY HIỂM</span>
                <div className="text-2xl font-black text-emerald-700">—</div>
                <div className="text-xs text-emerald-600 font-semibold">Chưa có số liệu thống kê</div>
              </div>
            </div>

            {/* Safety policy showcase */}
            <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                  CẤU HÌNH BẢO MẬT & GUARD RAILS HIỆN TẠI
                </span>
                <span className="text-xs text-emerald-400 font-mono">
                  {chatbotHealth?.status === 'up' ? 'Trực tuyến • Sẵn sàng' : 'Dịch vụ AI không phản hồi'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Mô hình tự động đối chiếu các nhóm chất dị ứng (Hải sản, Đậu phộng, Lactose, Gluten, Trứng, Đậu nành) và hồ sơ khẩu vị của người dùng trước khi xuất công thức nấu ăn.
              </p>
            </div>

            {/* Main Content: Sessions & Config */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Chat Sessions & Transcript (col 7) */}
              <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-orange-500" />
                    Nhật Ký Hội Thoại Người Dùng
                  </h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={sessionStatusFilter}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setSessionStatusFilter(val);
                        loadChatSessions(val);
                      }}
                      className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="all">Tất cả hội thoại</option>
                      <option value="error">Hội thoại bị lỗi</option>
                      <option value="flagged">Đã bị gắn cờ</option>
                      <option value="disliked">Bị đánh giá kém</option>
                    </select>
                    <button
                      onClick={() => loadChatSessions(sessionStatusFilter)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                      title="Làm mới"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Sessions list (col 5) */}
                  <div className="md:col-span-5 space-y-1.5 max-h-96 overflow-y-auto pr-1 border-r border-slate-100">
                    {loadingSessions ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-orange-500 mb-1" />
                        Đang tải hội thoại...
                      </div>
                    ) : chatSessions.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Chưa có phiên hội thoại nào theo bộ lọc này.
                      </div>
                    ) : (
                      chatSessions.map(s => (
                        <button
                          key={s.id}
                          onClick={() => loadChatSessionDetail(s.id)}
                          className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors cursor-pointer block ${selectedSessionId === s.id
                            ? 'bg-orange-50 border border-orange-200 text-orange-950 font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                            }`}
                        >
                          <div className="truncate font-semibold">{s.title || 'Hội thoại không tiêu đề'}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {s.user?.display_name || s.user?.email || 'Người dùng'} • {new Date(s.updated_at || s.created_at).toLocaleDateString('vi-VN')} • {s.message_count ?? 0} tin nhắn
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Messages transcript (col 7) */}
                  <div className="md:col-span-7 flex flex-col justify-between max-h-96 overflow-y-auto pl-2 space-y-3">
                    {loadingSessionDetail ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-orange-500 mb-1" />
                        Đang tải tin nhắn...
                      </div>
                    ) : !selectedSessionId ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        Chọn một phiên hội thoại bên trái để xem nội dung chi tiết.
                      </div>
                    ) : sessionMessages.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        Phiên hội thoại này chưa có tin nhắn.
                      </div>
                    ) : (
                      sessionMessages.map(m => (
                        <div
                          key={m.id}
                          className={`p-3 rounded-2xl text-xs space-y-1 relative group ${m.sender === 'user' || m.role === 'user'
                            ? 'bg-slate-100 text-slate-800 ml-4'
                            : 'bg-orange-50/70 border border-orange-200/60 text-slate-900 mr-4'
                            }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                            <span>{m.sender === 'user' || m.role === 'user' ? 'Người dùng' : 'Trợ lý ChefAI'}</span>
                            {(m.sender === 'assistant' || m.role === 'assistant' || m.sender === 'bot') && (
                              <button
                                onClick={() => handleFlagMessage(m.id, !!m.is_flagged)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${m.is_flagged
                                  ? 'bg-red-500 text-white'
                                  : 'bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200'
                                  }`}
                                title="Đánh dấu câu trả lời không phù hợp"
                              >
                                <Flag className="w-3 h-3" />
                                {m.is_flagged ? 'Đã gắn cờ' : 'Gắn cờ'}
                              </button>
                            )}
                          </div>
                          <p className="leading-relaxed whitespace-pre-line text-xs">
                            {m.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Chatbot Settings & Frequent Questions (col 5) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Chatbot Config Form */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-orange-500" />
                      Cấu Hình Hoạt Động Chatbot
                    </h3>
                    {loadingConfig && <span className="text-xs text-slate-400 font-medium animate-pulse">Đang tải...</span>}
                  </div>

                  <form onSubmit={handleSaveChatbotConfig} className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Lượt hỏi khách / chu kỳ:
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={chatbotConfig.guest_message_limit}
                          onChange={(e) => setChatbotConfig({
                            ...chatbotConfig,
                            guest_message_limit: parseInt(e.target.value, 10) || 0
                          })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Chu kỳ làm mới (giờ):
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={chatbotConfig.guest_window_hours}
                          onChange={(e) => setChatbotConfig({
                            ...chatbotConfig,
                            guest_window_hours: parseInt(e.target.value, 10) || 24
                          })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Số món ăn tham khảo tối đa (Max Context Dishes):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={chatbotConfig.max_context_dishes}
                        onChange={(e) => setChatbotConfig({
                          ...chatbotConfig,
                          max_context_dishes: parseInt(e.target.value, 10) || 8
                        })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Chỉ dẫn hệ thống chuyên sâu (System Prompt):
                      </label>
                      <textarea
                        rows={3}
                        maxLength={4000}
                        value={chatbotConfig.system_prompt}
                        onChange={(e) => setChatbotConfig({
                          ...chatbotConfig,
                          system_prompt: e.target.value
                        })}
                        placeholder="Bạn là trợ lý dinh dưỡng và ẩm thực ChefAI..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={savingConfig}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {savingConfig ? 'Đang lưu...' : 'Lưu cấu hình (PUT)'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Frequent Questions list */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Chủ Đề & Câu Hỏi Thường Gặp
                  </h3>
                  <div className="space-y-2">
                    {frequentQuestions.length === 0 ? (
                      <div className="text-xs text-slate-400">
                        Chưa có thống kê câu hỏi thường gặp.
                      </div>
                    ) : (
                      frequentQuestions.map((q, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 rounded-xl text-xs flex items-center justify-between">
                          <span className="font-medium text-slate-800">{q.question || q.topic}</span>
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                            {q.count || 1} lượt
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audit Logs Modal */}
      {showAuditLogs && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                Nhật Ký Thao Tác Quản Trị (Audit Logs)
              </h3>
              <button
                onClick={() => setShowAuditLogs(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase">
                  <tr>
                    <th className="py-2.5 pl-3">THỜI GIAN</th>
                    <th className="py-2.5">HÀNH ĐỘNG</th>
                    <th className="py-2.5">ĐỐI TƯỢNG</th>
                    <th className="py-2.5 pr-3">CHI TIẾT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingAuditLogs ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-orange-500 mb-1" />
                        Đang tải nhật ký thao tác...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Chưa có bản ghi nhật ký thao tác nào.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 pl-3 text-slate-500 font-mono text-[11px]">
                          {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : 'Vừa xong'}
                        </td>
                        <td className="py-2.5 font-bold text-slate-800">
                          {log.action}
                          {log.actor?.display_name && (
                            <div className="text-[10px] font-normal text-slate-400">{log.actor.display_name}</div>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-600">
                          {log.target_type} ({log.target_id ? log.target_id.substring(0, 8) : 'hệ thống'})
                        </td>
                        <td className="py-2.5 pr-3 text-slate-500 text-[11px]">
                          {log.detail && typeof log.detail === 'object' ? JSON.stringify(log.detail) : log.detail || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowAuditLogs(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecipeImportModal && (
        <RecipeImportModal
          onClose={() => setShowRecipeImportModal(false)}
          onImported={() => {
            loadAdminDishes();
            loadRecipeDishOptions();
            if (selectedRecipeDishId) loadDishRecipe(selectedRecipeDishId);
          }}
        />
      )}

      {/* Import Dishes Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">KHO DỮ LIỆU CHEFAI</span>
                <h3 className="text-lg font-black text-slate-900">Nhập Món Ăn Từ File Excel</h3>
              </div>
              <button
                type="button"
                onClick={closeImportModal}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bước 1: tải file mẫu */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">1. Tải file mẫu</div>
                <p className="text-slate-500 mt-0.5">
                  Mỗi món một dòng. Bắt buộc: tên món, danh mục, khẩu phần. Tối đa 500 món, 5 MB.
                  Món mới ở trạng thái ẩn; nguyên liệu và các bước nhập sau ở Quản lý công thức (theo cột slug).
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadImportTemplate('xlsx')}
                  disabled={isDownloadingTemplate}
                  className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDownloadingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Mẫu .xlsx
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadImportTemplate('csv')}
                  disabled={isDownloadingTemplate}
                  className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Mẫu .csv
                </button>
              </div>
            </div>

            {/* Bước 2: chọn file */}
            <div className="space-y-2">
              <div className="font-bold text-slate-900">2. Chọn file đã điền</div>
              <label
                className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-2xl transition-colors ${isCheckingImport || isSubmittingImport ? 'border-slate-200 bg-slate-50 cursor-wait' : 'border-orange-200 hover:border-orange-400 hover:bg-orange-50/40 cursor-pointer'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!isCheckingImport && !isSubmittingImport) handleImportFileSelect(e.dataTransfer.files?.[0]);
                }}
              >
                {isCheckingImport ? (
                  <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                ) : (
                  <FileText className="w-6 h-6 text-orange-500" />
                )}
                <span className="font-bold text-slate-700">
                  {isCheckingImport
                    ? 'Đang kiểm tra file...'
                    : importFile
                      ? importFile.name
                      : 'Bấm để chọn hoặc kéo thả file .xlsx / .csv vào đây'}
                </span>
                {importFile && !isCheckingImport && (
                  <span className="text-[11px] text-slate-400">Bấm để chọn file khác</span>
                )}
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  disabled={isCheckingImport || isSubmittingImport}
                  onChange={(e) => {
                    handleImportFileSelect(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {importError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {/* Bước 3: kết quả kiểm tra / kết quả nhập */}
            {importResult && (
              <div className="space-y-3">
                <div className="font-bold text-slate-900">
                  {importResult.dry_run ? '3. Kết quả kiểm tra' : 'Kết quả nhập'}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <div className="text-[11px] text-slate-500 font-bold">Tổng số món</div>
                    <div className="text-xl font-black text-slate-900">{importResult.total_dishes}</div>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/80">
                    <div className="text-[11px] text-emerald-700 font-bold">
                      {importResult.dry_run ? 'Món hợp lệ' : 'Đã tạo'}
                    </div>
                    <div className="text-xl font-black text-emerald-700">
                      {importResult.dry_run ? importResult.valid_dishes : importResult.created_count}
                    </div>
                  </div>
                  <div className={`p-3 rounded-2xl border ${importResult.error_dishes > 0 ? 'bg-red-50 border-red-200/80' : 'bg-slate-50 border-slate-200/80'}`}>
                    <div className={`text-[11px] font-bold ${importResult.error_dishes > 0 ? 'text-red-700' : 'text-slate-500'}`}>
                      Món lỗi {importResult.dry_run ? '' : '(bỏ qua)'}
                    </div>
                    <div className={`text-xl font-black ${importResult.error_dishes > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                      {importResult.error_dishes}
                    </div>
                  </div>
                </div>

                {importResult.warnings.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 space-y-0.5">
                    {importResult.warnings.map((w) => <div key={w}>• {w}</div>)}
                  </div>
                )}

                {importResult.errors.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 font-bold w-16">Dòng</th>
                            <th className="px-3 py-2 font-bold w-32">Cột</th>
                            <th className="px-3 py-2 font-bold">Lỗi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importResult.errors.map((e, idx) => (
                            <tr key={`${e.row}-${e.field}-${idx}`}>
                              <td className="px-3 py-2 font-mono font-bold text-slate-700">{e.row}</td>
                              <td className="px-3 py-2 text-slate-600">{IMPORT_FIELD_LABELS[e.field] || e.field}</td>
                              <td className="px-3 py-2 text-red-700">{e.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!importResult.dry_run && importResult.created && importResult.created.length > 0 && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Các món vừa tạo đang ẩn. Hãy nhập công thức (từng món hoặc từ file) ở Quản lý công thức rồi công khai.
                    </div>
                    <div className="text-emerald-700">
                      {importResult.created.map((d) => d.name).join(', ')}
                    </div>
                  </div>
                )}

                {importResult.dry_run && importResult.valid_dishes === 0 && (
                  <div className="text-slate-500">Không có món hợp lệ nào. Hãy sửa file rồi chọn lại.</div>
                )}
                {importResult.dry_run && importResult.valid_dishes > 0 && importResult.error_dishes > 0 && (
                  <div className="text-slate-500">
                    Món lỗi sẽ bị bỏ qua, chỉ {importResult.valid_dishes} món hợp lệ được nhập.
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={closeImportModal}
                disabled={isCheckingImport || isSubmittingImport}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {importResult && !importResult.dry_run ? 'Đóng' : 'Hủy'}
              </button>
              {(!importResult || importResult.dry_run) && (
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={!importResult || importResult.valid_dishes === 0 || isCheckingImport || isSubmittingImport}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingImport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importResult && importResult.valid_dishes > 0
                    ? `Nhập ${importResult.valid_dishes} món hợp lệ`
                    : 'Nhập món'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add New Dish Modal */}
      {showAddDishModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">KHO DỮ LIỆU CHEFAI</span>
                <h3 className="text-lg font-black text-slate-900">Thêm Món Ăn Mới Vào Hệ Thống</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDishModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDishSubmit} className="space-y-4 text-xs">
              {/* Tên & Mô tả */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">TÊN MÓN ĂN *</label>
                <input
                  type="text"
                  required
                  value={newDishName}
                  onChange={(e) => setNewDishName(e.target.value)}
                  placeholder="Ví dụ: Cá hồi áp chảo sốt chanh leo"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">MÔ TẢ NGẮN VỀ MÓN ĂN</label>
                <textarea
                  value={newDishDesc}
                  onChange={(e) => setNewDishDesc(e.target.value)}
                  placeholder="Mô tả hương vị, đặc điểm dinh dưỡng, cách thưởng thức..."
                  rows={2}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none"
                />
              </div>

              {/* Quản lý ảnh món ăn */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-orange-500" />
                    ẢNH MÓN ĂN
                  </label>
                  {newDishImageUrl && (
                    <button
                      type="button"
                      onClick={() => setNewDishImageUrl('')}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                    >
                      Xóa ảnh này
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="relative w-28 h-28 rounded-2xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                    {newDishImageUrl ? (
                      <>
                        <img
                          src={newDishImageUrl}
                          alt="Dish Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setNewDishImageUrl('')}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                          title="Gỡ ảnh"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                        <Camera className="w-6 h-6 mb-1 text-slate-300" />
                        <span className="text-[10px] font-medium leading-tight">Chưa có ảnh</span>
                      </div>
                    )}
                    {isUploadingNewImage && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-[11px] font-bold gap-1">
                        <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                        <span>Đang tải lên...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2.5 w-full">
                    <div>
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 hover:border-orange-300 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Tải tệp ảnh từ máy tính (JPG, PNG, WebP)</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/jpg"
                          className="hidden"
                          disabled={isUploadingNewImage}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDishImageFile(file, false);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <span className="text-[11px] text-slate-400 block mt-1">
                        Hệ thống tự động nén và tải lên đám mây (tối đa 5MB).
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        HOẶC DÁN ĐƯỜNG DẪN ẢNH (IMAGE URL):
                      </span>
                      <input
                        type="url"
                        value={newDishImageUrl}
                        onChange={(e) => setNewDishImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Phân loại & Khẩu phần */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">DANH MỤC GỢI Ý</label>
                  <select
                    value={popularCategories.includes(newDishCategory) ? newDishCategory : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value !== '__custom__') {
                        setNewDishCategory(e.target.value);
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-orange-500"
                  >
                    {popularCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__custom__">+ Tùy chỉnh danh mục khác</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">TÊN DANH MỤC HOẶC TỰ NHẬP *</label>
                  <input
                    type="text"
                    required
                    value={newDishCategory}
                    onChange={(e) => setNewDishCategory(e.target.value)}
                    placeholder="Nhập tên phân loại món..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">THỜI GIAN (PHÚT)</label>
                  <input
                    type="number"
                    min="1"
                    value={newDishTime}
                    onChange={(e) => setNewDishTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ĐỘ KHÓ</label>
                  <select
                    value={newDishDifficulty}
                    onChange={(e) => setNewDishDifficulty(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="easy">Dễ làm</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Cầu kỳ</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">KHẨU PHẦN (NGƯỜI)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newDishServings}
                    onChange={(e) => setNewDishServings(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Thông số dinh dưỡng */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">GIÁ TRỊ DINH DƯỠNG TRÊN KHẨU PHẦN</label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 font-semibold text-center">CALO (KCAL)</span>
                    <input
                      type="number"
                      value={newDishCalo}
                      onChange={(e) => setNewDishCalo(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 font-semibold text-center">PROTEIN (G)</span>
                    <input
                      type="number"
                      value={newDishProtein}
                      onChange={(e) => setNewDishProtein(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 font-semibold text-center">CARBS (G)</span>
                    <input
                      type="number"
                      value={newDishCarbs}
                      onChange={(e) => setNewDishCarbs(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 font-semibold text-center">FAT (G)</span>
                    <input
                      type="number"
                      value={newDishFat}
                      onChange={(e) => setNewDishFat(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddDishModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isCreatingDish || isUploadingNewImage}
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition-all"
                >
                  {isCreatingDish && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Lưu vào kho món ăn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Dish Modal */}
      {showEditDishModal && editingDish && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
                  CHỈNH SỬA THÔNG TIN MÓN ĂN
                </span>
                <h3 className="text-lg font-black text-slate-900">{editingDish.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditDishModal(false);
                  setEditingDish(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateDishSubmit} className="space-y-4 text-xs">
              {/* Tên & Mô tả */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">TÊN MÓN ĂN *</label>
                <input
                  type="text"
                  required
                  value={editDishName}
                  onChange={(e) => setEditDishName(e.target.value)}
                  placeholder="Tên món ăn..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">MÔ TẢ NGẮN VỀ MÓN ĂN</label>
                <textarea
                  value={editDishDesc}
                  onChange={(e) => setEditDishDesc(e.target.value)}
                  placeholder="Mô tả hương vị, đặc điểm dinh dưỡng, cách thưởng thức..."
                  rows={2}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none"
                />
              </div>

              {/* Quản lý ảnh món ăn */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-orange-500" />
                    ẢNH MÓN ĂN
                  </label>
                  {editDishImageUrl && (
                    <button
                      type="button"
                      onClick={() => setEditDishImageUrl('')}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                    >
                      Xóa ảnh này
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="relative w-28 h-28 rounded-2xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                    {editDishImageUrl ? (
                      <>
                        <img
                          src={editDishImageUrl}
                          alt="Dish Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setEditDishImageUrl('')}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer"
                          title="Gỡ ảnh"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                        <Camera className="w-6 h-6 mb-1 text-slate-300" />
                        <span className="text-[10px] font-medium leading-tight">Chưa có ảnh</span>
                      </div>
                    )}
                    {isUploadingEditImage && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-[11px] font-bold gap-1">
                        <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                        <span>Đang tải lên...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2.5 w-full">
                    <div>
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 hover:border-orange-300 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Tải tệp ảnh mới từ máy tính</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/jpg"
                          className="hidden"
                          disabled={isUploadingEditImage}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDishImageFile(file, true);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <span className="text-[11px] text-slate-400 block mt-1">
                        Thay thế ảnh đại diện món ăn trực tiếp lên đám mây.
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        HOẶC DÁN ĐƯỜNG DẪN ẢNH (IMAGE URL):
                      </span>
                      <input
                        type="url"
                        value={editDishImageUrl}
                        onChange={(e) => setEditDishImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Phân loại & Khẩu phần */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">DANH MỤC GỢI Ý</label>
                  <select
                    value={popularCategories.includes(editDishCategory) ? editDishCategory : '__custom__'}
                    onChange={(e) => {
                      if (e.target.value !== '__custom__') {
                        setEditDishCategory(e.target.value);
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-orange-500"
                  >
                    {popularCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__custom__">+ Tùy chỉnh danh mục khác</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">TÊN DANH MỤC *</label>
                  <input
                    type="text"
                    required
                    value={editDishCategory}
                    onChange={(e) => setEditDishCategory(e.target.value)}
                    placeholder="Nhập tên phân loại..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">THỜI GIAN (PHÚT)</label>
                  <input
                    type="number"
                    min="1"
                    value={editDishTime}
                    onChange={(e) => setEditDishTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ĐỘ KHÓ</label>
                  <select
                    value={editDishDifficulty}
                    onChange={(e) => setEditDishDifficulty(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="easy">Dễ làm</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Cầu kỳ</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">KHẨU PHẦN (NGƯỜI)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={editDishServings}
                    onChange={(e) => setEditDishServings(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              {/* Thông số dinh dưỡng */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">GIÁ TRỊ DINH DƯỠNG TRÊN KHẨU PHẦN</label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 font-semibold text-center">CALO (KCAL)</span>
                    <input
                      type="number"
                      value={editDishCalo}
                      onChange={(e) => setEditDishCalo(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 font-semibold text-center">PROTEIN (G)</span>
                    <input
                      type="number"
                      value={editDishProtein}
                      onChange={(e) => setEditDishProtein(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 font-semibold text-center">CARBS (G)</span>
                    <input
                      type="number"
                      value={editDishCarbs}
                      onChange={(e) => setEditDishCarbs(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 font-semibold text-center">FAT (G)</span>
                    <input
                      type="number"
                      value={editDishFat}
                      onChange={(e) => setEditDishFat(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDishModal(false);
                    setEditingDish(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingDish || isUploadingEditImage}
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition-all"
                >
                  {isUpdatingDish && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Lưu cập nhật món ăn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
