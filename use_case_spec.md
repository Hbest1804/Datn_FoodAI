ĐẶC TẢ USE CASE

Hệ thống trợ lý ẩm thực thông minh tích hợp chatbot AI hỗ trợ tư vấn và gợi ý món ăn cá nhân hóa

1. Tác nhân

| STT | Tác nhân | Mô tả |

| --- | --- | --- |

| 1 | Khách vãng lai | Người chưa đăng nhập. Xem, tìm kiếm món ăn (kể cả tìm theo nguyên liệu có sẵn), và dùng chatbot ở chế độ hạn chế. |

| 2 | Người dùng (đã đăng nhập) | Có tài khoản. Sử dụng đầy đủ các tính năng cá nhân hóa: hồ sơ khẩu vị, chatbot cá nhân hóa, gợi ý, yêu thích, đánh giá. |

| 3 | Quản trị viên (Admin) | Quản lý món ăn (kể cả danh mục món tự nhập), công thức, người dùng, giám sát chatbot và xem thống kê hệ thống. |



2. Biểu đồ use case

Hình 1. Biểu đồ use case tổng quát

3. Danh sách use case

| Mã | Tên use case | Tác nhân |

| --- | --- | --- |

| UC01 | Đăng ký tài khoản | Khách vãng lai |

| UC02 | Tìm kiếm & lọc món ăn | Khách vãng lai, Người dùng |

| UC03 | Trò chuyện với chatbot (chế độ khách, hạn chế) | Khách vãng lai |

| UC04 | Xem chi tiết món ăn & công thức | Khách vãng lai, Người dùng |

| UC05 | Đăng nhập / đăng xuất | Khách vãng lai, Người dùng, Quản trị viên |

| UC06 | Quản lý hồ sơ khẩu vị | Người dùng |

| UC07 | Trò chuyện với chatbot (cá nhân hóa đầy đủ) | Người dùng |

| UC08 | Nhận gợi ý cá nhân hóa | Người dùng |

| UC09 | Yêu thích, đánh giá & bình luận món | Người dùng |

| UC10 | Quản lý dữ liệu cá nhân | Người dùng |

| UC11 | Quản lý món ăn | Quản trị viên |

| UC12 | Quản lý người dùng | Quản trị viên |

| UC13 | Giám sát chatbot | Quản trị viên |

| UC14 | Xem thống kê hệ thống | Quản trị viên |

| UC15 | Quên mật khẩu / khôi phục mật khẩu | Khách vãng lai |

| UC16 | Quản lý công thức | Quản trị viên |



4. Quan hệ giữa các use case

| Use case nguồn | Quan hệ | Use case đích | Ghi chú |

| --- | --- | --- | --- |

| UC03 | «extend» | UC01 / UC05 | Khi vượt giới hạn lượt hỏi, khách được mời đăng ký/đăng nhập. |

| UC03, UC07 | «extend» | UC04 | Từ thẻ món ăn trong câu trả lời, người dùng mở xem chi tiết món. |

| UC02, UC08 | «extend» | UC04 | Chọn một món từ danh sách kết quả/gợi ý để xem chi tiết. |

| UC03, UC07 | «extend» | UC02 | Tại “Nguyên liệu có sẵn”, người dùng nhấn “Chuyển sang Chatbot AI với nguyên liệu này”; chatbot nhận danh sách nguyên liệu làm ngữ cảnh. |

| UC08 | «extend» | UC06 | Người dùng mới chưa có dữ liệu được nhắc hoàn thiện hồ sơ khẩu vị. |

| UC07, UC08 | Phụ thuộc dữ liệu | UC06 | Đọc hồ sơ khẩu vị làm ngữ cảnh cá nhân hóa; không chạy lại UC06 nên không phải «include». |

| UC09 | «extend» | UC04 | Người dùng đã đăng nhập có thêm chức năng yêu thích/đánh giá/bình luận. |

| UC06 – UC10 | «include» | UC05 | Yêu cầu đã đăng nhập. |

| UC15 | «extend» | UC05 | Tại màn hình đăng nhập, người dùng chọn "Quên mật khẩu" khi không nhớ mật khẩu. |

| UC11 – UC14, UC16 | «include» | UC05 | Yêu cầu Admin đã đăng nhập. |

| UC16 | «include» | UC11 | Admin chọn món ăn cần thêm/sửa/xóa công thức; công thức luôn gắn với một món đã tồn tại. |



5. Đặc tả chi tiết các use case

5.1. UC01 – Đăng ký tài khoản

| UC01 – Đăng ký tài khoản |  |

| --- | --- |

| Mã use case | UC01 |

| Tên use case | Đăng ký tài khoản |

| Tác nhân | Khách vãng lai |

| Mô tả | Khách tạo tài khoản mới để sử dụng các chức năng cá nhân hóa, quản lý hồ sơ khẩu vị, lưu món yêu thích và lưu lịch sử hội thoại. |

| Tiền điều kiện | – Khách chưa đăng nhập.– Dịch vụ xác thực đang hoạt động. |

| Hậu điều kiện | – Tài khoản được tạo thành công thông qua Supabase Auth.– Hồ sơ người dùng được khởi tạo theo thiết kế hệ thống.– Người dùng có thể đăng nhập khi đáp ứng các điều kiện xác thực, bao gồm xác minh email nếu chức năng này được bật. |

| Luồng sự kiện chính | 1.Khách chọn chức năng “Đăng ký”.2.Hệ thống hiển thị biểu mẫu gồm họ tên, email, mật khẩu và xác nhận mật khẩu.3.Khách nhập thông tin và gửi biểu mẫu.4.Hệ thống kiểm tra dữ liệu bắt buộc, định dạng email, chính sách mật khẩu và sự trùng khớp giữa mật khẩu với phần xác nhận.5.Hệ thống yêu cầu Supabase Auth tạo tài khoản.6.Hệ thống khởi tạo hồ sơ người dùng nếu cần.7.Hệ thống thông báo kết quả và hướng dẫn khách đăng nhập hoặc xác minh email nếu được yêu cầu. |

