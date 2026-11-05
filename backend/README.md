# ChefAI – Backend

REST API `/api` của ChefAI: Node.js 22 + Express 5, JavaScript (ES Modules), Supabase (PostgreSQL + pgvector, Auth, Storage) và Google Gemini.

## Cấu trúc

```
backend/
├── src/
│   ├── config/        # Biến môi trường, kết nối Supabase
│   ├── controllers/   # Xử lý từng API
│   ├── middlewares/   # Xác thực, phân quyền, giới hạn tần suất, tải file
│   ├── routes/        # Khai báo đường dẫn (comment ghi số mục trong Tài liệu API v3.2)
│   ├── services/      # Nghiệp vụ: AI, chatbot, gợi ý, chế độ ăn, cache…
│   ├── utils/         # Hàm tiện ích, luật chế độ ăn
│   └── server.js
├── test/              # Kiểm thử đơn vị (node --test)
├── .env.example
└── package.json
```

## Chạy

```bash
cp .env.example .env   # điền khóa Supabase, Gemini, SMTP, tài khoản Admin
npm install
npm run dev            # nodemon src/server.js, cổng 5000
npm start              # node src/server.js
npm test               # kiểm thử đơn vị
```

Kiểm tra máy chủ: `GET http://localhost:5000/api/health`.

Ý nghĩa từng biến môi trường xem trong `.env.example` và HLD mục 9 (Bảng 18). Triển khai bằng Docker: xem `docker-compose.yml` ở thư mục gốc.
