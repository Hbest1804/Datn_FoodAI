import React, { useEffect, useRef } from 'react';
import { Soup, Salad, Fish, Beef, Egg, Wheat, Carrot, Drumstick } from 'lucide-react';
import { ChefLogo3D } from './ChefLogo3D';

export interface SceneDish {
  title: string;
  image?: string;
}

interface AuthScene3DProps {
  dishes: SceneDish[];
  /** Thu nhỏ cả cảnh (dùng cho đầu trang trên điện thoại) */
  compact?: boolean;
  /** Vật ở tâm vòng (mặc định là logo đầu bếp) */
  center?: React.ReactNode;
  /** Số món tối đa bay quanh (mặc định 8) */
  maxItems?: number;
}

// Món dự phòng khi chưa tải được món từ máy chủ: chỉ hiện tên trên nền màu
const FALLBACK_DISHES: SceneDish[] = [
  { title: 'Phở bò' },
  { title: 'Bún chả' },
  { title: 'Gỏi cuốn' },
  { title: 'Canh chua cá lóc' },
  { title: 'Cơm tấm sườn' },
  { title: 'Bánh xèo' },
  { title: 'Cá kho tộ' },
  { title: 'Rau muống xào tỏi' },
];

const FALLBACK_TINTS = ['#FFE3B3', '#FFD2B0', '#DDF3E4', '#FFE7C2', '#FCD9C4', '#FFEBC7', '#E2F1DA', '#FFDCC8'];
const FALLBACK_ICONS = [Soup, Wheat, Salad, Fish, Drumstick, Egg, Beef, Carrot];

/**
 * Vòng món ăn 3D: các thẻ ảnh món bay quanh logo theo quỹ đạo elip nghiêng.
 * Mỗi khung hình tính lại vị trí bằng requestAnimationFrame và ghi thẳng vào style (không render lại React).
 * Cả cảnh nghiêng theo vị trí chuột; người dùng bật "giảm chuyển động" thì vòng đứng yên.
 */
export const AuthScene3D: React.FC<AuthScene3DProps> = ({ dishes, compact = false, center, maxItems = 8 }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  const items = (dishes.filter((d) => d.image).length >= 5 ? dishes.filter((d) => d.image) : FALLBACK_DISHES).slice(0, maxItems);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const count = items.length;
    // Nhiều hơn 8 món thì nới quỹ đạo cho thưa (chỉ bản máy tính; bản điện thoại giữ nguyên để vừa màn hình)
    const spread = !compact && count > 8 ? 1.12 : 1;
    const radiusX = (compact ? 165 : 250) * spread;
    const radiusZ = (compact ? 90 : 160) * spread;
    const lift = compact ? 48 : 96; // độ nghiêng quỹ đạo: món phía trước thấp hơn logo, món phía sau cao hơn
    let angle = 0;
    let last = performance.now();
    let frame = 0;
    // Chỉ chạy hoạt ảnh khi cảnh đang nằm trong màn hình (trang chủ dài, cuộn qua thì dừng)
    let visible = true;

    const place = () => {
      for (let i = 0; i < count; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const theta = angle + (i / count) * Math.PI * 2;
        const x = Math.sin(theta) * radiusX;
        const depth = Math.cos(theta); // 1 = gần nhất, -1 = xa nhất
        const z = depth * radiusZ;
        const y = depth * lift;
        const near = (depth + 1) / 2;
        el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateY(${Math.sin(theta) * 18}deg)`;
        el.style.zIndex = String(Math.round(near * 100));
        el.style.opacity = String(0.45 + near * 0.55);
        el.style.filter = `blur(${(1 - near) * 1.6}px) saturate(${0.7 + near * 0.4})`;
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      angle += dt * 0.00022;
      place();
      frame = visible ? requestAnimationFrame(tick) : 0;
    };

    place();
    let observer: IntersectionObserver | null = null;
    if (!reduceMotion) {
      frame = requestAnimationFrame(tick);
      const stage = stageRef.current;
      if (stage && 'IntersectionObserver' in window) {
        observer = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !frame) {
            last = performance.now();
            frame = requestAnimationFrame(tick);
          }
        });
        observer.observe(stage);
      }
    }
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [items.length, compact]);

  // Nghiêng cả cảnh theo chuột (chỉ máy tính)
  useEffect(() => {
    const stage = stageRef.current;
    const tilt = tiltRef.current;
    if (!stage || !tilt || compact) return;
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `rotateX(${-py * 14}deg) rotateY(${px * 18}deg)`;
    };
    const onLeave = () => {
      tilt.style.transform = 'rotateX(0deg) rotateY(0deg)';
    };
    window.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    };
  }, [compact]);

  const cardSize = compact ? 'w-[86px]' : 'w-[132px]';

  return (
    <div
      ref={stageRef}
      className="relative w-full h-full flex items-center justify-center"
      style={{ perspective: compact ? '700px' : '1100px' }}
      aria-hidden="true"
    >
      <div
        ref={tiltRef}
        className="relative w-0 h-0 transition-transform duration-500 ease-out"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Vệt quỹ đạo như mép mâm */}
        <div
          className="absolute left-1/2 top-1/2 rounded-full border border-white/25"
          style={{
            width: compact ? 330 : 500,
            height: compact ? 180 : 320,
            transform: 'translate(-50%, -50%) translateY(8px)',
            boxShadow: 'inset 0 0 60px rgba(255,255,255,0.08)',
          }}
        />

        {/* Logo ở tâm, nổi lên xuống, có hơi bốc lên */}
        <div className="absolute left-0 top-0" style={{ transform: 'translate(-50%, -50%)', zIndex: 50 }}>
          <div className="relative auth-float">
            <div className="absolute -top-10 inset-x-0 flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="auth-steam block w-1.5 h-8 rounded-full bg-white/50" style={{ animationDelay: `${i * 0.6}s` }} />
              ))}
            </div>
            {center ?? <ChefLogo3D size={compact ? 'lg' : 'hero'} interactive={false} />}
          </div>
          <div className={`mx-auto mt-4 rounded-[50%] bg-black/25 blur-md ${compact ? 'w-14 h-2' : 'w-24 h-3'}`} />
        </div>

        {/* Các thẻ món bay quanh */}
        {items.map((dish, i) => (
          <div
            key={`${dish.title}-${i}`}
            ref={(el) => { cardRefs.current[i] = el; }}
            className={`absolute left-0 top-0 ${cardSize} -ml-[43px] -mt-[54px] ${compact ? '' : 'sm:-ml-[66px] sm:-mt-[80px]'} will-change-transform`}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div className="rounded-2xl bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(80,20,0,0.55)]">
              {dish.image ? (
                <img
                  src={dish.image}
                  alt=""
                  loading="lazy"
                  className={`w-full ${compact ? 'h-[62px]' : 'h-[96px]'} rounded-xl object-cover`}
                />
              ) : (
                <div
                  className={`w-full ${compact ? 'h-[62px]' : 'h-[96px]'} rounded-xl flex items-center justify-center text-orange-600`}
                  style={{ background: FALLBACK_TINTS[i % FALLBACK_TINTS.length] }}
                >
                  {React.createElement(FALLBACK_ICONS[i % FALLBACK_ICONS.length], { className: compact ? 'w-6 h-6' : 'w-9 h-9', strokeWidth: 1.8 })}
                </div>
              )}
              <p className={`px-1 pt-1.5 pb-0.5 font-display font-bold text-slate-800 truncate ${compact ? 'text-[10px]' : 'text-xs'}`}>
                {dish.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
