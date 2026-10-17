#!/bin/sh
# Dumps the database every BACKUP_INTERVAL_SECONDS into /backups and deletes
# local dumps older than BACKUP_KEEP_DAYS. backup-offsite.sh copies them off
# the host. Connection settings come from the standard PG* variables.
set -eu

interval="${BACKUP_INTERVAL_SECONDS:-86400}"
keep_days="${BACKUP_KEEP_DAYS:-14}"

while true; do
	stamp="$(date -u +%Y%m%dT%H%M%SZ)"
	# Written under a dot-name first so the offsite copy never sees a partial dump.
	partial="/backups/.bunting-${stamp}.dump"
	if pg_dump --format=custom --file="$partial"; then
		mv "$partial" "/backups/bunting-${stamp}.dump"
		echo "backup: wrote bunting-${stamp}.dump"
	else
		rm -f "$partial"
		echo "backup: pg_dump failed" >&2
	fi
	find /backups -name 'bunting-*.dump' -mtime +"$keep_days" -exec rm -f {} \;
	sleep "$interval"
done
