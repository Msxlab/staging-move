-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE_TRIAL',
    "status" TEXT NOT NULL DEFAULT 'TRIALING',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "stripeCurrentPeriodEnd" DATETIME,
    "trialEndsAt" DATETIME,
    "canceledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ageRange" TEXT,
    "familyStatus" TEXT,
    "hasChildren" BOOLEAN NOT NULL DEFAULT false,
    "childrenCount" INTEGER NOT NULL DEFAULT 0,
    "hasSenior" BOOLEAN NOT NULL DEFAULT false,
    "hasDisability" BOOLEAN NOT NULL DEFAULT false,
    "hasPets" BOOLEAN NOT NULL DEFAULT false,
    "petTypes" TEXT NOT NULL DEFAULT '[]',
    "carCount" INTEGER NOT NULL DEFAULT 0,
    "hasMotorcycle" BOOLEAN NOT NULL DEFAULT false,
    "hasBoatRV" BOOLEAN NOT NULL DEFAULT false,
    "needsStorage" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATETIME,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "isChild" BOOLEAN NOT NULL DEFAULT false,
    "childName" TEXT,
    "childAge" INTEGER,
    "childGrade" TEXT,
    "canManageServices" BOOLEAN NOT NULL DEFAULT true,
    "canManageBudget" BOOLEAN NOT NULL DEFAULT true,
    "canManageBilling" BOOLEAN NOT NULL DEFAULT false,
    "canInviteMembers" BOOLEAN NOT NULL DEFAULT false,
    "invitedBy" TEXT,
    "invitedAt" DATETIME,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nickname" TEXT,
    "street" TEXT NOT NULL,
    "street2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'USA',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "ownership" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "latitude" REAL,
    "longitude" REAL,
    "placeId" TEXT,
    "formattedAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "providerName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "username" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "monthlyCost" REAL,
    "billingDay" INTEGER,
    "billingCycle" TEXT,
    "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
    "contractEndDate" DATETIME,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" DATETIME,
    "deactivatedAt" DATETIME,
    "personalRating" INTEGER,
    "personalReview" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Service_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Service_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fromAddressId" TEXT NOT NULL,
    "toAddressId" TEXT NOT NULL,
    "moveDate" DATETIME NOT NULL,
    "isTemporary" BOOLEAN NOT NULL DEFAULT false,
    "estimatedDuration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MovingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MovingPlan_fromAddressId_fkey" FOREIGN KEY ("fromAddressId") REFERENCES "Address" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovingPlan_toAddressId_fkey" FOREIGN KEY ("toAddressId") REFERENCES "Address" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "movingPlanId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "dueDate" DATETIME,
    "daysBeforeMove" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_movingPlanId_fkey" FOREIGN KEY ("movingPlanId") REFERENCES "MovingPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovingBox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "movingPlanId" TEXT NOT NULL,
    "boxNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "room" TEXT,
    "contents" TEXT NOT NULL,
    "isFragile" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "qrCode" TEXT NOT NULL,
    "isPacked" BOOLEAN NOT NULL DEFAULT false,
    "packedAt" DATETIME,
    "isUnpacked" BOOLEAN NOT NULL DEFAULT false,
    "unpackedAt" DATETIME,
    "photoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MovingBox_movingPlanId_fkey" FOREIGN KEY ("movingPlanId") REFERENCES "MovingPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "category" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "ocrProcessed" BOOLEAN NOT NULL DEFAULT false,
    "ocrText" TEXT,
    "extractedData" TEXT,
    "documentDate" DATETIME,
    "description" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "addressId" TEXT,
    "month" DATETIME NOT NULL,
    "year" INTEGER NOT NULL,
    "plannedIncome" REAL,
    "actualIncome" REAL,
    "plannedExpenses" REAL,
    "actualExpenses" REAL NOT NULL,
    "categoryBreakdown" TEXT,
    "savingsRate" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Budget_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "remindAt" DATETIME NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" DATETIME,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reminder_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "speedRating" INTEGER,
    "reliabilityRating" INTEGER,
    "customerServiceRating" INTEGER,
    "valueRating" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "moderatedAt" DATETIME,
    "moderatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,
    "category" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "requirementData" TEXT,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StateRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stateCode" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "dmvRules" TEXT,
    "voterRegistration" TEXT,
    "utilityInfo" TEXT,
    "taxInfo" TEXT,
    "insuranceRules" TEXT,
    "commonProviders" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ServiceProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "description" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "logoUrl" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'FEDERAL',
    "states" TEXT NOT NULL DEFAULT '[]',
    "zipCodes" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "popularityScore" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_userId_key" ON "FamilyMember"("userId");

