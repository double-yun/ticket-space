/*
  Warnings:

  - A unique constraint covering the columns `[recoveryCodeHash]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "encryptedPublicKey" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "recoveryCodeCreatedAt" TIMESTAMP(3),
ADD COLUMN     "recoveryCodeHash" TEXT;

-- CreateTable
CREATE TABLE "public_key_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "keyAlgorithm" TEXT NOT NULL DEFAULT 'ECDSA_P256',
    "reason" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_key_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "public_key_history_userId_createdAt_idx" ON "public_key_history"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "recovery_attempts_userId_createdAt_idx" ON "recovery_attempts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "recovery_attempts_ipAddress_createdAt_idx" ON "recovery_attempts"("ipAddress", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_recoveryCodeHash_key" ON "users"("recoveryCodeHash");

-- AddForeignKey
ALTER TABLE "public_key_history" ADD CONSTRAINT "public_key_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_attempts" ADD CONSTRAINT "recovery_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
