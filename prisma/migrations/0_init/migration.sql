-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AccessType" AS ENUM ('email', 'domain');

-- CreateEnum
CREATE TYPE "public"."FlagType" AS ENUM ('bool', 'string', 'int', 'double', 'date', 'json');

-- CreateEnum
CREATE TYPE "public"."TestRolloutType" AS ENUM ('test', 'rollout');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('admin', 'developer');

-- CreateTable
CREATE TABLE "public"."access_list" (
    "id" TEXT NOT NULL,
    "type" "public"."AccessType" NOT NULL,
    "value" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "access_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."apps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "artifact_url" TEXT NOT NULL,
    "public_keys" JSONB NOT NULL,
    "fetch_policy" JSONB NOT NULL,
    "storage_config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "config_version" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "published_by" TEXT,
    "changelog" TEXT,
    "config_diff" JSONB NOT NULL,
    "artifact_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "app_id" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "type" "public"."FlagType" NOT NULL,
    "description" TEXT,
    "group" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "first_published_at" TIMESTAMP(3),
    "last_published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "default_values" JSONB NOT NULL,
    "variants" JSONB NOT NULL DEFAULT '{}',
    "app_id" TEXT NOT NULL,

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."publications" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "configSize" INTEGER NOT NULL,
    "signature" TEXT NOT NULL,
    "detached_signature" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "published_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "app_id" TEXT NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rules" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "flagOverrides" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "environment" TEXT NOT NULL DEFAULT 'development',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "app_id" TEXT NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."signing_keys" (
    "id" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'RS256',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "app_id" TEXT NOT NULL,

    CONSTRAINT "signing_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_rollouts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."TestRolloutType" NOT NULL,
    "group" TEXT,
    "salt" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "variants" JSONB,
    "percentage" INTEGER,
    "rolloutValues" JSONB,
    "flagIds" JSONB NOT NULL DEFAULT '[]',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "app_id" TEXT NOT NULL,

    CONSTRAINT "test_rollouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'developer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_list_type_value_key" ON "public"."access_list"("type" ASC, "value" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "apps_identifier_key" ON "public"."apps"("identifier" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "flags_app_id_key_key" ON "public"."flags"("app_id" ASC, "key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "publications_app_id_environment_version_key" ON "public"."publications"("app_id" ASC, "environment" ASC, "version" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "rules_app_id_key_key" ON "public"."rules"("app_id" ASC, "key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "signing_keys_app_id_kid_key" ON "public"."signing_keys"("app_id" ASC, "kid" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "signing_keys_kid_key" ON "public"."signing_keys"("kid" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "test_rollouts_app_id_key_key" ON "public"."test_rollouts"("app_id" ASC, "key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."access_list" ADD CONSTRAINT "access_list_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."flags" ADD CONSTRAINT "flags_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."publications" ADD CONSTRAINT "publications_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rules" ADD CONSTRAINT "rules_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signing_keys" ADD CONSTRAINT "signing_keys_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."test_rollouts" ADD CONSTRAINT "test_rollouts_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

