# ChefAI – Trợ lý ẩm thực thông minh

Web gợi ý món ăn Việt và chatbot ẩm thực (RAG trên Gemini), CSDL PostgreSQL trên Supabase.

- Bản chạy thật: <https://chefai.hbest.net>
- `backend/` – API Node.js (Express), xem [backend/README.md](backend/README.md)
- `frontend/` – React + Vite, phục vụ bằng Nginx, xem [frontend/README.md](frontend/README.md)
- `docker-compose.yml` – 2 container: `frontend` (công bố cổng) và `backend` (chỉ trong mạng nội bộ Docker)

## Chạy toàn bộ bằng Docker Compose

Cần Docker Engine có Compose plugin, một dự án Supabase và khóa Gemini API.

1. Lấy mã nguồn:

   ```bash
   git clone https://github.com/Hbest1804/Datn_FoodAI.git
   cd Datn_FoodAI
   ```

2. Tạo file biến môi trường cho backend rồi điền khóa Supabase, Gemini, SMTP, tài khoản Admin khởi tạo:

   ```bash
   cp backend/.env.example backend/.env
   ```

   Ý nghĩa từng biến xem chú thích trong `backend/.env.example`. Không đưa file `.env` lên Git.

3. Tạo CSDL: mở SQL Editor của Supabase, chạy toàn bộ `backend/schema_chatbot_am_thuc.sql`
   (bật `vector`, `pg_trgm`, `unaccent`, tạo 28 bảng, bật RLS, nạp dữ liệu nền).

4. (Chỉ trên server) tạo file `.env` ở thư mục gốc cho các biến của Compose:

   ```bash
   CORS_ORIGIN=https://ten-mien-cua-ban
   FRONTEND_BIND=127.0.0.1      # chỉ Nginx máy chủ vào được cổng frontend
   FRONTEND_PORT=8080
   VITE_GOOGLE_CLIENT_ID=       # Client ID Google OAuth (nếu dùng đăng nhập Google)
   ```

5. Build và chạy:

   ```bash
   docker compose up -d --build
   ```

   Web chạy ở <http://localhost:8080>; kiểm tra: `curl http://localhost:8080/api/health`.

6. Đăng nhập tài khoản Admin (tạo tự động từ `ADMIN_EMAIL`, `ADMIN_PASSWORD`), vào trang quản trị nhập file món
   và file công thức (`danh-sach-100-mon-an-sach_co_anh_v1.1.xlsx`, `cong-thuc-100-mon-an.xlsx`).
   Backend tự tạo embedding cho các món sau khi nhập.

## CI/CD

- `.github/workflows/ci.yml`: kiểm thử backend (Node 22, 24), build frontend, build thử image Docker khi push hoặc mở PR vào `main`, `dev`.
- `.github/workflows/cd.yml`: khi CI trên `main` đạt, SSH vào VPS, chạy `docker compose up -d --build` và kiểm tra `/api/health`.