| Luồng thay thế / ngoại lệ | 4a.Email sai định dạng: hệ thống thông báo lỗi tại trường email.4b.Mật khẩu không đáp ứng yêu cầu hoặc không khớp phần xác nhận: hệ thống yêu cầu nhập lại.5a.Email đã được đăng ký: hệ thống thông báo tài khoản không thể được tạo với email đó.5b.Dịch vụ xác thực gặp lỗi: hệ thống thông báo lỗi và cho phép thử lại.6a.Không thể khởi tạo hồ sơ người dùng: hệ thống ghi nhận lỗi để xử lý và tránh tạo hồ sơ trùng khi người dùng thử lại. |



5.2. UC02 – Tìm kiếm & lọc món ăn

| UC02 – Tìm kiếm & lọc món ăn |  |

| --- | --- |

| Mã use case | UC02 |

| Tên use case | Tìm kiếm & lọc món ăn |

| Tác nhân | Khách vãng lai, Người dùng |

| Mô tả | Người dùng tìm kiếm món ăn theo từ khóa và lọc theo danh mục, thời gian nấu, độ khó, khẩu vị, dinh dưỡng và nguyên liệu. Ngoài các bộ lọc thông thường, người dùng có thể chọn hoặc nhập danh sách nguyên liệu có sẵn để tìm món có thể chế biến. Danh sách nguyên liệu này chỉ được sử dụng tạm thời trên giao diện, không tự động lưu vào tài khoản. Danh sách danh mục dùng để lọc được lấy từ danh mục mà quản trị viên đã nhập cho các món đang hiển thị. |

| Tiền điều kiện | – Hệ thống có dữ liệu món ăn được phép hiển thị.– Dữ liệu nguyên liệu và các thẻ lọc phục vụ tìm kiếm đã được khởi tạo. |

| Hậu điều kiện | – Danh sách món ăn phù hợp được hiển thị.– Khi tìm theo nguyên liệu có sẵn, mỗi món hiển thị số nguyên liệu đã có và còn thiếu dựa trên công thức được lưu trong cơ sở dữ liệu. |

| Luồng sự kiện chính | 1.Người dùng nhập từ khóa và/hoặc chọn các điều kiện lọc như danh mục, thời gian nấu, độ khó, khẩu vị, dinh dưỡng và nguyên liệu.2.Hệ thống kiểm tra điều kiện tìm kiếm và truy vấn cơ sở dữ liệu.3.Hệ thống sắp xếp và hiển thị kết quả gồm hình ảnh, tên món, mô tả ngắn và thông tin đánh giá nếu có.4.Hệ thống cung cấp chức năng phân trang, sắp xếp và điều chỉnh bộ lọc.5.Người dùng chọn món để xem chi tiết (UC04) hoặc tiếp tục thay đổi điều kiện tìm kiếm. |

| Luồng thay thế / ngoại lệ | 1a.Người dùng mở chức năng “Nguyên liệu có sẵn”, chọn nguyên liệu từ danh mục hoặc nhập nguyên liệu khác rồi nhấn “Thêm”. Người dùng có thể xóa từng nguyên liệu hoặc chọn “Xóa tất cả”.1b.Hệ thống cập nhật danh sách nguyên liệu đang có, truy vấn các công thức liên quan và hiển thị số món tìm được. Món được xếp hạng theo mức độ đáp ứng nguyên liệu, ưu tiên món có nhiều nguyên liệu bắt buộc đã có và ít nguyên liệu bắt buộc còn thiếu.1c.Nguyên liệu nhập tự do chưa có trong danh mục vẫn được giữ trong danh sách tạm thời để chuyển sang chatbot. Tuy nhiên, hệ thống không tự động coi nguyên liệu đó là dữ liệu đã được xác minh hoặc là nguyên liệu khớp trong công thức.2a.Không tìm thấy kết quả: hệ thống thông báo “Không tìm thấy món phù hợp” và gợi ý điều chỉnh điều kiện tìm kiếm.2b.Khi tìm theo nguyên liệu có sẵn nhưng không có kết quả, hệ thống cung cấp tùy chọn “Chuyển sang Chatbot AI với nguyên liệu này”.3a.Người dùng chọn tùy chọn chuyển sang chatbot: hệ thống mở UC03 nếu là khách vãng lai hoặc UC07 nếu đã đăng nhập, đồng thời truyền danh sách nguyên liệu làm ngữ cảnh.4a.Người dùng đã đăng nhập nhấn biểu tượng yêu thích trên thẻ món: hệ thống thực hiện UC09.4b.Khách vãng lai nhấn biểu tượng yêu thích: hệ thống yêu cầu đăng nhập (UC05).5a.Điều kiện tìm kiếm không hợp lệ: hệ thống thông báo lỗi và yêu cầu người dùng điều chỉnh. |



5.3. UC03 – Trò chuyện với chatbot (chế độ khách, hạn chế)

| UC03 – Trò chuyện với chatbot (chế độ khách, hạn chế) |  |

| --- | --- |

| Mã use case | UC03 |

| Tên use case | Trò chuyện với chatbot (chế độ khách, hạn chế) |

| Tác nhân | Khách vãng lai |

| Mô tả | Khách hỏi chatbot về món ăn, công thức, nguyên liệu và các gợi ý ẩm thực chung. Chế độ khách không sử dụng hồ sơ khẩu vị cá nhân của thành viên và bị giới hạn số lượt hỏi. |

| Tiền điều kiện | – Dịch vụ chatbot đã được cấu hình.– Khách có thể truy cập chức năng trò chuyện.– Giới hạn lượt hỏi được cấu hình và kiểm tra tại backend. |

| Hậu điều kiện | – Câu trả lời được hiển thị cho khách.– Lịch sử hội thoại được duy trì trong phạm vi phiên khách và theo chính sách lưu trữ của hệ thống.– Hội thoại khách không tự động được gắn vào tài khoản thành viên nếu chưa có chức năng chuyển đổi được triển khai. |

