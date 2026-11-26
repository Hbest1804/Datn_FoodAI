#!/usr/bin/env bash
# Sao lưu CSDL Supabase bằng pg_dump (HLD mục 9).
# - Chạy pg_dump qua Docker nên không cần cài postgresql-client trên VPS.
# - Giữ KEEP bản mới nhất trong $BACKUP_DIR/dumps.
# - Nếu đặt RCLONE_REMOTE thì chép thêm một bản ra ngoài VPS.
#
# Cấu hình trong $BACKUP_DIR/.env (không đưa lên Git, chmod 600):
#   DB_URL=postgresql://postgres.<ref>:<mật khẩu>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
#   RCLONE_REMOTE=gdrive:chefai-backup     # tùy chọn
#   PG_IMAGE=postgres:17                    # tùy chọn, >= phiên bản Postgres của Supabase
#   KEEP=7                                  # tùy chọn
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/chefai-backup}"
cd "$BACKUP_DIR"
set -a; source ./.env; set +a
: "${DB_URL:?Chưa đặt DB_URL trong $BACKUP_DIR/.env}"
PG_IMAGE="${PG_IMAGE:-postgres:17}"
KEEP="${KEEP:-7}"

mkdir -p dumps
NAME="chefai_$(date +%F_%H%M).dump"

docker run --rm --network host -e DB_URL -v "$BACKUP_DIR/dumps:/dumps" "$PG_IMAGE" \
  sh -c 'pg_dump "$DB_URL" -Fc -n public --no-owner --no-privileges -f "/dumps/'"$NAME"'"'

# File dump do container (root) tạo, đổi chủ về user đang chạy để xóa được về sau
docker run --rm -v "$BACKUP_DIR/dumps:/dumps" "$PG_IMAGE" chown "$(id -u):$(id -g)" "/dumps/$NAME"

# Giữ KEEP bản mới nhất
ls -1t dumps/chefai_*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm -f

if [ -n "${RCLONE_REMOTE:-}" ]; then
  if rclone copy "dumps/$NAME" "$RCLONE_REMOTE"; then
    echo "$(date '+%F %T') Đã chép $NAME lên $RCLONE_REMOTE"
  else
    echo "$(date '+%F %T') CẢNH BÁO: chép $NAME lên $RCLONE_REMOTE thất bại"
  fi
fi

echo "$(date '+%F %T') OK dumps/$NAME $(du -h "dumps/$NAME" | cut -f1), đang giữ $(ls dumps/chefai_*.dump | wc -l) bản"
