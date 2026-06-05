#!/bin/sh
set -eu

role="${1:-api}"

case "$role" in
  api)
    echo "[entrypoint] applying database migrations"
    npm run db:deploy
    echo "[entrypoint] seeding database"
    npm run db:seed
    echo "[entrypoint] starting API"
    exec npm run start
    ;;
  worker)
    echo "[entrypoint] starting worker"
    exec npm run start:worker
    ;;
  *)
    exec "$@"
    ;;
esac
