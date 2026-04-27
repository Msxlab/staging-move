CREATE TABLE "MobileOAuthCode" (
    "id" VARCHAR(30) NOT NULL,
    "userId" VARCHAR(30) NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "redirectUri" VARCHAR(500) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileOAuthCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileOAuthCode_codeHash_key" ON "MobileOAuthCode"("codeHash");
CREATE INDEX "MobileOAuthCode_userId_idx" ON "MobileOAuthCode"("userId");
CREATE INDEX "MobileOAuthCode_expiresAt_idx" ON "MobileOAuthCode"("expiresAt");
CREATE INDEX "MobileOAuthCode_usedAt_idx" ON "MobileOAuthCode"("usedAt");

ALTER TABLE "MobileOAuthCode"
ADD CONSTRAINT "MobileOAuthCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
