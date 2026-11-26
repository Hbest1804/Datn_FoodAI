#!/usr/bin/env bash
# Thử khôi phục một bản sao lưu vào Postgres tạm (Docker), đếm số dòng rồi xóa container.
# Không đụng tới CSDL thật trên Supabase.
#   ./restore-test.sh                       # dùng bản mới nhất trong /opt/chefai-backup/dumps
#   ./restore-test.sh path/to/file.dump
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/chefai-backup}"
DUMP="${1:-$(ls -1t "$BACKUP_DIR"/dumps/chefai_*.dump | head -n 1)}"
DUMP="$(realpath "$DUMP")"
NAME=chefai-restore-test
IMAGE="${RESTORE_IMAGE:-pgvector/pgvector:pg17}"

echo "Khôi phục thử từ: $DUMP"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test -v "$DUMP:/tmp/b.dump:ro" "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
until docker exec "$NAME" pg_isready -U postgres -q; do sleep 1; done
sleep 2

# Trên Supabase, extension thường nằm ở schema "extensions"; nếu bản dump dùng public.vector thì tạo ở public
EXT_SCHEMA=public
if docker exec "$NAME" pg_restore --schema-only -f - /tmp/b.dump | grep -q 'extensions\.vector'; then
  EXT_SCHEMA=extensions
fi

# Giả lập phần Supabase mà schema public tham chiếu tới: auth.users, auth.uid()
docker exec -i "$NAME" psql -q -U postgres -v ON_ERROR_STOP=1 <<SQL
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
CREATE EXTENSION IF NOT EXISTS vector   SCHEMA $EXT_SCHEMA;
CREATE EXTENSION IF NOT EXISTS pg_trgm  SCHEMA $EXT_SCHEMA;
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA $EXT_SCHEMA;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA $EXT_SCHEMA;
SQL

echo "Đang khôi phục (lỗi users_id_auth_fkey là bình thường: tài khoản Supabase Auth không nằm trong bản sao lưu)..."
docker exec "$NAME" pg_restore -U postgres -d postgres --no-owner --no-privileges /tmp/b.dump 2>&1 \
  | grep -E 'error|lỗi|warning' || true

docker exec "$NAME" psql -U postgres -c "
SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') AS so_bang,
       (SELECT count(*) FROM dishes)          AS mon,
       (SELECT count(*) FROM ingredients)     AS nguyen_lieu,
       (SELECT count(*) FROM dish_embeddings) AS embedding,
       (SELECT count(*) FROM users)           AS nguoi_dung;"
echo "Ngày thử khôi phục: $(date '+%d/%m/%Y %H:%M')"