| Luồng sự kiện chính | 1.Khách mở khung chat và nhập câu hỏi.2.Hệ thống kiểm tra phiên khách, giới hạn lượt hỏi và tính hợp lệ của câu hỏi.3.Hệ thống xác định ngữ cảnh cần thiết và truy hồi dữ liệu món ăn liên quan từ cơ sở dữ liệu nếu phù hợp.4.Hệ thống gửi câu hỏi cùng ngữ cảnh cần thiết tới mô hình AI.5.Hệ thống kiểm tra kết quả trả về và hiển thị câu trả lời. Nếu có món phù hợp trong cơ sở dữ liệu, hệ thống đính kèm thẻ món tương ứng.6.Khách tiếp tục hội thoại hoặc chọn món được gợi ý để xem chi tiết (UC04). |

| Luồng thay thế / ngoại lệ | 1a.Khách mở chatbot từ chức năng “Nguyên liệu có sẵn” (UC02): hệ thống truyền danh sách nguyên liệu làm ngữ cảnh. Chatbot ưu tiên tư vấn dựa trên danh sách này nhưng vẫn tuân thủ giới hạn lượt hỏi.2a.Khách vượt giới hạn lượt hỏi: hệ thống thông báo đã đạt giới hạn và mời đăng ký hoặc đăng nhập (UC01, UC05).2b.Phiên khách hết hạn hoặc không hợp lệ: hệ thống yêu cầu khởi tạo phiên mới.2c.Chatbot khách đang tắt (Admin đặt giới hạn lượt hỏi bằng 0): hệ thống thông báo chatbot khách tạm thời không khả dụng và mời đăng ký hoặc đăng nhập (UC01, UC05).3a.Không tìm được món phù hợp trong cơ sở dữ liệu: chatbot có thể đưa ra tư vấn chung hoặc sáng tạo công thức dưới dạng văn bản, nhưng không tạo thẻ món chính thức cho món chưa tồn tại trong cơ sở dữ liệu.4a.Dịch vụ AI gặp lỗi hoặc quá thời gian chờ: hệ thống thông báo lỗi thân thiện và cho phép gửi lại câu hỏi.5a.Câu hỏi ngoài phạm vi ẩm thực: chatbot từ chối lịch sự và hướng người dùng về chủ đề được hỗ trợ.5b.Kết quả AI không hợp lệ hoặc không đáp ứng điều kiện an toàn: hệ thống không hiển thị kết quả đó như một gợi ý đã được xác minh. |



5.4. UC04 – Xem chi tiết món ăn & công thức

| UC04 – Xem chi tiết món ăn & công thức |  |

| --- | --- |

| Mã use case | UC04 |

| Tên use case | Xem chi tiết món ăn & công thức |

| Tác nhân | Khách vãng lai, Người dùng |

| Mô tả | Xem thông tin chi tiết của một món: hình ảnh, mô tả, nguyên liệu, các bước chế biến, thời gian, khẩu phần, dinh dưỡng, đánh giá và bình luận. |

| Tiền điều kiện | Món ăn tồn tại và đang được hiển thị. |

| Hậu điều kiện | Thông tin chi tiết của món được hiển thị; với người dùng đã đăng nhập, lượt xem được ghi vào lịch sử xem để phục vụ gợi ý (UC08). |

| Luồng sự kiện chính | 1.Người dùng chọn một món từ danh sách hoặc từ chatbot.2.Hệ thống tải thông tin món ăn.3.Hệ thống hiển thị trang chi tiết cùng đánh giá, bình luận và các món liên quan. |

| Luồng thay thế / ngoại lệ | 2a.Món không tồn tại hoặc đã bị ẩn: hiển thị thông báo và quay lại danh sách.3a.Người dùng đã đăng nhập thấy thêm nút Yêu thích / Đánh giá / Bình luận (UC09). |



5.5. UC05 – Đăng nhập / đăng xuất

| UC05 – Đăng nhập / đăng xuất |  |

| --- | --- |

| Mã use case | UC05 |

| Tên use case | Đăng nhập / đăng xuất |

| Tác nhân | Khách vãng lai, Người dùng, Quản trị viên |

| Mô tả | Cho phép người dùng xác thực để truy cập các chức năng riêng tư và kết thúc phiên làm việc. Hệ thống xác định vai trò để cấp quyền truy cập phù hợp. |

| Tiền điều kiện | – Đăng nhập: người dùng có tài khoản hợp lệ.– Đăng xuất: người dùng đang có phiên đăng nhập. |

| Hậu điều kiện | – Đăng nhập thành công: Supabase Auth xác thực người dùng và cung cấp phiên xác thực; hệ thống xác định vai trò để điều hướng đến khu vực tương ứng.– Đăng xuất thành công: hệ thống thực hiện đăng xuất, cập nhật trạng thái phiên trên giao diện và chuyển người dùng về chế độ khách. |

| Luồng sự kiện chính | Đăng nhập1.Khách vãng lai hoặc người dùng chưa đăng nhập chọn “Đăng nhập”.2.Hệ thống hiển thị biểu mẫu email và mật khẩu.3.Người dùng nhập thông tin và gửi biểu mẫu.4.Hệ thống yêu cầu Supabase Auth xác thực thông tin.5.Hệ thống xác định vai trò và điều hướng người dùng đến trang chủ hoặc khu vực quản trị tương ứng.Đăng xuất1.Người dùng chọn “Đăng xuất”.2.Hệ thống thực hiện đăng xuất thông qua Supabase Auth.3.Giao diện xóa trạng thái xác thực cục bộ phù hợp và chuyển về chế độ khách. |

| Luồng thay thế / ngoại lệ | 4a.Email hoặc mật khẩu không chính xác: hệ thống thông báo lỗi và cho phép nhập lại.4b.Tài khoản bị khóa hoặc không được phép truy cập: hệ thống từ chối đăng nhập và thông báo phù hợp.4c.Dịch vụ xác thực không khả dụng: hệ thống thông báo lỗi và cho phép thử lại.4d.Người dùng quên mật khẩu: chọn “Quên mật khẩu” để thực hiện UC15.5a.Phiên xác thực hết hạn: hệ thống yêu cầu đăng nhập lại khi người dùng truy cập chức năng cần xác thực.5b.Người dùng không có quyền quản trị: hệ thống từ chối truy cập các chức năng quản trị dù giao diện có gửi yêu cầu tới API quản trị. |



5.6. UC06 – Quản lý hồ sơ khẩu vị

| UC06 – Quản lý hồ sơ khẩu vị |  |

| --- | --- |

| Mã use case | UC06 |

