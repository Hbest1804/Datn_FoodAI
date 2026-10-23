import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Sparkles, 
  Flame, 
  Clock, 
  Camera, 
  Mic, 
  RotateCcw, 
  Sliders, 
  ChefHat, 
  Plus, 
  Trash2,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  UtensilsCrossed,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, ChatMessage, Recipe, ChatSession, GuestQuota } from '../types';
import { apiService } from '../services/api';
import { normalizeDish, formatDifficulty } from '../utils/dishUtils';
import { toast, showConfirm } from './NotificationModal';

interface ChatbotViewProps {
  currentUser: UserProfile;
  recipes?: Recipe[];
  initialPrompt?: string;
  initialFridge?: string[];
  initialSessionId?: string;
  onOpenRecipe: (recipe: Recipe) => void;
  onOpenRegisterModal: () => void;
  onGoToProfile: () => void;
  onAddToPlanner: (recipe: Recipe) => void;
}

function getAppetizingImageForDishName(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('bò') || n.includes('beef')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('cá hồi') || n.includes('salmon')) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('tôm') || n.includes('shrimp') || n.includes('hải sản') || n.includes('mực') || n.includes('ngao')) {
    return 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('đậu') || n.includes('chay') || n.includes('tofu') || n.includes('nấm')) {
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('canh') || n.includes('soup') || n.includes('mây') || n.includes('trứng')) {
    return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('gà') || n.includes('chicken')) {
    return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('heo') || n.includes('lợn') || n.includes('thịt kho') || n.includes('sườn') || n.includes('ba chỉ')) {
    return 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('rau') || n.includes('xào') || n.includes('luộc') || n.includes('cải') || n.includes('muống')) {
    return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('mì') || n.includes('bún') || n.includes('phở') || n.includes('hủ tiếu')) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80';
  }
  if (n.includes('gỏi') || n.includes('salad') || n.includes('nộm')) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80';
  }
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
}

