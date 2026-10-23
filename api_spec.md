TÀI LIỆU API

REST API Specification

Hệ thống trợ lý ẩm thực thông minh tích hợp chatbot AI hỗ trợ tư vấn và gợi ý món ăn cá nhân hóa

| Phiên bản | 2.4 (API chính mục 4, API phụ mô tả đủ ở mục 5) |

| --- | --- |

| Ngày | 15/10/2026 |

| Phạm vi hiện tại | Mô tả chi tiết toàn bộ API: API chính ở mục 4 (ưu tiên làm trước), API phụ ở mục bổ sung (mục 5, chọn làm sau). |

| Căn cứ | Đặc tả use case UC01–UC16 (bản v10); sơ đồ use case; sơ đồ ERD (dbdiagram.io) |

| Base URL | http://localhost:3000/api/v1 |



1. Giới thiệu

1.1 Mục đích

Tài liệu mô tả các API REST của hệ thống trợ lý ẩm thực thông minh. Nội dung bám sát đặc tả 16 use case (UC01–UC16) và mô hình dữ liệu (ERD), giúp nhóm frontend và backend phát triển song song và kiểm thử theo cùng một hợp đồng giao tiếp.

1.2 Tác nhân & phạm vi

| Tác nhân | Phạm vi API | Use case |

| --- | --- | --- |

| Khách vãng lai | Đăng ký, đăng nhập, quên mật khẩu; tìm kiếm (gồm tìm theo nguyên liệu có sẵn), xem món; chatbot chế độ khách | UC01, UC02, UC03, UC04, UC15 |

| Người dùng (đã đăng nhập) | Hồ sơ khẩu vị, chatbot cá nhân hóa, gợi ý, yêu thích/đánh giá, dữ liệu cá nhân | UC05–UC10 |

| Quản trị viên (Admin) | Quản lý món ăn (danh mục món tự nhập), công thức, người dùng, giám sát chatbot, thống kê (tiền tố /admin) | UC05, UC11–UC14, UC16 |



1.3 Công nghệ dự kiến

| # | Nội dung |

| --- | --- |

| 1 | Kiểu giao tiếp: REST over HTTPS, dữ liệu JSON (UTF-8). |

| 2 | Backend: Node.js/Express (TypeScript); cơ sở dữ liệu PostgreSQL (Supabase), cột vector dùng cho taste_vector và dish_embeddings (mô hình gemini-embedding-2, 768 chiều). |

