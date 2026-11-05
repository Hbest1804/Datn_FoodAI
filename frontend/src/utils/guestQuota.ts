import type { GuestQuota } from '../types';

// Hạn mức hỏi chatbot của khách (guest_message_limit lượt trong 24 giờ, cấu hình ở UC13).
// Trang chat và widget phát sự kiện này sau mỗi lần gửi để thanh thông báo ở Header cập nhật theo.
export const GUEST_QUOTA_EVENT = 'chefai:guest-quota';

export function publishGuestQuota(quota: GuestQuota | null | undefined) {
  if (!quota) return;
  window.dispatchEvent(new CustomEvent<GuestQuota>(GUEST_QUOTA_EVENT, { detail: quota }));
}
