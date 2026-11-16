# Triển khai ChefAI lên VPS

Hướng dẫn đưa ChefAI lên VPS tại **https://chefai.hbest.net** và bật tự động deploy mỗi lần push lên nhánh `main`.

## Kiến trúc

```
Trình duyệt ──HTTPS──▶ Cloudflare (Proxied) ──HTTPS──▶ VPS 160.191.50.73
                                                        │
                                          Nginx máy chủ :443 (chứng chỉ Cloudflare Origin)
                                                        │  proxy tới 127.0.0.1:8080
                                                        ▼
                                   ┌──────── docker compose ────────┐
                                   │ frontend (Nginx + React) :80   │
                                   │   /api/* ──▶ backend :5000     │
                                   └────────────────────────────────┘
```

- DNS: bản ghi `A chefai → 160.191.50.73`, **Proxied** (đám mây cam). Đã có sẵn.
- Container `frontend` chỉ mở cổng `127.0.0.1:8080`, không lộ ra Internet; chỉ Nginx máy chủ đi vào được.
- Database, Auth, Storage dùng Supabase nên VPS không cần cài PostgreSQL.

Yêu cầu: VPS Ubuntu 26.04 (24.04 cũng được), tối thiểu 1 vCPU, 2 GB RAM (build frontend tốn RAM; nếu chỉ có 1 GB thì tạo swap ở bước 1).

---

## 1. Chuẩn bị VPS

SSH vào VPS bằng tài khoản root:

```bash
ssh root@160.191.50.73
```

Cập nhật hệ thống và tạo user `deploy` để chạy ứng dụng:

```bash
apt update && apt upgrade -y
apt install -y git curl nginx ufw

useradd -m -s /bin/bash deploy
```

Cài Docker (kèm Docker Compose plugin) và cho `deploy` dùng Docker:

```bash
curl -fsSL https://get.docker.com | sh
```

Nếu script trên báo không hỗ trợ phiên bản Ubuntu, dùng gói có sẵn của Ubuntu:

```bash
apt install -y docker.io docker-compose-v2 docker-buildx
```

Sau đó:

```bash
usermod -aG docker deploy
systemctl enable --now docker
docker compose version   # phải in ra phiên bản, không báo lỗi
```

Mở tường lửa (SSH, HTTP, HTTPS):

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

Nếu VPS chỉ có 1 GB RAM, tạo 2 GB swap để `npm run build` không bị kill:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 2. Lấy mã nguồn

Repo đang public nên clone không cần token:

```bash
mkdir -p /opt/chefai && chown deploy:deploy /opt/chefai
su - deploy
git clone -b main https://github.com/Hbest1804/Datn_FoodAI.git /opt/chefai
cd /opt/chefai
```

> Các bước tiếp theo đến hết mục 3 chạy dưới user `deploy`.

## 3. Cấu hình biến môi trường

File `.env` **không** nằm trong git, phải tạo tay trên VPS. Lần deploy tự động dùng `git reset --hard` nhưng không đụng tới file bị `.gitignore`, nên các file này được giữ nguyên.

### 3.1. `.env` ở thư mục gốc (dành cho docker compose)

```bash
cat > /opt/chefai/.env <<'EOF'
CORS_ORIGIN=https://chefai.hbest.net
FRONTEND_BIND=127.0.0.1
FRONTEND_PORT=8080
EOF
```

> Giữ `FRONTEND_PORT=8080`: workflow CD kiểm tra sức khỏe qua `http://127.0.0.1:8080/api/health`.

### 3.2. `backend/.env`

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Điền giá trị thật. Các dòng cần lưu ý trên production:

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `NODE_ENV` | `production` | |
| `CORS_ORIGIN` | `https://chefai.hbest.net` | docker compose đã ghi đè từ `.env` gốc, đặt luôn cho rõ ràng |
| `TRUST_PROXY` | `2` | Nginx máy chủ + Nginx trong container (xem mục 4.3) |
| `SUPABASE_*`, `GEMINI_*` | khóa thật | |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | mật khẩu mạnh | tài khoản admin được tạo lần đầu khởi động |
| `SMTP_*` | Gmail App Password | để gửi mã đặt lại mật khẩu |

Khóa quyền đọc file:

```bash
chmod 600 /opt/chefai/.env /opt/chefai/backend/.env
```

