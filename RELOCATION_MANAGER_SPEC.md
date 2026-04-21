# 🏠 LocateFlow - Address & Moving Management System

## Comprehensive Project Specification

---

## 📋 TABLE OF CONTENTS

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Database Schema](#database-schema)
4. [Project Structure](#project-structure)
5. [Feature Specifications](#feature-specifications)
6. [UI/UX Design Guidelines](#uiux-design-guidelines)
7. [API Endpoints](#api-endpoints)
8. [Business Logic & Rules](#business-logic--rules)
9. [Implementation Phases](#implementation-phases)
10. [Deployment & Infrastructure](#deployment--infrastructure)

---

## 🎯 PROJECT OVERVIEW

### What is LocateFlow?

A comprehensive SaaS application for managing addresses, services, and moving processes in the United States. Users can track all their service subscriptions (utilities, banks, insurance, etc.) across multiple addresses, and get intelligent assistance when relocating.

### Target Market

- **Primary:** US residents who are moving or managing multiple addresses
- **Secondary:** Families coordinating household services
- **Geography:** United States (state-specific features)

### Core Value Propositions

1. **Centralized Service Management:** One place to track all subscriptions and services
2. **Moving Assistant:** Rule-based, state-aware checklist and timeline for relocations (LLM-powered generation deferred to Phase 2 — currently tracked as a roadmap item, not a shipped feature)
3. **Budget Tracking:** Monitor monthly expenses across all services
4. **Document Management:** Store and OCR contracts, bills, and important papers
5. **Community Intelligence:** Verified reviews and recommendations by location

---

## 🛠 TECH STACK

### Monorepo Structure

```
pnpm workspaces (Turborepo optional)
```

### Frontend (apps/web)

- **Framework:** Next.js 15.1+ (App Router)
- **Language:** TypeScript 5.3+
- **Styling:** Tailwind CSS 3.4+
- **UI Components:** shadcn/ui
- **State Management:** Zustand or Jotai
- **Forms:** React Hook Form + Zod validation
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Maps:** @googlemaps/js-api-loader
- **PWA:** next-pwa
- **Charts:** Recharts

### Backend (apps/api - optional, can use Next.js API routes)

- **Framework:** Express.js (if separate API needed)
- **Language:** TypeScript
- **Validation:** Zod

### Database (packages/db)

- **ORM:** Prisma 5.x
- **Development:** SQLite
- **Production:** PostgreSQL 15+ (Supabase or Neon)
- **Migrations:** Prisma Migrate

### Authentication

- **Provider:** In-house JWT auth
- **Features:** Email/password, Google/Apple OAuth, cookie sessions (web), Bearer tokens (mobile), MFA, session management

### External Services

- **File Storage:** Cloudinary or AWS S3
- **OCR:**
  - MVP: Tesseract.js
  - Phase 2: Google Vision API
- **Payments:** Stripe
- **Email:** Resend or SendGrid
- **Maps:** Google Maps API (Places, Geocoding)
- **AI (Phase 2, not yet integrated):** Anthropic Claude API planned for narrative checklist generation and explainability. Current production build ships rule-based logic only; any "AI" references elsewhere in this doc describe the Phase 2 target.
- **Analytics:** Vercel Analytics + PostHog
- **Error Tracking:** Sentry

---

## 🗄 DATABASE SCHEMA

### Complete Prisma Schema

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // Use "sqlite" for development
  url      = env("DATABASE_URL")
}

// ==================== USER & AUTH ====================

model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String   @unique
  firstName String?
  lastName  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Subscription
  subscription   Subscription?

  // Relations
  profile        Profile?
  addresses      Address[]
  services       Service[]
  tasks          Task[]
  budgets        Budget[]
  documents      Document[]
  movingPlans    MovingPlan[]
  reviews        Review[]
  badges         UserBadge[]
  familyMember   FamilyMember?

  @@index([clerkId])
  @@index([email])
}

model Subscription {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  plan      SubscriptionPlan
  status    SubscriptionStatus

  stripeCustomerId       String?   @unique
  stripeSubscriptionId   String?   @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?

  trialEndsAt DateTime?
  canceledAt  DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([stripeCustomerId])
}

enum SubscriptionPlan {
  FREE_TRIAL
  INDIVIDUAL_MONTHLY
  INDIVIDUAL_YEARLY
  FAMILY_MONTHLY
  FAMILY_YEARLY
}

enum SubscriptionStatus {
  ACTIVE
  CANCELED
  PAST_DUE
  TRIALING
  INCOMPLETE
}

// ==================== PROFILE ====================

model Profile {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Demographics
  ageRange         String?
  familyStatus     FamilyStatus?

  // Household
  hasChildren      Boolean          @default(false)
  childrenCount    Int              @default(0)
  childrenAges     Int[]            // Array of ages
  hasSenior        Boolean          @default(false)
  hasDisability    Boolean          @default(false)
  hasPets          Boolean          @default(false)
  petTypes         String[]         // ["dog", "cat"]

  // Assets
  carCount         Int              @default(0)
  hasMotorcycle    Boolean          @default(false)
  hasBoatRV        Boolean          @default(false)
  needsStorage     Boolean          @default(false)

  // Preferences
  preferredLanguage String          @default("en")
  timezone          String          @default("America/New_York")

  // Gamification
  currentStreak    Int              @default(0)
  longestStreak    Int              @default(0)
  lastActiveDate   DateTime?
  totalPoints      Int              @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}

enum FamilyStatus {
  SINGLE
  COUPLE
  FAMILY
  OTHER
}

// ==================== FAMILY MANAGEMENT ====================

model FamilyMember {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  familyId  String
  role      FamilyRole

  // For child profiles
  isChild        Boolean  @default(false)
  childName      String?
  childAge       Int?
  childGrade     String?

  // Permissions
  canManageServices   Boolean @default(true)
  canManageBudget     Boolean @default(true)
  canManageBilling    Boolean @default(false)
  canInviteMembers    Boolean @default(false)

  invitedBy String?
  invitedAt DateTime?
  acceptedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([familyId])
}

enum FamilyRole {
  ADMIN
  PARTNER
  CHILD
}

// ==================== ADDRESSES ====================

model Address {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Address details
  type      AddressType
  nickname  String?         // "Home", "Beach House", "Mom's Place"

  street    String
  street2   String?
  city      String
  state     String          // Two-letter code: "NJ", "TX"
  zip       String
  country   String          @default("USA")

  // Metadata
  isPrimary    Boolean      @default(false)
  ownership    OwnershipType

  // Dates
  startDate    DateTime
  endDate      DateTime?

  // Google Maps integration
  latitude     Float?
  longitude    Float?
  placeId      String?
  formattedAddress String?

  // Relations
  services     Service[]
  budgets      Budget[]
  movingPlansFrom MovingPlan[] @relation("FromAddress")
  movingPlansTo   MovingPlan[] @relation("ToAddress")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([zip])
  @@index([state])
}

enum AddressType {
  HOME
  WORK
  VACATION
  TEMPORARY
  STORAGE
  OTHER
}

enum OwnershipType {
  OWNER
  RENTER
  FAMILY
  OTHER
}

// ==================== SERVICES ====================

model Service {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  addressId   String
  address     Address  @relation(fields: [addressId], references: [id], onDelete: Cascade)

  // Service details
  category    ServiceCategory
  subCategory String?           // "Electric", "Gas", "Fiber Internet"
  providerName String

  // Account info
  accountNumber String?
  username      String?

  // Contact
  website       String?
  phone         String?
  email         String?

  // Billing
  monthlyCost   Float?
  billingDay    Int?            // Day of month (1-31)
  billingCycle  BillingCycle?
  autoRenewal   Boolean         @default(false)
  contractEndDate DateTime?

  // Additional info
  notes         String?

  // Status
  isActive      Boolean         @default(true)
  activatedAt   DateTime?
  deactivatedAt DateTime?

  // User rating (for community reviews)
  personalRating Int?           // 1-5
  personalReview String?

  // Relations
  documents     Document[]
  reminders     Reminder[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([addressId])
  @@index([category])
  @@index([providerName])
}

enum ServiceCategory {
  // Utilities
  UTILITY_ELECTRIC
  UTILITY_GAS
  UTILITY_WATER
  UTILITY_SEWER
  UTILITY_TRASH
  UTILITY_INTERNET
  UTILITY_CABLE
  UTILITY_PHONE

  // Financial
  FINANCIAL_BANK
  FINANCIAL_CREDIT_CARD
  FINANCIAL_INVESTMENT
  FINANCIAL_INSURANCE_AUTO
  FINANCIAL_INSURANCE_HOME
  FINANCIAL_INSURANCE_HEALTH
  FINANCIAL_INSURANCE_LIFE
  FINANCIAL_LOAN
  FINANCIAL_MORTGAGE

  // Government
  GOVERNMENT_DMV
  GOVERNMENT_VOTER
  GOVERNMENT_IRS
  GOVERNMENT_USCIS
  GOVERNMENT_SOCIAL_SECURITY
  GOVERNMENT_PASSPORT

  // Transportation
  TRANSPORTATION_TOLL
  TRANSPORTATION_PARKING
  TRANSPORTATION_TRANSIT
  TRANSPORTATION_AUTO_LEASE
  TRANSPORTATION_AUTO_LOAN

  // Shopping & Subscriptions
  SHOPPING_RETAIL
  SHOPPING_GROCERY
  SHOPPING_PHARMACY
  SHOPPING_SUBSCRIPTION

  // Housing
  HOUSING_HOA
  HOUSING_RENT
  HOUSING_LAWN_CARE
  HOUSING_PEST_CONTROL
  HOUSING_HOME_WARRANTY
  HOUSING_STORAGE

  // Healthcare
  HEALTHCARE_DOCTOR
  HEALTHCARE_DENTIST
  HEALTHCARE_SPECIALIST
  HEALTHCARE_PHARMACY

  // Kids
  KIDS_SCHOOL
  KIDS_DAYCARE
  KIDS_PEDIATRICIAN
  KIDS_ACTIVITY

  // Fitness & Wellness
  FITNESS_GYM
  FITNESS_STUDIO
  FITNESS_THERAPY

  // Other
  OTHER
}

enum BillingCycle {
  MONTHLY
  QUARTERLY
  YEARLY
  ONE_TIME
}

// ==================== MOVING PLAN ====================

model MovingPlan {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  fromAddressId String
  fromAddress   Address  @relation("FromAddress", fields: [fromAddressId], references: [id])

  toAddressId   String
  toAddress     Address  @relation("ToAddress", fields: [toAddressId], references: [id])

  // Move details
  moveDate      DateTime
  isTemporary   Boolean  @default(false)
  estimatedDuration Int? // Days if temporary

  status        MoveStatus @default(PLANNING)

  // Progress tracking
  totalTasks      Int @default(0)
  completedTasks  Int @default(0)

  // Relations
  tasks         Task[]
  boxes         MovingBox[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([fromAddressId])
  @@index([toAddressId])
  @@index([moveDate])
}

enum MoveStatus {
  PLANNING
  IN_PROGRESS
  COMPLETED
  CANCELED
}

// ==================== TASKS ====================

model Task {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  movingPlanId String?
  movingPlan   MovingPlan? @relation(fields: [movingPlanId], references: [id], onDelete: Cascade)

  // Task details
  title       String
  description String?
  category    String?     // "Government", "Utilities", "Healthcare"

  // Scheduling
  dueDate     DateTime?
  daysBeforeMove Int?     // For auto-generated tasks

  completed   Boolean   @default(false)
  completedAt DateTime?

  priority    Priority  @default(MEDIUM)

  // Assignment (for family plans)
  assignedTo  String?   // userId

  // Automation
  isAutoGenerated Boolean @default(false)
  templateId      String? // Reference to task template

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([movingPlanId])
  @@index([dueDate])
  @@index([completed])
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

// ==================== MOVING BOXES ====================

model MovingBox {
  id            String   @id @default(cuid())
  movingPlanId  String
  movingPlan    MovingPlan @relation(fields: [movingPlanId], references: [id], onDelete: Cascade)

  // Box details
  boxNumber     Int
  label         String      // "Kitchen Essentials"
  room          String?     // "Kitchen", "Bedroom 1"
  contents      String      // Text description

  // Metadata
  isFragile     Boolean     @default(false)
  priority      Priority    @default(MEDIUM)

  // QR Code
  qrCode        String      @unique // Generated unique ID

  // Packing status
  isPacked      Boolean     @default(false)
  packedAt      DateTime?

  // Unpacking status
  isUnpacked    Boolean     @default(false)
  unpackedAt    DateTime?

  // Optional photo
  photoUrl      String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([movingPlanId])
  @@index([qrCode])
  @@unique([movingPlanId, boxNumber])
}

// ==================== DOCUMENTS ====================

model Document {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  serviceId   String?
  service     Service? @relation(fields: [serviceId], references: [id], onDelete: SetNull)

  // File details
  fileName    String
  fileUrl     String
  fileType    String      // "application/pdf", "image/jpeg"
  fileSize    Int         // Bytes

  // Categorization
  category    DocumentCategory?
  tags        String[]

  // OCR results
  ocrProcessed   Boolean @default(false)
  ocrText        String? // Full extracted text
  extractedData  Json?   // Structured data: {accountNumber, amount, dueDate}

  // Metadata
  documentDate   DateTime?
  description    String?

  uploadedAt DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([userId])
  @@index([serviceId])
  @@index([category])
}

enum DocumentCategory {
  BILL
  CONTRACT
  RECEIPT
  INSURANCE_POLICY
  LEASE_AGREEMENT
  MORTGAGE_DOCUMENT
  TAX_DOCUMENT
  MEDICAL_RECORD
  SCHOOL_RECORD
  ID_DOCUMENT
  OTHER
}

// ==================== BUDGET ====================

model Budget {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  addressId   String?
  address     Address? @relation(fields: [addressId], references: [id], onDelete: SetNull)

  // Period
  month       DateTime // First day of month
  year        Int

  // Budget
  plannedIncome    Float?
  actualIncome     Float?
  plannedExpenses  Float?
  actualExpenses   Float

  // Breakdown (JSON for flexibility)
  categoryBreakdown Json? // {utilities: 450, financial: 200, ...}

  // Calculated fields
  savingsRate      Float?

  notes       String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, addressId, month])
  @@index([userId])
  @@index([month])
}

// ==================== REMINDERS ====================

model Reminder {
  id          String   @id @default(cuid())

  serviceId   String?
  service     Service? @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  // Reminder details
  type        ReminderType
  title       String
  message     String?

  // Scheduling
  remindAt    DateTime
  sent        Boolean   @default(false)
  sentAt      DateTime?

  // Recurrence
  isRecurring Boolean   @default(false)
  recurrenceRule String? // Cron expression or simple rule

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([remindAt, sent])
  @@index([serviceId])
}

enum ReminderType {
  BILL_DUE
  CONTRACT_EXPIRING
  MOVING_TASK
  ADDRESS_UPDATE
  CUSTOM
}

// ==================== COMMUNITY REVIEWS ====================

model Review {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // What's being reviewed
  providerName String
  category     ServiceCategory

  // Location context
  zipCode      String
  city         String
  state        String

  // Review content
  rating       Int        // 1-5
  title        String?
  content      String

  // Detailed ratings
  speedRating        Int?
  reliabilityRating  Int?
  customerServiceRating Int?
  valueRating        Int?

  // Metadata
  isVerified   Boolean    @default(false)
  helpfulCount Int        @default(0)
  reportCount  Int        @default(0)

  // Moderation
  isHidden     Boolean    @default(false)
  moderatedAt  DateTime?
  moderatedBy  String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([providerName])
  @@index([category])
  @@index([zipCode])
  @@index([rating])
  @@index([isVerified])
}

// ==================== GAMIFICATION ====================

model Badge {
  id          String   @id @default(cuid())

  // Badge details
  code        String   @unique  // "first_home", "task_tackler"
  name        String
  description String
  iconUrl     String?
  category    BadgeCategory

  // Requirements
  requirement String   // Human-readable
  requirementData Json? // Structured rules

  // Display
  rarity      BadgeRarity
  points      Int      @default(0)

  // Relations
  users       UserBadge[]

  createdAt DateTime @default(now())
}

enum BadgeCategory {
  GETTING_STARTED
  ORGANIZATION
  MOVING
  COMMUNITY
  STREAK
  SPECIAL
}

enum BadgeRarity {
  COMMON
  UNCOMMON
  RARE
  LEGENDARY
}

model UserBadge {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  badgeId     String
  badge       Badge    @relation(fields: [badgeId], references: [id], onDelete: Cascade)

  earnedAt    DateTime @default(now())

  @@unique([userId, badgeId])
  @@index([userId])
}

// ==================== STATE RULES & SUGGESTIONS ====================

model StateRule {
  id          String   @id @default(cuid())

  stateCode   String   @unique // "TX", "NJ"
  stateName   String

  // Rules (JSON for flexibility)
  dmvRules           Json?
  voterRegistration  Json?
  utilityInfo        Json?
  taxInfo            Json?
  insuranceRules     Json?

  // Common providers by category
  commonProviders    Json?

  updatedAt DateTime @updatedAt

  @@index([stateCode])
}

model ServiceSuggestion {
  id          String   @id @default(cuid())

  // Context
  category    ServiceCategory
  zipCode     String?
  state       String?

  // Suggestion
  providerName String
  description  String?
  websiteUrl   String?
  phoneNumber  String?

  // Popularity
  suggestionCount Int @default(0)

  // Display order
  displayOrder Int @default(0)

  isActive    Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category, state])
  @@index([zipCode])
}

// ==================== AUDIT LOG ====================

model AuditLog {
  id          String   @id @default(cuid())

  userId      String
  action      String      // "created_service", "updated_address"
  entityType  String      // "Service", "Address"
  entityId    String

  changes     Json?       // Before/after data
  ipAddress   String?
  userAgent   String?

  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
  @@index([entityType, entityId])
}

---
## 📁 PROJECT STRUCTURE

```

├── apps/
│ ├── web/ # Next.js frontend
│ │ ├── app/
│ │ │ ├── (auth)/ # Auth routes
│ │ │ │ ├── sign-in/
│ │ │ │ └── sign-up/
│ │ │ │
│ │ │ ├── (onboarding)/ # First-time setup wizard
│ │ │ │ ├── layout.tsx
│ │ │ │ ├── page.tsx # Step 1: Profile
│ │ │ │ ├── addresses/ # Step 2: Addresses
│ │ │ │ ├── services/ # Step 3: Services
│ │ │ │ └── moving/ # Step 4: Moving plan (optional)
│ │ │ │
│ │ │ ├── (app)/ # Main app (protected)
│ │ │ │ ├── layout.tsx # App shell with navigation
│ │ │ │ ├── dashboard/
│ │ │ │ │ └── page.tsx
│ │ │ │ │
│ │ │ │ ├── addresses/
│ │ │ │ │ ├── page.tsx
│ │ │ │ │ ├── [id]/
│ │ │ │ │ │ ├── page.tsx
│ │ │ │ │ │ └── edit/page.tsx
│ │ │ │ │ └── new/page.tsx
│ │ │ │ │
│ │ │ │ ├── services/
│ │ │ │ │ ├── page.tsx # List all services
│ │ │ │ │ ├── [id]/
│ │ │ │ │ │ ├── page.tsx # Service details
│ │ │ │ │ │ └── edit/page.tsx
│ │ │ │ │ └── new/page.tsx
│ │ │ │ │
│ │ │ │ ├── moving/
│ │ │ │ │ ├── page.tsx # Active moving plans
│ │ │ │ │ ├── [id]/
│ │ │ │ │ │ ├── page.tsx # Moving plan details
│ │ │ │ │ │ ├── tasks/ # Task management
│ │ │ │ │ │ ├── boxes/ # Box tracking
│ │ │ │ │ │ └── timeline/ # Visual timeline
│ │ │ │ │ └── new/page.tsx
│ │ │ │ │
│ │ │ │ ├── budget/
│ │ │ │ │ ├── page.tsx # Monthly budget view
│ │ │ │ │ └── [month]/page.tsx
│ │ │ │ │
│ │ │ │ ├── documents/
│ │ │ │ │ ├── page.tsx
│ │ │ │ │ └── upload/page.tsx
│ │ │ │ │
│ │ │ │ ├── community/
│ │ │ │ │ ├── page.tsx # Browse reviews
│ │ │ │ │ └── write/page.tsx
│ │ │ │ │
│ │ │ │ ├── family/
│ │ │ │ │ ├── page.tsx # Family members
│ │ │ │ │ └── invite/page.tsx
│ │ │ │ │
│ │ │ │ └── settings/
│ │ │ │ ├── page.tsx
│ │ │ │ ├── profile/
│ │ │ │ ├── subscription/
│ │ │ │ ├── notifications/
│ │ │ │ └── export/
│ │ │ │
│ │ │ ├── api/ # Next.js API routes
│ │ │ │ ├── auth/
│ │ │ │ ├── addresses/
│ │ │ │ ├── services/
│ │ │ │ ├── moving/
│ │ │ │ ├── budget/
│ │ │ │ ├── documents/
│ │ │ │ │ └── ocr/
│ │ │ │ ├── reviews/
│ │ │ │ ├── webhooks/
│ │ │ │ │ ├── stripe/
│ │ │ │ │ └── clerk/
│ │ │ │ └── cron/
│ │ │ │ └── reminders/
│ │ │ │
│ │ │ ├── box/ # Public QR code viewer
│ │ │ │ └── [qrCode]/page.tsx
│ │ │ │
│ │ │ └── pricing/
│ │ │ └── page.tsx
│ │ │
│ │ ├── components/
│ │ │ ├── ui/ # shadcn/ui components
│ │ │ ├── layout/
│ │ │ │ ├── header.tsx
│ │ │ │ ├── sidebar.tsx
│ │ │ │ └── mobile-nav.tsx
│ │ │ ├── dashboard/
│ │ │ │ ├── stats-card.tsx
│ │ │ │ ├── budget-widget.tsx
│ │ │ │ ├── upcoming-tasks.tsx
│ │ │ │ └── suggestions.tsx
│ │ │ ├── addresses/
│ │ │ │ ├── address-card.tsx
│ │ │ │ ├── address-form.tsx
│ │ │ │ └── address-selector.tsx
│ │ │ ├── services/
│ │ │ │ ├── service-card.tsx
│ │ │ │ ├── service-form.tsx
│ │ │ │ └── category-filter.tsx
│ │ │ ├── moving/
│ │ │ │ ├── timeline.tsx
│ │ │ │ ├── task-list.tsx
│ │ │ │ ├── task-item.tsx
│ │ │ │ └── progress-bar.tsx
│ │ │ ├── boxes/
│ │ │ │ ├── box-card.tsx
│ │ │ │ ├── qr-generator.tsx
│ │ │ │ └── packing-progress.tsx
│ │ │ ├── budget/
│ │ │ │ ├── expense-chart.tsx
│ │ │ │ └── category-breakdown.tsx
│ │ │ ├── documents/
│ │ │ │ ├── document-upload.tsx
│ │ │ │ ├── document-viewer.tsx
│ │ │ │ └── ocr-results.tsx
│ │ │ ├── community/
│ │ │ │ ├── review-card.tsx
│ │ │ │ ├── review-form.tsx
│ │ │ │ └── rating-stars.tsx
│ │ │ ├── gamification/
│ │ │ │ ├── badge-display.tsx
│ │ │ │ ├── streak-counter.tsx
│ │ │ │ └── achievement-toast.tsx
│ │ │ └── shared/
│ │ │ ├── empty-state.tsx
│ │ │ ├── loading-state.tsx
│ │ │ └── error-boundary.tsx
│ │ │
│ │ ├── lib/
│ │ │ ├── auth.ts # Clerk helpers
│ │ │ ├── db.ts # Prisma client
│ │ │ ├── stripe.ts
│ │ │ ├── cloudinary.ts
│ │ │ ├── ocr.ts # OCR service
│ │ │ ├── maps.ts # Google Maps
│ │ │ └── utils.ts
│ │ │
│ │ ├── hooks/
│ │ │ ├── use-addresses.ts
│ │ │ ├── use-services.ts
│ │ │ ├── use-moving-plan.ts
│ │ │ ├── use-budget.ts
│ │ │ └── use-toast.ts
│ │ │
│ │ ├── store/ # Zustand stores
│ │ │ ├── wizard-store.ts
│ │ │ ├── filter-store.ts
│ │ │ └── ui-store.ts
│ │ │
│ │ ├── styles/
│ │ │ └── globals.css
│ │ │
│ │ ├── public/
│ │ │ ├── manifest.json # PWA manifest
│ │ │ ├── icons/
│ │ │ └── images/
│ │ │
│ │ ├── next.config.js
│ │ ├── tailwind.config.ts
│ │ ├── tsconfig.json
│ │ └── package.json
│ │
│ └── api/ # Optional Express API (if needed)
│ ├── src/
│ │ ├── routes/
│ │ ├── controllers/
│ │ ├── middleware/
│ │ ├── services/
│ │ └── index.ts
│ ├── tsconfig.json
│ └── package.json
│
├── packages/
│ ├── db/ # Prisma & Database
│ │ ├── prisma/
│ │ │ ├── schema.prisma
│ │ │ ├── migrations/
│ │ │ └── seed.ts
│ │ ├── src/
│ │ │ ├── index.ts # Export Prisma client
│ │ │ └── seed-data/
│ │ │ ├── states.ts
│ │ │ ├── badges.ts
│ │ │ └── suggestions.ts
│ │ ├── tsconfig.json
│ │ └── package.json
│ │
│ ├── ui/ # Shared UI components
│ │ ├── src/
│ │ │ └── components/
│ │ ├── tsconfig.json
│ │ └── package.json
│ │
│ ├── validators/ # Zod schemas
│ │ ├── src/
│ │ │ ├── user.ts
│ │ │ ├── address.ts
│ │ │ ├── service.ts
│ │ │ ├── moving.ts
│ │ │ ├── budget.ts
│ │ │ └── index.ts
│ │ ├── tsconfig.json
│ │ └── package.json
│ │
│ ├── utils/ # Shared utilities
│ │ ├── src/
│ │ │ ├── dates.ts
│ │ │ ├── currency.ts
│ │ │ ├── formatters.ts
│ │ │ └── index.ts
│ │ ├── tsconfig.json
│ │ └── package.json
│ │
│ └── emails/ # React Email templates
│ ├── src/
│ │ ├── welcome.tsx
│ │ ├── moving-reminder.tsx
│ │ ├── trial-ending.tsx
│ │ └── index.ts
│ ├── tsconfig.json
│ └── package.json
│
├── .github/
│ └── workflows/
│ ├── ci.yml
│ └── deploy.yml
│
├── .vscode/
│ └── settings.json
│
├── pnpm-workspace.yaml
├── turbo.json # Turborepo config (optional)
├── .env.example
├── .gitignore
├── README.md
└── package.json

````

---

## 🎨 UI/UX DESIGN GUIDELINES

### Design System

#### Color Palette

```css
/* Light Mode */
:root {
  --primary: #6366f1; /* Indigo - CTA buttons, links */
  --primary-hover: #4f46e5;
  --primary-light: #e0e7ff;

  --secondary: #8b5cf6; /* Purple - accents */
  --secondary-hover: #7c3aed;

  --success: #10b981; /* Green - completed tasks */
  --success-light: #d1fae5;

  --warning: #f59e0b; /* Amber - upcoming deadlines */
  --warning-light: #fef3c7;

  --danger: #ef4444; /* Red - urgent, errors */
  --danger-light: #fee2e2;

  --info: #3b82f6; /* Blue - informational */
  --info-light: #dbeafe;

  --background: #ffffff;
  --surface: #f8fafc;
  --surface-hover: #f1f5f9;

  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;

  --border: #e2e8f0;
  --border-dark: #cbd5e1;
}

/* Dark Mode */
.dark {
  --primary: #818cf8;
  --primary-hover: #6366f1;
  --primary-light: #312e81;

  --background: #0f172a;
  --surface: #1e293b;
  --surface-hover: #334155;

  --text-primary: #f1f5f9;
  --text-secondary: #cbd5e1;
  --text-muted: #64748b;

  --border: #334155;
  --border-dark: #475569;
}
````

#### Typography

```css
/* Font Stack */
font-family:
  "Inter",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;

/* Type Scale */
--text-xs: 0.75rem; /* 12px - labels */
--text-sm: 0.875rem; /* 14px - body small */
--text-base: 1rem; /* 16px - body */
--text-lg: 1.125rem; /* 18px - subheadings */
--text-xl: 1.25rem; /* 20px - headings */
--text-2xl: 1.5rem; /* 24px - page titles */
--text-3xl: 1.875rem; /* 30px - hero text */
--text-4xl: 2.25rem; /* 36px - landing page */

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

#### Spacing System

```css
/* Tailwind default spacing (4px base) */
--space-1: 0.25rem; /* 4px */
--space-2: 0.5rem; /* 8px */
--space-3: 0.75rem; /* 12px */
--space-4: 1rem; /* 16px */
--space-5: 1.25rem; /* 20px */
--space-6: 1.5rem; /* 24px */
--space-8: 2rem; /* 32px */
--space-10: 2.5rem; /* 40px */
--space-12: 3rem; /* 48px */
--space-16: 4rem; /* 64px */
```

#### Border Radius

```css
--radius-sm: 0.375rem; /* 6px - buttons, inputs */
--radius-md: 0.5rem; /* 8px - cards */
--radius-lg: 0.75rem; /* 12px - modals */
--radius-xl: 1rem; /* 16px - special cards */
--radius-full: 9999px; /* Fully rounded - badges */
```

### Component Patterns

#### Cards

```tsx
<Card className="p-6 hover:shadow-lg transition-shadow">
  <CardHeader>
    <CardTitle>Service Name</CardTitle>
    <CardDescription>Category • Provider</CardDescription>
  </CardHeader>
  <CardContent>{/* Content */}</CardContent>
  <CardFooter>{/* Actions */}</CardFooter>
</Card>
```

#### Buttons

```tsx
// Primary CTA
<Button variant="default" size="lg">
  Get Started
</Button>

// Secondary
<Button variant="outline">
  Cancel
</Button>

// Destructive
<Button variant="destructive">
  Delete
</Button>

// Ghost (minimal)
<Button variant="ghost">
  Learn More
</Button>
```

#### Form Fields

```tsx
<div className="space-y-2">
  <Label htmlFor="field">Field Label</Label>
  <Input id="field" placeholder="Enter value" {...register("field")} />
  {errors.field && (
    <p className="text-sm text-danger">{errors.field.message}</p>
  )}
</div>
```

### Mobile-First Layouts

#### Bottom Navigation (Mobile)

```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-surface border-t md:hidden">
  <div className="flex justify-around items-center h-16">
    <NavItem icon={Home} label="Home" href="/dashboard" />
    <NavItem icon={MapPin} label="Addresses" href="/addresses" />
    <NavItem icon={CheckSquare} label="Tasks" href="/moving" />
    <NavItem icon={DollarSign} label="Budget" href="/budget" />
    <NavItem icon={Settings} label="Settings" href="/settings" />
  </div>
</nav>
```

#### Responsive Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  {items.map((item) => (
    <ItemCard key={item.id} {...item} />
  ))}
</div>
```

### Accessibility

- All interactive elements must have focus states
- Minimum touch target: 44x44px
- Color contrast ratio: 4.5:1 for normal text, 3:1 for large text
- ARIA labels for icon-only buttons
- Keyboard navigation support

### Loading States

```tsx
// Skeleton loader
<div className="space-y-4">
  <Skeleton className="h-12 w-full" />
  <Skeleton className="h-24 w-full" />
  <Skeleton className="h-32 w-full" />
</div>

// Spinner
<div className="flex items-center justify-center p-8">
  <Loader2 className="h-8 w-8 animate-spin text-primary" />
</div>
```

### Empty States

```tsx
<div className="flex flex-col items-center justify-center p-12 text-center">
  <Icon className="h-16 w-16 text-muted mb-4" />
  <h3 className="text-xl font-semibold mb-2">No items yet</h3>
  <p className="text-text-secondary mb-6">
    Get started by adding your first item
  </p>
  <Button>Add Item</Button>
</div>
```

## 🔌 API ENDPOINTS

### Authentication

Protected web requests use an httpOnly JWT cookie session. Mobile and programmatic clients use a Bearer token:

```text
Authorization: Bearer <user_jwt_token>
```

### RESTful API Design

#### Addresses

...

### Project Structure

```bash
apps/
web/
components/
...
containers/
...
lib/
auth.ts # JWT/session helpers
db.ts # Prisma client
stripe.ts
cloudinary.ts
...
...
...
```

### Development Environment

```bash
# .env.development
DATABASE_URL="file:./dev.db"
USER_JWT_SECRET="replace-with-long-random-secret"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIza..."
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

### Production Environment

```bash
# .env.production
DATABASE_URL="postgresql://user:password@host:5432/db"
USER_JWT_SECRET="replace-with-long-random-secret"
NEXT_PUBLIC_APP_URL="https://app.locateflow.com"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
GOOGLE_MAPS_API_KEY="AIza..."
```

### Getting Started with Windsurf

To implement this project with Windsurf/Cascade:

1. **Initialize the monorepo:**

   ```bash
   pnpm create next-app@latest apps/web
   mkdir -p packages/{db,ui,validators,utils,emails}
   ```

2. **Setup Prisma:**

   ```bash
   cd packages/db
   pnpm init
   pnpm add prisma @prisma/client
   pnpx prisma init
   # Copy the schema from above into prisma/schema.prisma
   pnpx prisma migrate dev --name init
   ```

3. **Install shadcn/ui:**

   ```bash
   cd apps/web
   pnpx shadcn-ui@latest init
   pnpx shadcn-ui@latest add button card input label select
   ```

4. **Setup JWT-based authentication:**
   - Generate `USER_JWT_SECRET`
   - Configure Google / Apple OAuth credentials if needed
   - Copy auth secrets to `.env`
   - Verify cookie + bearer auth flows locally

5. **Start building features in order:**
   - Authentication
   - Onboarding wizard
   - Address management
   - Service management
   - Moving plan
   - Documents
   - Budget
   - Gamification

Use this spec as your comprehensive guide. Each section provides the exact structure, logic, and code patterns you need.

---

**END OF SPECIFICATION**

This document should serve as a complete blueprint for building LocateFlow. Feed relevant sections to Windsurf/Cascade as needed for each feature implementation.
