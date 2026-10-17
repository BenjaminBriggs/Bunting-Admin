-- CreateEnum
CREATE TYPE "public"."SigningKeyStatus" AS ENUM ('active', 'standby', 'retired');

-- AlterTable
ALTER TABLE "public"."signing_keys" ADD COLUMN "status" "public"."SigningKeyStatus" NOT NULL DEFAULT 'standby';

-- Data migration: is_active=true becomes ACTIVE, is_active=false becomes RETIRED.
-- Older builds could leave more than one active key per app; the newest one is
-- the key that was signing, so it stays ACTIVE and the rest become STANDBY
-- (they were in every bootstrap file served while active, so they stay trusted).
UPDATE "public"."signing_keys" AS sk
SET "status" = CASE
    WHEN NOT sk."is_active" THEN 'retired'::"public"."SigningKeyStatus"
    WHEN ranked."rn" = 1 THEN 'active'::"public"."SigningKeyStatus"
    ELSE 'standby'::"public"."SigningKeyStatus"
END
FROM (
    SELECT "id", ROW_NUMBER() OVER (
        PARTITION BY "app_id", "is_active"
        ORDER BY "created_at" DESC, "id" DESC
    ) AS "rn"
    FROM "public"."signing_keys"
) AS ranked
WHERE ranked."id" = sk."id";

-- AlterTable
ALTER TABLE "public"."signing_keys" DROP COLUMN "is_active";

-- DropForeignKey
ALTER TABLE "public"."signing_keys" DROP CONSTRAINT "signing_keys_app_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."signing_keys" ADD CONSTRAINT "signing_keys_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
