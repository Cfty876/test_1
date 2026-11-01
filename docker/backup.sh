#!/bin/sh
set -eu
umask 077
export PGPASSWORD="$POSTGRES_PASSWORD"
mkdir -p /backups
chmod 700 /backups
while true; do
  stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
  target="/backups/pervik-${stamp}.dump"
  if pg_dump -Fc --file "${target}.tmp"; then
    mv "${target}.tmp" "$target"
    touch /backups/last-success
    echo "Database backup completed: ${stamp}"
    find /backups -maxdepth 1 -type f -name 'pervik-*.dump' -mtime +13 -delete
    sleep 86400
  else
    echo 'Database backup failed; retrying in 5 minutes' >&2
    rm -f "${target}.tmp"
    sleep 300
  fi
done
