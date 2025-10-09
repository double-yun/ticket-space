-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "kakaoId" TEXT,
    "phoneNumber" TEXT,
    "phoneVerified" BOOLEAN DEFAULT false,
    "birthDate" TEXT,
    "gender" TEXT,
    "walletAddress" TEXT,
    "privyUserId" TEXT,
    "privyWalletId" TEXT,
    "pointBalance" INTEGER NOT NULL DEFAULT 0,
    "publicKey" TEXT,
    "keyAlgorithm" TEXT DEFAULT 'ECDSA_P256',
    "keyCreatedAt" DATETIME,
    "deviceInfo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "events" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ticketCount" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "deadline" DATETIME NOT NULL,
    "saleStart" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "lottery_rounds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" INTEGER NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resultHash" TEXT,
    "drawnAt" DATETIME,
    "applicationDeadline" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lottery_rounds_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lottery_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "priority" INTEGER,
    "applicationTxHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentDeadline" DATETIME,
    "pointAmount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lottery_applications_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "lottery_rounds" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lottery_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT,
    "eventId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" BIGINT,
    "txHash" TEXT,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tickets_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "lottery_applications" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "point_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "point_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "auth_challenges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_kakaoId_key" ON "users"("kakaoId");

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "users_privyUserId_key" ON "users"("privyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_privyWalletId_key" ON "users"("privyWalletId");

-- CreateIndex
CREATE UNIQUE INDEX "users_publicKey_key" ON "users"("publicKey");

-- CreateIndex
CREATE INDEX "events_deadline_idx" ON "events"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "events_title_deadline_key" ON "events"("title", "deadline");

-- CreateIndex
CREATE INDEX "lottery_rounds_applicationDeadline_idx" ON "lottery_rounds"("applicationDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "lottery_rounds_eventId_roundNumber_key" ON "lottery_rounds"("eventId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "lottery_applications_applicationTxHash_key" ON "lottery_applications"("applicationTxHash");

-- CreateIndex
CREATE INDEX "lottery_applications_paymentDeadline_idx" ON "lottery_applications"("paymentDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "lottery_applications_roundId_userId_key" ON "lottery_applications"("roundId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_applicationId_key" ON "tickets"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_txHash_key" ON "tickets"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_eventId_tokenId_key" ON "tickets"("eventId", "tokenId");

-- CreateIndex
CREATE INDEX "point_history_userId_idx" ON "point_history"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_challenges_challenge_key" ON "auth_challenges"("challenge");

-- CreateIndex
CREATE INDEX "auth_challenges_userId_idx" ON "auth_challenges"("userId");

-- CreateIndex
CREATE INDEX "auth_challenges_challenge_idx" ON "auth_challenges"("challenge");

-- CreateIndex
CREATE INDEX "auth_challenges_expiresAt_idx" ON "auth_challenges"("expiresAt");
