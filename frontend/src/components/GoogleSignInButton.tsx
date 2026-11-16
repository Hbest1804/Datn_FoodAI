import React, { useEffect, useRef } from 'react';

// Client ID OAuth "Web application" trong Google Cloud Console (giá trị công khai, không phải secret).
export const GOOGLE_CLIENT_ID: string = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisPromise: Promise<void> | null = null;

/** Tải thư viện Google Identity Services một lần cho cả trang */
function loadGis(): Promise<void> {
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gisPromise = null;
        reject(new Error('Không tải được thư viện đăng nhập Google.'));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

interface GoogleSignInButtonProps {
  /** Nhận ID token (JWT) Google cấp sau khi người dùng chọn tài khoản */
  onCredential: (idToken: string) => void;
  onError?: (message: string) => void;
}

/**
 * Nút "Đăng nhập bằng Google" do Google vẽ (Google Identity Services).
 * Cửa sổ chọn tài khoản chạy trên domain của web nên Google hiện "Tiếp tục tới <domain của web>",
 * không còn hiện xxx.supabase.co như luồng chuyển hướng qua Supabase.
 */
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onCredential, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Giữ callback mới nhất mà không phải khởi tạo lại nút
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  onCredentialRef.current = onCredential;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    loadGis()
      .then(() => {
        const el = containerRef.current;
        const gid = (window as any).google?.accounts?.id;
        if (cancelled || !el || !gid) return;
        gid.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp: { credential?: string }) => {
            if (resp?.credential) onCredentialRef.current(resp.credential);
            else onErrorRef.current?.('Đăng nhập Google không thành công. Vui lòng thử lại.');
          },
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        el.innerHTML = '';
        gid.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          locale: 'vi',
          // Google chỉ nhận độ rộng 200–400px
          width: Math.max(200, Math.min(400, Math.floor(el.clientWidth || 320))),
        });
      })
      .catch((err: Error) => {
        if (!cancelled) onErrorRef.current?.(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <div ref={containerRef} className="w-full flex justify-center min-h-[44px]" />;
};
