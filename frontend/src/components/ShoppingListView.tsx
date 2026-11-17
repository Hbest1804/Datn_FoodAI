import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBasket,
  Loader2,
  Plus,
  Minus,
  Trash2,
  Pencil,
  Check,
  X,
  Home,
  RotateCcw,
  AlertTriangle,
  LogIn,
  Compass,
} from 'lucide-react';
import { ShoppingList, ShoppingListItem, UserProfile } from '../types';
import { apiService } from '../api';
import { toast, showConfirm } from './NotificationModal';

interface ShoppingListViewProps {
  currentUser: UserProfile;
  sessionChecked: boolean;
  onOpenLogin: () => void;
}

const EMPTY: ShoppingList = {
  dishes: [],
  items: [],
  summary: { dish_count: 0, to_buy: 0, have_at_home: 0, purchased: 0 },
};

const formatQty = (q: number | null) =>
  q == null ? '' : q.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

const itemStatus = (it: ShoppingListItem) =>
  it.have_at_home ? 'have_at_home' : it.purchased ? 'purchased' : 'to_buy';

const GROUPS: Array<{ key: 'to_buy' | 'purchased' | 'have_at_home'; title: string; hint: string }> = [
  { key: 'to_buy', title: 'Cần mua', hint: 'Tick khi đã mua xong' },
  { key: 'purchased', title: 'Đã mua', hint: '' },
  { key: 'have_at_home', title: 'Đã có ở nhà', hint: 'Không tính vào phần cần mua' },
];

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({ currentUser, sessionChecked, onOpenLogin }) => {
  const navigate = useNavigate();
  const [list, setList] = useState<ShoppingList>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyDish, setBusyDish] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<number | null>(null);

  // Thêm dòng thủ công
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [adding, setAdding] = useState(false);

  // Sửa dòng thủ công
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      setList(await apiService.shoppingList.get());
    } catch (err: any) {
      setLoadError(err.message || 'Không tải được thực đơn.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser.isLoggedIn) load();
    else setLoading(false);
  }, [currentUser.isLoggedIn]);

  const openDish = (dishId: string) => navigate({ search: `?dish=${dishId}` });

  const changeServings = async (dishId: string, servings: number) => {
    if (servings < 1 || servings > 100) return;
    setBusyDish(dishId);
    try {
      setList(await apiService.shoppingList.updateDishServings(dishId, servings));
    } catch (err: any) {
      toast.error(err.message || 'Không đổi được số khẩu phần.');
    } finally {
      setBusyDish(null);
    }
  };

  const removeDish = async (dishId: string, name: string) => {
    setBusyDish(dishId);
    try {
      setList(await apiService.shoppingList.removeDish(dishId));
      toast.success(`Đã gỡ "${name}" khỏi thực đơn.`);
    } catch (err: any) {
      toast.error(err.message || 'Không gỡ được món.');
    } finally {
      setBusyDish(null);
    }
  };

  // Cập nhật một dòng rồi sắp lại theo thứ tự: cần mua → đã mua → đã có
  const applyItem = (item: ShoppingListItem, summary: ShoppingList['summary']) => {
    setList((prev) => {
      const order = { to_buy: 0, purchased: 1, have_at_home: 2 } as const;
      const items = prev.items.map((it) => (it.id === item.id ? item : it));
      const sorted = [...items].sort((a, b) => order[itemStatus(a)] - order[itemStatus(b)]);
      return { ...prev, items: sorted, summary };
    });
  };

  const toggleItem = async (item: ShoppingListItem, field: 'purchased' | 'have_at_home') => {
    setBusyItem(item.id);
    // Đổi ngay trên giao diện, lỗi thì tải lại từ máy chủ
    applyItem({ ...item, [field]: !item[field] }, list.summary);
    try {
      const res = await apiService.shoppingList.updateItem(item.id, { [field]: !item[field] });
      applyItem(res.item, res.summary);
    } catch (err: any) {
      toast.error(err.message || 'Không lưu được trạng thái.');
      load();
    } finally {
      setBusyItem(null);
    }
  };

  const parseQty = (raw: string): number | null | undefined => {
    const s = raw.trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const quantity = parseQty(newQty);
    if (quantity === undefined) {
      toast.warning('Số lượng phải là số lớn hơn 0.');
      return;
    }
    setAdding(true);
    try {
      await apiService.shoppingList.addItem({ name, quantity, unit: newUnit.trim() || null });
      setNewName('');
      setNewQty('');
      setNewUnit('');
      setList(await apiService.shoppingList.get());
    } catch (err: any) {
      toast.error(err.message || 'Không thêm được dòng.');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: ShoppingListItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(item.quantity == null ? '' : String(item.quantity));
    setEditUnit(item.unit || '');
  };

  const saveEdit = async (item: ShoppingListItem) => {
    const name = editName.trim();
    const quantity = parseQty(editQty);
    if (!name) {
      toast.warning('Tên không được để trống.');
      return;
    }
    if (quantity === undefined) {
      toast.warning('Số lượng phải là số lớn hơn 0.');
      return;
    }
    setBusyItem(item.id);
    try {
      const res = await apiService.shoppingList.updateItem(item.id, { name, quantity, unit: editUnit.trim() || null });
      applyItem(res.item, res.summary);
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.message || 'Không lưu được thay đổi.');
    } finally {
      setBusyItem(null);
    }
  };

  const deleteItem = async (item: ShoppingListItem) => {
    setBusyItem(item.id);
    try {
      const res = await apiService.shoppingList.deleteItem(item.id);
      setList((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== item.id), summary: res.summary }));
    } catch (err: any) {
      toast.error(err.message || 'Không xóa được dòng.');
    } finally {
      setBusyItem(null);
    }
  };

  const handleClear = async () => {
    const ok = await showConfirm({
      title: 'Làm mới thực đơn?',
      message: 'Toàn bộ món trong thực đơn và danh sách đi chợ (kể cả các dòng bạn tự thêm) sẽ bị xóa. Thao tác này không hoàn tác được.',
      confirmText: 'Làm mới',
      cancelText: 'Hủy',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    try {
      setList(await apiService.shoppingList.clear());
      toast.success('Đã làm mới thực đơn và danh sách đi chợ.');
    } catch (err: any) {
      toast.error(err.message || 'Không làm mới được thực đơn.');
    }
  };

  // ── Chưa đăng nhập (luồng 1b) ──────────────────────────────────────────────
  if (!sessionChecked) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }
  if (!currentUser.isLoggedIn) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 flex items-center justify-center">
          <ShoppingBasket className="w-7 h-7 text-orange-500" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Thực đơn</h1>
        <p className="text-sm text-slate-500">
          Đăng nhập để lên thực đơn các món định nấu, ChefAI sẽ tự gộp nguyên liệu thành danh sách đi chợ và lưu theo tài khoản của bạn.
        </p>
        <button
          onClick={onOpenLogin}
          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" /> Đăng nhập
        </button>
      </div>
    );
  }

  const isEmpty = list.dishes.length === 0 && list.items.length === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Tiêu đề */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBasket className="w-7 h-7 text-orange-500" />
            Thực đơn
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Chọn món định nấu vào thực đơn, nguyên liệu được gộp tự động thành danh sách đi chợ theo số khẩu phần.
          </p>
        </div>
        {!isEmpty && (
          <button
            onClick={handleClear}
            className="self-start sm:self-auto px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Làm mới thực đơn
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      ) : loadError ? (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-red-200 font-bold text-xs cursor-pointer">
            Thử lại
          </button>
        </div>
      ) : (
        <>
          {/* Tóm tắt */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Món trong thực đơn', value: list.summary.dish_count, cls: 'text-slate-900' },
              { label: 'Cần mua', value: list.summary.to_buy, cls: 'text-orange-600' },
              { label: 'Đã mua', value: list.summary.purchased, cls: 'text-emerald-600' },
              { label: 'Đã có ở nhà', value: list.summary.have_at_home, cls: 'text-sky-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 p-4">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</div>
                <div className={`text-2xl font-black mt-0.5 ${s.cls}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {isEmpty && (
            <div className="p-8 sm:p-10 rounded-3xl border border-dashed border-slate-300 bg-white text-center space-y-3">
              <ShoppingBasket className="w-10 h-10 mx-auto text-slate-300" />
              <h2 className="text-base font-bold text-slate-800">Thực đơn đang trống</h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Mở trang chi tiết một món, chọn <strong>“Thêm vào thực đơn”</strong> và nhập số khẩu phần.
                Bạn cũng có thể tự thêm thứ cần mua ở ô bên dưới.
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-4 h-4" /> Khám phá món ăn
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Món đã chọn */}
            {list.dishes.length > 0 && (
              <section className="lg:col-span-4 space-y-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Thực đơn của tôi</h2>
                <div className="space-y-2.5">
                  {list.dishes.map((d) => (
                    <div
                      key={d.dish_id}
                      className={`bg-white rounded-2xl border p-3 flex gap-3 ${d.is_available ? 'border-slate-200/80' : 'border-amber-300 bg-amber-50/40'}`}
                    >
                      <button
                        onClick={() => d.is_available && openDish(d.dish_id)}
                        disabled={!d.is_available}
                        className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 cursor-pointer disabled:cursor-default"
                      >
                        {d.image_url && <img src={d.image_url} alt={d.name} className="w-full h-full object-cover" />}
                      </button>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => d.is_available && openDish(d.dish_id)}
                            disabled={!d.is_available}
                            className="text-sm font-bold text-slate-900 hover:text-orange-600 text-left leading-snug cursor-pointer disabled:cursor-default disabled:hover:text-slate-900"
                          >
                            {d.name}
                          </button>
                          <button
                            onClick={() => removeDish(d.dish_id, d.name)}
                            disabled={busyDish === d.dish_id}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg shrink-0 cursor-pointer disabled:opacity-40"
                            title="Gỡ khỏi thực đơn"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {d.is_available ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg">
                              <button
                                onClick={() => changeServings(d.dish_id, d.servings - 1)}
                                disabled={busyDish === d.dish_id || d.servings <= 1}
                                className="w-6 h-6 rounded-md bg-white flex items-center justify-center text-slate-700 hover:text-orange-600 cursor-pointer disabled:opacity-40"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-bold text-slate-900 w-6 text-center">
                                {busyDish === d.dish_id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : d.servings}
                              </span>
                              <button
                                onClick={() => changeServings(d.dish_id, d.servings + 1)}
                                disabled={busyDish === d.dish_id || d.servings >= 100}
                                className="w-6 h-6 rounded-md bg-white flex items-center justify-center text-slate-700 hover:text-orange-600 cursor-pointer disabled:opacity-40"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              khẩu phần (công thức: {d.recipe_servings})
                            </span>
                          </div>
                        ) : (
                          <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Món không còn khả dụng – hãy gỡ khỏi thực đơn
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Nguyên liệu */}
            <section className={`${list.dishes.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Danh sách đi chợ</h2>

              {GROUPS.map((g) => {
                const items = list.items.filter((it) => itemStatus(it) === g.key);
                if (items.length === 0) return null;
                return (
                  <div key={g.key} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        {g.title} <span className="text-slate-400 font-semibold">({items.length})</span>
                      </span>
                      {g.hint && <span className="text-[11px] text-slate-400">{g.hint}</span>}
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {items.map((it) => (
                        <li key={it.id} className="px-4 py-3">
                          {editingId === it.id ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                maxLength={100}
                                className="flex-1 min-w-[140px] px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-orange-500"
                              />
                              <input
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                inputMode="decimal"
                                placeholder="SL"
                                className="w-20 px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-orange-500"
                              />
                              <input
                                value={editUnit}
                                onChange={(e) => setEditUnit(e.target.value)}
                                maxLength={30}
                                placeholder="Đơn vị"
                                className="w-24 px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-orange-500"
                              />
                              <button
                                onClick={() => saveEdit(it)}
                                disabled={busyItem === it.id}
                                className="p-1.5 rounded-lg bg-orange-500 text-white cursor-pointer disabled:opacity-50"
                                title="Lưu"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                                title="Hủy"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={it.purchased}
                                disabled={it.have_at_home || busyItem === it.id}
                                onChange={() => toggleItem(it, 'purchased')}
                                className="accent-emerald-600 w-4 h-4 mt-0.5 cursor-pointer disabled:cursor-not-allowed"
                                title={it.have_at_home ? 'Đã có ở nhà' : 'Đánh dấu đã mua'}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <span
                                    className={`text-sm font-semibold ${
                                      it.purchased || it.have_at_home ? 'text-slate-400 line-through' : 'text-slate-800'
                                    }`}
                                  >
                                    {it.name}
                                  </span>
                                  {it.is_optional && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                      Tùy chọn
                                    </span>
                                  )}
                                  {it.is_manual && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-600">
                                      Tự thêm
                                    </span>
                                  )}
                                </div>
                                {it.used_by.length > 0 && (
                                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                    Dùng cho: {it.used_by.map((u) => u.name).join(', ')}
                                  </p>
                                )}
                              </div>
                              <span className="text-sm font-extrabold text-slate-900 whitespace-nowrap">
                                {formatQty(it.quantity)} {it.unit || ''}
                              </span>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  onClick={() => toggleItem(it, 'have_at_home')}
                                  disabled={busyItem === it.id}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                                    it.have_at_home
                                      ? 'bg-sky-100 text-sky-700'
                                      : 'text-slate-500 hover:bg-sky-50 hover:text-sky-700'
                                  }`}
                                  title={it.have_at_home ? 'Bỏ đánh dấu đã có' : 'Đánh dấu đã có ở nhà'}
                                >
                                  <Home className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Đã có</span>
                                </button>
                                {it.is_manual && (
                                  <>
                                    <button
                                      onClick={() => startEdit(it)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 cursor-pointer"
                                      title="Sửa"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => deleteItem(it)}
                                      disabled={busyItem === it.id}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                                      title="Xóa"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {/* Thêm dòng thủ công (luồng 5b) */}
              <form onSubmit={handleAddItem} className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2">
                <div className="text-xs font-bold text-slate-700">Thêm thứ cần mua khác</div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={100}
                    placeholder="Ví dụ: Giấy bạc, nước uống..."
                    className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-orange-500"
                  />
                  <input
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    inputMode="decimal"
                    placeholder="Số lượng"
                    className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-orange-500"
                  />
                  <input
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    maxLength={30}
                    placeholder="Đơn vị"
                    className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-orange-500"
                  />
                  <button
                    type="submit"
                    disabled={adding || !newName.trim()}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Thêm
                  </button>
                </div>
              </form>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