### 3.3. Chạy thử

```bash
cd /opt/chefai
docker compose up -d --build
docker compose ps                         # cả 2 container phải là "healthy"
curl http://127.0.0.1:8080/api/health     # trả về JSON là OK
```

## 4. HTTPS với Cloudflare

Vì bản ghi DNS đang **Proxied**, cách đơn giản và bền nhất là dùng **Cloudflare Origin Certificate** (hạn 15 năm, không cần gia hạn như Let's Encrypt).

### 4.1. Tạo chứng chỉ Origin

1. Cloudflare Dashboard → chọn `hbest.net` → **SSL/TLS → Origin Server → Create Certificate**.
2. Để mặc định (RSA, hostname `*.hbest.net, hbest.net`, 15 năm) → **Create**.
3. Trên VPS (quyền root), dán nội dung vào 2 file:

```bash
mkdir -p /etc/ssl/cloudflare
nano /etc/ssl/cloudflare/hbest.net.pem   # dán "Origin Certificate"
nano /etc/ssl/cloudflare/hbest.net.key   # dán "Private Key"
chmod 600 /etc/ssl/cloudflare/hbest.net.key
```

4. **SSL/TLS → Overview** → chọn chế độ **Full (strict)**.
5. (Khuyên dùng) **SSL/TLS → Edge Certificates** → bật **Always Use HTTPS**.

### 4.2. Lấy IP thật của người dùng qua Cloudflare

Đi qua Cloudflare, Nginx chỉ thấy IP của Cloudflare. Tạo file khai báo dải IP Cloudflare để Nginx đọc IP thật từ header `CF-Connecting-IP` (cần cho giới hạn tần suất và hạn mức chat khách):

```bash
{
  echo "# Sinh tự động từ https://www.cloudflare.com/ips"
  for ip in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
    echo "set_real_ip_from $ip;"
  done
  echo "real_ip_header CF-Connecting-IP;"
} > /etc/nginx/conf.d/cloudflare-realip.conf
```

### 4.3. Cấu hình Nginx máy chủ

```bash
cat > /etc/nginx/sites-available/chefai <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name chefai.hbest.net;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name chefai.hbest.net;

    ssl_certificate     /etc/ssl/cloudflare/hbest.net.pem;
    ssl_certificate_key /etc/ssl/cloudflare/hbest.net.key;

    # Ảnh món ăn và file nhập món
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        # $remote_addr đã là IP thật nhờ cloudflare-realip.conf.
        # Ghi đè (không nối thêm) để chuỗi X-Forwarded-For chỉ có các proxy tin cậy.
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 120s;
        proxy_buffering off;   # chatbot trả lời dạng stream
    }
}
EOF

ln -sf /etc/nginx/sites-available/chefai /etc/nginx/sites-enabled/chefai
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

> Dòng `http2 on;` cần Nginx ≥ 1.25; Ubuntu 24.04 và 26.04 đều đáp ứng.

Vì sao `TRUST_PROXY=2`: request tới backend đi qua Nginx máy chủ rồi Nginx trong container frontend. Express bỏ qua 2 lớp proxy này và lấy đúng IP người dùng mà Nginx máy chủ đã ghi vào `X-Forwarded-For`.

Mở https://chefai.hbest.net — trang web phải chạy.

## 5. Tự động deploy bằng GitHub Actions

File [.github/workflows/cd.yml](.github/workflows/cd.yml) hoạt động như sau:

1. Bạn push lên `main` → workflow **CI** chạy (test backend, build frontend, build Docker).
2. CI **thành công** → workflow **CD** SSH vào VPS, chạy `git reset --hard <commit>` rồi `docker compose up -d --build`.
3. CD đợi `/api/health` trả về OK; nếu sau ~90 giây vẫn lỗi thì in log backend và báo đỏ.
4. Xóa image cũ để không đầy ổ đĩa.

CI đỏ thì không deploy. Push lên `dev` chỉ chạy CI, không deploy.

### 5.1. Tạo SSH key riêng cho GitHub Actions

Trên **máy của bạn** (không phải VPS):

```bash
ssh-keygen -t ed25519 -C "github-actions-chefai" -f ~/.ssh/chefai_deploy -N ""
```

Đưa public key lên VPS cho user `deploy` (user này không có mật khẩu nên đi qua root):

```bash
cat ~/.ssh/chefai_deploy.pub | ssh root@160.191.50.73 \
  "install -d -m 700 -o deploy -g deploy /home/deploy/.ssh && \
   cat >> /home/deploy/.ssh/authorized_keys && \
   chown deploy:deploy /home/deploy/.ssh/authorized_keys && \
   chmod 600 /home/deploy/.ssh/authorized_keys"

# Thử đăng nhập:
ssh -i ~/.ssh/chefai_deploy deploy@160.191.50.73 "docker ps"
```

### 5.2. Khai báo Secrets trên GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Giá trị |
|---|---|
| `VPS_HOST` | `160.191.50.73` (dùng **IP**, không dùng tên miền vì Cloudflare proxy không chuyển tiếp SSH) |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | toàn bộ nội dung file `~/.ssh/chefai_deploy` (private key, gồm cả dòng `-----BEGIN…` và `-----END…`) |
| `VPS_PORT` | *(tùy chọn)* cổng SSH nếu khác 22 |
| `DEPLOY_PATH` | *(tùy chọn)* thư mục dự án nếu khác `/opt/chefai` |

> Repo public: Secrets vẫn được mã hóa và **không** lộ ra log hay cho người fork. Không bao giờ commit file `.env` hoặc private key.

### 5.3. Environment `production` (tùy chọn)

Workflow khai báo `environment: production`. GitHub tự tạo environment này ở lần chạy đầu. Muốn duyệt tay trước mỗi lần deploy: **Settings → Environments → production → Required reviewers** → chọn chính bạn.

### 5.4. Kích hoạt

`workflow_run` chỉ hoạt động khi file `cd.yml` đã có trên nhánh mặc định (`main`). Đưa lên lần đầu:

```bash
git checkout main
git merge dev
git push origin main
```

Vào tab **Actions** trên GitHub: thấy **CI** chạy xong rồi **CD** tự chạy. Có thể bấm **Run workflow** trong mục CD để deploy tay.

## 6. Quy trình làm việc hằng ngày

```bash
# Code trên dev, push để CI kiểm tra
git checkout dev
git commit -am "feat: ..."
git push origin dev

# Muốn đưa lên production: gộp vào main
git checkout main
git merge dev
git push origin main      # → CI → CD tự deploy
git checkout dev
```

Hoặc tạo Pull Request `dev → main` trên GitHub rồi Merge.

## 7. Vận hành & xử lý sự cố

Chạy trên VPS, trong `/opt/chefai`:

```bash
docker compose ps                        # trạng thái container
docker compose logs -f backend           # log backend
docker compose logs -f frontend          # log Nginx trong container
docker compose restart backend           # khởi động lại sau khi sửa backend/.env
docker compose up -d --build             # build lại thủ công
sudo tail -f /var/log/nginx/error.log    # log Nginx máy chủ
```

Quay lại phiên bản trước:

```bash
git log --oneline -5
git reset --hard <commit_cũ>
docker compose up -d --build
```

(Lần push `main` tiếp theo sẽ deploy lại bản mới nhất.)

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Cloudflare báo **521** | Nginx máy chủ chưa chạy hoặc ufw chặn 443 → `systemctl status nginx`, `ufw status` |
| Cloudflare báo **526** | Chế độ Full (strict) nhưng chưa cài chứng chỉ Origin đúng (mục 4.1) |
| **502 Bad Gateway** | Container chưa chạy → `docker compose ps`, xem log backend |
| Lỗi **CORS** trên trình duyệt | `CORS_ORIGIN` trong `/opt/chefai/.env` sai, phải đúng `https://chefai.hbest.net` (không có `/` cuối) |
| Link trong email trỏ về `localhost` | Như trên: `CORS_ORIGIN` chưa đặt |
| CD lỗi `Permission denied (publickey)` | Sai `VPS_SSH_KEY` hoặc public key chưa nằm trong `~deploy/.ssh/authorized_keys` |
| CD lỗi `permission denied ... docker.sock` | User `deploy` chưa thuộc nhóm `docker` → `usermod -aG docker deploy` rồi đăng nhập lại |
| Build bị `Killed` | Thiếu RAM → tạo swap (mục 1) |
