// Các tab của Cổng quản trị, mở qua /admin?tab=<tên tab>
// Tách riêng để App/Sidebar dùng mà không kéo cả AdminStudioView (đang lazy-load) vào gói đầu
export const ADMIN_TABS = ['overview', 'dishes', 'recipes', 'users', 'chatbot', 'audit'] as const;
export type AdminTab = typeof ADMIN_TABS[number];