| Tên use case | Quản lý hồ sơ khẩu vị |

| Tác nhân | Người dùng |

| Mô tả | Cho phép người dùng thiết lập và cập nhật sở thích ăn uống gồm nguyên liệu ưa thích, nguyên liệu dị ứng hoặc cần tránh, chế độ ăn, mức độ cay/mặn/ngọt/chua, mục tiêu dinh dưỡng và số người trong gia đình. |

| Tiền điều kiện | – Người dùng đã đăng nhập.– Danh mục nguyên liệu và các lựa chọn hồ sơ liên quan đã được khởi tạo. |

| Hậu điều kiện | – Hồ sơ khẩu vị được lưu thành công.– Dữ liệu hồ sơ được sử dụng làm điều kiện cho chatbot và chức năng gợi ý cá nhân hóa. |

| Luồng sự kiện chính | 1.Người dùng mở mục “Hồ sơ khẩu vị”.2.Hệ thống hiển thị thông tin hồ sơ hiện tại hoặc biểu mẫu trống nếu người dùng chưa thiết lập.3.Người dùng thêm, sửa hoặc xóa các tùy chọn, gồm nguyên liệu ưa thích, nguyên liệu cần tránh, chế độ ăn và mục tiêu dinh dưỡng.4.Với nguyên liệu cần chọn từ danh mục, người dùng nhập tên để tìm kiếm và chọn kết quả phù hợp.5.Người dùng nhấn “Lưu”.6.Hệ thống kiểm tra tính hợp lệ, tính nhất quán và quyền cập nhật hồ sơ.7.Hệ thống lưu dữ liệu và thông báo kết quả. |

| Luồng thay thế / ngoại lệ | 3a.Người dùng vừa thích vừa đánh dấu cần tránh cùng một nguyên liệu: hệ thống báo lỗi và yêu cầu điều chỉnh.4a.Nguyên liệu chưa có trong danh mục: hệ thống gợi ý nguyên liệu tương tự nếu có. Người dùng có thể nêu nguyên liệu đó trực tiếp khi trò chuyện với chatbot (UC07), nhưng nguyên liệu nhập tự do không được xem là dữ liệu dị ứng đã được xác minh.4b.Người dùng chọn nhóm dị ứng hoặc nguyên liệu cần tránh: hệ thống lưu dưới dạng dữ liệu có cấu trúc để phục vụ lọc món.6a.Dữ liệu không hợp lệ, chẳng hạn mục tiêu dinh dưỡng âm: hệ thống thông báo lỗi và yêu cầu chỉnh sửa.7a.Lỗi khi lưu: hệ thống giữ dữ liệu đang nhập và cho phép thử lại. |

| Quy tắc nghiệp vụ | Điều kiện dị ứng và cần tránh có mức ưu tiên cao hơn sở thích. Hệ thống không được mặc định nguyên liệu chưa được xác minh là an toàn. Nếu dữ liệu thành phần của món ăn chưa đủ để xác nhận món đáp ứng yêu cầu dị ứng nghiêm ngặt, hệ thống phải loại món khỏi danh sách gợi ý an toàn hoặc thông báo rõ rằng chưa đủ dữ liệu để xác nhận. |



5.7. UC07 – Trò chuyện với chatbot (cá nhân hóa đầy đủ)

| UC07 – Trò chuyện với chatbot (cá nhân hóa đầy đủ) |  |

| --- | --- |

| Mã use case | UC07 |

| Tên use case | Trò chuyện với chatbot (cá nhân hóa đầy đủ) |

| Tác nhân | Người dùng |

| Mô tả | Chatbot tư vấn ẩm thực dựa trên câu hỏi hiện tại, hồ sơ khẩu vị, chế độ ăn, nguyên liệu dị ứng hoặc cần tránh và lịch sử tương tác có liên quan. Hệ thống lưu lịch sử hội thoại để người dùng tiếp tục hoặc xem lại sau này. |

| Tiền điều kiện | – Người dùng đã đăng nhập.– Dịch vụ chatbot và dữ liệu món ăn cần thiết có thể truy cập.– Hồ sơ khẩu vị có thể chưa được thiết lập đầy đủ. |

| Hậu điều kiện | – Câu trả lời được hiển thị theo ngữ cảnh và các điều kiện cá nhân hóa có thể xác định.– Tin nhắn người dùng và câu trả lời được lưu vào lịch sử hội thoại theo thiết kế hệ thống.– Các thẻ món ăn chính thức trong câu trả lời tham chiếu tới món tồn tại trong cơ sở dữ liệu. |

| Luồng sự kiện chính | 1.Người dùng nhập câu hỏi, ví dụ: “Tối nay nên nấu gì cho 4 người, không ăn cay?”.2.Hệ thống xác thực phiên người dùng và kiểm tra nội dung yêu cầu.3.Backend lấy hồ sơ khẩu vị và lịch sử tương tác có liên quan, chỉ sử dụng những dữ liệu cần thiết cho yêu cầu hiện tại.4.Hệ thống truy hồi các món ăn hoặc công thức phù hợp từ cơ sở dữ liệu bằng tìm kiếm từ khóa, tìm kiếm ngữ nghĩa hoặc phương thức truy hồi được triển khai.5.Backend áp dụng các điều kiện lọc về dị ứng, nguyên liệu cần tránh và chế độ ăn trước khi lựa chọn các món đưa vào ngữ cảnh gợi ý.6.Hệ thống gửi câu hỏi cùng ngữ cảnh cần thiết tới mô hình AI.7.Hệ thống kiểm tra câu trả lời, hiển thị nội dung tư vấn và đính kèm thẻ món ăn tương ứng nếu có món phù hợp trong cơ sở dữ liệu.8.Hệ thống lưu tin nhắn và kết quả trả lời vào hội thoại của người dùng.9.Người dùng có thể chọn “thích/không thích” câu trả lời và nêu lý do; phản hồi được lưu để quản trị viên xem tại UC13.10.Người dùng tiếp tục hội thoại, mở lại hội thoại cũ hoặc xóa hội thoại. |