-- CreateIndex
CREATE INDEX "FamilyMember_userId_idx" ON "FamilyMember"("userId");

-- CreateIndex
CREATE INDEX "FamilyMember_familyId_idx" ON "FamilyMember"("familyId");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE INDEX "Address_zip_idx" ON "Address"("zip");

-- CreateIndex
CREATE INDEX "Address_state_idx" ON "Address"("state");

-- CreateIndex
CREATE INDEX "Service_userId_idx" ON "Service"("userId");

-- CreateIndex
CREATE INDEX "Service_addressId_idx" ON "Service"("addressId");

-- CreateIndex
CREATE INDEX "Service_category_idx" ON "Service"("category");

-- CreateIndex
CREATE INDEX "Service_providerName_idx" ON "Service"("providerName");

-- CreateIndex
CREATE INDEX "Service_userId_isActive_idx" ON "Service"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Service_userId_category_idx" ON "Service"("userId", "category");

-- CreateIndex
CREATE INDEX "MovingPlan_userId_idx" ON "MovingPlan"("userId");

-- CreateIndex
CREATE INDEX "MovingPlan_fromAddressId_idx" ON "MovingPlan"("fromAddressId");

-- CreateIndex
CREATE INDEX "MovingPlan_toAddressId_idx" ON "MovingPlan"("toAddressId");

-- CreateIndex
CREATE INDEX "MovingPlan_moveDate_idx" ON "MovingPlan"("moveDate");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "Task_movingPlanId_idx" ON "Task"("movingPlanId");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_completed_idx" ON "Task"("completed");

-- CreateIndex
CREATE INDEX "Task_userId_completed_idx" ON "Task"("userId", "completed");

-- CreateIndex
CREATE INDEX "Task_userId_dueDate_idx" ON "Task"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "MovingBox_qrCode_key" ON "MovingBox"("qrCode");

-- CreateIndex
CREATE INDEX "MovingBox_movingPlanId_idx" ON "MovingBox"("movingPlanId");

-- CreateIndex
CREATE INDEX "MovingBox_qrCode_idx" ON "MovingBox"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "MovingBox_movingPlanId_boxNumber_key" ON "MovingBox"("movingPlanId", "boxNumber");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_serviceId_idx" ON "Document"("serviceId");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX "Budget_userId_idx" ON "Budget"("userId");

-- CreateIndex
CREATE INDEX "Budget_month_idx" ON "Budget"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_userId_addressId_month_key" ON "Budget"("userId", "addressId", "month");

-- CreateIndex
CREATE INDEX "Reminder_remindAt_sent_idx" ON "Reminder"("remindAt", "sent");

-- CreateIndex
CREATE INDEX "Reminder_serviceId_idx" ON "Reminder"("serviceId");

-- CreateIndex
CREATE INDEX "Review_providerName_idx" ON "Review"("providerName");

-- CreateIndex
CREATE INDEX "Review_category_idx" ON "Review"("category");

-- CreateIndex
CREATE INDEX "Review_zipCode_idx" ON "Review"("zipCode");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "Review_isVerified_idx" ON "Review"("isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_code_key" ON "Badge"("code");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "StateRule_stateCode_key" ON "StateRule"("stateCode");

-- CreateIndex
CREATE INDEX "StateRule_stateCode_idx" ON "StateRule"("stateCode");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProvider_slug_key" ON "ServiceProvider"("slug");

-- CreateIndex
CREATE INDEX "ServiceProvider_category_idx" ON "ServiceProvider"("category");

-- CreateIndex
CREATE INDEX "ServiceProvider_scope_idx" ON "ServiceProvider"("scope");

-- CreateIndex
CREATE INDEX "ServiceProvider_slug_idx" ON "ServiceProvider"("slug");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