| 3 | Xác thực: JWT (access token) kết hợp refresh token. Nếu dùng Supabase Auth thì các API /auth/* đóng vai trò lớp bao ngoài. |

| 4 | Dịch vụ AI: backend gọi mô hình ngôn ngữ; frontend không gọi trực tiếp. |

| 5 | Phiên bản API nằm trong URL (/api/v1). Thay đổi không tương thích sẽ nâng lên /api/v2. |



2. Quy ước chung

2.1 Vai trò & xác thực

API đã đăng nhập gửi access token qua header Authorization: Bearer <access_token>. Giá trị role của người dùng (user hoặc admin) nằm trong token và được kiểm tra lại ở server.

| Mức quyền | Ý nghĩa | Cách xác thực |

| --- | --- | --- |

| Công khai | Không cần đăng nhập. Nếu có token hợp lệ, một số API trả thêm dữ liệu cá nhân. | Không bắt buộc |

| Công khai (khách) | Chatbot chế độ khách, theo dõi bằng định danh phiên khách. | Header X-Guest-Id |

| Người dùng | Tài khoản role = user hoặc admin, status = active. | Authorization: Bearer |

| Admin | Tài khoản role = admin. Tất cả URL bắt đầu bằng /admin. | Authorization: Bearer |



Access token hết hạn: server trả 401 TOKEN_EXPIRED, client gọi POST /auth/refresh rồi gửi lại request; refresh thất bại thì chuyển về màn hình đăng nhập. Tài khoản bị khóa giữa chừng nhận 403 ACCOUNT_LOCKED.

2.2 Định dạng dữ liệu

| # | Nội dung |

| --- | --- |

| 1 | Tên trường dùng snake_case, trùng với tên cột trong ERD. |

| 2 | Thời gian theo ISO 8601, UTC (ví dụ 2026-10-06T13:54:00Z). |

| 3 | Id của dishes, users, chat_sessions, chat_messages, collections là uuid; id của các bảng tra cứu (tags, ingredients, diet_types, allergen_groups...) và ratings là số nguyên. |

| 4 | Tiền tệ tính bằng VND (số, không định dạng). Dinh dưỡng: calories (kcal), protein_g, carbs_g, fat_g trên mỗi khẩu phần. |

| 5 | Mọi response JSON có cấu trúc thống nhất như bên dưới; ngoại lệ là tệp tải về (xuất báo cáo) và HTTP 204. |



Response thành công

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| success | boolean | true | Kết quả xử lý. |

| data | object | array |  | Dữ liệu trả về. |

| meta | object |  | Thông tin bổ sung (chỉ có ở API danh sách hoặc khi cần). |

| meta.page | integer | 1 | Trang hiện tại. |

| meta.limit | integer | 20 | Số bản ghi mỗi trang. |

| meta.total | integer | 57 | Tổng số bản ghi. |

| meta.total_pages | integer | 3 | Tổng số trang. |



meta chỉ xuất hiện ở API trả danh sách có phân trang hoặc thông tin bổ sung.

Response lỗi

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| success | boolean | false | Kết quả xử lý. |

| error | object |  | Thông tin lỗi. |

| error.code | string | VALIDATION_ERROR | Mã lỗi để client xử lý logic. |

| error.message | string | Dữ liệu không hợp lệ. | Thông báo tiếng Việt, hiển thị được cho người dùng. |

| error.details | array<object> |  | Chi tiết lỗi theo từng trường (nếu có). |

| error.details[].field | string | password | Tên trường lỗi. |

| error.details[].code | string | WEAK_PASSWORD | Mã lỗi của trường. |

| error.details[].message | string | Mật khẩu cần... | Mô tả lỗi của trường. |

| error.request_id | string | req_7f3a91c2 | Mã yêu cầu để tra log. |



message là câu tiếng Việt có thể hiển thị trực tiếp; client xử lý logic dựa vào code. request_id dùng để tra log.

2.3 Phân trang, sắp xếp, lọc

| # | Nội dung |

| --- | --- |

| 1 | Phân trang theo trang: page (từ 1) và limit (mặc định 20, tối đa 100). meta trả page, limit, total, total_pages. |

| 2 | sort nhận một giá trị trong danh sách của từng API; mặc định được ghi rõ ở phần tham số. |

| 3 | Tham số dạng danh sách truyền cách nhau bằng dấu phẩy: tag_ids=1,5,9. |

| 4 | Tham số boolean: true | false. Tham số ngày: YYYY-MM-DD. |



2.4 Mã trạng thái HTTP

| HTTP | Ý nghĩa | Dùng khi |

| --- | --- | --- |

| 200 / 201 / 202 / 204 | Thành công / Đã tạo / Đã nhận xử lý bất đồng bộ / Không có nội dung | GET, PUT, PATCH / POST tạo mới / tác vụ nền / DELETE |

| 400 | Bad Request | Tham số truy vấn sai, thiếu confirm=true, token không hợp lệ |

| 401 | Unauthorized | Thiếu, sai hoặc hết hạn access token; sai thông tin đăng nhập |

| 403 | Forbidden | Không đủ quyền, tài khoản bị khóa, thao tác bị cấm |

| 404 | Not Found | Tài nguyên không tồn tại hoặc không thuộc về người dùng |

| 409 | Conflict | Trùng dữ liệu, đang được sử dụng, vi phạm ràng buộc nghiệp vụ |

| 413 / 415 | Payload Too Large / Unsupported Media Type | Tệp tải lên quá lớn / sai định dạng |

| 422 | Unprocessable Entity | Dữ liệu sai định dạng hoặc vi phạm quy tắc nghiệp vụ |

| 429 | Too Many Requests | Vượt giới hạn tần suất hoặc hạn mức lượt hỏi |

| 500 / 502 / 504 | Lỗi máy chủ / Dịch vụ AI hoặc email lỗi / Quá thời gian chờ | Sự cố hệ thống hoặc dịch vụ bên ngoài |



2.5 Mã lỗi chung

Các mã lỗi sau có thể xảy ra ở nhiều API nên không lặp lại ở từng endpoint; mã lỗi riêng của từng API được liệt kê tại phần mô tả API đó.

| HTTP | Mã lỗi (error.code) | Mô tả |

| --- | --- | --- |

| 400 | INVALID_QUERY | Tham số truy vấn sai kiểu hoặc giá trị. |

| 400 | CONFIRMATION_REQUIRED | Thao tác xóa thiếu confirm=true. |

| 401 | UNAUTHORIZED | Chưa đăng nhập hoặc token sai. |

| 401 | TOKEN_EXPIRED | Access token hết hạn. |

| 403 | FORBIDDEN | Không đủ quyền (ví dụ người dùng gọi API /admin). |

| 403 | ACCOUNT_LOCKED | Tài khoản bị khóa. |

| 404 | NOT_FOUND | Không tìm thấy tài nguyên (mã cụ thể như DISH_NOT_FOUND được dùng ở từng API). |

| 422 | VALIDATION_ERROR | Dữ liệu không hợp lệ; error.details liệt kê từng trường. |

| 429 | TOO_MANY_REQUESTS | Vượt giới hạn tần suất; error.details.retry_after (giây). |

| 500 | INTERNAL_ERROR | Lỗi không xác định; kèm request_id. |

| 502 / 504 | AI_SERVICE_ERROR / AI_TIMEOUT | Dịch vụ AI lỗi hoặc quá thời gian; client hiển thị thông báo thân thiện và cho thử lại. |



2.6 Giới hạn tần suất (đề xuất)

| Nhóm API | Giới hạn | Khóa đếm |

| --- | --- | --- |

| Đọc công khai (GET /dishes, /meta...) | 120 request / phút | IP |

| Xác thực (/auth/*) | 10 request / phút; forgot-password 3 / 15 phút | IP và email |

| Chatbot người dùng | 20 tin nhắn / phút | user_id |

| Chatbot khách | Hạn mức lượt hỏi theo cấu hình (UC13) và 10 request / phút | X-Guest-Id và IP |

| Admin | 300 request / phút | user_id |



Response có header X-RateLimit-Limit, X-RateLimit-Remaining và Retry-After khi bị chặn.

2.7 Quy ước thiết kế

| # | Nội dung |

| --- | --- |

| 1 | GET chỉ đọc, không thay đổi dữ liệu (ngoại lệ có chủ đích: ghi nhận lượt xem ở chi tiết món). |

| 2 | POST tạo mới hoặc thực hiện hành động; PUT ghi đè toàn bộ (idempotent); PATCH cập nhật một phần; DELETE xóa. |

| 3 | Mọi thao tác xóa hàng loạt hoặc xóa tài khoản bắt buộc có confirm=true (tương ứng bước xác nhận trong use case). |

| 4 | Người dùng chỉ truy cập được dữ liệu của chính mình; truy cập dữ liệu người khác trả 404 (không tiết lộ sự tồn tại) hoặc 403 NOT_OWNER. |

| 5 | Món ăn có is_published = false chỉ hiển thị với Admin. |



3. Tổng quan API & phân loại ưu tiên

3.1 Tiêu chí phân loại

Để giới hạn phạm vi triển khai, các API được chia làm hai loại. Ưu tiên làm các API chính trước; chúng được mô tả đầy đủ ở mục 4. Các API phụ được mô tả đầy đủ ở mục 5 (Mục bổ sung) để chọn lọc: chức năng nào cần thì làm, không cần thì bỏ qua.

| Loại | Tiêu chí | Số API | Vị trí trong tài liệu |

| --- | --- | --- | --- |

| Chính (làm trước) | Cần cho luồng nghiệp vụ lõi và buổi demo: đăng ký/đăng nhập, làm mới token, đặt lại mật khẩu, tìm và xem món, chatbot (khách và người dùng), hồ sơ khẩu vị, gợi ý, yêu thích/đánh giá, quản trị món ăn/người dùng/chatbot cơ bản. | 62 | Mục 4 |

| Phụ (làm sau) | Tiện ích, luồng thay thế, báo cáo nâng cao, hoặc có thể thay bằng cơ chế có sẵn (Supabase Auth, seed dữ liệu, cập nhật tự động). Có thể làm sau hoặc bỏ mà không phá vỡ use case chính. | 21 | Mục 5 (mô tả đầy đủ, chọn lọc để làm) |



3.2 Thứ tự triển khai đề xuất

Làm theo thứ tự các giai đoạn dưới đây; mỗi giai đoạn từ 1 đến 4 chỉ gồm API chính.

| Giai đoạn | Nội dung | Nhóm API (mục 4) |

| --- | --- | --- |

| 1 | Nền tảng: xác thực, dữ liệu tra cứu, tìm kiếm và xem món | Xác thực; Dữ liệu tra cứu; Món ăn |

| 2 | Giá trị cốt lõi: chatbot, hồ sơ khẩu vị, gợi ý từ nguyên liệu có sẵn | Chatbot khách; Hồ sơ khẩu vị; Chatbot cá nhân hóa; Gợi ý |

| 3 | Tương tác người dùng và tài khoản | Yêu thích & đánh giá; Tài khoản & dữ liệu cá nhân |

| 4 | Quản trị | Admin (món ăn, công thức, người dùng, chatbot, thống kê) |

| 5 | Sau khi xong giai đoạn 1–4: chọn trong mục 5 những API phụ cần thiết để làm | Mục 5 |



3.3 Số lượng API theo nhóm

| Nhóm | Use case | Chính | Phụ | Tổng |

| --- | --- | --- | --- | --- |

| Xác thực & tài khoản | UC01, UC05, UC15 | 7 | 0 | 7 |

| Dữ liệu tra cứu | UC02, UC06, UC11, UC16 | 2 | 0 | 2 |

| Món ăn | UC02, UC04 | 2 | 2 | 4 |

| Chatbot chế độ khách | UC03 | 1 | 1 | 2 |

| Hồ sơ khẩu vị | UC06 | 2 | 1 | 3 |

| Chatbot cá nhân hóa | UC07 | 6 | 2 | 8 |

| Gợi ý cá nhân hóa | UC08 | 1 | 0 | 1 |

| Yêu thích, đánh giá & bình luận | UC09 | 6 | 0 | 6 |

| Tài khoản & dữ liệu cá nhân | UC10 | 6 | 4 | 10 |

| Bộ sưu tập món ăn (mở rộng) | UC10 (mở rộng) | 0 | 7 | 7 |

| Admin – Quản lý món ăn | UC11 | 6 | 2 | 8 |

| Admin – Quản lý công thức | UC16 | 4 | 0 | 4 |

| Admin – Quản lý người dùng | UC12 | 6 | 1 | 7 |

| Admin – Giám sát chatbot | UC13 | 8 | 0 | 8 |

| Admin – Thống kê hệ thống | UC14 | 5 | 1 | 6 |

| Tổng |  | 62 | 21 | 83 |



3.4 Ánh xạ use case → API

| Use case | API chính (mục 4, làm trước) | API phụ (mục 5, làm sau) |

| --- | --- | --- |

| UC01 – Đăng ký tài khoản | POST /auth/register | — |

| UC02 – Tìm kiếm & lọc món ăn | GET /meta/filtersGET /ingredientsGET /dishes | GET /dishes/popularPOST /interactions |

| UC03 – Trò chuyện với chatbot (chế độ khách) | POST /chat/guest/messages | GET /chat/guest/quota |

| UC04 – Xem chi tiết món ăn & công thức | GET /dishes/{idOrSlug}GET /dishes/{dishId}/ratings | POST /interactions |

| UC05 – Đăng nhập / đăng xuất | POST /auth/loginPOST /auth/logoutPOST /auth/refresh | — |

| UC06 – Quản lý hồ sơ khẩu vị | GET /meta/filtersGET /ingredientsGET /me/taste-profilePUT /me/taste-profile | PATCH /me/taste-profile |

| UC07 – Trò chuyện với chatbot (cá nhân hóa) | POST /chat/sessionsGET /chat/sessionsGET /chat/sessions/{sessionId}POST /chat/sessions/{sessionId}/messagesDELETE /chat/sessions/{sessionId}POST /chat/messages/{messageId}/feedback | PATCH /chat/sessions/{sessionId} |

| UC08 – Nhận gợi ý cá nhân hóa | GET /me/recommendations | GET /dishes/popularPOST /interactions |

| UC09 – Yêu thích, đánh giá & bình luận | PUT /dishes/{dishId}/favoriteDELETE /dishes/{dishId}/favoriteGET /dishes/{dishId}/ratingsPOST /dishes/{dishId}/ratingsPATCH /ratings/{ratingId}DELETE /ratings/{ratingId} | — |

| UC10 – Quản lý dữ liệu cá nhân | GET /chat/sessionsDELETE /chat/sessions/{sessionId}GET /mePATCH /mePUT /me/passwordGET /me/favoritesPOST /me/avatarDELETE /me | DELETE /chat/sessionsDELETE /me/favoritesGET /me/ratingsGET /me/view-historyDELETE /me/view-historyGET /me/collectionsPOST /me/collectionsGET /me/collections/{collectionId}PATCH /me/collections/{collectionId}DELETE /me/collections/{collectionId}PUT /me/collections/{collectionId}/dishes/{dishId}DELETE /me/collections/{collectionId}/dishes/{dishId} |

| UC11 – Quản lý món ăn | GET /admin/dishesGET /admin/dishes/{dishId}POST /admin/dishesPUT /admin/dishes/{dishId}DELETE /admin/dishes/{dishId}POST /admin/uploads/imagesGET /meta/filters | PATCH /admin/dishes/{dishId}/publishPOST /admin/dishes/{dishId}/reindex |

| UC12 – Quản lý người dùng | GET /admin/usersGET /admin/users/{userId}PATCH /admin/users/{userId}/statusPATCH /admin/users/{userId}/roleDELETE /admin/users/{userId}GET /admin/audit-logs | DELETE /admin/ratings/{ratingId} |

| UC13 – Giám sát chatbot | GET /admin/chatbot/overviewGET /admin/chatbot/conversationsGET /admin/chatbot/conversations/{sessionId}GET /admin/chatbot/settingsPUT /admin/chatbot/settingsPOST /chat/messages/{messageId}/feedbackPATCH /admin/chatbot/messages/{messageId}/flagGET /admin/chatbot/frequent-questionsGET /admin/chatbot/health | — |

| UC14 – Xem thống kê hệ thống | GET /admin/stats/overviewGET /admin/stats/top-dishesGET /admin/stats/timeseriesGET /admin/stats/search-trendsGET /admin/stats/export | GET /admin/stats/chatbot-usage |

| UC15 – Quên / khôi phục mật khẩu | POST /auth/forgot-passwordPOST /auth/reset-password/verifyPOST /auth/reset-password | — |

| UC16 – Quản lý công thức | GET /admin/dishes/{dishId}/recipePOST /admin/dishes/{dishId}/recipePUT /admin/dishes/{dishId}/recipeDELETE /admin/dishes/{dishId}/recipeGET /ingredientsGET /meta/filters | — |



4. Chi tiết API chính

Mục này gồm 62 API chính. Mọi API dưới /admin yêu cầu tài khoản role = admin.

4.1 Xác thực & tài khoản

Use case: UC01, UC05, UC15

Nhóm API đăng ký, đăng nhập/đăng xuất, làm mới token và khôi phục mật khẩu. Các API này không yêu cầu token (trừ đăng xuất).

4.1.1  Đăng ký tài khoản

POST   /auth/register

| Mô tả | Khách vãng lai tạo tài khoản mới. Vai trò mặc định là user, trạng thái active. |

| --- | --- |

| Use case | UC01 |

| Quyền truy cập | Công khai |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | Email phải đúng định dạng và chưa tồn tại (không phân biệt hoa/thường). |

| 2 | Mật khẩu: Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số. |

| 3 | confirm_password phải trùng password. |

| 4 | Mật khẩu được băm (bcrypt/Supabase Auth) trước khi lưu, không bao giờ trả về trong response. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| display_name | string | Huyền Thiên | Tên hiển thị. |

| email | string | thien@example.com | Email đăng nhập. |

| password | string | Matkhau@123 | Mật khẩu. |

| confirm_password | string | Matkhau@123 | Nhập lại mật khẩu để xác nhận. |



Response 201 Created

Response thành công (success = true). data gồm: id, email, display_name, role, created_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 409 | EMAIL_ALREADY_EXISTS | Email đã tồn tại (luồng 4a). |

| 422 | VALIDATION_ERROR | Sai định dạng, mật khẩu yếu hoặc không khớp; chi tiết theo từng trường trong error.details (luồng 4b). |



4.1.2  Đăng nhập

POST   /auth/login

| Mô tả | Xác thực bằng email và mật khẩu, trả về access token và refresh token. Client dùng trường user.role để chuyển hướng (admin → trang quản trị). |

| --- | --- |

| Use case | UC05 |

| Quyền truy cập | Công khai |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | Access token (JWT) hết hạn sau 1 giờ; refresh token hết hạn sau 7 ngày. |

| 2 | Sai mật khẩu quá 5 lần liên tiếp: tạm khóa đăng nhập 15 phút cho email đó (luồng 2c). |

| 3 | Thông báo sai thông tin không tiết lộ email có tồn tại hay không. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| email | string | thien@example.com | Email đăng nhập. |

| password | string | Matkhau@123 | Mật khẩu. |



Response 200 OK

Response thành công (success = true). data gồm: access_token, refresh_token, token_type, expires_in, user{id, email, display_name, avatar_url, role, status, created_at}.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 401 | INVALID_CREDENTIALS | Sai email hoặc mật khẩu (luồng 2a). |

| 403 | ACCOUNT_LOCKED | Tài khoản đã bị quản trị viên khóa (luồng 2b). |

| 429 | TOO_MANY_ATTEMPTS | Nhập sai quá số lần cho phép; kèm error.details.retry_after (giây) (luồng 2c). |



4.1.3  Đăng xuất

POST   /auth/logout

| Mô tả | Hủy phiên hiện tại (vô hiệu refresh token). Sau đó client xóa token và quay về chế độ khách. |

| --- | --- |

| Use case | UC05 |

| Quyền truy cập | Người dùng / Admin |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| refresh_token | string | f3b9c0d2-... | Token dùng để cấp lại access token. |



Response 204 No Content

Không có nội dung trả về.

4.1.4  Làm mới access token

POST   /auth/refresh

| Mô tả | Cấp access token mới từ refresh token còn hiệu lực (xoay vòng refresh token). |

| --- | --- |

| Use case | UC05 |

| Quyền truy cập | Công khai (cần refresh token) |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| refresh_token | string | f3b9c0d2-... | Token dùng để cấp lại access token. |



Response 200 OK

Response thành công (success = true). data gồm: access_token, refresh_token, token_type, expires_in.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 401 | INVALID_REFRESH_TOKEN | Refresh token sai, đã dùng hoặc hết hạn → client yêu cầu đăng nhập lại (UC09 luồng 2b). |



4.1.5  Yêu cầu đặt lại mật khẩu

POST   /auth/forgot-password

| Mô tả | Gửi liên kết/mã đặt lại mật khẩu tới email đã đăng ký. |

| --- | --- |

| Use case | UC15 |

| Quyền truy cập | Công khai |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | Luôn trả về cùng một thông báo chung dù email có tồn tại hay không, để tránh dò tìm tài khoản (luồng 4a). |

| 2 | Chỉ gửi email khi tài khoản tồn tại và không bị khóa. |

| 3 | Liên kết/mã dùng một lần, hiệu lực 15 phút. |

| 4 | Giới hạn 3 yêu cầu / 15 phút cho mỗi email và mỗi IP (luồng 4c). |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| email | string | thien@example.com | Email đăng nhập. |



Response 200 OK

Response thành công (success = true). data gồm: message.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 422 | VALIDATION_ERROR | Email sai định dạng (luồng 3a). |

| 429 | TOO_MANY_REQUESTS | Gửi yêu cầu quá nhiều lần; kèm retry_after (luồng 4c). |

| 502 | EMAIL_SEND_FAILED | Gửi email thất bại, cho phép gửi lại (luồng 4b). |



4.1.6  Kiểm tra liên kết/mã đặt lại

POST   /auth/reset-password/verify

| Mô tả | Kiểm tra token trong liên kết (hoặc mã xác thực) còn hiệu lực trước khi hiển thị form mật khẩu mới. |

| --- | --- |

| Use case | UC15 |

| Quyền truy cập | Công khai |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| token | string | d41f9a... | Token trong liên kết/mã đặt lại mật khẩu. |



Response 200 OK

Response thành công (success = true). data gồm: valid, expires_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_OR_EXPIRED_TOKEN | Token sai, đã sử dụng hoặc hết hạn; client cho phép yêu cầu token mới (luồng 7a). |



4.1.7  Đặt mật khẩu mới

POST   /auth/reset-password

| Mô tả | Đặt mật khẩu mới bằng token hợp lệ. |

| --- | --- |

| Use case | UC15 |

| Quyền truy cập | Công khai (cần token) |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | Mật khẩu mới: Tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số. |

| 2 | Sau khi thành công: mật khẩu được băm và lưu, token bị vô hiệu, mọi phiên/refresh token cũ bị hủy. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| token | string | d41f9a... | Token trong liên kết/mã đặt lại mật khẩu. |

| new_password | string | MatkhauMoi@456 | Mật khẩu mới. |

| confirm_password | string | MatkhauMoi@456 | Nhập lại mật khẩu để xác nhận. |



Response 200 OK

Response thành công (success = true). data gồm: message.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_OR_EXPIRED_TOKEN | Token không hợp lệ hoặc hết hạn. |

| 422 | VALIDATION_ERROR | Mật khẩu yếu hoặc không khớp phần xác nhận (luồng 9a). |



4.2 Dữ liệu tra cứu

Use case: UC02, UC06, UC11, UC16

Dữ liệu dùng để dựng bộ lọc và form: danh mục món, thẻ, chế độ ăn, nhóm dị ứng và nguyên liệu. Thẻ, chế độ ăn và nhóm dị ứng được khởi tạo sẵn (seed) khi triển khai, không có API quản trị. Danh mục món không có bảng riêng: đó là giá trị văn bản Admin tự nhập ở từng món. Dữ liệu ít thay đổi, nên cache phía client.

4.2.1  Lấy toàn bộ danh mục bộ lọc

GET   /meta/filters

| Mô tả | Trả về một lần: danh mục món, thẻ, chế độ ăn, nhóm dị ứng. categories là danh sách tên danh mục khác nhau lấy từ các món đang hiển thị (is_published = true), sắp xếp theo tên; với token Admin thì gồm cả danh mục của món đang ẩn (dùng làm gợi ý khi nhập danh mục ở UC11). Header Cache-Control: max-age=300. |

| --- | --- |

| Use case | UC02, UC06, UC11 |

| Quyền truy cập | Công khai |



Response 200 OK

Response thành công (success = true). data gồm: categories (mảng chuỗi tên danh mục), tags{id, name}, diet_types{id, code, name}, allergen_groups{id, code, name}.

4.2.2  Tìm nguyên liệu (autocomplete)

GET   /ingredients

| Mô tả | Tìm nguyên liệu theo tên hoặc bí danh (aliases), không phân biệt dấu. Dùng cho bộ lọc nguyên liệu, form hồ sơ khẩu vị, “Nguyên liệu có sẵn” (is_common = true trả về danh sách nguyên liệu phổ biến để chọn nhanh) và ô gõ nguyên liệu trong form công thức của Admin (UC16): Admin gõ tên, chọn nguyên liệu có sẵn; nếu chưa có thì nhập tên mới và hệ thống tạo khi lưu công thức. |

| --- | --- |

| Use case | UC02, UC06, UC16 |

| Quyền truy cập | Công khai |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| q | query | string | Không | Từ khóa tên/bí danh nguyên liệu. |

| is_common | query | boolean | Không | true: chỉ trả nguyên liệu phổ biến (chip chọn nhanh trong mục Nguyên liệu có sẵn). |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: id, name, default_unit, is_common, allergen_group{id, name}. meta: page, limit, total, total_pages.

4.3 Món ăn

Use case: UC02, UC04

Tra cứu, tìm kiếm và xem chi tiết món ăn. Chỉ trả về các món có is_published = true. Nếu request có access token hợp lệ, response bổ sung các trường cá nhân (is_favorite, my_rating) và hệ thống ghi nhận lượt xem. Gồm cả tìm món theo nguyên liệu có sẵn.

4.3.1  Tìm kiếm & lọc món ăn

GET   /dishes

| Mô tả | Tìm món theo từ khóa và lọc theo danh mục món, nguyên liệu, thời gian nấu, độ khó, khẩu vị/thẻ, dinh dưỡng; có sắp xếp và phân trang. Dùng cả cho “Nguyên liệu có sẵn”: truyền các nguyên liệu đang có qua ingredient_ids để tìm những món nấu được. |

| --- | --- |

| Use case | UC02 |

| Quyền truy cập | Công khai (có token thì thêm is_favorite) |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | q tìm trên tên món, mô tả và bí danh nguyên liệu (full-text, bỏ dấu). |

| 2 | Các tham số dạng danh sách truyền cách nhau bằng dấu phẩy: tag_ids=1,5. |

| 3 | Khẩu vị (cay, ngọt, chay...) được lọc qua tag_ids. |

| 4 | Không có kết quả vẫn trả 200 với data rỗng và meta.suggestions để client hiển thị gợi ý mở rộng tìm kiếm (luồng 2a). |

| 5 | Danh sách nguyên liệu có sẵn chỉ nằm ở client; client gửi các nguyên liệu đang có qua ingredient_ids, server không lưu (UC02, luồng 1a). |

| 6 | Khi có ingredient_ids, mỗi món trả thêm match (số nguyên liệu đã có/còn thiếu; nguyên liệu is_optional = true không tính là thiếu). Nếu không có q thì sort mặc định là match (khớp nhiều nhất trước). min_match_ratio lọc các món có tỷ lệ nguyên liệu đã có từ ngưỡng đó (1 = nấu được ngay). |

| 7 | Nguyên liệu nhập tay không có trong danh mục (không có id) không đưa vào ingredient_ids; client chỉ gửi chúng khi hỏi chatbot (luồng 1b). |

| 8 | Có ingredient_ids nhưng không có món khớp: trả 200 với data rỗng và meta.suggest_ai = true để client hiển thị nút “Chuyển sang Chatbot AI với nguyên liệu này” (luồng 2a, 4a). |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| q | query | string | Không | Từ khóa tìm kiếm. |

| category | query | string | Không | Lọc theo danh mục món (tên danh mục do Admin nhập; so khớp không phân biệt hoa thường và dấu). |

| ingredient_ids | query | string | Không | Danh sách id nguyên liệu (ví dụ nguyên liệu có sẵn), cách nhau bằng dấu phẩy. |

| ingredient_match | query | enum | Không | any (mặc định) hoặc all: món chứa ít nhất một / tất cả nguyên liệu. |

| min_match_ratio | query | number | Không | Dùng cùng ingredient_ids: tỷ lệ nguyên liệu đã có tối thiểu (0–1); 1 = nấu được ngay. |

| exclude_ingredient_ids | query | string | Không | Loại các món chứa nguyên liệu này. |

| tag_ids | query | string | Không | Danh sách id thẻ (khẩu vị, chế độ ăn...). |

| max_cook_time | query | integer | Không | Thời gian nấu tối đa (phút). |

| difficulty | query | enum | Không | easy | medium | hard. |

| max_calories | query | integer | Không | Calo tối đa mỗi khẩu phần. |

| min_protein_g | query | integer | Không | Lượng protein tối thiểu mỗi khẩu phần (g). |

| max_carbs_g | query | integer | Không | Lượng carb tối đa mỗi khẩu phần (g). |

| max_fat_g | query | integer | Không | Lượng chất béo tối đa mỗi khẩu phần (g). |

| sort | query | enum | Không | relevance (mặc định khi có q) | match (mặc định khi có ingredient_ids, không có q) | newest | rating | popular | cook_time | calories. |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: id, name, slug, description, image_url, category, cook_time_minutes, difficulty, calories, avg_rating, rating_count, favorite_count, is_favorite, match{matched_count, missing_count, ratio, missing_ingredients}. meta: page, limit, total, total_pages, suggestions, suggest_ai.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_QUERY | Tham số lọc sai kiểu hoặc giá trị không hợp lệ. |



4.3.2  Xem chi tiết món ăn & công thức

GET   /dishes/{idOrSlug}

| Mô tả | Thông tin đầy đủ của một món: mô tả, nguyên liệu, các bước, thời gian, khẩu phần, dinh dưỡng, điểm đánh giá, món liên quan. Người dùng đã đăng nhập sẽ được cập nhật view_history. |

| --- | --- |

| Use case | UC04 |

| Quyền truy cập | Công khai (có token thì thêm dữ liệu cá nhân) |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| idOrSlug | path | uuid | string | Có | id (uuid) hoặc slug của món. |



Response 200 OK

Response thành công (success = true). data gồm: id, name, slug, description, image_url, category, cook_time_minutes, difficulty, calories, avg_rating, rating_count, favorite_count, is_favorite, servings, est_cost, nutrition{calories, protein_g, carbs_g, fat_g}, ingredients{ingredient_id, name, quantity, unit, is_optional, allergen_group}, steps{order, content}, tags{id, name}, rating_summary{average, count, distribution}, my_rating{id, stars, comment}, related_dishes{id, name, slug, image_url}, created_at, updated_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | DISH_NOT_FOUND | Món không tồn tại hoặc đã bị ẩn; client thông báo và quay lại danh sách (luồng 2a). |



4.4 Chatbot chế độ khách

Use case: UC03

Khách chưa đăng nhập hỏi chatbot ở chế độ hạn chế: không dùng dữ liệu cá nhân, giới hạn số lượt hỏi, lịch sử chỉ lưu tạm theo phiên khách (cache, TTL 24 giờ) và không ghi vào chat_sessions của người dùng.

4.4.1  Gửi câu hỏi (khách)

POST   /chat/guest/messages

| Mô tả | Gửi một câu hỏi cho chatbot. Lần đầu không có header X-Guest-Id, server cấp guest_id mới; client lưu lại và gửi kèm các lượt sau. |

| --- | --- |

| Use case | UC03 |

| Quyền truy cập | Công khai (khách) |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | Kiểm tra hạn mức lượt hỏi (cấu hình ở UC13) trước khi gọi mô hình AI (luồng 2). Nếu guest_message_limit = 0 (chatbot khách bị tắt): trả 429 GUEST_LIMIT_EXCEEDED kèm error.details.disabled = true để client báo chatbot khách tạm không khả dụng (luồng 2b). |

| 2 | Server gửi câu hỏi cùng ngữ cảnh món ăn liên quan (tìm theo embedding) tới mô hình AI. |

| 3 | Câu hỏi ngoài phạm vi ẩm thực: trả 200 với reply.type = out_of_scope và nội dung từ chối lịch sự (luồng 4a). |

| 4 | content tối đa 1000 ký tự. |

| 5 | Có thể gửi kèm pantry (nguyên liệu có sẵn): server đưa danh sách này vào ngữ cảnh để chatbot ưu tiên gợi ý hoặc sáng tạo món từ các nguyên liệu đó; nguyên liệu nhập tay (custom_ingredients) cũng được dùng (luồng 1a). Tối đa 20 nguyên liệu. |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| X-Guest-Id | header | string | Không | Định danh phiên khách do server cấp. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| content | string | Gợi ý món canh cho bữa trưa nhanh gọn | Nội dung văn bản. |

| pantry | object |  | Không bắt buộc. Nguyên liệu có sẵn gửi kèm câu hỏi. |

| pantry.ingredient_ids | array<integer> | [7,21] | Id nguyên liệu trong danh mục. |

| pantry.custom_ingredients | array<string> | ["súp lơ"] | Nguyên liệu nhập tay không có trong danh mục. |



Response 200 OK

Response thành công (success = true). data gồm: guest_id, reply{type, content, dishes}, quota{limit, used, remaining, resets_at}.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 429 | GUEST_LIMIT_EXCEEDED | Vượt giới hạn lượt hỏi; error.details.cta = [register, login] để client mời đăng ký/đăng nhập (UC01, UC05) (luồng 2a). |

| 502 | AI_SERVICE_ERROR | Dịch vụ AI lỗi; cho phép thử lại (luồng 3a). |

| 504 | AI_TIMEOUT | Dịch vụ AI quá thời gian chờ (luồng 3a). |



4.5 Hồ sơ khẩu vị

Use case: UC06

Quản lý sở thích ăn uống làm ngữ cảnh cho chatbot và gợi ý. Dữ liệu nằm ở user_profiles và các bảng liên kết user_diets, user_allergies, user_disliked_ingredients. Mọi API trong nhóm yêu cầu đăng nhập.

4.5.1  Xem hồ sơ khẩu vị

GET   /me/taste-profile

| Mô tả | Trả về hồ sơ khẩu vị hiện tại. Lần đầu chưa có dữ liệu: trả các trường rỗng và completeness = 0 để client hiển thị form trống. |

| --- | --- |

| Use case | UC06 |

| Quyền truy cập | Người dùng |



Response 200 OK

Response thành công (success = true). data gồm: taste_prefs{spicy_level, salty_level, sweet_level, sour_level, liked_ingredient_ids}, calorie_goal, household_size, diet_type_ids, allergen_group_ids, disliked_ingredient_ids, diet_types{id, name}, allergen_groups{id, name}, disliked_ingredients{id, name}, completeness, updated_at.

4.5.2  Lưu hồ sơ khẩu vị (ghi đè toàn bộ)

PUT   /me/taste-profile

| Mô tả | Thêm, sửa hoặc xóa các tùy chọn rồi lưu. Các mảng id được thay thế hoàn toàn; trường không gửi được đặt về rỗng/null. |

| --- | --- |

| Use case | UC06 |

| Quyền truy cập | Người dùng |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | Thực hiện trong một transaction trên user_profiles, user_diets, user_allergies, user_disliked_ingredients. |

| 2 | spicy_level, salty_level, sweet_level, sour_level: số nguyên 0–5. |

| 3 | Mâu thuẫn bị từ chối: nguyên liệu vừa nằm trong liked_ingredient_ids vừa trong disliked_ingredient_ids (luồng 5a). |

| 4 | Sau khi lưu, taste_vector được tính lại bất đồng bộ để phục vụ gợi ý. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| taste_prefs | object |  | Mức độ ưa thích vị. |

| taste_prefs.spicy_level | integer | 1 | Mức cay ưa thích (0–5). |

| taste_prefs.salty_level | integer | 3 | Mức mặn ưa thích (0–5). |

| taste_prefs.sweet_level | integer | 2 | Mức ngọt ưa thích (0–5). |

| taste_prefs.sour_level | integer | 2 | Mức chua ưa thích (0–5). |

| taste_prefs.liked_ingredient_ids | array<integer> | [7,21] | Danh sách id nguyên liệu yêu thích. |

| calorie_goal | integer | 1800 | Mục tiêu calo mỗi ngày (kcal). |

| household_size | integer | 4 | Số người trong gia đình. |

| diet_type_ids | array<integer> | [2] | Danh sách id chế độ ăn. |

| allergen_group_ids | array<integer> | [4] | Danh sách id nhóm dị ứng của người dùng. |

| disliked_ingredient_ids | array<integer> | [15,42] | Danh sách id nguyên liệu không thích/kiêng. |



Response 200 OK

Response thành công (success = true). data gồm: taste_prefs{spicy_level, salty_level, sweet_level, sour_level, liked_ingredient_ids}, calorie_goal, household_size, diet_type_ids, allergen_group_ids, disliked_ingredient_ids, diet_types{id, name}, allergen_groups{id, name}, disliked_ingredients{id, name}, completeness, updated_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 422 | PROFILE_CONFLICT | Dữ liệu mâu thuẫn; error.details nêu cặp trường xung đột (luồng 5a). |

| 422 | VALIDATION_ERROR | Giá trị ngoài miền hợp lệ hoặc id không tồn tại. |

| 500 | INTERNAL_ERROR | Lỗi khi lưu; client giữ nguyên dữ liệu đang nhập và cho thử lại (luồng 5b). |



4.6 Chatbot cá nhân hóa

Use case: UC07

Hội thoại đầy đủ cho người dùng đã đăng nhập, lưu vào chat_sessions và chat_messages. Mỗi lượt hỏi, server nạp hồ sơ khẩu vị, món yêu thích và lịch sử tương tác làm ngữ cảnh cho mô hình AI. Người dùng chỉ truy cập được hội thoại của chính mình (trái lại trả 404 CHAT_SESSION_NOT_FOUND).

4.6.1  Tạo hội thoại mới

POST   /chat/sessions

| Mô tả | Tạo phiên chat trống. Nếu không gửi title, hệ thống tự đặt tiêu đề từ tin nhắn đầu tiên. |

| --- | --- |

| Use case | UC07 |

| Quyền truy cập | Người dùng |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| title | string | Thực đơn tối nay cho 4 người | Tiêu đề. |



Response 201 Created

Response thành công (success = true). data gồm: id, title, created_at, updated_at.

4.6.2  Danh sách hội thoại

GET   /chat/sessions

| Mô tả | Liệt kê các hội thoại của người dùng, mới nhất trước. |

| --- | --- |

| Use case | UC07, UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: id, title, created_at, updated_at. meta: page, limit, total, total_pages.

4.6.3  Mở lại hội thoại cũ

GET   /chat/sessions/{sessionId}

| Mô tả | Trả về thông tin phiên và các tin nhắn theo thứ tự thời gian. |

| --- | --- |

| Use case | UC07 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| sessionId | path | uuid | Có | Id hội thoại. |

| page | query | integer | Không | Trang tin nhắn. |

| limit | query | integer | Không | Mặc định 50. |



Response 200 OK

Response thành công (success = true). data gồm: id, title, created_at, updated_at, messages{id, role, content, created_at}. meta: page, limit, total, total_pages.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | CHAT_SESSION_NOT_FOUND | Hội thoại không tồn tại hoặc không thuộc người dùng. |



4.6.4  Gửi câu hỏi cho chatbot

POST   /chat/sessions/{sessionId}/messages

| Mô tả | Gửi câu hỏi, nhận câu trả lời cá nhân hóa kèm thẻ món ăn. Cả hai tin nhắn được lưu vào chat_messages. |

| --- | --- |

| Use case | UC07 |

| Quyền truy cập | Người dùng |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | Server lấy hồ sơ khẩu vị, món đã yêu thích và lịch sử gần đây làm ngữ cảnh (luồng 2–3). |

| 2 | Món chứa nguyên liệu thuộc nhóm dị ứng hoặc nguyên liệu không thích bị loại khỏi referenced_dishes. Chính sách thận trọng: nếu người dùng có nhóm dị ứng, món chứa nguyên liệu needs_review = true (chưa xác nhận nhóm dị ứng) cũng bị loại. |

| 3 | Không tìm được món thỏa ràng buộc: outcome = no_match, chatbot đề xuất nới lỏng điều kiện (luồng 4a). |

| 4 | Nội dung không phù hợp/ngoài phạm vi: outcome = out_of_scope, chatbot từ chối lịch sự (luồng 4b). |

| 5 | Hỗ trợ streaming: gửi header Accept: text/event-stream để nhận các sự kiện token, dishes, done; mặc định trả JSON một lần. |

| 6 | content tối đa 2000 ký tự. |

| 7 | Có thể gửi kèm pantry (nguyên liệu có sẵn): server đưa danh sách này vào ngữ cảnh để chatbot ưu tiên gợi ý hoặc sáng tạo món từ các nguyên liệu đó; nguyên liệu nhập tay (custom_ingredients) cũng được dùng (luồng 1a). Tối đa 20 nguyên liệu. Món chứa nguyên liệu dị ứng/không thích vẫn bị loại theo quy tắc 2. |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| sessionId | path | uuid | Có | Id hội thoại. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| content | string | Tối nay nên nấu gì cho 4 người, không ăn ... | Nội dung văn bản. |

| pantry | object |  | Không bắt buộc. Nguyên liệu có sẵn gửi kèm câu hỏi. |

| pantry.ingredient_ids | array<integer> | [7,21] | Id nguyên liệu trong danh mục. |

| pantry.custom_ingredients | array<string> | ["súp lơ"] | Nguyên liệu nhập tay không có trong danh mục. |



Response 201 Created

Response thành công (success = true). data gồm: user_message{id, role, content, created_at}, assistant_message{id, role, content, referenced_dishes, outcome, tokens, created_at}.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | CHAT_SESSION_NOT_FOUND | Hội thoại không tồn tại. |

| 502 | AI_SERVICE_ERROR | Dịch vụ AI lỗi; tin nhắn người dùng vẫn được lưu để gửi lại (luồng 3a). |

| 504 | AI_TIMEOUT | Quá thời gian chờ AI. |



4.6.5  Xóa một hội thoại

DELETE   /chat/sessions/{sessionId}

| Mô tả | Xóa hội thoại và toàn bộ tin nhắn của nó (cascade). |

| --- | --- |

| Use case | UC07, UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| sessionId | path | uuid | Có | Id hội thoại. |



Response 204 No Content

Không có nội dung trả về.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | CHAT_SESSION_NOT_FOUND | Hội thoại không tồn tại. |



4.6.6  Đánh giá câu trả lời của chatbot

POST   /chat/messages/{messageId}/feedback

| Mô tả | Thích / không thích một câu trả lời của chatbot (ghi vào chat_messages.feedback, feedback_reason). Dữ liệu này hiển thị cho Admin ở UC13. |

| --- | --- |

| Use case | UC07, UC13 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| messageId | path | uuid | Có | Id tin nhắn của chatbot. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| feedback | string | dislike | Phản hồi của người dùng: like | dislike. |

| reason | string | Gợi ý món có hải sản dù mình dị ứng | Lý do. |



feedback: like | dislike. reason không bắt buộc, tối đa 500 ký tự.

Response 200 OK

Response thành công (success = true). data gồm: id, feedback, feedback_reason.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | MESSAGE_NOT_FOUND | Tin nhắn không tồn tại hoặc không thuộc người dùng. |

| 422 | VALIDATION_ERROR | Chỉ đánh giá được tin nhắn có role = assistant. |



4.7 Gợi ý cá nhân hóa

Use case: UC08

Hệ thống xếp hạng món dựa trên hồ sơ khẩu vị (taste_vector), món yêu thích, lịch sử xem và đánh giá (dish_embeddings, view_history, favorites, ratings).

4.7.1  Nhận gợi ý món ăn

GET   /me/recommendations

| Mô tả | Danh sách món gợi ý kèm lý do, đã loại trừ món chứa nguyên liệu thuộc nhóm dị ứng và nguyên liệu không thích. |

| --- | --- |

| Use case | UC08 |

| Quyền truy cập | Người dùng |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | Người dùng mới, chưa đủ dữ liệu: meta.strategy = popular_fallback, trả món phổ biến/nổi bật và meta.prompt_complete_profile = true để client nhắc hoàn thiện hồ sơ khẩu vị (UC06) (luồng 3a). |

| 2 | refresh=true bỏ qua cache và tính lại gợi ý (bước 5). |

| 3 | Kết quả cache theo người dùng 10 phút; cache bị hủy khi hồ sơ, yêu thích hoặc đánh giá thay đổi. |

| 4 | Chính sách thận trọng: nếu người dùng có nhóm dị ứng, món chứa nguyên liệu needs_review = true (chưa xác nhận nhóm dị ứng) không được đưa vào gợi ý. |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| limit | query | integer | Không | Mặc định 12, tối đa 50. |

| category | query | string | Không | Giới hạn theo danh mục món (tên danh mục do Admin nhập; so khớp không phân biệt hoa thường và dấu). |

| refresh | query | boolean | Không | Làm mới gợi ý. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: dish{id, name, slug, description, image_url, category, cook_time_minutes, difficulty, calories, avg_rating, rating_count, favorite_count, is_favorite}, score, reasons. meta: strategy, profile_completeness, prompt_complete_profile, generated_at.

4.8 Yêu thích, đánh giá & bình luận

Use case: UC09

Mỗi người dùng có tối đa một đánh giá cho mỗi món (ràng buộc duy nhất user_id + dish_id trên bảng ratings). Điểm trung bình và số lượt yêu thích được cập nhật ngay và trả về trong response.

4.8.1  Thêm vào yêu thích

PUT   /dishes/{dishId}/favorite

| Mô tả | Lưu món vào danh sách yêu thích. Idempotent: gọi lại khi đã yêu thích vẫn trả 200. |

| --- | --- |

| Use case | UC09 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |



Response 200 OK

Response thành công (success = true). data gồm: dish_id, is_favorite, favorite_count.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | DISH_NOT_FOUND | Món không tồn tại hoặc đã bị ẩn. |



4.8.2  Bỏ yêu thích

DELETE   /dishes/{dishId}/favorite

| Mô tả | Bỏ món khỏi danh sách yêu thích (luồng 1a). |

| --- | --- |

| Use case | UC09 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |



Response 200 OK

Response thành công (success = true). data gồm: dish_id, is_favorite, favorite_count.

4.8.3  Danh sách đánh giá & bình luận của món

GET   /dishes/{dishId}/ratings

| Mô tả | Liệt kê đánh giá/bình luận công khai của một món, kèm thống kê điểm. |

| --- | --- |

| Use case | UC04, UC09 |

| Quyền truy cập | Công khai |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |

| sort | query | enum | Không | newest (mặc định) | highest | lowest. |

| has_comment | query | boolean | Không | Chỉ lấy đánh giá có bình luận. |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data gồm: summary{average, count, distribution}, items{id, stars, comment, user, created_at, updated_at}. meta: page, limit, total, total_pages.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | DISH_NOT_FOUND | Món không tồn tại. |



4.8.4  Đánh giá & bình luận món

POST   /dishes/{dishId}/ratings

| Mô tả | Chấm điểm sao và/hoặc viết bình luận cho món. |

| --- | --- |

| Use case | UC09 |

| Quyền truy cập | Người dùng |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | stars: số nguyên 1–5, bắt buộc. |

| 2 | comment: không bắt buộc; nếu có thì không rỗng (sau khi cắt khoảng trắng), tối đa 1000 ký tự và không chứa từ ngữ bị cấm (luồng 2a). |

| 3 | Mỗi người chỉ đánh giá một lần cho mỗi món; muốn đổi thì dùng PATCH. |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| stars | integer | 5 | Số sao (1–5). |

| comment | string | Nước dùng đậm đà, nấu theo công thức rất dễ. | Nội dung bình luận (tối đa 1000 ký tự). |



Response 201 Created

Response thành công (success = true). data gồm: rating{id, dish_id, stars, comment, created_at}, rating_summary{average, count}.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 409 | RATING_ALREADY_EXISTS | Người dùng đã đánh giá món này. |

| 422 | CONTENT_REJECTED | Bình luận rỗng, quá dài hoặc chứa từ ngữ bị cấm (luồng 2a). |

| 401 | TOKEN_EXPIRED | Phiên hết hạn; client làm mới token hoặc yêu cầu đăng nhập lại (luồng 2b). |



4.8.5  Sửa đánh giá của mình

PATCH   /ratings/{ratingId}

| Mô tả | Sửa số sao và/hoặc bình luận (luồng 1a). Quy tắc nội dung như khi tạo. |

| --- | --- |

| Use case | UC09 |

| Quyền truy cập | Người dùng (chủ đánh giá) |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| ratingId | path | integer | Có | Id đánh giá. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| stars | integer | 4 | Số sao (1–5). |

| comment | string | Ngon nhưng hơi mặn. | Nội dung bình luận (tối đa 1000 ký tự). |



Response 200 OK

Response thành công (success = true). data gồm: id, stars, comment, updated_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 403 | NOT_OWNER | Không phải đánh giá của người dùng. |

| 404 | RATING_NOT_FOUND | Đánh giá không tồn tại. |

| 422 | CONTENT_REJECTED | Nội dung không hợp lệ. |



4.8.6  Xóa đánh giá của mình

DELETE   /ratings/{ratingId}

| Mô tả | Xóa đánh giá/bình luận của chính mình (luồng 1a); điểm trung bình được tính lại. |

| --- | --- |

| Use case | UC09 |

| Quyền truy cập | Người dùng (chủ đánh giá) |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| ratingId | path | integer | Có | Id đánh giá. |



Response 204 No Content

Không có nội dung trả về.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 403 | NOT_OWNER | Không phải đánh giá của người dùng. |

| 404 | RATING_NOT_FOUND | Đánh giá không tồn tại. |



4.9 Tài khoản & dữ liệu cá nhân

Use case: UC10

Xem và cập nhật thông tin tài khoản, quản lý danh sách yêu thích, bộ sưu tập, lịch sử xem và xóa dữ liệu cá nhân. Các thao tác xóa đều yêu cầu xác nhận. Lịch sử hội thoại được quản lý ở nhóm Chatbot cá nhân hóa.

4.9.1  Xem thông tin tài khoản

GET   /me

| Mô tả | Thông tin cơ bản và số liệu tổng hợp để dựng trang Tài khoản của tôi. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng / Admin |



Response 200 OK

Response thành công (success = true). data gồm: id, email, display_name, avatar_url, role, status, created_at, stats{favorites, ratings, chat_sessions}.

4.9.2  Cập nhật thông tin tài khoản

PATCH   /me

| Mô tả | Đổi họ tên hiển thị. Email không đổi được qua API này. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| display_name | string | Thiên Huyền | Tên hiển thị. |



Response 200 OK

Response thành công (success = true). data gồm: id, email, display_name, avatar_url, role, status, created_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 422 | VALIDATION_ERROR | display_name rỗng hoặc dài quá 100 ký tự. |



4.9.3  Đổi mật khẩu

PUT   /me/password

| Mô tả | Đổi mật khẩu khi đang đăng nhập. Thành công thì các phiên khác bị hủy (phiên hiện tại được giữ). |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| current_password | string | Matkhau@123 | Mật khẩu hiện tại. |

| new_password | string | MatkhauMoi@456 | Mật khẩu mới. |

| confirm_password | string | MatkhauMoi@456 | Nhập lại mật khẩu để xác nhận. |



Response 200 OK

Response thành công (success = true). data gồm: message.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | WRONG_CURRENT_PASSWORD | Mật khẩu cũ sai (luồng 3a). |

| 422 | VALIDATION_ERROR | Mật khẩu mới không hợp lệ hoặc không khớp (luồng 3a). |



4.9.4  Danh sách món yêu thích

GET   /me/favorites

| Mô tả | Các món đã yêu thích, mới nhất trước. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| q | query | string | Không | Lọc theo tên món. |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: id, name, slug, description, image_url, category, cook_time_minutes, difficulty, calories, avg_rating, rating_count, favorite_count, is_favorite, favorited_at. meta: page, limit, total, total_pages.

4.9.5  Tải ảnh đại diện

POST   /me/avatar

| Mô tả | Tải ảnh đại diện lên kho lưu trữ (Supabase Storage). Content-Type: multipart/form-data, trường file; định dạng jpg/png/webp, tối đa 2 MB. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Response 200 OK

Response thành công (success = true). data gồm: avatar_url.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 413 | FILE_TOO_LARGE | Ảnh vượt dung lượng cho phép. |

| 415 | UNSUPPORTED_MEDIA_TYPE | Sai định dạng ảnh. |



4.9.6  Xóa tài khoản

DELETE   /me

| Mô tả | Xóa tài khoản và toàn bộ dữ liệu cá nhân: hồ sơ khẩu vị, yêu thích, bộ sưu tập, lịch sử xem, hội thoại. Đánh giá/bình luận được ẩn danh hóa. Cần xác nhận mật khẩu; hủy thì không có thay đổi nào (luồng 3b). Admin không dùng được API này. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| password | string | Matkhau@123 | Mật khẩu. |

| confirm | boolean | true | Xác nhận thao tác, phải là true. |



Response 204 No Content

Không có nội dung trả về.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | CONFIRMATION_REQUIRED | Thiếu confirm = true. |

| 400 | WRONG_CURRENT_PASSWORD | Mật khẩu xác nhận sai. |

| 403 | FORBIDDEN | Tài khoản Admin không tự xóa qua API này. |



4.10 Admin – Quản lý món ăn

Use case: UC11

Tất cả API trong nhóm Admin có tiền tố /admin và yêu cầu access token của tài khoản có role = admin (trái lại trả 403 FORBIDDEN). Công thức (nguyên liệu và các bước) có API riêng ở mục 4.14. Mỗi thay đổi về món ăn đều cập nhật dish_embeddings để chatbot và gợi ý dùng dữ liệu mới.

4.10.1  Danh sách món (quản trị)

GET   /admin/dishes

| Mô tả | Danh sách món gồm cả món đang ẩn, có tìm kiếm, lọc và phân trang. |

| --- | --- |

| Use case | UC11 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| q | query | string | Không | Tìm theo tên. |

| is_published | query | boolean | Không | Lọc món đang hiển thị/ẩn. |

| category | query | string | Không | Lọc theo danh mục món (tên danh mục do Admin nhập; so khớp không phân biệt hoa thường và dấu). |

| sort | query | enum | Không | updated_at (mặc định) | created_at | name. |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: id, name, slug, description, image_url, category, has_recipe, cook_time_minutes, difficulty, calories, avg_rating, rating_count, favorite_count, is_published, updated_at. meta: page, limit, total, total_pages.

4.10.2  Chi tiết món (quản trị)

GET   /admin/dishes/{dishId}

| Mô tả | Dữ liệu đầy đủ của món dùng để điền form sửa, kể cả món đang ẩn. |

| --- | --- |

| Use case | UC11 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |



Response 200 OK

Response thành công (success = true). data gồm: id, slug, created_by, created_at, updated_at, name, description, image_url, category, cook_time_minutes, difficulty, servings, est_cost, calories, protein_g, carbs_g, fat_g, tag_ids, has_recipe, is_published.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | DISH_NOT_FOUND | Món không tồn tại. |



4.10.3  Thêm món ăn

POST   /admin/dishes

| Mô tả | Tạo món (thông tin chung và thẻ dish_tags). Công thức của món tạo riêng qua POST /admin/dishes/{dishId}/recipe (mục 4.14). |

| --- | --- |

| Use case | UC11 |

| Quyền truy cập | Admin |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | Bắt buộc: name, category, servings. |

| 2 | slug tự sinh từ name (bỏ dấu); trùng tên hoặc slug bị từ chối (luồng 4a). |

| 3 | category là văn bản do Admin tự nhập (không có API quản lý danh mục riêng): cắt khoảng trắng thừa, tối đa 100 ký tự. Nếu trùng với danh mục đã có (không phân biệt hoa thường và dấu) thì dùng lại cách viết đã có để các món cùng danh mục được gom chung; chưa có thì danh mục mới xuất hiện trong bộ lọc khi món được hiển thị. |

| 4 | Ảnh tải lên trước qua POST /admin/uploads/images rồi gán URL vào image_url. |

| 5 | created_by lấy từ token; món mới luôn ẩn (is_published = false) vì chưa có công thức. Chỉ hiển thị được sau khi có công thức: Admin thêm công thức ở mục 4.14 và có thể bật hiển thị ngay trong cùng request bằng publish = true. |

| 6 | Sau khi lưu, cập nhật chỉ mục embedding phục vụ tìm kiếm/chatbot (bước 5). |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| name | string | Bún bò Huế | Tên. |

| description | string | Món bún đậm đà, cay nhẹ đặc trưng xứ Huế. | Mô tả. |

| image_url | string | https://cdn.example.com/dishes/bun-bo-hue... | Đường dẫn ảnh. |

| category | string | Món nước | Danh mục món do Admin tự nhập (bắt buộc, tối đa 100 ký tự). |

| cook_time_minutes | integer | 90 | Thời gian nấu (phút). |

| difficulty | string | medium | Độ khó: easy | medium | hard. |

| servings | integer | 4 | Số khẩu phần. |

| est_cost | integer | 120000 | Chi phí ước tính (VND). |

| calories | integer | 520 | Năng lượng mỗi khẩu phần (kcal). |

| protein_g | integer | 32 | Đạm mỗi khẩu phần (g). |

| carbs_g | integer | 58 | Tinh bột mỗi khẩu phần (g). |

| fat_g | integer | 18 | Chất béo mỗi khẩu phần (g). |

| tag_ids | array<integer> | [5] | Danh sách id thẻ. |



Response 201 Created

Response thành công (success = true). data gồm: id, slug, created_by, created_at, updated_at, name, description, image_url, category, cook_time_minutes, difficulty, servings, est_cost, calories, protein_g, carbs_g, fat_g, tag_ids, has_recipe, is_published.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 409 | DISH_NAME_EXISTS | Tên món hoặc slug đã tồn tại (luồng 5a). |

| 422 | VALIDATION_ERROR | Thiếu trường bắt buộc, giá trị sai, category trống hoặc vượt quá 100 ký tự (luồng 6a). |



4.10.4  Sửa món ăn

PUT   /admin/dishes/{dishId}

| Mô tả | Cập nhật thông tin món. Danh sách tag_ids được thay thế hoàn toàn. Request body như POST /admin/dishes, thêm is_published. Công thức sửa riêng ở mục 4.14. |

| --- | --- |

| Use case | UC11 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| name | string | Bún bò Huế | Tên. |

| description | string | Món bún đậm đà, cay nhẹ đặc trưng xứ Huế. | Mô tả. |

| image_url | string | https://cdn.example.com/dishes/bun-bo-hue... | Đường dẫn ảnh. |

| category | string | Món nước | Danh mục món do Admin tự nhập (bắt buộc, tối đa 100 ký tự). |

| cook_time_minutes | integer | 90 | Thời gian nấu (phút). |

| difficulty | string | medium | Độ khó: easy | medium | hard. |

| servings | integer | 4 | Số khẩu phần. |

| est_cost | integer | 120000 | Chi phí ước tính (VND). |

| calories | integer | 520 | Năng lượng mỗi khẩu phần (kcal). |

| protein_g | integer | 32 | Đạm mỗi khẩu phần (g). |

| carbs_g | integer | 58 | Tinh bột mỗi khẩu phần (g). |

| fat_g | integer | 18 | Chất béo mỗi khẩu phần (g). |

| tag_ids | array<integer> | [5] | Danh sách id thẻ. |

| is_published | boolean | true | Món đang hiển thị công khai. |



Response 200 OK

Response thành công (success = true). data gồm: id, slug, created_by, created_at, updated_at, name, description, image_url, category, cook_time_minutes, difficulty, servings, est_cost, calories, protein_g, carbs_g, fat_g, tag_ids, has_recipe, is_published.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | DISH_NOT_FOUND | Món không tồn tại. |

| 409 | DISH_NAME_EXISTS | Tên món trùng món khác. |

| 422 | VALIDATION_ERROR | Dữ liệu không hợp lệ. |

| 422 | RECIPE_REQUIRED | is_published = true nhưng món chưa có công thức. |



4.10.5  Xóa món (hoặc ẩn nếu đã có đánh giá)

DELETE   /admin/dishes/{dishId}

| Mô tả | Bắt buộc xác nhận confirm=true. Nếu món đã có đánh giá/bình luận thì chỉ ẩn thay vì xóa hẳn (luồng 3a); phản hồi cho biết kết quả thực tế. |

| --- | --- |

| Use case | UC11 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |

| confirm | query | boolean | Có | Phải bằng true. |



Response 200 OK

Response thành công (success = true). data gồm: id, deleted, hidden, reason.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | CONFIRMATION_REQUIRED | Thiếu confirm=true. |

| 404 | DISH_NOT_FOUND | Món không tồn tại. |



4.10.6  Tải ảnh món ăn

POST   /admin/uploads/images

| Mô tả | Tải ảnh lên Supabase Storage. Content-Type: multipart/form-data, trường file; jpg/png/webp, tối đa 5 MB. Trả về URL để gán vào image_url. |

| --- | --- |

| Use case | UC11 |

| Quyền truy cập | Admin |



Response 201 Created

Response thành công (success = true). data gồm: url, width, height, size.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 413 | FILE_TOO_LARGE | Ảnh vượt dung lượng cho phép (luồng 5b). |

| 415 | UNSUPPORTED_MEDIA_TYPE | Sai định dạng ảnh (luồng 5b). |



4.11 Admin – Quản lý người dùng

Use case: UC12

Quản lý tài khoản, trạng thái và phân quyền. Mọi thao tác thay đổi đều yêu cầu xác nhận ở giao diện và được ghi nhật ký (audit log).

4.11.1  Danh sách người dùng

GET   /admin/users

| Mô tả | Danh sách tài khoản, tìm kiếm theo email/tên, lọc theo trạng thái và vai trò. |

| --- | --- |

| Use case | UC12 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| q | query | string | Không | Tìm theo email hoặc tên hiển thị. |

| status | query | enum | Không | active | locked. |

| role | query | enum | Không | user | admin. |

| sort | query | enum | Không | created_at (mặc định) | email | display_name. |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: id, email, display_name, role, status, created_at. meta: page, limit, total, total_pages.

4.11.2  Chi tiết người dùng

GET   /admin/users/{userId}

| Mô tả | Thông tin tài khoản và số liệu hoạt động (không trả về dữ liệu riêng tư như nội dung hội thoại). |

| --- | --- |

| Use case | UC12 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| userId | path | uuid | Có | Id người dùng. |



Response 200 OK

Response thành công (success = true). data gồm: id, email, display_name, role, status, created_at, stats{favorites, ratings, chat_sessions, violations}.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | USER_NOT_FOUND | Người dùng không tồn tại. |



4.11.3  Khóa / mở khóa tài khoản

PATCH   /admin/users/{userId}/status

| Mô tả | Đổi users.status. Khi khóa, mọi phiên đăng nhập hiện có bị hủy ngay. |

| --- | --- |

| Use case | UC12 |

| Quyền truy cập | Admin |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | Không được khóa chính mình (luồng 4a). |

| 2 | Không được khóa Admin cuối cùng đang hoạt động (luồng 4a). |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| userId | path | uuid | Có | Id người dùng. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| status | string | locked | Trạng thái. |

| reason | string | Bình luận vi phạm nhiều lần | Lý do. |



status: active | locked. reason bắt buộc khi khóa.

Response 200 OK

Response thành công (success = true). data gồm: id, status.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 403 | CANNOT_MODIFY_SELF | Thao tác lên chính tài khoản của mình. |

| 409 | LAST_ADMIN | Tác động lên Admin cuối cùng. |

| 404 | USER_NOT_FOUND | Người dùng không tồn tại. |



4.11.4  Đổi vai trò

PATCH   /admin/users/{userId}/role

| Mô tả | Phân quyền: user hoặc admin. Cùng các ràng buộc tự thao tác / Admin cuối cùng như trên. |

| --- | --- |

| Use case | UC12 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| userId | path | uuid | Có | Id người dùng. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| role | string | admin | Vai trò: user | admin. |



Response 200 OK

Response thành công (success = true). data gồm: id, role.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 403 | CANNOT_MODIFY_SELF | Thao tác lên chính mình. |

| 409 | LAST_ADMIN | Hạ quyền Admin cuối cùng. |

| 404 | USER_NOT_FOUND | Người dùng không tồn tại. |



4.11.5  Xóa tài khoản

DELETE   /admin/users/{userId}

| Mô tả | Xóa tài khoản vi phạm và dữ liệu cá nhân (như DELETE /me). Bắt buộc confirm=true. |

| --- | --- |

| Use case | UC12 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| userId | path | uuid | Có | Id người dùng. |

| confirm | query | boolean | Có | Phải bằng true. |



Response 204 No Content

Không có nội dung trả về.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | CONFIRMATION_REQUIRED | Thiếu confirm=true. |

| 403 | CANNOT_MODIFY_SELF | Thao tác lên chính mình. |

| 409 | LAST_ADMIN | Admin cuối cùng. |

| 404 | USER_NOT_FOUND | Người dùng không tồn tại. |



4.11.6  Nhật ký thao tác của Admin

GET   /admin/audit-logs

| Mô tả | Xem nhật ký các thao tác quản trị (khóa/mở khóa, đổi vai trò, xóa...). Cần bảng audit_logs (xem mục 7). |

| --- | --- |

| Use case | UC12 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| actor_id | query | uuid | Không | Lọc theo Admin thực hiện. |

| action | query | string | Không | Ví dụ user.lock, user.role_change, dish.delete. |

| from | query | date | Không | Từ ngày (YYYY-MM-DD). Mặc định 30 ngày trước. |

| to | query | date | Không | Đến ngày (YYYY-MM-DD). Mặc định hôm nay. |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: id, actor{id, display_name}, action, target_type, target_id, detail{reason}, created_at. meta: page, limit, total, total_pages.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_DATE_RANGE | from > to hoặc khoảng thời gian vượt quá 366 ngày. |



4.12 Admin – Giám sát chatbot

Use case: UC13

Theo dõi chất lượng và hoạt động của chatbot dựa trên chat_sessions, chat_messages (outcome, feedback, tokens). Cấu hình giới hạn lượt hỏi của khách và thông điệp hệ thống nằm ở API settings. Nhật ký hội thoại chi tiết chỉ gồm người dùng đã đăng nhập; chat chế độ khách (lưu tạm, không ghi chat_sessions) được theo dõi dưới dạng số liệu tổng hợp ở API tổng quan.

4.12.1  Tổng quan hoạt động chatbot

GET   /admin/chatbot/overview

| Mô tả | Số lượt hỏi, thời gian phản hồi, tỉ lệ lỗi và phản hồi của người dùng trong khoảng thời gian chọn. Không có dữ liệu thì các số bằng 0 và series rỗng (luồng 2a). |

| --- | --- |

| Use case | UC13 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| from | query | date | Không | Từ ngày (YYYY-MM-DD). Mặc định 30 ngày trước. |

| to | query | date | Không | Đến ngày (YYYY-MM-DD). Mặc định hôm nay. |



Response 200 OK

Response thành công (success = true). data gồm: total_sessions, total_messages, guest_messages, avg_response_ms, error_rate, outcomes{answered, no_match, out_of_scope, error}, feedback{like, dislike}, flagged_count, tokens_total, series{date, messages, errors}.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_DATE_RANGE | from > to hoặc khoảng thời gian vượt quá 366 ngày. |



4.12.2  Nhật ký hội thoại

GET   /admin/chatbot/conversations

| Mô tả | Danh sách hội thoại của người dùng đã đăng nhập, có lọc theo thời gian, trạng thái và từ khóa. Chat khách chỉ có số liệu tổng hợp ở GET /admin/chatbot/overview. |

| --- | --- |

| Use case | UC13 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| status | query | enum | Không | all (mặc định) | error | flagged | disliked. |

| q | query | string | Không | Tìm trong nội dung tin nhắn. |

| user_id | query | uuid | Không | Lọc theo người dùng. |

| from | query | date | Không | Từ ngày (YYYY-MM-DD). Mặc định 30 ngày trước. |

| to | query | date | Không | Đến ngày (YYYY-MM-DD). Mặc định hôm nay. |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: id, user{id, display_name}, title, message_count, has_error, flagged_count, updated_at. meta: page, limit, total, total_pages.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_DATE_RANGE | from > to hoặc khoảng thời gian vượt quá 366 ngày. |



4.12.3  Chi tiết hội thoại

GET   /admin/chatbot/conversations/{sessionId}

| Mô tả | Toàn bộ tin nhắn của một hội thoại, kèm outcome, feedback, tokens và trạng thái gắn cờ. |

| --- | --- |

| Use case | UC13 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| sessionId | path | uuid | Có | Id hội thoại. |



Response 200 OK

Response thành công (success = true). data gồm: id, user{id, display_name}, messages{id, role, content, referenced_dish_ids, feedback, feedback_reason, outcome, tokens, flagged, created_at}.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | CHAT_SESSION_NOT_FOUND | Hội thoại không tồn tại. |



4.12.4  Xem cấu hình chatbot

GET   /admin/chatbot/settings

| Mô tả | Cấu hình hiện hành của chatbot. |

| --- | --- |

| Use case | UC13 |

| Quyền truy cập | Admin |



Response 200 OK

Response thành công (success = true). data gồm: guest_message_limit, guest_window_hours, system_prompt, max_context_dishes, updated_by, updated_at.

4.12.5  Cập nhật cấu hình chatbot

PUT   /admin/chatbot/settings

| Mô tả | Điều chỉnh giới hạn lượt hỏi của chế độ khách và thông điệp hệ thống. Có hiệu lực ngay cho các lượt hỏi sau (bước 6). |

| --- | --- |

| Use case | UC13 |

| Quyền truy cập | Admin |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | guest_message_limit: số nguyên ≥ 0 (0 = tắt chatbot cho khách). |

| 2 | guest_window_hours: số nguyên 1–168. |

| 3 | system_prompt: không rỗng, tối đa 4000 ký tự. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| guest_message_limit | integer | 5 | Số lượt hỏi tối đa của khách (0 = tắt). |

| guest_window_hours | integer | 24 | Chu kỳ đặt lại hạn mức (giờ). |

| system_prompt | string | Bạn là trợ lý ẩm thực... | Thông điệp hệ thống của chatbot. |

| max_context_dishes | integer | 8 | Số món tối đa đưa vào ngữ cảnh của AI. |



Response 200 OK

Response thành công (success = true). data gồm: guest_message_limit, guest_window_hours, system_prompt, max_context_dishes, updated_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 422 | VALIDATION_ERROR | Cấu hình không hợp lệ, ví dụ giới hạn lượt hỏi âm; không lưu (luồng 5a). |



4.12.6  Gắn cờ câu trả lời không phù hợp

PATCH   /admin/chatbot/messages/{messageId}/flag

| Mô tả | Đánh dấu hoặc bỏ đánh dấu một câu trả lời của chatbot là không phù hợp. |

| --- | --- |

| Use case | UC13 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| messageId | path | uuid | Có | Id tin nhắn. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| flagged | boolean | true | Đã gắn cờ không phù hợp hay chưa. |

| reason | string | Gợi ý món chứa nguyên liệu người dùng dị ứng | Lý do. |



Response 200 OK

Response thành công (success = true). data gồm: id, flagged, flag_reason.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | MESSAGE_NOT_FOUND | Tin nhắn không tồn tại. |



4.12.7  Câu hỏi thường gặp

GET   /admin/chatbot/frequent-questions

| Mô tả | Các nhóm câu hỏi xuất hiện nhiều nhất (gom theo ý định/từ khóa). |

| --- | --- |

| Use case | UC13 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| limit | query | integer | Không | Mặc định 10. |

| from | query | date | Không | Từ ngày (YYYY-MM-DD). Mặc định 30 ngày trước. |

| to | query | date | Không | Đến ngày (YYYY-MM-DD). Mặc định hôm nay. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: question, count.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_DATE_RANGE | from > to hoặc khoảng thời gian vượt quá 366 ngày. |



4.12.8  Tình trạng dịch vụ AI

GET   /admin/chatbot/health

| Mô tả | Kiểm tra nhanh dịch vụ AI. Khi dịch vụ không phản hồi, API vẫn trả 200 với status = down để bảng giám sát hiển thị cảnh báo (luồng 5b). |

| --- | --- |

| Use case | UC13 |

| Quyền truy cập | Admin |



Response 200 OK

Response thành công (success = true). data gồm: status, latency_ms, model, checked_at.

4.13 Admin – Thống kê hệ thống

Use case: UC14

Số liệu tổng hợp từ users, dishes, favorites, ratings, view_history, interaction_logs, chat_sessions và chat_messages. Khoảng thời gian mặc định là 30 ngày gần nhất. Khi không có dữ liệu, API vẫn trả 200 với data rỗng/0 để client hiển thị «Chưa có dữ liệu» (luồng 4a).

4.13.1  Thống kê tổng quan

GET   /admin/stats/overview

| Mô tả | Các chỉ số chính của bảng điều khiển. |

| --- | --- |

| Use case | UC14 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| from | query | date | Không | Từ ngày (YYYY-MM-DD). Mặc định 30 ngày trước. |

| to | query | date | Không | Đến ngày (YYYY-MM-DD). Mặc định hôm nay. |



Response 200 OK

Response thành công (success = true). data gồm: range{from, to}, users{total, new, active}, visits, dishes{total, published}, favorites_new, ratings_new, chat{sessions, messages}.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_DATE_RANGE | from > to hoặc khoảng thời gian vượt quá 366 ngày. |



4.13.2  Món được xem/yêu thích nhiều

GET   /admin/stats/top-dishes

| Mô tả | Xếp hạng món theo lượt xem, lượt yêu thích hoặc điểm đánh giá. |

| --- | --- |

| Use case | UC14 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| by | query | enum | Không | views (mặc định) | favorites | rating. |

| limit | query | integer | Không | Mặc định 10, tối đa 50. |

| from | query | date | Không | Từ ngày (YYYY-MM-DD). Mặc định 30 ngày trước. |

| to | query | date | Không | Đến ngày (YYYY-MM-DD). Mặc định hôm nay. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: rank, dish{id, name, slug}, views, favorites, avg_rating.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_DATE_RANGE | from > to hoặc khoảng thời gian vượt quá 366 ngày. |



4.13.3  Biểu đồ theo thời gian

GET   /admin/stats/timeseries

| Mô tả | Chuỗi số liệu theo ngày/tuần/tháng cho biểu đồ. |

| --- | --- |

| Use case | UC14 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| metric | query | enum | Có | users | visits | searches | favorites | ratings | chat_messages. |

| interval | query | enum | Không | day (mặc định) | week | month. |

| from | query | date | Không | Từ ngày (YYYY-MM-DD). Mặc định 30 ngày trước. |

| to | query | date | Không | Đến ngày (YYYY-MM-DD). Mặc định hôm nay. |



Response 200 OK

Response thành công (success = true). data gồm: metric, interval, points{date, value}.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_DATE_RANGE | from > to hoặc khoảng thời gian vượt quá 366 ngày. |

| 400 | INVALID_QUERY | metric hoặc interval không hợp lệ. |



4.13.4  Xu hướng tìm kiếm

GET   /admin/stats/search-trends

| Mô tả | Từ khóa tìm kiếm phổ biến (từ interaction_logs với event_type = search). |

| --- | --- |

| Use case | UC14 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| limit | query | integer | Không | Mặc định 10, tối đa 50. |

| from | query | date | Không | Từ ngày (YYYY-MM-DD). Mặc định 30 ngày trước. |

| to | query | date | Không | Đến ngày (YYYY-MM-DD). Mặc định hôm nay. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: keyword, count, change_pct.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_DATE_RANGE | from > to hoặc khoảng thời gian vượt quá 366 ngày. |



4.13.5  Xuất báo cáo CSV/PDF

GET   /admin/stats/export

| Mô tả | Xuất báo cáo thống kê thành tệp. Response là tệp nhị phân với Content-Disposition: attachment, không bọc trong cấu trúc JSON chung. |

| --- | --- |

| Use case | UC14 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| type | query | enum | Có | overview | top-dishes | search-trends | chatbot-usage. |

| format | query | enum | Có | csv | pdf. |

| from | query | date | Không | Từ ngày (YYYY-MM-DD). Mặc định 30 ngày trước. |

| to | query | date | Không | Đến ngày (YYYY-MM-DD). Mặc định hôm nay. |



Response 200 OK

(Tệp: thong-ke-overview-2026-09-06_2026-10-06.csv)

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_DATE_RANGE | from > to hoặc khoảng thời gian vượt quá 366 ngày. |

| 400 | INVALID_QUERY | type hoặc format không hợp lệ. |

| 500 | EXPORT_FAILED | Lỗi truy vấn hoặc sinh tệp; cho phép thử lại (luồng 4b). |



4.14 Admin – Quản lý công thức

Use case: UC16

Công thức là phần nguyên liệu (dish_ingredients) và các bước chế biến của một món, quản lý riêng khỏi thông tin món ở mục 4.10. Mỗi món có tối đa một công thức, truy cập theo dishId. Admin nhập nguyên liệu bằng cách gõ tên: nguyên liệu đã có trong danh mục thì chọn từ gợi ý (gửi ingredient_id), chưa có thì gửi tên (name) và server tự tạo nguyên liệu mới khi lưu, không cần tạo trước (hệ thống không có API quản lý nguyên liệu riêng). Mỗi lần ghi được thực hiện trong một transaction (lỗi thì rollback, kể cả nguyên liệu mới) và cập nhật lại dish_embeddings để chatbot và gợi ý dùng dữ liệu mới.

4.14.1  Xem công thức của món

GET   /admin/dishes/{dishId}/recipe

| Mô tả | Công thức đầy đủ của một món để điền form sửa, kể cả món đang ẩn. |

| --- | --- |

| Use case | UC16 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |



Response 200 OK

Response thành công (success = true). data gồm: dish_id, servings, is_published, steps{order, content}, ingredients{ingredient_id, name, quantity, unit, is_optional, needs_review}, updated_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | DISH_NOT_FOUND | Món không tồn tại. |

| 404 | RECIPE_NOT_FOUND | Món chưa có công thức. |



4.14.2  Thêm công thức

POST   /admin/dishes/{dishId}/recipe

| Mô tả | Tạo công thức cho món chưa có công thức. Bắt buộc có ít nhất 1 bước (steps) và 1 nguyên liệu (ingredients). Mỗi nguyên liệu chọn từ danh mục (ingredient_id) hoặc gõ tên mới (name); không trùng nguyên liệu trong cùng công thức. |

| --- | --- |

| Use case | UC16 |

| Quyền truy cập | Admin |



Quy tắc nghiệp vụ

| # | Nội dung |

| --- | --- |

| 1 | Mỗi dòng nguyên liệu gửi ingredient_id (nguyên liệu đã chọn từ gợi ý) hoặc name (tên Admin gõ). Không cần tạo nguyên liệu trước. |

| 2 | Với name: server chuẩn hóa (chữ thường, bỏ dấu, bỏ khoảng trắng thừa) rồi tìm theo tên và tên gọi khác của nguyên liệu; có thì dùng lại, chưa có thì tạo nguyên liệu mới (default_unit lấy từ unit của dòng, allergen_group_id nếu có). |

| 3 | Nguyên liệu mới tạo mà không có allergen_group_id và không có no_allergen = true được đặt needs_review = true (chưa xác nhận nhóm dị ứng). Admin xác nhận sau bằng cách sửa công thức (PUT) và gửi allergen_group_id hoặc no_allergen = true cho dòng nguyên liệu đó; lưu thành công thì needs_review = false. |

| 4 | Việc tạo nguyên liệu mới nằm trong cùng transaction với lưu công thức: lưu lỗi thì nguyên liệu mới cũng không được tạo (luồng 7a). |

| 5 | Không được trùng nguyên liệu trong cùng công thức; kiểm tra sau khi quy về ingredient_id (gõ “Tôm” và chọn “tôm” là trùng). |

| 6 | quantity lớn hơn 0 và cho phép số thập phân; tính theo servings của món (sửa servings ở PUT /admin/dishes/{dishId}). |

| 7 | Ít nhất 1 bước và 1 nguyên liệu. order của bước không bắt buộc; không gửi thì lấy theo vị trí trong mảng. |

| 8 | publish = true: đặt món hiển thị công khai trong cùng transaction, Admin không phải quay lại mục quản lý món để bật hiển thị. |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| steps | array<object> |  | Các bước chế biến (ít nhất 1 bước). |

| steps[] | object |  |  |

| steps[].order | integer | 1 | Thứ tự bước, không bắt buộc; nếu không gửi thì theo vị trí trong mảng. Nếu gửi thì phải liên tục từ 1. |

| steps[].content | string | Ninh xương bò trong 60 phút... | Nội dung bước. |

| ingredients | array<object> |  | Danh sách nguyên liệu (ít nhất 1). |

| ingredients[] | object |  |  |

| ingredients[].ingredient_id | integer | 15 | Id nguyên liệu đã có trong danh mục (chọn từ gợi ý GET /ingredients). Mỗi dòng bắt buộc có ingredient_id hoặc name. |

| ingredients[].name | string | Tôm sú | Tên nguyên liệu Admin gõ khi nguyên liệu chưa có trong danh mục. Server tìm theo tên/tên gọi khác (không phân biệt hoa thường, dấu): có thì dùng lại, chưa có thì tạo mới. Bỏ qua nếu đã gửi ingredient_id. |

| ingredients[].allergen_group_id | integer | 6 | Nhóm dị ứng của nguyên liệu. Dùng khi tạo nguyên liệu mới (kèm name) hoặc khi xác nhận lại nguyên liệu đang needs_review = true. Nếu không gửi allergen_group_id lẫn no_allergen thì nguyên liệu mới có needs_review = true. |

| ingredients[].no_allergen | boolean | true | Xác nhận nguyên liệu không thuộc nhóm dị ứng nào (đặt needs_review = false). Bỏ qua nếu đã gửi allergen_group_id. |

| ingredients[].quantity | number | 0.5 | Số lượng, lớn hơn 0, cho phép số thập phân; tính theo servings của món. |

| ingredients[].unit | string | g | Đơn vị tính. Không gửi thì lấy default_unit của nguyên liệu; với nguyên liệu mới tạo thì unit này trở thành default_unit. |

| ingredients[].is_optional | boolean | false | Nguyên liệu không bắt buộc. |

| publish | boolean | true | Không bắt buộc, mặc định false. true: sau khi lưu, đặt món hiển thị công khai (is_published = true) trong cùng transaction. |



Response 201 Created

Response thành công (success = true). data gồm: dish_id, servings, is_published, steps{order, content}, ingredients{ingredient_id, name, quantity, unit, is_optional, needs_review}, new_ingredients{id, name, needs_review} (các nguyên liệu vừa được tạo mới, rỗng nếu không có), updated_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | DISH_NOT_FOUND | Món không tồn tại. |

| 409 | RECIPE_EXISTS | Món đã có công thức; dùng PUT để sửa. |

| 422 | VALIDATION_ERROR | Danh sách nguyên liệu hoặc bước trống; dòng thiếu cả ingredient_id lẫn name; ingredient_id không tồn tại; quantity không lớn hơn 0; order không liên tục; hoặc nguyên liệu bị trùng (sau khi quy về cùng một nguyên liệu). |



4.14.3  Sửa công thức

PUT   /admin/dishes/{dishId}/recipe

| Mô tả | Thay thế hoàn toàn nguyên liệu và các bước của công thức hiện có. Request body và quy tắc nghiệp vụ như POST /admin/dishes/{dishId}/recipe (gõ tên nguyên liệu mới cũng được tạo tự động). |

| --- | --- |

| Use case | UC16 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| steps | array<object> |  | Các bước chế biến (ít nhất 1 bước). |

| steps[] | object |  |  |

| steps[].order | integer | 1 | Thứ tự bước, không bắt buộc; nếu không gửi thì theo vị trí trong mảng. Nếu gửi thì phải liên tục từ 1. |

| steps[].content | string | Ninh xương bò trong 60 phút... | Nội dung bước. |

| ingredients | array<object> |  | Danh sách nguyên liệu (ít nhất 1). |

| ingredients[] | object |  |  |

| ingredients[].ingredient_id | integer | 15 | Id nguyên liệu đã có trong danh mục (chọn từ gợi ý GET /ingredients). Mỗi dòng bắt buộc có ingredient_id hoặc name. |

| ingredients[].name | string | Tôm sú | Tên nguyên liệu Admin gõ khi nguyên liệu chưa có trong danh mục. Server tìm theo tên/tên gọi khác (không phân biệt hoa thường, dấu): có thì dùng lại, chưa có thì tạo mới. Bỏ qua nếu đã gửi ingredient_id. |

| ingredients[].allergen_group_id | integer | 6 | Nhóm dị ứng của nguyên liệu. Dùng khi tạo nguyên liệu mới (kèm name) hoặc khi xác nhận lại nguyên liệu đang needs_review = true. Nếu không gửi allergen_group_id lẫn no_allergen thì nguyên liệu mới có needs_review = true. |

| ingredients[].no_allergen | boolean | true | Xác nhận nguyên liệu không thuộc nhóm dị ứng nào (đặt needs_review = false). Bỏ qua nếu đã gửi allergen_group_id. |

| ingredients[].quantity | number | 0.5 | Số lượng, lớn hơn 0, cho phép số thập phân; tính theo servings của món. |

| ingredients[].unit | string | g | Đơn vị tính. Không gửi thì lấy default_unit của nguyên liệu; với nguyên liệu mới tạo thì unit này trở thành default_unit. |

| ingredients[].is_optional | boolean | false | Nguyên liệu không bắt buộc. |

| publish | boolean | true | Không bắt buộc. Không gửi thì giữ nguyên trạng thái hiển thị hiện tại; true: đặt món hiển thị công khai (is_published = true) trong cùng transaction. |



Response 200 OK

Response thành công (success = true). data gồm: dish_id, servings, is_published, steps{order, content}, ingredients{ingredient_id, name, quantity, unit, is_optional, needs_review}, new_ingredients{id, name, needs_review} (các nguyên liệu vừa được tạo mới, rỗng nếu không có), updated_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | DISH_NOT_FOUND | Món không tồn tại. |

| 404 | RECIPE_NOT_FOUND | Món chưa có công thức; dùng POST để tạo. |

| 422 | VALIDATION_ERROR | Danh sách nguyên liệu hoặc bước trống; dòng thiếu cả ingredient_id lẫn name; ingredient_id không tồn tại; quantity không lớn hơn 0; hoặc nguyên liệu bị trùng. |



4.14.4  Xóa công thức

DELETE   /admin/dishes/{dishId}/recipe

| Mô tả | Bắt buộc xác nhận confirm=true. Xóa toàn bộ nguyên liệu và các bước của món. Món không có công thức thì không được hiển thị nên nếu đang hiển thị, hệ thống tự ẩn món (is_published = false); phản hồi cho biết kết quả. |

| --- | --- |

| Use case | UC16 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |

| confirm | query | boolean | Có | Phải bằng true. |



Response 200 OK

Response thành công (success = true). data gồm: dish_id, deleted, dish_hidden.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | CONFIRMATION_REQUIRED | Thiếu confirm=true. |

| 404 | DISH_NOT_FOUND | Món không tồn tại. |

| 404 | RECIPE_NOT_FOUND | Món chưa có công thức. |



5. Mục bổ sung – API phụ (làm sau)

Mục này gồm 21 API phụ, mô tả đầy đủ như API chính. Chúng không bắt buộc cho luồng nghiệp vụ chính: sau khi xong mục 4, hãy lọc trong bảng 5.0 những chức năng cần thiết rồi mới làm. Bỏ API nào thì chỉ cần bỏ phần mô tả tương ứng, các API chính không phụ thuộc vào chúng.

5.0 Danh sách và lý do xếp vào mục bổ sung

| API | Use case | Lý do xếp vào mục bổ sung |

| --- | --- | --- |

| GET /dishes/popular | UC02, UC08 | Có thể gộp vào GET /dishes?sort=popular; gợi ý dự phòng xử lý ngay trong /me/recommendations. |

| POST /interactions | UC02, UC04, UC08 | Chỉ phục vụ phân tích nâng cao; view_history đã tự ghi khi xem chi tiết món. |

| GET /chat/guest/quota | UC03 | Hạn mức lượt hỏi đã có trong response của POST /chat/guest/messages. |

| PATCH /me/taste-profile | UC06 | PUT /me/taste-profile đã đủ dùng. |

| PATCH /chat/sessions/{sessionId} | UC07 | Tiêu đề hội thoại có thể tự đặt từ tin nhắn đầu tiên. |

| DELETE /chat/sessions | UC10 | Đã có xóa từng hội thoại. |

| DELETE /me/favorites | UC10 | Đã có bỏ yêu thích từng món. |

| GET /me/ratings | UC10 | Tiện ích tra cứu lại đánh giá của mình. |

| GET /me/view-history | UC10 | Dữ liệu dùng nội bộ cho gợi ý; hiển thị cho người dùng là tính năng thêm. |

| DELETE /me/view-history | UC10 | Đi kèm GET /me/view-history. |

| GET /me/collections | UC10 | Ngoài đặc tả use case, chỉ có trong ERD. |

| POST /me/collections | UC10 | Ngoài đặc tả use case, chỉ có trong ERD. |

| GET /me/collections/{collectionId} | UC10 | Ngoài đặc tả use case, chỉ có trong ERD. |

| PATCH /me/collections/{collectionId} | UC10 | Ngoài đặc tả use case, chỉ có trong ERD. |

| DELETE /me/collections/{collectionId} | UC10 | Ngoài đặc tả use case, chỉ có trong ERD. |

| PUT /me/collections/{collectionId}/dishes/{dishId} | UC10 | Ngoài đặc tả use case, chỉ có trong ERD. |

| DELETE /me/collections/{collectionId}/dishes/{dishId} | UC10 | Ngoài đặc tả use case, chỉ có trong ERD. |

| PATCH /admin/dishes/{dishId}/publish | UC11 | DELETE đã tự ẩn món có đánh giá; đổi is_published cũng làm được qua PUT. |

| POST /admin/dishes/{dishId}/reindex | UC11 | Embedding được cập nhật tự động mỗi khi lưu món. |

| DELETE /admin/ratings/{ratingId} | UC12 | Xử lý vi phạm nâng cao; làm sau. |

| GET /admin/stats/chatbot-usage | UC14 | Số liệu chatbot đã có trong /admin/chatbot/overview. |



5.1 Món ăn

Use case: UC02, UC04

5.1.1  Món phổ biến / nổi bật

GET   /dishes/popular

| Mô tả | Danh sách món nổi bật (xếp theo lượt xem, yêu thích, điểm đánh giá). Dùng cho trang chủ của khách và làm gợi ý dự phòng cho người dùng mới. |

| --- | --- |

| Use case | UC02, UC08 |

| Quyền truy cập | Công khai |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| limit | query | integer | Không | Mặc định 12, tối đa 50. |

| category | query | string | Không | Lọc theo danh mục món (tên danh mục do Admin nhập; so khớp không phân biệt hoa thường và dấu). |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: id, name, slug, description, image_url, category, cook_time_minutes, difficulty, calories, avg_rating, rating_count, favorite_count.

5.1.2  Ghi nhận tương tác

POST   /interactions

| Mô tả | Ghi sự kiện hành vi vào interaction_logs để phục vụ gợi ý và thống kê: tìm kiếm, bấm vào món, bấm thẻ món trong chatbot. Xử lý bất đồng bộ, không chặn giao diện. |

| --- | --- |

| Use case | UC02, UC04, UC08 |

| Quyền truy cập | Công khai (có token thì gắn user_id) |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| event_type | string | chat_card_click | Loại sự kiện: view | click | search | chat_card_click | recommendation_click | share. |

| dish_id | uuid | b7e2c9a4-1d3f-4a68-8e5b-0c9f2d6a7b31 | Id món ăn. |

| context | object |  | Thông tin ngữ cảnh của sự kiện. |

| context.source | string | chatbot | Nguồn phát sinh sự kiện. |

| context.session_id | uuid | 5a9c3e17-8d42-4b06-9f1a-6e2d7c0b4a83 | Id hội thoại. |



event_type: view | click | search | chat_card_click | recommendation_click | share. Với search, context.query chứa từ khóa.

Response 202 Accepted

Không có nội dung trả về.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 422 | VALIDATION_ERROR | event_type không hợp lệ. |



5.2 Chatbot chế độ khách

Use case: UC03

5.2.1  Xem hạn mức lượt hỏi còn lại

GET   /chat/guest/quota

| Mô tả | Trả về số lượt hỏi còn lại của phiên khách để hiển thị trên khung chat. |

| --- | --- |

| Use case | UC03 |

| Quyền truy cập | Công khai (khách) |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| X-Guest-Id | header | string | Không | Định danh phiên khách. Thiếu thì trả về hạn mức mặc định. |



Response 200 OK

Response thành công (success = true). data gồm: limit, used, remaining, resets_at.

5.3 Hồ sơ khẩu vị

Use case: UC06

5.3.1  Cập nhật một phần hồ sơ khẩu vị

PATCH   /me/taste-profile

| Mô tả | Chỉ cập nhật các trường được gửi lên (ví dụ chỉ thêm dị ứng). Quy tắc kiểm tra giống PUT. |

| --- | --- |

| Use case | UC06 |

| Quyền truy cập | Người dùng |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| allergen_group_ids | array<integer> | [4,6] | Danh sách id nhóm dị ứng của người dùng. |



Response 200 OK

(Cùng cấu trúc như GET /me/taste-profile)

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 422 | PROFILE_CONFLICT | Dữ liệu mâu thuẫn. |



5.4 Chatbot cá nhân hóa

Use case: UC07

5.4.1  Đổi tên hội thoại

PATCH   /chat/sessions/{sessionId}

| Mô tả | Cập nhật tiêu đề hội thoại. |

| --- | --- |

| Use case | UC07 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| sessionId | path | uuid | Có | Id hội thoại. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| title | string | Thực đơn cuối tuần | Tiêu đề. |



Response 200 OK

Response thành công (success = true). data gồm: id, title, created_at, updated_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | CHAT_SESSION_NOT_FOUND | Hội thoại không tồn tại. |



5.4.2  Xóa toàn bộ lịch sử hội thoại

DELETE   /chat/sessions

| Mô tả | Xóa tất cả hội thoại của người dùng. Bắt buộc có confirm=true (luồng xác nhận 3b của UC10). |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| confirm | query | boolean | Có | Phải bằng true. |



Response 200 OK

Response thành công (success = true). data gồm: deleted_sessions.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | CONFIRMATION_REQUIRED | Thiếu confirm=true. |



5.5 Tài khoản & dữ liệu cá nhân

Use case: UC10

5.5.1  Xóa toàn bộ danh sách yêu thích

DELETE   /me/favorites

| Mô tả | Xóa tất cả món yêu thích. Bắt buộc confirm=true (luồng 3b). |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| confirm | query | boolean | Có | Phải bằng true. |



Response 200 OK

Response thành công (success = true). data gồm: deleted.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | CONFIRMATION_REQUIRED | Thiếu confirm=true. |



5.5.2  Đánh giá của tôi

GET   /me/ratings

| Mô tả | Các đánh giá/bình luận do người dùng viết. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: id, stars, comment, dish{id, name, slug, image_url}, created_at. meta: page, limit, total, total_pages.

5.5.3  Lịch sử xem món

GET   /me/view-history

| Mô tả | Các món đã xem (bảng view_history), xem gần nhất trước. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: dish{id, name, slug, description, image_url, category, cook_time_minutes, difficulty, calories, avg_rating, rating_count, favorite_count}, view_count, last_viewed_at. meta: page, limit, total, total_pages.

5.5.4  Xóa lịch sử xem

DELETE   /me/view-history

| Mô tả | Xóa toàn bộ lịch sử xem; gợi ý sẽ không còn dựa vào dữ liệu này. Bắt buộc confirm=true. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| confirm | query | boolean | Có | Phải bằng true. |



Response 200 OK

Response thành công (success = true). data gồm: deleted.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | CONFIRMATION_REQUIRED | Thiếu confirm=true. |



5.6 Bộ sưu tập món ăn (mở rộng)

Use case: UC10 (mở rộng)

5.6.1  Danh sách bộ sưu tập

GET   /me/collections

| Mô tả | Các bộ sưu tập của người dùng. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Response 200 OK

Response thành công (success = true). data là mảng, mỗi phần tử gồm: id, name, dish_count, created_at, updated_at.

5.6.2  Tạo bộ sưu tập

POST   /me/collections

| Mô tả | Tạo bộ sưu tập mới. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| name | string | Món cuối tuần | Tên. |



Response 201 Created

Response thành công (success = true). data gồm: id, name, dish_count.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 422 | VALIDATION_ERROR | Tên rỗng hoặc dài quá 100 ký tự. |



5.6.3  Chi tiết bộ sưu tập

GET   /me/collections/{collectionId}

| Mô tả | Thông tin bộ sưu tập và danh sách món bên trong. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| collectionId | path | uuid | Có | Id bộ sưu tập. |

| page | query | integer | Không | Trang hiện tại, mặc định 1. |

| limit | query | integer | Không | Số bản ghi mỗi trang, mặc định 20, tối đa 100. |



Response 200 OK

Response thành công (success = true). data gồm: id, name, dishes{id, name, slug, description, image_url, category, cook_time_minutes, difficulty, calories, avg_rating, rating_count, favorite_count, is_favorite}. meta: page, limit, total, total_pages.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | COLLECTION_NOT_FOUND | Bộ sưu tập không tồn tại. |



5.6.4  Đổi tên bộ sưu tập

PATCH   /me/collections/{collectionId}

| Mô tả | Cập nhật tên. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| collectionId | path | uuid | Có | Id bộ sưu tập. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| name | string | Món đãi khách | Tên. |



Response 200 OK

Response thành công (success = true). data gồm: id, name.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | COLLECTION_NOT_FOUND | Bộ sưu tập không tồn tại. |



5.6.5  Xóa bộ sưu tập

DELETE   /me/collections/{collectionId}

| Mô tả | Xóa bộ sưu tập (các món gốc không bị ảnh hưởng). |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| collectionId | path | uuid | Có | Id bộ sưu tập. |



Response 204 No Content

Không có nội dung trả về.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | COLLECTION_NOT_FOUND | Bộ sưu tập không tồn tại. |



5.6.6  Thêm món vào bộ sưu tập

PUT   /me/collections/{collectionId}/dishes/{dishId}

| Mô tả | Thêm món (idempotent). |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| collectionId | path | uuid | Có | Id bộ sưu tập. |

| dishId | path | uuid | Có | Id món ăn. |



Response 200 OK

Response thành công (success = true). data gồm: collection_id, dish_id, added_at.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | COLLECTION_NOT_FOUND | Bộ sưu tập hoặc món không tồn tại. |



5.6.7  Bỏ món khỏi bộ sưu tập

DELETE   /me/collections/{collectionId}/dishes/{dishId}

| Mô tả | Gỡ món khỏi bộ sưu tập. |

| --- | --- |

| Use case | UC10 |

| Quyền truy cập | Người dùng |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| collectionId | path | uuid | Có | Id bộ sưu tập. |

| dishId | path | uuid | Có | Id món ăn. |



Response 204 No Content

Không có nội dung trả về.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | COLLECTION_NOT_FOUND | Không tìm thấy. |



5.7 Admin – Quản lý món ăn

Use case: UC11

5.7.1  Ẩn / hiển thị món

PATCH   /admin/dishes/{dishId}/publish

| Mô tả | Đổi is_published. Món bị ẩn biến mất khỏi tìm kiếm, gợi ý và câu trả lời chatbot nhưng dữ liệu đánh giá được giữ nguyên. Chỉ hiển thị được món đã có công thức (mục 4.14). |

| --- | --- |

| Use case | UC11 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |



Request body (application/json)

| Trường | Kiểu | Ví dụ | Mô tả |

| --- | --- | --- | --- |

| is_published | boolean | false | Món đang hiển thị công khai. |



Response 200 OK

Response thành công (success = true). data gồm: id, is_published.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | DISH_NOT_FOUND | Món không tồn tại. |

| 422 | RECIPE_REQUIRED | Đặt is_published = true khi món chưa có công thức. |



5.7.2  Cập nhật lại embedding của món

POST   /admin/dishes/{dishId}/reindex

| Mô tả | Tính lại vector tìm kiếm cho một món (bảng dish_embeddings) bằng mô hình gemini-embedding-2 (768 chiều). Dùng khi đổi mô hình embedding hoặc khi tác vụ tự động bị lỗi. |

| --- | --- |

| Use case | UC11 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| dishId | path | uuid | Có | Id món ăn. |



Response 202 Accepted

Response thành công (success = true). data gồm: dish_id, status.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | DISH_NOT_FOUND | Món không tồn tại. |



5.8 Admin – Quản lý người dùng

Use case: UC12

5.8.1  Gỡ bình luận vi phạm

DELETE   /admin/ratings/{ratingId}

| Mô tả | Xóa đánh giá/bình luận của người dùng khác (xử lý nội dung vi phạm), có ghi nhật ký. |

| --- | --- |

| Use case | UC12 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| ratingId | path | integer | Có | Id đánh giá. |



Response 204 No Content

Không có nội dung trả về.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 404 | RATING_NOT_FOUND | Đánh giá không tồn tại. |



5.9 Admin – Thống kê hệ thống

Use case: UC14

5.9.1  Thống kê sử dụng chatbot

GET   /admin/stats/chatbot-usage

| Mô tả | Số hội thoại, tin nhắn theo nhóm khách/người dùng và tổng token tiêu thụ. |

| --- | --- |

| Use case | UC14 |

| Quyền truy cập | Admin |



Tham số

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |

| --- | --- | --- | --- | --- |

| from | query | date | Không | Từ ngày (YYYY-MM-DD). Mặc định 30 ngày trước. |

| to | query | date | Không | Đến ngày (YYYY-MM-DD). Mặc định hôm nay. |



Response 200 OK

Response thành công (success = true). data gồm: guest_messages, user_messages, sessions, tokens_total, avg_messages_per_session.

Mã lỗi riêng

| HTTP | Mã lỗi (error.code) | Khi nào |

| --- | --- | --- |

| 400 | INVALID_DATE_RANGE | from > to hoặc khoảng thời gian vượt quá 366 ngày. |



6. Ánh xạ bảng ERD → API

Bảng cho biết mỗi bảng trong ERD được đọc/ghi bởi nhóm API nào, để kiểm tra không sót bảng nào. API ghi «bổ sung» thuộc mục 5.

| Bảng | API sử dụng |

| --- | --- |

| users | Đăng ký, đăng nhập, làm mới token, đặt lại mật khẩu, /me, /admin/users |

| user_profiles | /me/taste-profile; taste_vector được tính lại bất đồng bộ |

| user_diets, user_allergies, user_disliked_ingredients | /me/taste-profile (mảng diet_type_ids, allergen_group_ids, disliked_ingredient_ids) |

| diet_types, allergen_groups, tags | /meta/filters; dữ liệu khởi tạo sẵn (seed), không có API quản trị |

| dishes.category (văn bản) | /meta/filters (danh sách danh mục); lọc /dishes theo category; Admin tự nhập ở POST/PUT /admin/dishes |

| ingredients | /ingredients; /admin/dishes/{dishId}/recipe (tạo nguyên liệu mới khi Admin gõ tên chưa có); bộ lọc nguyên liệu của /dishes |

| dishes, dish_ingredients, dish_tags | /dishes, /dishes/{idOrSlug}; /admin/dishes (thông tin món, thẻ); /admin/dishes/{dishId}/recipe (công thức: dish_ingredients và các bước chế biến) |

| dish_embeddings | Tự cập nhật khi lưu món; nguồn cho chatbot và gợi ý; /admin/dishes/{id}/reindex (API bổ sung) |

| favorites | /dishes/{id}/favorite; /me/favorites |

| ratings | /dishes/{id}/ratings; PATCH, DELETE /ratings/{id}; /me/ratings (API bổ sung, mục 5) |

| collections, collection_dishes | /me/collections (API bổ sung, mục 5) |

| view_history | Ghi khi xem chi tiết món; thống kê món xem nhiều; /me/view-history (API bổ sung) |

| interaction_logs | /admin/stats/overview, /admin/stats/top-dishes, /admin/stats/timeseries, /admin/stats/search-trends, /admin/stats/export; POST /interactions và /admin/stats/chatbot-usage (API bổ sung) |

| chat_sessions, chat_messages | /chat/sessions*; /admin/chatbot/*; POST /chat/messages/{id}/feedback; PATCH /admin/chatbot/messages/{id}/flag |



7. Đề xuất bổ sung ERD & lưu ý triển khai

Khi đối chiếu use case với ERD hiện tại, một số chức năng cần thêm cột hoặc bảng. Các mục dưới đây là điều kiện để API hoạt động đầy đủ; mục nào chỉ phục vụ API bổ sung thì có thể làm sau.

| # | Nội dung | Phục vụ | Đề xuất |

| --- | --- | --- | --- |

| 1 | Bảng users chưa có mật khẩu băm, ảnh đại diện | UC01, UC05, UC10 | Dùng Supabase Auth cho mật khẩu; thêm avatar_url vào users hoặc user_profiles. Nếu tự quản lý: thêm password_hash. |

| 2 | Chưa có nơi lưu token đặt lại mật khẩu | UC15 | Bảng password_reset_tokens(id, user_id, token_hash, expires_at, used_at) hoặc dùng cơ chế của Supabase Auth. |

| 3 | Chưa theo dõi số lần đăng nhập sai | UC05 (2c) | Thêm failed_login_count, locked_until ở users hoặc dùng Redis. |

| 4 | Cờ câu trả lời không phù hợp và thời gian phản hồi | UC13 | Thêm vào chat_messages: flagged, flag_reason, flagged_by, latency_ms. |

| 5 | Cấu hình chatbot (giới hạn lượt hỏi khách, system prompt) | UC13 | Bảng app_settings(key, value jsonb, updated_by, updated_at). |

| 6 | Nhật ký thao tác của Admin | UC12 | Bảng audit_logs(id, actor_id, action, target_type, target_id, detail jsonb, created_at). |

| 7 | Danh sách từ ngữ bị cấm cho bình luận | UC09 (2a) | Bảng banned_words hoặc tệp cấu hình. |

| 8 | Mỗi người một đánh giá cho mỗi món | UC09 | Ràng buộc UNIQUE(user_id, dish_id) trên ratings; ratings.user_id cho phép NULL để ẩn danh khi xóa tài khoản. |

| 9 | avg_rating, rating_count, favorite_count | UC02, UC04, UC09 | Tính bằng view/materialized view hoặc cột denormalized cập nhật bằng trigger. |

| 10 | referenced_dish_ids đang là text | UC07 | Đổi sang uuid[] hoặc jsonb để truy vấn được. |

| 11 | difficulty, role, status, event_type, feedback, outcome đang là text | Nhiều UC | Thêm CHECK constraint theo các giá trị liệt kê trong tài liệu (easy|medium|hard; user|admin; active|locked...). |

| 12 | Lượt truy cập hệ thống | UC14 | Ghi event_type = page_view vào interaction_logs hoặc dùng bảng riêng. |

| 13 | Chat chế độ khách không lưu DB | UC03 | Lưu tạm theo X-Guest-Id trong cache (Redis/bộ nhớ) với TTL 24 giờ. |

| 14 | Danh mục món là trường văn bản Admin tự nhập; không dùng vùng miền | UC02, UC11 | Bỏ bảng regions và categories, cột dishes.region_id và user_profiles.preferred_region_id. Thêm dishes.category (varchar(100), NOT NULL) và cột chuẩn hóa category_normalized (chữ thường, bỏ dấu, gộp khoảng trắng) có index để lọc và gom nhóm. |

| 15 | Công thức tách khỏi thông tin món | UC11, UC16 | Mỗi món tối đa một công thức. Nếu các bước (steps) đang là cột jsonb của dishes thì API công thức ghi thẳng vào đó; nên tách bảng recipe_steps(dish_id, step_order, content) và dùng dish_ingredients cho nguyên liệu, ghi trong một transaction. |

| 16 | Tạo nguyên liệu ngay khi nhập công thức | UC16 | Bảng ingredients thêm needs_review (boolean, mặc định false), normalized_name (UNIQUE; chữ thường, bỏ dấu) và created_by; aliases cũng được chuẩn hóa để so khớp tên. dish_ingredients.quantity dùng numeric(10,2) thay vì integer. |



Lưu ý bảo mật

| # | Nội dung |

| --- | --- |

| 1 | Băm mật khẩu bằng bcrypt/argon2; không ghi mật khẩu, token vào log. |

| 2 | Kiểm tra quyền ở server cho mọi API /admin và mọi tài nguyên thuộc người dùng. |

| 3 | Dùng truy vấn tham số hóa; làm sạch nội dung bình luận và tin nhắn chatbot trước khi hiển thị. |

| 4 | Chatbot chỉ nhận ngữ cảnh cần thiết (hồ sơ khẩu vị, món liên quan), không gửi email, mật khẩu hay dữ liệu định danh sang dịch vụ AI. |

| 5 | Bật CORS chỉ cho tên miền frontend; bắt buộc HTTPS ở môi trường thật. |

