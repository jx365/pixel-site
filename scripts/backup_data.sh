#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
API_CONTAINER_ID="$(docker compose -f "${ROOT_DIR}/docker-compose.yml" ps -q api)"

mkdir -p "${BACKUP_DIR}"
if [[ -z "${API_CONTAINER_ID}" ]]; then
  echo "api 容器未运行，请先执行 docker compose up -d" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
docker cp "${API_CONTAINER_ID}:/app/data/pixel_art.db" "${TMP_DIR}/pixel_art.db"
docker cp "${API_CONTAINER_ID}:/app/uploads" "${TMP_DIR}/uploads"
tar -czf "${BACKUP_DIR}/pixel_backup_${TIMESTAMP}.tar.gz" -C "${TMP_DIR}" pixel_art.db uploads
rm -rf "${TMP_DIR}"

echo "备份完成: ${BACKUP_DIR}/pixel_backup_${TIMESTAMP}.tar.gz"
