# ChefAI – Frontend

Giao diện web của ChefAI, trợ lý ẩm thực thông minh: khám phá và tìm món ăn, trò chuyện với trợ lý AI, quản lý hồ sơ khẩu vị và quản trị hệ thống.

**Công nghệ:** React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router 7, lucide-react.

## Yêu cầu

- Node.js 22 trở lên
- Backend ChefAI đang chạy tại `http://localhost:5000` (xem [backend/README.md](../backend/README.md))

## Chạy ở máy cá nhân

```bash
cd frontend
npm install
npm run dev
```

Mở <http://localhost:3000>. Vite chuyển tiếp các yêu cầu `/api` sang backend ở cổng 5000.

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `VITE_API_URL` | Không | Địa chỉ backend, ví dụ `https://api.example.com`. Để trống thì frontend gọi `/api` cùng origin. |

Giá trị này được gắn vào mã khi build, nên cần build lại sau khi thay đổi. Khóa AI và thông tin Supabase chỉ cấu hình ở backend, không đặt trong frontend.

## Các lệnh

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy máy chủ phát triển ở cổng 3000 |
| `npm run build` | Build bản production vào `dist/` |
| `npm run preview` | Xem thử bản đã build |
| `npm run lint` | Kiểm tra kiểu TypeScript (`tsc --noEmit`) |

## Các trang

| Đường dẫn | Trang |
| --- | --- |
| `/` | Khám phá món ăn |
| `/search` | Tìm kiếm và lọc món (`?q=<từ khóa>`) |
| `/chat` | Trò chuyện với trợ lý AI |
| `/planner` | Thực đơn tuần |
| `/taste-profile` | Hồ sơ khẩu vị |
| `/account` | Tài khoản cá nhân |
| `/admin` | Cổng quản trị, chỉ dành cho quản trị viên (`?tab=overview`, `dishes`, `recipes`, `users`, `chatbot`) |

Thêm `?dish=<id>` vào đường dẫn để mở trực tiếp cửa sổ chi tiết món. Hai đường dẫn `/reset-password` và `/auth/callback` dùng cho liên kết đặt lại mật khẩu và đăng nhập Google.

## Cấu trúc thư mục

```
frontend/
├── src/
│   ├── api/          # HTTP client và các hàm gọi API theo từng nhóm
│   ├── components/   # Các trang và thành phần giao diện
│   ├── types/        # Kiểu dữ liệu dùng chung
│   ├── utils/        # Hàm tiện ích
│   ├── App.tsx       # Định tuyến và trạng thái phiên đăng nhập
│   ├── main.tsx      # Điểm khởi động ứng dụng
│   └── index.css     # Tailwind và style toàn cục
├── Dockerfile        # Build bản production và phục vụ bằng nginx
├── nginx.conf        # Phục vụ SPA, chuyển tiếp /api sang backend
└── vite.config.ts
```

## Triển khai bằng Docker

Cần có file `backend/.env`, sau đó chạy từ thư mục gốc của dự án:

```bash
docker compose up --build
```

Frontend được phục vụ tại <http://localhost:8080> (đổi cổng bằng biến `FRONTEND_PORT`). Nginx chuyển tiếp `/api/` sang dịch vụ `backend`.