| Luồng thay thế / ngoại lệ | 1a.Người dùng mở chatbot từ chức năng “Nguyên liệu có sẵn” (UC02): hệ thống nhận danh sách nguyên liệu làm ngữ cảnh, ưu tiên gợi ý món phù hợp và vẫn áp dụng các điều kiện dị ứng, chế độ ăn của hồ sơ.1b.Người dùng chọn “Cuộc trò chuyện mới”: hệ thống tạo hội thoại trống, tiêu đề tự đặt từ tin nhắn đầu tiên.3a.Người dùng chưa có hồ sơ khẩu vị: hệ thống sử dụng những thông tin được nêu trong câu hỏi hiện tại và có thể đề nghị người dùng thiết lập hồ sơ (UC06).4a.Không truy hồi được món phù hợp: chatbot có thể đề xuất công thức sáng tạo dưới dạng văn bản, nhưng phải phân biệt rõ nội dung AI đề xuất với món đã có trong cơ sở dữ liệu.5a.Không tìm được món đáp ứng đầy đủ điều kiện dị ứng hoặc chế độ ăn: chatbot thông báo chưa tìm được món phù hợp và đề xuất điều chỉnh những điều kiện không mang tính bắt buộc. Không tự ý nới lỏng điều kiện dị ứng.6a.Dịch vụ AI lỗi hoặc quá thời gian chờ: hệ thống thông báo lỗi và cho phép gửi lại câu hỏi.7a.Câu trả lời không hợp lệ hoặc chứa thẻ món không có trong kết quả truy hồi: hệ thống loại bỏ thẻ không hợp lệ và chỉ hiển thị những món đã xác minh được trong cơ sở dữ liệu.7b.Câu hỏi ngoài phạm vi ẩm thực: chatbot từ chối lịch sự và hướng người dùng về nội dung được hỗ trợ.8a.Lỗi lưu hội thoại: hệ thống thông báo rằng không thể lưu lịch sử; không thông báo lưu thành công khi thao tác lưu chưa hoàn tất. |

| Quy tắc nghiệp vụ | Backend chịu trách nhiệm xác thực quyền, truy hồi dữ liệu và áp dụng điều kiện loại trừ. Không giao hoàn toàn việc lọc dị ứng cho mô hình AI. Không gửi mật khẩu hoặc thông tin xác thực nhạy cảm tới mô hình AI. |



5.8. UC08 – Nhận gợi ý cá nhân hóa

| UC08 – Nhận gợi ý cá nhân hóa |  |

| --- | --- |

| Mã use case | UC08 |

| Tên use case | Nhận gợi ý cá nhân hóa |

| Tác nhân | Người dùng |

| Mô tả | Hệ thống chủ động gợi ý món ăn dựa trên khẩu vị, lịch sử xem, món yêu thích và đánh giá. |

| Tiền điều kiện | Đã đăng nhập. |

| Hậu điều kiện | Danh sách gợi ý được hiển thị. |

| Luồng sự kiện chính | 1.Người dùng vào trang chủ hoặc mục "Gợi ý cho bạn".2.Hệ thống lấy hồ sơ khẩu vị và lịch sử tương tác.3.Hệ thống tính toán, xếp hạng món phù hợp và loại trừ món chứa nguyên liệu dị ứng/kiêng.4.Hệ thống hiển thị danh sách kèm lý do gợi ý.5.Người dùng chọn món để xem chi tiết (UC04) hoặc làm mới gợi ý. |

| Luồng thay thế / ngoại lệ | 3a.Người dùng mới, chưa đủ dữ liệu: gợi ý món phổ biến/nổi bật và nhắc hoàn thiện hồ sơ khẩu vị (UC06). |



5.9. UC09 – Yêu thích, đánh giá & bình luận món

| UC09 – Yêu thích, đánh giá & bình luận món |  |

| --- | --- |

| Mã use case | UC09 |

| Tên use case | Yêu thích, đánh giá & bình luận món |

| Tác nhân | Người dùng |

| Mô tả | Lưu món vào danh sách yêu thích, chấm điểm sao và viết bình luận. |

| Tiền điều kiện | Đã đăng nhập và đang xem một món ăn. |

| Hậu điều kiện | Yêu thích/đánh giá/bình luận được lưu và ảnh hưởng đến gợi ý sau này. |

| Luồng sự kiện chính | 1.Người dùng nhấn "Yêu thích" hoặc chọn số sao (bắt buộc khi đánh giá) và có thể nhập thêm bình luận.2.Hệ thống kiểm tra dữ liệu.3.Hệ thống lưu và cập nhật điểm trung bình, số lượt yêu thích.4.Hệ thống hiển thị kết quả ngay trên trang. |

| Luồng thay thế / ngoại lệ | 1a.Người dùng bỏ yêu thích hoặc sửa/xóa đánh giá, bình luận của chính mình.2a.Thiếu số sao khi đánh giá; bình luận rỗng (nếu có nhập), quá dài hoặc chứa từ ngữ bị cấm: từ chối và báo lỗi.2b.Phiên hết hạn: yêu cầu đăng nhập lại (UC05). |



5.10. UC10 – Quản lý dữ liệu cá nhân

| UC10 – Quản lý dữ liệu cá nhân |  |

| --- | --- |

| Mã use case | UC10 |

| Tên use case | Quản lý dữ liệu cá nhân |

| Tác nhân | Người dùng |

| Mô tả | Xem và cập nhật thông tin tài khoản (họ tên, ảnh đại diện, mật khẩu); quản lý danh sách yêu thích, lịch sử hội thoại; xóa dữ liệu cá nhân. |

| Tiền điều kiện | Đã đăng nhập. |

| Hậu điều kiện | Dữ liệu cá nhân được cập nhật hoặc xóa. |

| Luồng sự kiện chính | 1.Người dùng vào trang "Tài khoản của tôi".2.Hệ thống hiển thị thông tin cá nhân, danh sách yêu thích, lịch sử chat.3.Người dùng chọn chỉnh sửa, đổi mật khẩu hoặc xóa mục dữ liệu.4.Hệ thống yêu cầu xác nhận (nếu cần), kiểm tra và lưu thay đổi.5.Hệ thống thông báo kết quả. |

