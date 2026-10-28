import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, Upload, X } from 'lucide-react';
import { apiService } from '../api';
import { toast } from './NotificationModal';
import type { RecipeImportResult } from '../api/admin.api';

const SHEET_LABELS: Record<string, string> = {
  nguyen_lieu_mon: 'Nguyên liệu',
  buoc_che_bien: 'Bước chế biến',
};

const FIELD_LABELS: Record<string, string> = {
  slug: 'Mã món (slug)',
  ingredient: 'Nguyên liệu',
  quantity: 'Số lượng',
  unit: 'Đơn vị',
  is_optional: 'Tùy chọn',
  step_order: 'Thứ tự bước',
  content: 'Nội dung bước',
};

type OnExisting = 'skip' | 'replace';

interface RecipeImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

// UC16 luồng 2a: nhập công thức (nguyên liệu và các bước) cho nhiều món đã có từ file Excel
export default function RecipeImportModal({ onClose, onImported }: RecipeImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [onExisting, setOnExisting] = useState<OnExisting>('skip');
  const [publish, setPublish] = useState(false);
  const [result, setResult] = useState<RecipeImportResult | null>(null);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const busy = isChecking || isSubmitting;

  const handleClose = () => {
    if (!busy) onClose();
  };

  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const blob = await apiService.admin.downloadRecipeImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mau-nhap-cong-thuc.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || 'Không tải được file mẫu');
    } finally {
      setIsDownloading(false);
    }
  };

  // Kiểm tra file (dry run), chưa ghi dữ liệu
  const runCheck = async (target: File, mode: OnExisting, pub: boolean) => {
    setResult(null);
    setError('');
    if (!/\.xlsx$/i.test(target.name)) {
      setError('Công thức chỉ nhập được bằng file .xlsx.');
      return;
    }
    if (target.size > 5 * 1024 * 1024) {
      setError('File vượt quá 5 MB.');
      return;
    }
    setIsChecking(true);
    try {
      setResult(await apiService.admin.importRecipes(target, { dryRun: true, onExisting: mode, publish: pub }));
    } catch (err: any) {
      setError(err.message || 'Không kiểm tra được file');
    } finally {
      setIsChecking(false);
    }
  };

  const handleFileSelect = (selected: File | undefined) => {
    if (!selected) return;
    setFile(selected);
    runCheck(selected, onExisting, publish);
  };

  // Đổi tùy chọn thì kiểm tra lại để bản xem trước đúng số liệu
  const handleChangeMode = (mode: OnExisting) => {
    setOnExisting(mode);
    if (file) runCheck(file, mode, publish);
  };
  const handleChangePublish = (pub: boolean) => {
    setPublish(pub);
    if (file) runCheck(file, onExisting, pub);
  };

  const pendingCount = result ? result.created_count + result.replaced_count : 0;

  const handleConfirm = async () => {
    if (!file || !result || pendingCount === 0) return;
    setIsSubmitting(true);
    setError('');
    try {
      const saved = await apiService.admin.importRecipes(file, { dryRun: false, onExisting, publish });
      setResult(saved);
      toast.success(`Đã lưu công thức cho ${saved.created_count + saved.replaced_count} món.`);
      onImported();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi nhập công thức');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">QUẢN LÝ CÔNG THỨC</span>
            <h3 className="text-lg font-black text-slate-900">Nhập Công Thức Từ File Excel</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
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
              Sheet <b>nguyen_lieu_mon</b> và <b>buoc_che_bien</b>, mỗi dòng ghi mã món (slug) của món đã có. Sheet hướng dẫn liệt kê slug
              các món hiện có. Nguyên liệu chưa có trong hệ thống sẽ được tạo mới. Tối đa 5.000 dòng mỗi sheet, 5 MB.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isDownloading}
            className="shrink-0 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Mẫu .xlsx
          </button>
        </div>

        {/* Bước 2: tùy chọn */}
        <div className="space-y-2">
          <div className="font-bold text-slate-900">2. Món đã có công thức</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {([
              ['skip', 'Bỏ qua', 'Giữ nguyên công thức đang có, chỉ thêm cho món chưa có công thức.'],
              ['replace', 'Ghi đè', 'Thay công thức đang có bằng công thức trong file.'],
            ] as const).map(([mode, label, desc]) => (
              <label
                key={mode}
                className={`p-3 rounded-2xl border flex items-start gap-2 transition-colors ${busy ? 'cursor-wait' : 'cursor-pointer'} ${onExisting === mode ? 'border-orange-400 bg-orange-50/60' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <input
                  type="radio"
                  name="recipe-import-mode"
                  className="mt-0.5 accent-orange-500"
                  checked={onExisting === mode}
                  disabled={busy}
                  onChange={() => handleChangeMode(mode)}
                />
                <span>
                  <span className="font-bold text-slate-800 block">{label}</span>
                  <span className="text-slate-500">{desc}</span>
                </span>
              </label>
            ))}
          </div>
          <label className={`flex items-center gap-2 p-3 rounded-2xl border border-slate-200 ${busy ? 'cursor-wait' : 'cursor-pointer hover:bg-slate-50'}`}>
            <input
              type="checkbox"
              className="accent-emerald-600"
              checked={publish}
              disabled={busy}
              onChange={(e) => handleChangePublish(e.target.checked)}
            />
            <span className="font-bold text-slate-800">Công khai các món sau khi lưu công thức</span>
          </label>
        </div>

        {/* Bước 3: chọn file */}
        <div className="space-y-2">
          <div className="font-bold text-slate-900">3. Chọn file đã điền</div>
          <label
            className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-2xl transition-colors ${busy ? 'border-slate-200 bg-slate-50 cursor-wait' : 'border-orange-200 hover:border-orange-400 hover:bg-orange-50/40 cursor-pointer'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) handleFileSelect(e.dataTransfer.files?.[0]);
            }}
          >
            {isChecking ? <Loader2 className="w-6 h-6 text-orange-500 animate-spin" /> : <FileText className="w-6 h-6 text-orange-500" />}
            <span className="font-bold text-slate-700">
              {isChecking ? 'Đang kiểm tra file...' : file ? file.name : 'Bấm để chọn hoặc kéo thả file .xlsx vào đây'}
            </span>
            {file && !isChecking && <span className="text-[11px] text-slate-400">Bấm để chọn file khác</span>}
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                handleFileSelect(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Bước 4: bản xem trước / kết quả */}
        {result && (
          <div className="space-y-3">
            <div className="font-bold text-slate-900">{result.dry_run ? '4. Kết quả kiểm tra' : 'Kết quả nhập'}</div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/80">
                <div className="text-[11px] text-emerald-700 font-bold">{result.dry_run ? 'Sẽ thêm công thức' : 'Đã thêm công thức'}</div>
                <div className="text-xl font-black text-emerald-700">{result.created_count}</div>
              </div>
              <div className="p-3 bg-sky-50 rounded-2xl border border-sky-200/80">
                <div className="text-[11px] text-sky-700 font-bold">{result.dry_run ? 'Sẽ ghi đè' : 'Đã ghi đè'}</div>
                <div className="text-xl font-black text-sky-700">{result.replaced_count}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="text-[11px] text-slate-500 font-bold">Bỏ qua (đã có công thức)</div>
                <div className="text-xl font-black text-slate-900">{result.skipped.length}</div>
              </div>
              <div className={`p-3 rounded-2xl border ${result.error_dishes > 0 ? 'bg-red-50 border-red-200/80' : 'bg-slate-50 border-slate-200/80'}`}>
                <div className={`text-[11px] font-bold ${result.error_dishes > 0 ? 'text-red-700' : 'text-slate-500'}`}>Món lỗi</div>
                <div className={`text-xl font-black ${result.error_dishes > 0 ? 'text-red-700' : 'text-slate-900'}`}>{result.error_dishes}</div>
              </div>
            </div>

            {publish && pendingCount > 0 && (
              <div className="text-slate-600">
                {result.dry_run ? 'Sẽ công khai' : 'Đã công khai'} thêm <b>{result.published_count}</b> món (món đã công khai từ trước giữ nguyên).
              </div>
            )}

            {result.new_ingredients.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800">
                <span className="font-bold">
                  {result.dry_run ? 'Nguyên liệu mới sẽ được tạo' : 'Đã tạo nguyên liệu mới'}:{' '}
                </span>
                {result.new_ingredients.join(', ')}
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 space-y-0.5">
                {result.warnings.map((w) => <div key={w}>• {w}</div>)}
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 font-bold w-28">Sheet</th>
                        <th className="px-3 py-2 font-bold w-14">Dòng</th>
                        <th className="px-3 py-2 font-bold w-32">Cột</th>
                        <th className="px-3 py-2 font-bold">Lỗi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.errors.map((e, idx) => (
                        <tr key={`${e.sheet}-${e.row}-${e.field}-${idx}`}>
                          <td className="px-3 py-2 text-slate-600">{SHEET_LABELS[e.sheet] || e.sheet}</td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-700">{e.row}</td>
                          <td className="px-3 py-2 text-slate-600">{FIELD_LABELS[e.field] || e.field}</td>
                          <td className="px-3 py-2 text-red-700">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.skipped.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-600">
                <span className="font-bold">Đã có công thức, bỏ qua: </span>
                {result.skipped.map((s) => s.name).join(', ')}
              </div>
            )}

            {!result.dry_run && result.saved && result.saved.length > 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Đã lưu công thức cho {result.saved.length} món.
                </div>
                <div className="text-emerald-700">
                  {result.saved
                    .map((d) => `${d.name}${d.replaced ? ' (ghi đè)' : ''}${d.is_published ? ' – đang công khai' : ' – đang ẩn'}`)
                    .join(', ')}
                </div>
              </div>
            )}

            {result.dry_run && pendingCount === 0 && (
              <div className="text-slate-500">Không có công thức nào cần lưu. Hãy sửa file hoặc đổi tùy chọn rồi thử lại.</div>
            )}
            {result.dry_run && pendingCount > 0 && result.error_dishes > 0 && (
              <div className="text-slate-500">Món lỗi sẽ bị bỏ qua, chỉ công thức của các món hợp lệ được lưu.</div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {result && !result.dry_run ? 'Đóng' : 'Hủy'}
          </button>
          {(!result || result.dry_run) && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!result || pendingCount === 0 || busy}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {pendingCount > 0 ? `Lưu công thức ${pendingCount} món` : 'Lưu công thức'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
