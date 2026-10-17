#!/bin/sh
# Copies the local dumps to S3-compatible storage every
# BACKUP_OFFSITE_INTERVAL_SECONDS. `copy` never deletes remote objects, so
# set retention with a lifecycle rule on the bucket instead.
set -eu

interval="${BACKUP_OFFSITE_INTERVAL_SECONDS:-3600}"
destination="offsite:${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}"

while true; do
	if rclone copy /backups "$destination" --exclude '.*' --s3-no-check-bucket; then
		echo "backup-offsite: synced to ${destination}"
	else
		echo "backup-offsite: copy to ${destination} failed" >&2
	fi
	sleep "$interval"
done