| Luồng thay thế / ngoại lệ | 3a.Đổi mật khẩu: mật khẩu cũ sai hoặc mật khẩu mới không hợp lệ thì báo lỗi.3b.Xóa tài khoản/dữ liệu: hệ thống yêu cầu xác nhận; người dùng hủy thì không thay đổi gì. |



5.11. UC11 – Quản lý món ăn

| UC11 – Quản lý món ăn |  |

| --- | --- |

| Mã use case | UC11 |

| Tên use case | Quản lý món ăn |

| Tác nhân | Quản trị viên |

| Mô tả | Cho phép quản trị viên thêm, sửa, ẩn hoặc xóa món ăn theo chính sách lưu trữ của hệ thống. Thông tin món gồm tên, mô tả, danh mục, thẻ, hình ảnh, thời gian chế biến, khẩu phần và dữ liệu dinh dưỡng. Danh mục món là trường văn bản do quản trị viên tự nhập khi thêm hoặc sửa món; hệ thống không có chức năng quản lý danh mục riêng. Việc quản lý nguyên liệu và các bước chế biến thuộc UC16; nguyên liệu mới được tạo nhanh ngay trong UC16. Thẻ, chế độ ăn và nhóm dị ứng là dữ liệu hệ thống được khởi tạo sẵn, không có chức năng quản lý riêng. |

| Tiền điều kiện | – Quản trị viên đã đăng nhập và có quyền quản lý món ăn.– Dữ liệu thẻ (khẩu vị, chế độ ăn...) đã được khởi tạo sẵn trong hệ thống. |

| Hậu điều kiện | – Thông tin món ăn được cập nhật và có hiệu lực đối với các chức năng tìm kiếm, gợi ý và chatbot sau khi dữ liệu liên quan được đồng bộ.– Món chỉ được công khai khi đáp ứng điều kiện công khai của hệ thống, bao gồm có công thức hợp lệ. |

| Luồng sự kiện chính | 1.Quản trị viên mở mục “Quản lý món ăn”.2.Hệ thống hiển thị danh sách món ăn, hỗ trợ tìm kiếm, lọc theo danh mục hoặc trạng thái và phân trang; mỗi món có trạng thái công thức.3.Quản trị viên chọn thêm, sửa, ẩn hoặc xóa món ăn.4.Khi thêm hoặc sửa, hệ thống hiển thị biểu mẫu với các trường thông tin món ăn, trong đó danh mục là ô nhập văn bản, có gợi ý từ các danh mục đã dùng cho món khác.5.Quản trị viên nhập hoặc cập nhật thông tin (gồm tự nhập danh mục của món) rồi nhấn “Lưu”.6.Hệ thống kiểm tra dữ liệu, quyền thao tác và tính hợp lệ của danh mục (bắt buộc, không vượt quá độ dài cho phép) và các thẻ được chọn.7.Hệ thống lưu thay đổi, cập nhật trạng thái công khai và làm mới dữ liệu phục vụ tìm kiếm hoặc chatbot khi cần.8.Hệ thống thông báo kết quả và cập nhật danh sách món ăn. |

| Luồng thay thế / ngoại lệ | 4a.Quản trị viên nhập một danh mục chưa có món nào sử dụng: hệ thống chấp nhận và danh mục mới tự xuất hiện trong bộ lọc tìm kiếm khi món được hiển thị công khai.5a.Thiếu trường bắt buộc hoặc tên món trùng theo quy tắc dữ liệu: hệ thống báo lỗi và yêu cầu chỉnh sửa.5b.Hình ảnh sai định dạng hoặc vượt dung lượng cho phép: hệ thống từ chối tải ảnh.6a.Danh mục để trống, vượt quá độ dài cho phép hoặc thẻ được chọn không hợp lệ: hệ thống yêu cầu nhập hoặc chọn lại.6b.Danh mục vừa nhập chỉ khác danh mục đã có về chữ hoa/thường, khoảng trắng thừa hoặc dấu: hệ thống dùng lại cách viết đã có để các món cùng danh mục được gom chung.3a.Quản trị viên yêu cầu xóa món đã có dữ liệu đánh giá hoặc các dữ liệu liên quan: hệ thống ưu tiên ẩn món để giữ tính toàn vẹn dữ liệu. Chỉ xóa vật lý khi không vi phạm các ràng buộc dữ liệu và chính sách lưu trữ.7a.Quản trị viên bật hiển thị món chưa có công thức hợp lệ: hệ thống từ chối và yêu cầu bổ sung công thức tại UC16.7b.Lỗi khi lưu hoặc đồng bộ dữ liệu: hệ thống thông báo lỗi; không thông báo thành công khi thao tác chưa hoàn tất. |



5.12. UC12 – Quản lý người dùng

| UC12 – Quản lý người dùng |  |

| --- | --- |

| Mã use case | UC12 |

| Tên use case | Quản lý người dùng |

| Tác nhân | Quản trị viên |

| Mô tả | Xem danh sách, tìm kiếm tài khoản; khóa/mở khóa tài khoản; phân quyền; xử lý tài khoản vi phạm. |

| Tiền điều kiện | Admin đã đăng nhập. |

| Hậu điều kiện | Trạng thái/quyền của tài khoản được cập nhật. |

| Luồng sự kiện chính | 1.Admin vào mục "Quản lý người dùng".2.Hệ thống hiển thị danh sách người dùng (tìm kiếm, lọc theo trạng thái, phân trang).3.Admin chọn một tài khoản để xem chi tiết.4.Admin chọn khóa / mở khóa / đổi vai trò / xóa tài khoản.5.Hệ thống yêu cầu xác nhận, thực hiện và ghi nhật ký thao tác.6.Hệ thống thông báo kết quả. |

| Luồng thay thế / ngoại lệ | 2a.Admin chọn "Nhật ký thao tác": hệ thống hiển thị nhật ký các thao tác quản trị (khóa/mở khóa, đổi vai trò, xóa...), có lọc theo Admin thực hiện, hành động và khoảng thời gian.4a.Admin thao tác lên chính tài khoản của mình hoặc Admin cuối cùng: hệ thống từ chối.5a.Admin hủy xác nhận: không thay đổi gì. |



5.13. UC13 – Giám sát chatbot

| UC13 – Giám sát chatbot |  |

| --- | --- |

| Mã use case | UC13 |

