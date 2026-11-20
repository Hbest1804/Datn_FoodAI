import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { startFx3d } from './utils/fx3d';

// Hiệu ứng 3D dùng chung cho mọi trang (thẻ lật khi cuộn tới, nghiêng theo chuột)
startFx3d();

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// PWA: chỉ đăng ký service worker ở bản build, tránh cache khi chạy dev
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