export const ChatbotView: React.FC<ChatbotViewProps> = ({
  currentUser,
  recipes = [],
  initialPrompt,
  initialFridge,
  initialSessionId,
  onOpenRecipe,
  onOpenRegisterModal,
  onGoToProfile,
  onAddToPlanner,
}) => {
  const isGuest = currentUser.role === 'guest';

  // Guest Quota State
  const [guestQuota, setGuestQuota] = useState<GuestQuota>({
    limit: 5,
    used: 0,
    remaining: 5,
    resets_at: new Date(Date.now() + 86400000).toISOString(),
  });

  // User Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);

  // Messages State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackSuccessId, setFeedbackSuccessId] = useState<string | null>(null);

  // Fridge ingredient attachments
  const [attachedFridge, setAttachedFridge] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('culina_fridge');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => item.name || String(item)).filter(Boolean);
        }
      }
    } catch {}
    return [];
  });
  const [showAttachFridge, setShowAttachFridge] = useState(false);
  const [newFridgeItem, setNewFridgeItem] = useState('');

  // Tự động nhận diện và ghép ảnh món ăn trực quan từ câu trả lời của Chatbot
  const getDishesForMessage = useCallback((msg: ChatMessage): Recipe[] => {
    const list: Recipe[] = [];
    const seenNames = new Set<string>();

    // 1. Ưu tiên lấy từ referenced_dishes do backend trả về
    if (Array.isArray(msg.referenced_dishes) && msg.referenced_dishes.length > 0) {
      msg.referenced_dishes.forEach((d: any) => {
        const norm = normalizeDish(d);
        if (norm.title && !seenNames.has(norm.title.toLowerCase())) {
          seenNames.add(norm.title.toLowerCase());
          list.push(norm);
        }
      });
    }

    // 2. Tự động quét các món ăn dạng **Tên Món**: trong nội dung tư vấn của AI
    const text = msg.content || msg.text || '';
    if (msg.role === 'assistant' || msg.sender === 'assistant') {
      const dishRegex = /(?:\*\s*)?\*\*([^*\n:]{3,60})\*\*(?:\s*:|\s*–|\s*-)?/g;
      let match;
      while ((match = dishRegex.exec(text)) !== null) {
        const candidate = match[1].trim();
        const lower = candidate.toLowerCase();
        if (/^(lưu ý|mẹo|chú ý|cách làm|nguyên liệu|bước \d+|hướng dẫn|thành phần|giá trị|lời khuyên|chúc bạn|ưu điểm|cách sơ chế|bảo quản|phân tích|tổng kết)/i.test(lower)) {
          continue;
        }

        if (!seenNames.has(lower)) {
          seenNames.add(lower);

          // Tìm món tương ứng trong hệ thống recipes
          const systemMatch = (recipes || []).find(r => 
            r.title?.toLowerCase().includes(lower) || 
            lower.includes(r.title?.toLowerCase() || '')
          );

          if (systemMatch) {
            list.push(systemMatch);
          } else {
            // Trích xuất thời gian nấu nếu có trong đoạn văn (ví dụ: "15 phút", "20 phút")
            const afterText = text.slice(match.index, match.index + 200);
            const timeMatch = afterText.match(/(\d+)\s*phút/i);
            const cookingTime = timeMatch ? parseInt(timeMatch[1], 10) : 15;

            list.push({
              id: `ai-dish-${candidate.replace(/\s+/g, '-').toLowerCase()}`,
              title: candidate,
              name: candidate,
              slug: candidate.replace(/\s+/g, '-').toLowerCase(),
              image: getAppetizingImageForDishName(candidate),
              image_url: getAppetizingImageForDishName(candidate),
              cookingTime,
              cook_time_minutes: cookingTime,
              difficulty: 'Dễ',
              category: 'Món gợi ý AI',
              description: `Món ăn dinh dưỡng chuẩn vị được Bếp Trưởng ChefAI tư vấn riêng cho bữa ăn của bạn.`,
              ingredients: [
                { name: 'Nguyên liệu tươi sạch', unit: 'theo khẩu phần gia đình' },
                { name: 'Gia vị cơ bản', unit: 'vừa đủ' }
              ],
              steps: [
                { order: 1, instruction: 'Sơ chế sạch nguyên liệu và để ráo nước.' },
                { order: 2, instruction: `Chế biến món ${candidate} trong khoảng ${cookingTime} phút theo hướng dẫn.` },
                { order: 3, instruction: 'Trình bày ra đĩa, nêm nếm vừa miệng và thưởng thức khi còn nóng.' }
              ],
              macros: { calories: 380, protein: 22, carbs: 35, fat: 12 },
              servings: 2,
              rating: 0,
              reviewCount: 0,
              tags: [],
            });
          }
        }
      }
    }

    return list.slice(0, 6);
  }, [recipes]);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    // Only scroll the internal message container, never the window/page
    const timer = setTimeout(() => {
      scrollToBottom('smooth');
    }, 50);
    return () => clearTimeout(timer);
  }, [messages.length, isLoading]);

  // 1. Initialize Guest Quota or User Sessions
  const loadGuestQuota = useCallback(async () => {
    try {
      const q = await apiService.chat.getGuestQuota();
      setGuestQuota(q);
    } catch (e) {
      console.warn('Could not load guest quota:', e);
    }
  }, []);

  const loadUserSessions = useCallback(async () => {
    setIsSessionsLoading(true);
    try {
      const res = await apiService.chat.getSessions(1, 20);
      setSessions(res.data || []);
      if (res.data && res.data.length > 0) {
        const targetId = (initialSessionId && res.data.some(s => s.id === initialSessionId))
          ? initialSessionId
          : res.data[0].id;
        loadSessionMessages(targetId);
      } else {
        // Create initial session if none exists
        const newSess = await apiService.chat.createSession();
        setSessions([newSess]);
        setCurrentSessionId(newSess.id);
        setMessages([
          {
            id: 'msg-welcome',
            role: 'assistant',
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            content: `Xin chào ${currentUser.name}! Tôi là Bếp trưởng AI của ChefAI. Dựa trên hồ sơ khẩu vị của bạn (${currentUser.dietPreference}), tôi sẵn sàng đề xuất món ăn tối ưu dinh dưỡng, loại bỏ hoàn toàn dị ứng và cân đối calo hôm nay.`,
            quickReplies: [
              'Gợi ý bữa trưa dưới 400 Kcal',
              'Thực đơn Eat Clean phục hồi sau tập',
              'Món gì từ nguyên liệu tủ lạnh hôm nay?',
              'Bí quyết xào ức gà mềm mọng không bị khô'
            ]
          }
        ]);
      }
    } catch (e) {
      console.warn('Error loading sessions:', e);
    } finally {
      setIsSessionsLoading(false);
    }
  }, [currentUser, initialSessionId]);

  const loadSessionMessages = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setIsLoading(true);
    try {
      const data = await apiService.chat.getSessionDetail(sessionId);
      if (data && data.messages) {
        setMessages(data.messages.map(m => ({
          ...m,
          sender: m.role || 'assistant',
          text: m.content,
          timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong',
        })));
      }
    } catch (e) {
      console.warn('Could not load session detail:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isGuest) {
      loadGuestQuota();
      // Welcome guest message
      setMessages([
        {
          id: 'guest-welcome',
          role: 'assistant',
          sender: 'assistant',
          timestamp: 'Vừa xong',
          content: 'Xin chào bạn! Tôi là Bếp trưởng AI ChefAI. Bạn có thể hỏi công thức nấu ăn, gợi ý món từ tủ lạnh hoặc tính toán calo dinh dưỡng tức thì.\n\nBạn đang có những nguyên liệu gì hoặc cần tư vấn món ăn nào hôm nay?',
          quickReplies: [
            'Tôi có ức gà và bông cải xanh, nấu món gì?',
            'Gợi ý bữa tối Eat Clean dưới 450 kcal',
            'Cách làm sốt tiêu đen không cần bột năng',
            'Món ngon miền Bắc dễ làm'
          ]
        }
      ]);
    } else {
      loadUserSessions();
    }
  }, [isGuest, loadGuestQuota, loadUserSessions]);

  // Handle initial prompt and fridge ingredients from other pages
  useEffect(() => {
    if (initialFridge && initialFridge.length > 0) {
      setAttachedFridge(initialFridge);
    }
    if (initialPrompt) {
      sendMessage(initialPrompt);
    }
  }, [initialPrompt, initialFridge]);

  // 2. Create New Session
  const handleCreateNewSession = async () => {
    try {
      const newSess = await apiService.chat.createSession();
      setSessions(prev => [newSess, ...prev]);
      setCurrentSessionId(newSess.id);
      setMessages([
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          sender: 'assistant',
          timestamp: 'Vừa xong',
          content: `Phiên hội thoại mới đã sẵn sàng! Bạn muốn Bếp trưởng ChefAI hỗ trợ điều gì hôm nay?`,
          quickReplies: [
            'Lên thực đơn 3 bữa hôm nay',
            'Món ăn giàu đạm ít béo',
            'Tìm món thanh đạm giải nhiệt'
          ]
        }
      ]);
    } catch (err: any) {
      toast.error('Không thể tạo hội thoại mới: ' + (err.message || 'Lỗi kết nối'));
    }
  };

  // 3. Delete Session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await showConfirm({
      title: 'Xóa hội thoại',
      message: 'Bạn có chắc chắn muốn xóa cuộc hội thoại này không? Lịch sử tin nhắn sẽ bị xóa vĩnh viễn.',
      confirmText: 'Xóa hội thoại',
      cancelText: 'Giữ lại',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiService.chat.deleteSession(sessionId);
      const remaining = sessions.filter(s => s.id !== sessionId);
      setSessions(remaining);
      if (currentSessionId === sessionId) {
        if (remaining.length > 0) {
          loadSessionMessages(remaining[0].id);
        } else {
          handleCreateNewSession();
        }
      }
      toast.success('Đã xóa hội thoại thành công.');
    } catch (err: any) {
      toast.error('Lỗi xóa hội thoại: ' + (err.message || 'Lỗi thao tác'));
    }
  };

  // 3b. Delete Current Active Chat (Header Action)
  const handleDeleteCurrentChat = async () => {
    const ok = await showConfirm({
      title: 'Xóa cuộc hội thoại',
      message: 'Bạn có chắc chắn muốn xóa cuộc trò chuyện này không? Thao tác này sẽ xóa toàn bộ nội dung thảo luận hiện tại.',
      confirmText: 'Xóa hội thoại',
      cancelText: 'Giữ lại',
      variant: 'danger',
    });
    if (!ok) return;

    if (!isGuest && currentSessionId) {
      try {
        await apiService.chat.deleteSession(currentSessionId);
        const remaining = sessions.filter(s => s.id !== currentSessionId);
        setSessions(remaining);
        if (remaining.length > 0) {
          loadSessionMessages(remaining[0].id);
        } else {
          handleCreateNewSession();
        }
        toast.success('Đã xóa cuộc hội thoại thành công.');
      } catch (err: any) {
        toast.error('Lỗi khi xóa hội thoại: ' + (err.message || 'Lỗi thao tác'));
      }
    } else {
      // Guest mode
      setMessages([
        {
          id: `guest-welcome-${Date.now()}`,
          role: 'assistant',
          sender: 'assistant',
          timestamp: 'Vừa xong',
          content: 'Xin chào bạn! Tôi là Bếp trưởng AI ChefAI. Bạn có thể hỏi công thức nấu ăn, gợi ý món từ tủ lạnh hoặc tính toán calo dinh dưỡng tức thì.\n\nBạn đang có những nguyên liệu gì hoặc cần tư vấn món ăn nào hôm nay?',
          quickReplies: [
            'Tôi có ức gà và bông cải xanh, nấu món gì?',
            'Bữa tối lành mạnh cho 2 người',
            'Cách làm nước sốt mè rang chuẩn vị'
          ]
        }
      ]);
      toast.success('Đã xóa và làm mới cuộc hội thoại.');
    }
  };

  // 4. Send Message Handler
  const sendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isLoading) return;

    if (isGuest && guestQuota.remaining <= 0) {
      onOpenRegisterModal();
      return;
    }

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      content: text.trim(),
      text: text.trim(),
    };

    setMessages(prev => [...prev, tempUserMsg]);
    setInputMessage('');
    setIsLoading(true);

    const fridgePayload = attachedFridge.length > 0 ? {
      custom_ingredients: attachedFridge,
    } : undefined;

    try {
      if (isGuest) {
        // GUEST MODE
        const res = await apiService.chat.sendGuestMessage(text.trim(), fridgePayload);
        const reply = res.reply;
        setGuestQuota(res.quota);

        const normalizedDishes = (reply.dishes || []).map(normalizeDish);

        const assistantMsg: ChatMessage = {
          id: `guest-resp-${Date.now()}`,
          role: 'assistant',
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          content: reply.content,
          text: reply.content,
          referenced_dishes: reply.dishes,
          recipeRecommendation: normalizedDishes.length > 0 ? normalizedDishes[0] : undefined,
          quickReplies: [
            'Cách sơ chế & bảo quản nguyên liệu',
            'Có thể thay thế gia vị nào nếu thiếu?',
            'Ước tính calo chi tiết từng nguyên liệu'
          ]
        };

        setMessages(prev => [...prev, assistantMsg]);
      } else {
        // PERSONALIZED USER MODE
        let activeSessId = currentSessionId;
        if (!activeSessId) {
          const newSess = await apiService.chat.createSession();
          activeSessId = newSess.id;
          setCurrentSessionId(newSess.id);
          setSessions(prev => [newSess, ...prev]);
        }

        const data = await apiService.chat.sendMessage(activeSessId, text.trim(), fridgePayload);
        
        // Đồng bộ tiêu đề session trong danh sách với câu hỏi đầu tiên của người dùng
        if (data.session_title) {
          const newTitle = data.session_title;
          setSessions(prev => prev.map(s => 
            s.id === activeSessId ? { ...s, title: newTitle } : s
          ));
        }

        const assistantMsgRaw = data.assistant_message;
        const normalizedDishes = (assistantMsgRaw.referenced_dishes || []).map(normalizeDish);

        const assistantMsg: ChatMessage = {
          ...assistantMsgRaw,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          text: assistantMsgRaw.content,
          recipeRecommendation: normalizedDishes.length > 0 ? normalizedDishes[0] : undefined,
          quickReplies: [
            'Lưu món này vào Thực Đơn Tuần',
            'Gợi ý món canh ăn kèm thanh mát',
            'Tự động trừ calo hôm nay'
          ]
        };

        setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), data.user_message, assistantMsg]);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      if (err.code === 'GUEST_LIMIT_EXCEEDED') {
        setGuestQuota(prev => ({ ...prev, used: prev.limit, remaining: 0, resets_at: err.details?.resets_at || prev.resets_at }));
        const errorMsg: ChatMessage = {
          id: `limit-${Date.now()}`,
          role: 'assistant',
          sender: 'assistant',
          timestamp: 'Vừa xong',
          content: `⚠️ ${err.message || 'Bạn đã dùng hết lượt hỏi ở chế độ khách. Vui lòng đăng ký hoặc đăng nhập để tiếp tục.'}`,
        };
        setMessages(prev => [...prev, errorMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          sender: 'assistant',
          timestamp: 'Vừa xong',
          content: `Bếp trưởng ChefAI: Rất tiếc, đã có sự cố kết nối máy chủ (${err.message || 'Lỗi server'}). Vui lòng thử lại sau giây lát!`,
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Feedback Thumbs Up / Down
  const handleFeedback = async (messageId: string, feedback: 'like' | 'dislike') => {
    try {
      await apiService.chat.sendFeedback(messageId, feedback);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback } : m));
      setFeedbackSuccessId(messageId);
      setTimeout(() => setFeedbackSuccessId(null), 2500);
    } catch (e) {
      console.warn('Feedback failed:', e);
    }
  };

  const handleAddFridgeItem = () => {
    if (newFridgeItem.trim() && !attachedFridge.includes(newFridgeItem.trim())) {
      setAttachedFridge([...attachedFridge, newFridgeItem.trim()]);
      setNewFridgeItem('');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Alert */}
      {isGuest ? (
        <div className="p-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-3xl text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-white animate-ping" />
            <div>
              <div className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <span>CHẾ ĐỘ KHÁCH</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  Còn {guestQuota.remaining}/{guestQuota.limit} lượt hỏi hôm nay
                </span>
              </div>
              <p className="text-xs text-orange-100">
                Đăng ký tài khoản miễn phí để lưu lịch sử hội thoại, đồng bộ hồ sơ khẩu vị và hỏi đáp không giới hạn!
              </p>
            </div>
          </div>
          <button
            onClick={onOpenRegisterModal}
            className="px-4 py-2 bg-white text-orange-700 hover:bg-orange-50 font-bold rounded-2xl text-xs shadow-md transition-all shrink-0 cursor-pointer"
          >
            Đăng ký miễn phí ngay →
          </button>
        </div>
      ) : (
        <div className="p-4 bg-white border border-slate-200/80 rounded-3xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-xs">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 text-sm">Bếp Trưởng AI Cá Nhân Hóa</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                  Trợ Lý Thông Minh
                </span>
                <span className="text-emerald-600 font-semibold text-[11px]">• Trực tuyến</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Đã đồng bộ khẩu vị của <strong>{currentUser.name}</strong> • Chế độ: {currentUser.dietPreference} • Calo: {currentUser.targetCalories} kcal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNewSession}
              className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo phiên hỏi mới
            </button>
            <button
              onClick={onGoToProfile}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              Hồ sơ khẩu vị
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Session List (for logged in users) or Quick Fridge (for guest) */}
        {!isGuest ? (
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4 h-[750px] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-orange-500" />
                Lịch sử hội thoại
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {sessions.length} phiên
              </span>
            </div>

            {/* Sessions Scrollable List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => loadSessionMessages(s.id)}
                  className={`p-3 rounded-2xl text-xs transition-all cursor-pointer group flex items-center justify-between ${
                    currentSessionId === s.id
                      ? 'bg-orange-50 border border-orange-200 text-orange-950 font-bold shadow-2xs'
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="truncate flex-1 pr-2">
                    <div className="truncate text-xs">{s.title || 'Hội thoại ẩm thực'}</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {new Date(s.updated_at || s.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors rounded-lg cursor-pointer"
                    title="Xóa hội thoại"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Fridge Attachments Button */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAttachFridge(!showAttachFridge)}
                className="w-full py-2 px-3 rounded-xl border border-dashed border-orange-300 bg-orange-50/50 hover:bg-orange-50 text-orange-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                {showAttachFridge ? 'Đóng nguyên liệu đính kèm' : 'Gắn nguyên liệu tủ lạnh'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4 h-fit">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ChefHat className="w-4 h-4 text-orange-500" />
                Trợ lý Khách
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                Lượt hỏi: {guestQuota.remaining}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có thể gửi câu hỏi bất kỳ về cách chế biến món ăn, điều chỉnh độ mặn ngọt, hoặc đính kèm nguyên liệu trong tủ lạnh để Bếp trưởng gợi ý món nấu ngay.
            </p>
            <div className="p-3 bg-slate-50 rounded-2xl text-[11px] text-slate-500 space-y-1 border border-slate-100">
              <div className="font-bold text-slate-700">Gợi ý mẫu câu hỏi nhanh:</div>
              <div>• "Tối nay ăn gì ít béo dưới 30 phút?"</div>
              <div>• "Cách nấu canh chua cá lóc không bị tanh?"</div>
              <div>• "Tôi có thịt bò và hành tây, làm món gì?"</div>
            </div>
          </div>
        )}

        {/* Center 3 Cols: Chat Conversation Box */}
        <div className={`bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col h-[750px] overflow-hidden ${isGuest ? 'lg:col-span-3' : 'lg:col-span-3'}`}>
          {/* Active Conversation Top Bar */}
          <div className="px-5 py-3 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <div className="truncate">
                <h4 className="text-xs font-bold text-slate-900 truncate">
                  {!isGuest 
                    ? (sessions.find(s => s.id === currentSessionId)?.title || 'Cuộc trò chuyện mới')
                    : 'Bếp Trưởng AI • Trò chuyện trực tuyến'
                  }
                </h4>
                <p className="text-[10px] text-slate-500 truncate">
                  {!isGuest ? 'Đồng bộ tiêu đề từ câu hỏi đầu tiên' : 'Chế độ khách dùng thử miễn phí'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDeleteCurrentChat}
                className="px-3 py-1.5 rounded-xl border border-rose-200/90 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Xóa cuộc hội thoại này"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Xóa hội thoại</span>
              </button>
            </div>
          </div>

          {/* Messages scroll area */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' || msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {(msg.sender === 'assistant' || msg.role === 'assistant') && (
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <ChefHat className="w-5 h-5" />
                  </div>
                )}

                <div className={`space-y-3 max-w-[85%] ${msg.sender === 'user' || msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Sender & Timestamp */}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-bold text-slate-700">
                      {(msg.sender === 'user' || msg.role === 'user') ? currentUser.name : 'Bếp trưởng ChefAI'}
                    </span>
                    <span>{msg.timestamp || 'Vừa xong'}</span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`p-4 rounded-3xl text-sm leading-relaxed ${
                      (msg.sender === 'user' || msg.role === 'user')
                        ? 'bg-slate-900 text-white rounded-tr-xs shadow-xs'
                        : 'bg-slate-50 text-slate-800 rounded-tl-xs border border-slate-200/60'
                    }`}
                  >
                    <div className="whitespace-pre-line">{msg.content || msg.text}</div>
                  </div>

                  {/* Referenced Dishes Cards with rich appetizing food photos */}
                  {(() => {
                    const messageDishes = getDishesForMessage(msg);
                    if (messageDishes.length === 0) return null;
                    return (
                      <div className="space-y-2.5 pt-2 w-full animate-in fade-in duration-300">
                        <div className="text-[11px] font-bold text-orange-700 uppercase tracking-wide flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                          Món ăn tư vấn kèm hình ảnh & công thức:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {messageDishes.map((dish: any) => (
                            <div
                              key={dish.id || dish.title}
                              onClick={() => onOpenRecipe(normalizeDish(dish))}
                              className="bg-white p-3 rounded-2xl border border-orange-200/90 shadow-2xs hover:shadow-md hover:border-orange-300 transition-all cursor-pointer flex gap-3 items-center group"
                            >
                              <img
                                src={dish.image || dish.image_url || getAppetizingImageForDishName(dish.title || dish.name)}
                                alt={dish.title || dish.name}
                                className="w-16 h-16 rounded-xl object-cover shrink-0 group-hover:scale-105 transition-transform border border-slate-100"
                              />
                              <div className="min-w-0 flex-1">
                                <h5 className="font-bold text-xs text-slate-900 group-hover:text-orange-600 truncate">
                                  {dish.title || dish.name}
                                </h5>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                                  <span>⏱ {dish.cookingTime || dish.cook_time_minutes || 15} phút</span>
                                  <span>• {formatDifficulty(dish.difficulty)}</span>
                                </div>
                                <span className="text-[10px] font-bold text-orange-600 flex items-center gap-0.5 mt-1 group-hover:translate-x-0.5 transition-transform">
                                  Xem công thức & nấu ngay <ChevronRight className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Feedback Buttons for Assistant Message (Section 4.6.6) */}
                  {!isGuest && (msg.role === 'assistant' || msg.sender === 'assistant') && msg.id && !msg.id.startsWith('temp') && (
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                      <span>Câu trả lời hữu ích?</span>
                      <button
                        onClick={() => handleFeedback(msg.id, 'like')}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          msg.feedback === 'like'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                            : 'border-slate-200 hover:bg-slate-100 text-slate-500'
                        }`}
                        title="Hữu ích"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 'dislike')}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          msg.feedback === 'dislike'
                            ? 'bg-red-50 border-red-300 text-red-700 font-bold'
                            : 'border-slate-200 hover:bg-slate-100 text-slate-500'
                        }`}
                        title="Chưa phù hợp"
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                      {feedbackSuccessId === msg.id && (
                        <span className="text-[10px] text-emerald-600 font-semibold animate-in fade-in">
                          ✓ Đã ghi nhận phản hồi!
                        </span>
                      )}
                    </div>
                  )}

                  {/* Quick Replies */}
                  {msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.quickReplies.map((qr, idx) => (
                        <button
                          key={idx}
                          onClick={() => sendMessage(qr)}
                          className="px-3 py-1 bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-full text-xs text-slate-600 hover:text-orange-700 font-medium transition-all shadow-2xs cursor-pointer"
                        >
                          {qr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start items-center">
                <div className="w-9 h-9 rounded-2xl bg-orange-500 text-white flex items-center justify-center shrink-0">
                  <ChefHat className="w-5 h-5 animate-bounce" />
                </div>
                <div className="p-3 bg-orange-50 border border-orange-200/80 rounded-2xl text-xs text-orange-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-500 animate-spin" />
                  <span>Bếp trưởng AI đang tính toán công thức phù hợp...</span>
                </div>
              </div>
            )}
          </div>

          {/* Attached Fridge Ingredients Panel (Toggleable) */}
          {showAttachFridge && (
            <div className="px-4 py-3 bg-amber-50/70 border-t border-amber-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950 flex items-center gap-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
                  Nguyên liệu có sẵn sẽ gửi kèm câu hỏi:
                </span>
                <span className="text-[11px] text-amber-700">Tối đa 20 nguyên liệu</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {attachedFridge.map((item, idx) => (
                  <span key={idx} className="px-2.5 py-0.5 bg-white border border-amber-300 text-amber-900 rounded-lg text-xs flex items-center gap-1">
                    {item}
                    <button
                      onClick={() => setAttachedFridge(attachedFridge.filter((_, i) => i !== idx))}
                      className="hover:text-red-500 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFridgeItem}
                  onChange={(e) => setNewFridgeItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFridgeItem()}
                  placeholder="Thêm nguyên liệu (VD: cà chua, tỏi băm...)"
                  className="px-3 py-1 bg-white border border-amber-300 rounded-lg text-xs outline-none flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddFridgeItem}
                  className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  + Thêm
                </button>
              </div>
            </div>
          )}

          {/* Input Box Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => {
                  sendMessage('Tôi có thịt bò và nấm, hãy gợi ý món ăn tối ít calo!');
                }}
                className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-orange-600 hover:border-orange-300 transition-all cursor-pointer shadow-2xs"
                title="Hỏi nhanh nguyên liệu tủ lạnh"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  isGuest 
                    ? `Nhập câu hỏi ẩm thực (Còn ${guestQuota.remaining} lượt hôm nay)...`
                    : "Nhập câu hỏi ẩm thực, nguyên liệu có sẵn, calo mong muốn..."
                }
                className="flex-1 px-4 py-3 bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-2xl text-sm sm:text-base font-medium outline-none shadow-2xs transition-all"
              />

              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="p-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl font-bold shadow-md shadow-orange-500/20 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-xs text-slate-500 mt-2 text-center">
              ChefAI tích hợp dữ liệu dinh dưỡng chuẩn cùng ẩm thực Việt Nam, kiểm tra an toàn dị ứng trước khi gợi ý.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