| Tên use case | Giám sát chatbot |

| Tác nhân | Quản trị viên |

| Mô tả | Theo dõi chất lượng và hoạt động của chatbot: xem nhật ký hội thoại của người dùng đã đăng nhập, câu hỏi thường gặp, phản hồi lỗi/không phù hợp, tình trạng dịch vụ AI; cấu hình giới hạn lượt hỏi của chế độ khách. |

| Tiền điều kiện | Admin đã đăng nhập. |

| Hậu điều kiện | Admin nắm được tình trạng chatbot và cập nhật cấu hình nếu cần. |

| Luồng sự kiện chính | 1.Admin vào mục "Giám sát chatbot".2.Hệ thống hiển thị tổng quan (số lượt hỏi, thời gian phản hồi, tỉ lệ lỗi) và danh sách hội thoại.3.Admin lọc nhật ký hội thoại của người dùng đã đăng nhập theo thời gian, người dùng hoặc trạng thái (lỗi, bị gắn cờ, bị đánh giá không tốt). Số liệu của khách được hiển thị dạng tổng hợp ở bảng tổng quan.4.Admin xem chi tiết hội thoại và đánh dấu câu trả lời không phù hợp.5.Admin điều chỉnh cấu hình (giới hạn lượt hỏi chế độ khách, thông điệp hệ thống) và lưu.6.Hệ thống áp dụng cấu hình mới và thông báo kết quả. |

| Luồng thay thế / ngoại lệ | 2a.Không có dữ liệu trong khoảng thời gian chọn: hiển thị thông báo trống.5a.Cấu hình không hợp lệ (ví dụ giới hạn lượt hỏi âm): báo lỗi, không lưu.5b.Dịch vụ AI không phản hồi: hệ thống hiển thị cảnh báo trên bảng giám sát. |



5.14. UC14 – Xem thống kê hệ thống

| UC14 – Xem thống kê hệ thống |  |

| --- | --- |

| Mã use case | UC14 |

| Tên use case | Xem thống kê hệ thống |

| Tác nhân | Quản trị viên |

| Mô tả | Xem báo cáo và biểu đồ: số người dùng, lượt truy cập, món được xem/yêu thích nhiều, lượt dùng chatbot, xu hướng tìm kiếm. |

| Tiền điều kiện | Admin đã đăng nhập. |

| Hậu điều kiện | Số liệu thống kê được hiển thị theo khoảng thời gian đã chọn. |

| Luồng sự kiện chính | 1.Admin vào mục "Thống kê".2.Hệ thống hiển thị bảng điều khiển với số liệu mặc định (30 ngày gần nhất).3.Admin chọn khoảng thời gian và loại thống kê.4.Hệ thống tổng hợp dữ liệu và hiển thị biểu đồ, bảng số liệu.5.Admin có thể xuất báo cáo (CSV/PDF). |

| Luồng thay thế / ngoại lệ | 4a.Không có dữ liệu trong khoảng thời gian chọn: hiển thị "Chưa có dữ liệu".4b.Lỗi truy vấn: thông báo lỗi và cho phép thử lại. |



5.15. UC15 – Quên mật khẩu / khôi phục mật khẩu

| UC15 – Quên mật khẩu / khôi phục mật khẩu |  |

| --- | --- |

| Mã use case | UC15 |

| Tên use case | Quên mật khẩu / khôi phục mật khẩu |

| Tác nhân | Khách vãng lai (chủ tài khoản Người dùng hoặc Quản trị viên đã quên mật khẩu) |

| Mô tả | Cho phép chủ tài khoản đặt lại mật khẩu mới thông qua liên kết/mã xác thực gửi tới email đã đăng ký khi không nhớ mật khẩu. |

| Tiền điều kiện | Tài khoản đã tồn tại, chưa bị khóa; người dùng chưa đăng nhập và truy cập được email đã đăng ký. |

| Hậu điều kiện | Mật khẩu mới được mã hóa và lưu; liên kết/mã đặt lại bị vô hiệu; các phiên cũ bị hủy; người dùng đăng nhập được bằng mật khẩu mới. |

| Luồng sự kiện chính | 1.Tại màn hình đăng nhập (UC05), người dùng chọn "Quên mật khẩu".2.Hệ thống hiển thị form nhập email đã đăng ký.3.Người dùng nhập email và nhấn "Gửi yêu cầu".4.Hệ thống kiểm tra email, tạo liên kết/mã đặt lại mật khẩu dùng một lần, có thời hạn (ví dụ 15 phút) và gửi tới email đó.5.Hệ thống thông báo chung: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi".6.Người dùng mở email và nhấn vào liên kết (hoặc nhập mã xác thực).7.Hệ thống xác thực liên kết/mã còn hiệu lực và hiển thị form đặt mật khẩu mới (mật khẩu mới, xác nhận mật khẩu).8.Người dùng nhập mật khẩu mới và gửi.9.Hệ thống kiểm tra tính hợp lệ, mã hóa và lưu mật khẩu mới, vô hiệu hóa liên kết/mã đã dùng, hủy các phiên đăng nhập cũ, thông báo thành công và chuyển tới màn hình đăng nhập (UC05). |

| Luồng thay thế / ngoại lệ | 3a.Email sai định dạng: báo lỗi tại trường email.4a.Email chưa đăng ký hoặc tài khoản bị khóa: vẫn hiển thị thông báo chung như bước 5 nhưng không gửi email (tránh dò tìm tài khoản).4b.Gửi email thất bại: thông báo lỗi và cho phép gửi lại.4c.Gửi yêu cầu quá nhiều lần trong thời gian ngắn: tạm chặn và yêu cầu thử lại sau.7a.Liên kết/mã sai, đã sử dụng hoặc hết hạn: thông báo và cho phép yêu cầu liên kết/mã mới (quay lại bước 2).9a.Mật khẩu mới yếu hoặc không khớp phần xác nhận: báo lỗi tại trường tương ứng, yêu cầu nhập lại. |



5.16. UC16 – Quản lý công thức

| UC16 – Quản lý công thức |  |

| --- | --- |

| Mã use case | UC16 |

| Tên use case | Quản lý công thức |

| Tác nhân | Quản trị viên |

