/**
 * Bộ hiệu ứng 3D dùng chung cho mọi trang (Người dùng và Admin).
 *
 * Tự tìm các "thẻ" (khối bo góc 2xl/3xl có nền, viền hoặc bóng) bên trong <main> rồi gắn:
 *  - data-fx-reveal: hiện lên kiểu lật 3D khi cuộn tới, các thẻ lần lượt nối đuôi nhau
 *  - data-fx-tilt:   nghiêng theo con trỏ chuột kèm vệt sáng (chỉ máy có chuột)
 *  - data-fx-head:   tiêu đề h1/h2 lật đứng dậy khi cuộn tới (không áp dụng trang Admin)
 *
 * Chỉ dùng thuộc tính data-* và biến CSS nên không đụng tới className/style mà React quản lý.
 * Muốn tắt hiệu ứng cho một khối nào đó: thêm thuộc tính data-fx-off vào khối đó.
 */

const CARD_SELECTOR = [
  'main .rounded-2xl',
  'main .rounded-3xl',
  'main [class*="rounded-[2"]',
  'main [class*="rounded-[3"]',
].join(',');

const SURFACE_RE = /(^|\s)(bg-|border(\s|$|-)|shadow)/;
const SKIP_TAGS = new Set(['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'IMG', 'VIDEO', 'svg', 'OPTION']);

const processed = new WeakSet<Element>();
let io: IntersectionObserver | null = null;
let canTilt = false;

const isCandidate = (el: HTMLElement): boolean => {
  if (SKIP_TAGS.has(el.tagName)) return false;
  const cls = typeof el.className === 'string' ? el.className : '';
  if (!SURFACE_RE.test(cls)) return false;
  if (cls.includes('animate-in') || cls.includes('animate-')) return false;
  // Không đụng vào modal/thanh nổi (đã có hiệu ứng riêng), header/nav và khối bị tắt
  if (el.closest('[data-fx-off], .fixed, .sticky, header, nav')) return false;
  // Thẻ lồng trong một thẻ đã có hiệu ứng thì để thẻ cha lo
  if (el.parentElement?.closest('[data-fx-reveal]')) return false;
  return true;
};

const setup = (el: HTMLElement) => {
  if (processed.has(el) || !isCandidate(el)) return;
  const rect = el.getBoundingClientRect();
  // Đang ẩn (tab chưa mở…) thì để lần sau xét lại
  if (rect.width === 0 || rect.height === 0) return;
  // Bỏ qua chip/nút nhỏ
  if (rect.width < 120 || rect.height < 56) {
    processed.add(el);
    return;
  }
  // Khung bao cả trang (cao hơn màn hình nhiều) thì không làm, để các thẻ con bên trong nhận hiệu ứng
  if (rect.height > window.innerHeight * 1.25) return;

  processed.add(el);
  el.setAttribute('data-fx-reveal', 'pending');
  io?.observe(el);

  if (
    canTilt &&
    rect.width <= 640 &&
    rect.height <= 560 &&
    !el.querySelector('input, textarea, select, table, iframe') &&
    // Khối điều hướng/thanh công cụ (nhiều nút) mà nghiêng thì khó bấm
    el.querySelectorAll('button, a').length <= 3
  ) {
    el.setAttribute('data-fx-tilt', 'off');
    const cls = typeof el.className === 'string' ? el.className : '';
    if (getComputedStyle(el).position !== 'static' && !cls.includes('after:')) {
      el.setAttribute('data-fx-glare', '');
    }
  }
};

/* ── Tiêu đề (h1/h2) ở giao diện người dùng: lật đứng dậy từ mặt bàn khi cuộn tới ── */
const HEAD_SELECTOR = 'main h1, main h2';

const setupHead = (el: HTMLElement) => {
  if (processed.has(el)) return;
  // Tiêu đề nằm trong thẻ đã có hiệu ứng, trong modal/thanh nổi hoặc ở trang Admin thì bỏ qua
  if (el.closest('[data-fx-reveal], [data-fx-off], .fixed, .sticky, .admin-studio-view')) return;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  processed.add(el);
  el.setAttribute('data-fx-head', 'pending');
  io?.observe(el);
};

const scan = (root: ParentNode = document) => {
  if (root instanceof HTMLElement && root.matches(CARD_SELECTOR)) setup(root);
  root.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach(setup);
  // Xét tiêu đề sau thẻ để tiêu đề nằm trong thẻ không bị chạy hiệu ứng hai lần
  if (root instanceof HTMLElement && root.matches(HEAD_SELECTOR)) setupHead(root);
  root.querySelectorAll<HTMLElement>(HEAD_SELECTOR).forEach(setupHead);
};

/* ── Hiện lên khi cuộn tới ── */
const onIntersect: IntersectionObserverCallback = (entries) => {
  const visible = entries
    .filter((e) => e.isIntersecting)
    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
  visible.forEach((entry, i) => {
    const el = entry.target as HTMLElement;
    io?.unobserve(el);
    const attr = el.hasAttribute('data-fx-head') ? 'data-fx-head' : 'data-fx-reveal';
    el.style.setProperty('--fx-delay', `${Math.min(i, 8) * 60}ms`);
    el.setAttribute(attr, 'in');
    const done = () => {
      el.setAttribute(attr, 'done');
      el.style.removeProperty('--fx-delay');
    };
    el.addEventListener('animationend', done, { once: true });
    // Phòng khi animationend không bắn (tab bị ẩn giữa chừng…)
    window.setTimeout(done, 1400);
  });
};

/* ── Nghiêng theo chuột ── */
let tiltEl: HTMLElement | null = null;
let raf = 0;
let lastEvent: PointerEvent | null = null;

const resetTilt = (el: HTMLElement) => {
  el.setAttribute('data-fx-tilt', 'off');
  ['--fx-rx', '--fx-ry', '--fx-sx', '--fx-sy', '--fx-gx', '--fx-gy'].forEach((p) => el.style.removeProperty(p));
};

const applyTilt = () => {
  raf = 0;
  const e = lastEvent;
  if (!e) return;
  const target = (e.target as Element | null)?.closest?.('[data-fx-tilt]') as HTMLElement | null;
  if (tiltEl && tiltEl !== target) resetTilt(tiltEl);
  tiltEl = target;
  if (!target) return;

  const r = target.getBoundingClientRect();
  const px = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
  const py = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
  // Thẻ càng lớn thì nghiêng càng ít cho đỡ chóng mặt
  const max = Math.min(8, Math.max(3, 2400 / r.width));
  const rx = (0.5 - py) * 2 * max;
  const ry = (px - 0.5) * 2 * max;
  const s = target.style;
  s.setProperty('--fx-rx', `${rx.toFixed(2)}deg`);
  s.setProperty('--fx-ry', `${ry.toFixed(2)}deg`);
  s.setProperty('--fx-sx', `${(-ry * 1.6).toFixed(1)}px`);
  s.setProperty('--fx-sy', `${(10 + rx * 1.2).toFixed(1)}px`);
  s.setProperty('--fx-gx', `${(px * 100).toFixed(1)}%`);
  s.setProperty('--fx-gy', `${(py * 100).toFixed(1)}%`);
  target.setAttribute('data-fx-tilt', 'on');
};

const onPointerMove = (e: PointerEvent) => {
  if (e.pointerType !== 'mouse') return;
  lastEvent = e;
  if (!raf) raf = requestAnimationFrame(applyTilt);
};

const onPointerLeaveDoc = () => {
  if (tiltEl) resetTilt(tiltEl);
  tiltEl = null;
};

let started = false;

export function startFx3d() {
  if (started || typeof window === 'undefined') return;
  started = true;

  // Người dùng bật "giảm chuyển động" thì không làm gì cả
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  canTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  io = new IntersectionObserver(onIntersect, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });

  // Xét các nút mới thêm ngay trong microtask (trước khi trình duyệt vẽ) để không bị chớp
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType === 1) scan(n as Element);
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
  scan();

  if (canTilt) {
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeaveDoc);
  }
}
