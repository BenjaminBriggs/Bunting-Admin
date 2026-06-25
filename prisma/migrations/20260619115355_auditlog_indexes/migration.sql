-- CreateIndex
CREATE INDEX "audit_logs_app_id_config_version_idx" ON "audit_logs"("app_id", "config_version");

-- CreateIndex
CREATE INDEX "audit_logs_app_id_published_at_idx" ON "audit_logs"("app_id", "published_at");
