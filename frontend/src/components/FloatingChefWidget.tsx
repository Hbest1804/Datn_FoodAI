import React, { useState, useRef, useEffect } from 'react';
import { 
  ChefHat, 
  Sparkles, 
  X, 
  Send, 
  Camera, 
  Trash2,
  Maximize2,
  ChevronDown
} from 'lucide-react';
import { UserProfile, Recipe } from '../types';
import { ChefLogo3D } from './ChefLogo3D';
import { apiService } from '../services/api';
import { toast, showConfirm } from './NotificationModal';

interface FloatingChefWidgetProps {
  currentUser: UserProfile;
  onOpenFullChat: (prompt?: string, sessionId?: string) => void;
  onOpenRecipe: (recipe: Recipe) => void;
}

interface MiniMessage {
  id: string;
  sender: 'chef' | 'user';
  text: string;
  timestamp: string;
  dishIdea?: {
    title: string;
    calo: number;
    time: number;
    protein: number;
    badge: string;
  };
}

export const FloatingChefWidget: React.FC<FloatingChefWidgetProps> = ({
  currentUser,
  onOpenFullChat,
  onOpenRecipe,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MiniMessage[]>([
    {
      id: 'm-1',
      sender: 'chef',
      text: `Chào ${currentUser.name || 'bạn'}! Bếp Trưởng Culina AI đang trực tuyến. Bạn cần gợi ý món từ tủ lạnh hay tính calo bữa ăn nào hôm nay?`,
      timestamp: 'Vừa xong',
    }
  ]);

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
    if (isOpen) {
      const timer = setTimeout(() => {
        scrollToBottom('smooth');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages.length, isOpen, isLoading]);

  const handleDeleteConversation = async () => {
    const ok = await showConfirm({
      title: 'Xóa cuộc hội thoại',
      message: 'Bạn có chắc chắn muốn xóa toàn bộ tin nhắn trong cuộc trò chuyện này và bắt đầu lại?',
      confirmText: 'Xóa hội thoại',
      cancelText: 'Giữ lại',
      variant: 'danger',
    });
    if (!ok) return;

    if (currentUser.isLoggedIn && activeSessionId) {
      try {
        await apiService.chat.deleteSession(activeSessionId);
      } catch (e) {
        console.warn('Could not delete session on backend:', e);
      }
    }

    setActiveSessionId(null);
    setMessages([
      {
        id: `m-reset-${Date.now()}`,
        sender: 'chef',
        text: `Chào ${currentUser.name || 'bạn'}! Bếp Trưởng Culina AI đang trực tuyến. Bạn cần gợi ý món từ tủ lạnh hay tính calo bữa ăn nào hôm nay?`,
        timestamp: 'Vừa xong',
      }
    ]);
    toast.success('Đã xóa cuộc hội thoại thành công.');
  };

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || isLoading) return;

    const userMsg: MiniMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: promptText.trim(),
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      let replyText = '';
      if (currentUser.isLoggedIn) {
        // Authenticated user - maintain active session
        let targetSessionId = activeSessionId;
        if (!targetSessionId) {
          const newSes = await apiService.chat.createSession();
          targetSessionId = newSes.id;
          setActiveSessionId(newSes.id);
        }
        const msgRes = await apiService.chat.sendMessage(targetSessionId, promptText);
        replyText = msgRes.assistant_message?.content || 'Bếp trưởng đã ghi nhận yêu cầu!';
      } else {
        // Guest mode
        const guestRes = await apiService.chat.sendGuestMessage(promptText);
        replyText = guestRes.reply?.content || 'Đã phân tích khẩu vị của bạn!';
      }

      const chefMsg: MiniMessage = {
        id: `c-${Date.now() + 1}`,
        sender: 'chef',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, chefMsg]);
    } catch (e: any) {
      console.error('Chat error:', e);
      const chefMsg: MiniMessage = {
        id: `c-${Date.now() + 1}`,
        sender: 'chef',
        text: e.message || 'Bếp trưởng AI đã ghi nhận yêu cầu. Hãy mở màn hình trò chuyện đầy đủ để nhận phân tích chi tiết.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, chefMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Pill / Bubble */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Quick Prompt Tooltip Pill */}
          <button
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-orange-200/90 text-xs font-bold text-slate-800 hover:text-orange-600 hover:border-orange-300 transition-all cursor-pointer group"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Hỏi Bếp Trưởng AI: "Ăn gì trưa nay?"</span>
            <Sparkles className="w-3.5 h-3.5 text-orange-500 group-hover:rotate-12 transition-transform" />
          </button>

          {/* Main Floating 3D Logo Button */}
          <div onClick={() => setIsOpen(true)} className="cursor-pointer">
            <ChefLogo3D size="lg" showSparkle={true} />
          </div>
        </div>
      )}

      {/* Floating Interactive AI Widget Popup Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 w-[92vw] sm:w-[400px] h-[560px] bg-white rounded-3xl shadow-2xl border border-orange-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Widget Header */}
          <div className="p-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <ChefLogo3D size="sm" showSparkle={false} />
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-black tracking-tight">Bếp Trưởng Culina AI</h4>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-400 text-slate-900">
                    Trực tuyến
                  </span>
                </div>
                <p className="text-[10px] text-orange-100">
                  Phân tích Calo & Khẩu vị tức thì • Gemini 3.8
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleDeleteConversation}
                className="p-1.5 rounded-lg text-white/80 hover:text-rose-200 hover:bg-rose-500/20 transition-colors cursor-pointer"
                title="Xóa cuộc hội thoại"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenFullChat(undefined, activeSessionId || undefined);
                }}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Mở toàn màn hình"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Thu nhỏ"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Dietary Profile Status Pill */}
          <div className="px-3.5 py-1.5 bg-orange-50/80 border-b border-orange-100 flex items-center justify-between text-[11px] text-orange-900">
            <span className="font-semibold truncate">
              🎯 {currentUser.name || 'Khách'}: {currentUser.dietPreference}
            </span>
            <span className="font-bold text-orange-600 shrink-0">
              {currentUser.targetCalories} kcal
            </span>
          </div>

          {/* Message Thread */}
          <div ref={chatContainerRef} className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50/60">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'chef' && (
                  <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <ChefHat className="w-4 h-4" />
                  </div>
                )}
                <div className={`space-y-1.5 max-w-[85%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-slate-900 text-white rounded-tr-xs'
                        : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200/80 shadow-2xs'
                    }`}
                  >
                    <div className="whitespace-pre-line">{msg.text}</div>
                  </div>
                  <div className="text-[9px] text-slate-400 px-1">
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200 w-fit">
                <ChefHat className="w-4 h-4 text-orange-500 animate-spin" />
                <span>Bếp trưởng AI đang phân tích dữ liệu...</span>
              </div>
            )}
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
            <button
              onClick={() => handleSend('Gợi ý bữa trưa dưới 400 Kcal, nấu trong 20 phút!')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-600 shrink-0 transition-colors cursor-pointer font-medium"
            >
              🥗 Bữa trưa &lt;400 kcal
            </button>
            <button
              onClick={() => handleSend('Tủ lạnh còn ức gà, nấm và bông cải, nấu món gì?')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-600 shrink-0 transition-colors cursor-pointer font-medium"
            >
              🍗 Ức gà & bông cải
            </button>
            <button
              onClick={() => handleSend('Món gì thanh đạm cho người đau dạ dày?')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-600 shrink-0 transition-colors cursor-pointer font-medium"
            >
              🍲 Thanh đạm dễ tiêu
            </button>
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-1.5"
            >
              <button
                type="button"
                onClick={() => handleSend('Quét tủ lạnh: Có trứng gà, cà chua và rau bina')}
                className="p-2 text-slate-400 hover:text-orange-600 rounded-xl hover:bg-slate-100 cursor-pointer"
                title="Quét tủ lạnh"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Hỏi món, calo, nguyên liệu..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 rounded-xl text-xs font-medium outline-none transition-all"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-2xs"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