| Mô tả | Cho phép quản trị viên thêm, sửa hoặc xóa công thức của món ăn. Công thức gồm danh sách nguyên liệu, số lượng, đơn vị, trạng thái bắt buộc hoặc tùy chọn và các bước chế biến theo thứ tự. Khi nhập tên nguyên liệu, hệ thống gợi ý dữ liệu đã có trong danh mục; nếu nguyên liệu chưa tồn tại, quản trị viên có thể tạo nhanh ngay trong biểu mẫu công thức. |

| Tiền điều kiện | – Quản trị viên đã đăng nhập và có quyền quản lý công thức.– Món ăn đã tồn tại trong hệ thống (UC11). |

| Hậu điều kiện | – Công thức và danh sách nguyên liệu được lưu thành công.– Dữ liệu liên quan đến tìm kiếm theo nguyên liệu và truy hồi chatbot được cập nhật theo cơ chế đồng bộ của hệ thống.– Món có công thức hợp lệ có thể được công khai nếu các điều kiện hiển thị khác đều đáp ứng.– Nguyên liệu mới được tạo trong quá trình nhập công thức được thêm vào danh mục dùng chung; nguyên liệu chưa được rà soát đầy đủ được đánh dấu để quản trị viên kiểm tra. |

| Luồng sự kiện chính | 1.Quản trị viên mở mục “Quản lý công thức” hoặc tab “Công thức” trong trang chi tiết món ăn.2.Hệ thống hiển thị danh sách món ăn kèm trạng thái đã có hoặc chưa có công thức, hỗ trợ tìm kiếm, lọc và phân trang.3.Quản trị viên chọn một món và chọn thêm, sửa hoặc xóa công thức.4.Khi thêm hoặc sửa, hệ thống hiển thị biểu mẫu gồm số khẩu phần, danh sách nguyên liệu và danh sách bước chế biến.5.Quản trị viên thêm, xóa hoặc sắp xếp nguyên liệu và các bước chế biến.6.Với mỗi dòng nguyên liệu, quản trị viên nhập tên; hệ thống gợi ý các nguyên liệu trong danh mục theo tên chuẩn và tên gọi khác, không phân biệt chữ hoa, chữ thường và dấu tiếng Việt khi chức năng tìm kiếm hỗ trợ.7.Quản trị viên chọn nguyên liệu, nhập số lượng, đơn vị và xác định nguyên liệu có bắt buộc hay không. Đơn vị mặc định được điền tự động nếu có.8.Quản trị viên nhấn “Lưu” hoặc “Lưu và hiển thị món” nếu món đang ẩn.9.Hệ thống kiểm tra dữ liệu, lưu công thức và nguyên liệu liên quan trong một giao dịch dữ liệu phù hợp, sau đó cập nhật chỉ mục tìm kiếm hoặc dữ liệu phục vụ chatbot.10.Nếu quản trị viên chọn hiển thị món, hệ thống kiểm tra công thức hợp lệ và các điều kiện công khai trước khi bật trạng thái hiển thị.11.Hệ thống thông báo kết quả và hiển thị công thức vừa lưu, kèm thông tin nguyên liệu mới được tạo nếu có. |

| Luồng thay thế / ngoại lệ | 6a.Tên nguyên liệu chưa tồn tại: hệ thống hiển thị tùy chọn “Thêm nguyên liệu mới” cùng tên vừa nhập.6b.Quản trị viên xác nhận tạo nguyên liệu mới: hệ thống cho phép nhập đơn vị mặc định và thông tin nhóm dị ứng nếu có. Nguyên liệu chỉ được ghi vào cơ sở dữ liệu khi thao tác lưu công thức thành công.6c.Tên vừa nhập trùng với tên chuẩn hoặc tên gọi khác của nguyên liệu đã có: hệ thống gợi ý hoặc sử dụng lại nguyên liệu hiện có, không tạo bản sao.6d.Nguyên liệu mới chưa có thông tin nhóm dị ứng hoặc chưa được rà soát đầy đủ: hệ thống đánh dấu “Cần rà soát” để quản trị viên bổ sung khi sửa công thức của món có nguyên liệu đó (xem 6e).6e.Quản trị viên mở lại công thức có nguyên liệu “Cần rà soát”, chọn nhóm dị ứng hoặc xác nhận nguyên liệu không thuộc nhóm dị ứng nào tại dòng nguyên liệu đó rồi lưu: hệ thống cập nhật thông tin nguyên liệu và bỏ đánh dấu “Cần rà soát”.7a.Một nguyên liệu xuất hiện nhiều lần trong công thức: hệ thống báo lỗi và yêu cầu quản trị viên gộp thành một dòng.8a.Danh sách nguyên liệu hoặc các bước chế biến bị trống, số lượng không hợp lệ hoặc thiếu trường bắt buộc: hệ thống thông báo lỗi tại vị trí tương ứng và yêu cầu chỉnh sửa.9a.Lỗi khi lưu: hệ thống hoàn tác các thay đổi thuộc giao dịch chưa hoàn tất, bao gồm nguyên liệu mới được tạo trong giao dịch; giữ nguyên công thức cũ và thông tin đang nhập nếu giao diện hỗ trợ.10a.Công thức chưa đáp ứng điều kiện hợp lệ: hệ thống không cho phép công khai món và thông báo các nội dung cần bổ sung.3a.Món đã có công thức: hệ thống mở công thức hiện tại ở chế độ chỉnh sửa.3b.Quản trị viên chọn xóa công thức: hệ thống yêu cầu xác nhận. Nếu món đang công khai, hệ thống ẩn món sau khi xóa công thức thành công.3c.Quản trị viên hủy thao tác xóa: hệ thống giữ nguyên công thức hiện tại. |

| Quy tắc nghiệp vụ | Dữ liệu nguyên liệu dùng chung phải được quản lý nhất quán để phục vụ tìm kiếm, chatbot và lọc dị ứng. Nguyên liệu chưa được rà soát không được mặc định là không gây dị ứng. Nếu món ăn có nguyên liệu chưa xác định đầy đủ và người dùng yêu cầu loại trừ dị ứng nghiêm ngặt, hệ thống phải áp dụng chính sách thận trọng thay vì khẳng định món an toàn. |

