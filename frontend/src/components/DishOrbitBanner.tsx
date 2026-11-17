import React, { useEffect, useState } from 'react';
import { AuthScene3D } from './AuthScene3D';
import { RiceBowl } from './RiceBowl';
import type { Recipe } from '../types';

const ORBIT_DISH_COUNT = 10;

/** true khi màn hình từ md (768px) trở lên */
function useIsDesktop() {
  const query = '(min-width: 768px)';
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return matches;
}

/**
 * Banner trang chủ: tô cơm ở giữa, 10 món ăn của hệ thống bay quanh như trang đăng nhập.
 * Chỉ để trang trí, dùng lại danh sách món trang chủ đã tải (không gọi thêm API).
 */
export const DishOrbitBanner: React.FC<{ recipes: Recipe[]; totalRecipes: number }> = ({ recipes, totalRecipes }) => {
  const isDesktop = useIsDesktop();
  const dishes = recipes.map((r) => ({ title: r.title || r.name || '', image: r.image || r.image_url }));

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#F25C05] auth-hero-bg text-white flex flex-col md:flex-row md:items-center">
      <div className="relative z-10 px-6 pt-7 sm:px-8 md:pl-10 md:pr-4 md:py-10 md:w-5/12 lg:w-1/3 shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-white/75">Mâm cơm Việt</span>
        <h2 className="mt-2 font-display font-extrabold text-2xl sm:text-3xl leading-tight tracking-tight text-balance">
          Mỗi ngày một món ngon quanh bát cơm nhà
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/80 max-w-sm">
          {totalRecipes > 0 ? `${totalRecipes} món ăn` : 'Hàng trăm món ăn'} kèm công thức chi tiết, sẵn sàng cho bữa cơm gia đình bạn.
        </p>
      </div>
      <div className={`relative w-full min-w-0 shrink-0 md:w-auto md:flex-1 ${isDesktop ? 'h-[430px]' : 'h-[290px]'}`}>
        <AuthScene3D
          key={isDesktop ? 'desktop' : 'mobile'}
          dishes={dishes}
          compact={!isDesktop}
          maxItems={ORBIT_DISH_COUNT}
          // Tô cơm nâng cao hơn tâm quỹ đạo để các món bay phía trước không che mất
          center={(
            <div style={{ marginTop: isDesktop ? -70 : -44 }}>
              <RiceBowl size={isDesktop ? 220 : 130} />
            </div>
          )}
        />
      </div>
    </section>
  );
};
