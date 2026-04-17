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
2. **Moving Assistant:** AI-powered checklist and timeline for relocations
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
- **Provider:** Clerk
- **Features:** Email/password, Google OAuth, session management

### External Services
- **File Storage:** Cloudinary or AWS S3
- **OCR:** 
  - MVP: Tesseract.js
  - Phase 2: Google Vision API
- **Payments:** Stripe
- **Email:** Resend or SendGrid
- **Maps:** Google Maps API (Places, Geocoding)
- **AI:** Anthropic Claude API (Phase 2)
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
```

---

## 📁 PROJECT STRUCTURE

```
locateflow/
├── apps/
│   ├── web/                          # Next.js 15 Frontend
│   │   ├── app/
│   │   │   ├── (auth)/               # Auth routes (Clerk)
│   │   │   │   ├── sign-in/
│   │   │   │   └── sign-up/
│   │   │   │
│   │   │   ├── (onboarding)/         # First-time setup wizard
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx          # Step 1: Profile
│   │   │   │   ├── addresses/        # Step 2: Addresses
│   │   │   │   ├── services/         # Step 3: Services
│   │   │   │   └── moving/           # Step 4: Moving plan (optional)
│   │   │   │
│   │   │   ├── (app)/                # Main app (protected)
│   │   │   │   ├── layout.tsx        # App shell with navigation
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx
│   │   │   │   │
│   │   │   │   ├── addresses/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   └── edit/page.tsx
│   │   │   │   │   └── new/page.tsx
│   │   │   │   │
│   │   │   │   ├── services/
│   │   │   │   │   ├── page.tsx      # List all services
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── page.tsx  # Service details
│   │   │   │   │   │   └── edit/page.tsx
│   │   │   │   │   └── new/page.tsx
│   │   │   │   │
│   │   │   │   ├── moving/
│   │   │   │   │   ├── page.tsx      # Active moving plans
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── page.tsx  # Moving plan details
│   │   │   │   │   │   ├── tasks/    # Task management
│   │   │   │   │   │   ├── boxes/    # Box tracking
│   │   │   │   │   │   └── timeline/ # Visual timeline
│   │   │   │   │   └── new/page.tsx
│   │   │   │   │
│   │   │   │   ├── budget/
│   │   │   │   │   ├── page.tsx      # Monthly budget view
│   │   │   │   │   └── [month]/page.tsx
│   │   │   │   │
│   │   │   │   ├── documents/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── upload/page.tsx
│   │   │   │   │
│   │   │   │   ├── community/
│   │   │   │   │   ├── page.tsx      # Browse reviews
│   │   │   │   │   └── write/page.tsx
│   │   │   │   │
│   │   │   │   ├── family/
│   │   │   │   │   ├── page.tsx      # Family members
│   │   │   │   │   └── invite/page.tsx
│   │   │   │   │
│   │   │   │   └── settings/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── profile/
│   │   │   │       ├── subscription/
│   │   │   │       ├── notifications/
│   │   │   │       └── export/
│   │   │   │
│   │   │   ├── api/                  # Next.js API routes
│   │   │   │   ├── auth/
│   │   │   │   ├── addresses/
│   │   │   │   ├── services/
│   │   │   │   ├── moving/
│   │   │   │   ├── budget/
│   │   │   │   ├── documents/
│   │   │   │   │   └── ocr/
│   │   │   │   ├── reviews/
│   │   │   │   ├── webhooks/
│   │   │   │   │   ├── stripe/
│   │   │   │   │   └── clerk/
│   │   │   │   └── cron/
│   │   │   │       └── reminders/
│   │   │   │
│   │   │   ├── box/                  # Public QR code viewer
│   │   │   │   └── [qrCode]/page.tsx
│   │   │   │
│   │   │   └── pricing/
│   │   │       └── page.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── layout/
│   │   │   │   ├── header.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   └── mobile-nav.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── stats-card.tsx
│   │   │   │   ├── budget-widget.tsx
│   │   │   │   ├── upcoming-tasks.tsx
│   │   │   │   └── suggestions.tsx
│   │   │   ├── addresses/
│   │   │   │   ├── address-card.tsx
│   │   │   │   ├── address-form.tsx
│   │   │   │   └── address-selector.tsx
│   │   │   ├── services/
│   │   │   │   ├── service-card.tsx
│   │   │   │   ├── service-form.tsx
│   │   │   │   └── category-filter.tsx
│   │   │   ├── moving/
│   │   │   │   ├── timeline.tsx
│   │   │   │   ├── task-list.tsx
│   │   │   │   ├── task-item.tsx
│   │   │   │   └── progress-bar.tsx
│   │   │   ├── boxes/
│   │   │   │   ├── box-card.tsx
│   │   │   │   ├── qr-generator.tsx
│   │   │   │   └── packing-progress.tsx
│   │   │   ├── budget/
│   │   │   │   ├── expense-chart.tsx
│   │   │   │   └── category-breakdown.tsx
│   │   │   ├── documents/
│   │   │   │   ├── document-upload.tsx
│   │   │   │   ├── document-viewer.tsx
│   │   │   │   └── ocr-results.tsx
│   │   │   ├── community/
│   │   │   │   ├── review-card.tsx
│   │   │   │   ├── review-form.tsx
│   │   │   │   └── rating-stars.tsx
│   │   │   ├── gamification/
│   │   │   │   ├── badge-display.tsx
│   │   │   │   ├── streak-counter.tsx
│   │   │   │   └── achievement-toast.tsx
│   │   │   └── shared/
│   │   │       ├── empty-state.tsx
│   │   │       ├── loading-state.tsx
│   │   │       └── error-boundary.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── auth.ts              # Clerk helpers
│   │   │   ├── db.ts                # Prisma client
│   │   │   ├── stripe.ts
│   │   │   ├── cloudinary.ts
│   │   │   ├── ocr.ts               # OCR service
│   │   │   ├── maps.ts              # Google Maps
│   │   │   └── utils.ts
│   │   │
│   │   ├── hooks/
│   │   │   ├── use-addresses.ts
│   │   │   ├── use-services.ts
│   │   │   ├── use-moving-plan.ts
│   │   │   ├── use-budget.ts
│   │   │   └── use-toast.ts
│   │   │
│   │   ├── store/                   # Zustand stores
│   │   │   ├── wizard-store.ts
│   │   │   ├── filter-store.ts
│   │   │   └── ui-store.ts
│   │   │
│   │   ├── styles/
│   │   │   └── globals.css
│   │   │
│   │   ├── public/
│   │   │   ├── manifest.json        # PWA manifest
│   │   │   ├── icons/
│   │   │   └── images/
│   │   │
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                          # Optional Express API (if needed)
│       ├── src/
│       │   ├── routes/
│       │   ├── controllers/
│       │   ├── middleware/
│       │   ├── services/
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── db/                          # Prisma & Database
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── index.ts             # Export Prisma client
│   │   │   └── seed-data/
│   │   │       ├── states.ts
│   │   │       ├── badges.ts
│   │   │       └── suggestions.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── ui/                          # Shared UI components
│   │   ├── src/
│   │   │   └── components/
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── validators/                  # Zod schemas
│   │   ├── src/
│   │   │   ├── user.ts
│   │   │   ├── address.ts
│   │   │   ├── service.ts
│   │   │   ├── moving.ts
│   │   │   ├── budget.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── utils/                       # Shared utilities
│   │   ├── src/
│   │   │   ├── dates.ts
│   │   │   ├── currency.ts
│   │   │   ├── formatters.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── emails/                      # React Email templates
│       ├── src/
│       │   ├── welcome.tsx
│       │   ├── moving-reminder.tsx
│       │   ├── trial-ending.tsx
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── .vscode/
│   └── settings.json
│
├── pnpm-workspace.yaml
├── turbo.json                       # Turborepo config (optional)
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

---

## 🎨 UI/UX DESIGN GUIDELINES

### Design System

#### Color Palette

```css
/* Light Mode */
:root {
  --primary: #6366f1;        /* Indigo - CTA buttons, links */
  --primary-hover: #4f46e5;
  --primary-light: #e0e7ff;
  
  --secondary: #8b5cf6;      /* Purple - accents */
  --secondary-hover: #7c3aed;
  
  --success: #10b981;        /* Green - completed tasks */
  --success-light: #d1fae5;
  
  --warning: #f59e0b;        /* Amber - upcoming deadlines */
  --warning-light: #fef3c7;
  
  --danger: #ef4444;         /* Red - urgent, errors */
  --danger-light: #fee2e2;
  
  --info: #3b82f6;           /* Blue - informational */
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
```

#### Typography

```css
/* Font Stack */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Type Scale */
--text-xs: 0.75rem;      /* 12px - labels */
--text-sm: 0.875rem;     /* 14px - body small */
--text-base: 1rem;       /* 16px - body */
--text-lg: 1.125rem;     /* 18px - subheadings */
--text-xl: 1.25rem;      /* 20px - headings */
--text-2xl: 1.5rem;      /* 24px - page titles */
--text-3xl: 1.875rem;    /* 30px - hero text */
--text-4xl: 2.25rem;     /* 36px - landing page */

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

#### Spacing System

```css
/* Tailwind default spacing (4px base) */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

#### Border Radius

```css
--radius-sm: 0.375rem;  /* 6px - buttons, inputs */
--radius-md: 0.5rem;    /* 8px - cards */
--radius-lg: 0.75rem;   /* 12px - modals */
--radius-xl: 1rem;      /* 16px - special cards */
--radius-full: 9999px;  /* Fully rounded - badges */
```

### Component Patterns

#### Cards

```tsx
<Card className="p-6 hover:shadow-lg transition-shadow">
  <CardHeader>
    <CardTitle>Service Name</CardTitle>
    <CardDescription>Category • Provider</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
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
  <Input
    id="field"
    placeholder="Enter value"
    {...register("field")}
  />
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
  {items.map(item => <ItemCard key={item.id} {...item} />)}
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

---

## 🔌 API ENDPOINTS

### Authentication

All protected endpoints require Clerk JWT in `Authorization` header:
```
Authorization: Bearer <clerk_jwt_token>
```

### RESTful API Design

#### Addresses

```typescript
// GET /api/addresses
// List all addresses for current user
Response: {
  addresses: Address[]
}

// GET /api/addresses/:id
// Get single address
Response: {
  address: Address
}

// POST /api/addresses
// Create new address
Body: {
  type: AddressType
  street: string
  city: string
  state: string
  zip: string
  // ...
}
Response: {
  address: Address
}

// PATCH /api/addresses/:id
// Update address
Body: Partial<Address>
Response: {
  address: Address
}

// DELETE /api/addresses/:id
// Delete address
Response: {
  success: boolean
}
```

#### Services

```typescript
// GET /api/services
// List services (with optional filters)
Query: {
  addressId?: string
  category?: ServiceCategory
  search?: string
}
Response: {
  services: Service[]
}

// GET /api/services/:id
Response: {
  service: Service
  documents: Document[]
  reminders: Reminder[]
}

// POST /api/services
Body: {
  addressId: string
  category: ServiceCategory
  providerName: string
  // ...
}
Response: {
  service: Service
}

// PATCH /api/services/:id
Body: Partial<Service>
Response: {
  service: Service
}

// DELETE /api/services/:id
Response: {
  success: boolean
}
```

#### Moving Plans

```typescript
// GET /api/moving
Response: {
  plans: MovingPlan[]
}

// GET /api/moving/:id
Response: {
  plan: MovingPlan
  tasks: Task[]
  boxes: MovingBox[]
}

// POST /api/moving
Body: {
  fromAddressId: string
  toAddressId: string
  moveDate: string (ISO)
  isTemporary: boolean
}
Response: {
  plan: MovingPlan
  tasks: Task[] // Auto-generated tasks
}

// PATCH /api/moving/:id
Body: Partial<MovingPlan>
Response: {
  plan: MovingPlan
}

// POST /api/moving/:id/complete
// Mark moving plan as completed
Response: {
  plan: MovingPlan
  badge?: Badge // If earned
}
```

#### Tasks

```typescript
// GET /api/tasks
Query: {
  movingPlanId?: string
  completed?: boolean
  dueDate?: string
}
Response: {
  tasks: Task[]
}

// POST /api/tasks
Body: {
  title: string
  movingPlanId?: string
  dueDate?: string
  // ...
}
Response: {
  task: Task
}

// PATCH /api/tasks/:id
Body: Partial<Task>
Response: {
  task: Task
}

// POST /api/tasks/:id/complete
Response: {
  task: Task
  streakUpdated?: boolean
  badgeEarned?: Badge
}
```

#### Boxes

```typescript
// GET /api/moving/:planId/boxes
Response: {
  boxes: MovingBox[]
  packingProgress: number // 0-100
}

// POST /api/moving/:planId/boxes
Body: {
  label: string
  room: string
  contents: string
  isFragile: boolean
  // ...
}
Response: {
  box: MovingBox
  qrCodeUrl: string
}

// PATCH /api/boxes/:id
Body: Partial<MovingBox>
Response: {
  box: MovingBox
}

// POST /api/boxes/:id/pack
// Mark as packed
Response: {
  box: MovingBox
}

// POST /api/boxes/:id/unpack
// Mark as unpacked
Response: {
  box: MovingBox
}
```

#### Documents

```typescript
// GET /api/documents
Query: {
  serviceId?: string
  category?: DocumentCategory
}
Response: {
  documents: Document[]
}

// POST /api/documents/upload
// Multipart form data
Body: {
  file: File
  serviceId?: string
  category?: DocumentCategory
}
Response: {
  document: Document
  ocrResults?: {
    text: string
    extractedData: any
  }
}

// DELETE /api/documents/:id
Response: {
  success: boolean
}

// POST /api/documents/:id/ocr
// Trigger OCR processing
Response: {
  document: Document
  ocrResults: {
    text: string
    extractedData: any
  }
}
```

#### Budget

```typescript
// GET /api/budget
Query: {
  addressId?: string
  month?: string // YYYY-MM
}
Response: {
  budgets: Budget[]
  summary: {
    totalIncome: number
    totalExpenses: number
    savingsRate: number
  }
}

// GET /api/budget/:month
Response: {
  budget: Budget
  breakdown: {
    [category: string]: number
  }
}

// POST /api/budget
Body: {
  addressId?: string
  month: string
  plannedIncome?: number
  plannedExpenses?: number
}
Response: {
  budget: Budget
}

// PATCH /api/budget/:id
Body: Partial<Budget>
Response: {
  budget: Budget
}
```

#### Community Reviews

```typescript
// GET /api/reviews
Query: {
  providerName?: string
  category?: ServiceCategory
  zipCode?: string
  state?: string
}
Response: {
  reviews: Review[]
  averageRating: number
  totalReviews: number
}

// POST /api/reviews
Body: {
  providerName: string
  category: ServiceCategory
  zipCode: string
  rating: number
  content: string
  // ...
}
Response: {
  review: Review
  badgeEarned?: Badge
}

// PATCH /api/reviews/:id
Body: Partial<Review>
Response: {
  review: Review
}

// POST /api/reviews/:id/helpful
// Mark review as helpful
Response: {
  review: Review
}
```

#### Gamification

```typescript
// GET /api/badges
Response: {
  earnedBadges: UserBadge[]
  availableBadges: Badge[]
  progress: {
    [badgeCode: string]: {
      current: number
      required: number
      percentage: number
    }
  }
}

// GET /api/streak
Response: {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string
  todayActivity: boolean
}
```

#### Suggestions

```typescript
// GET /api/suggestions
Query: {
  addressId?: string
  category?: ServiceCategory
}
Response: {
  suggestions: Array<{
    category: ServiceCategory
    providers: ServiceSuggestion[]
    reason: string // "Common in your area", "Based on your profile"
  }>
}

// POST /api/suggestions/:id/dismiss
Response: {
  success: boolean
}

// POST /api/suggestions/:id/add
// Quickly add suggested service
Response: {
  service: Service
}
```

#### Subscription & Billing

```typescript
// GET /api/subscription
Response: {
  subscription: Subscription
  usage: {
    addressCount: number
    documentStorageUsed: number
    documentStorageLimit: number
  }
}

// POST /api/subscription/create-checkout
Body: {
  plan: SubscriptionPlan
}
Response: {
  checkoutUrl: string
}

// POST /api/subscription/create-portal
// Stripe customer portal
Response: {
  portalUrl: string
}

// POST /api/subscription/cancel
Response: {
  subscription: Subscription
}
```

#### Webhooks

```typescript
// POST /api/webhooks/stripe
// Stripe webhook handler
Body: StripeEvent
Response: {
  received: boolean
}

// POST /api/webhooks/clerk
// Clerk webhook handler
Body: ClerkEvent
Response: {
  received: boolean
}
```

---

## 💼 BUSINESS LOGIC & RULES

### Subscription Tiers

#### Free Trial (7 Days)
- **Duration:** 7 days from sign-up
- **Limits:**
  - 2 addresses maximum
  - 10 services maximum
  - 5 documents (100MB total storage)
  - Basic moving checklist
  - Community reviews (read/write)
  - No AI assistant, QR tracking, or gamification
- **After trial:** Account becomes read-only until upgraded

#### Individual Plan ($4.99/month or $49/year)
- **Billing:** Monthly: $4.99, Yearly: $49 (save 17%)
- **Features:**
  - Unlimited addresses
  - Unlimited services
  - Unlimited documents (500MB storage)
  - Full moving assistant with AI-generated tasks
  - QR code generator for boxes
  - Community reviews (verified badge)
  - Priority email support
  - Export without watermarks
  - Badges & gamification
- **Yearly bonus:** +200MB storage (700MB total)

#### Family Plan ($7.99/month or $79/year)
- **Billing:** Monthly: $7.99, Yearly: $79 (save 17%)
- **Features:**
  - Everything in Individual Plan, PLUS:
  - Up to 5 family members
  - Shared addresses & services
  - Role-based permissions (Admin, Partner, Child)
  - Family budget dashboard
  - 1GB shared storage
  - Separate profiles for kids
  - Family moving coordinator
- **Yearly bonus:** +500MB storage (1.5GB total)

### Address Limits

```typescript
// Check limits before allowing address creation
async function canAddAddress(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { subscription: true, addresses: true }
  });
  
  // Free trial: 1 address max
  if (user.subscription.plan === 'FREE_TRIAL') {
    return user.addresses.length < 1;
  }
  
  // Paid plans: unlimited
  return true;
}
```

### Auto-Generated Moving Tasks

When a moving plan is created, system automatically generates tasks based on:
1. **From State** and **To State** rules
2. **Move Date** (tasks scheduled relative to this date)
3. **User Profile** (children, seniors, pets, cars)

#### Task Generation Logic

```typescript
interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  daysBeforeMove: number; // Negative for after move
  priority: Priority;
  requiredProfile?: {
    hasChildren?: boolean;
    hasCar?: boolean;
    isHomeowner?: boolean;
  };
  requiredStates?: string[]; // Specific to certain states
}

const TASK_TEMPLATES: TaskTemplate[] = [
  // Government - Universal
  {
    id: 'usps_change',
    title: 'Submit USPS Change of Address',
    description: 'File online at usps.com/move for $1.10',
    category: 'Government',
    daysBeforeMove: 30,
    priority: 'HIGH'
  },
  {
    id: 'irs_update',
    title: 'Update IRS Address',
    description: 'File Form 8822 or update online',
    category: 'Government',
    daysBeforeMove: -30, // After move
    priority: 'MEDIUM'
  },
  
  // DMV - State-specific
  {
    id: 'dmv_register_vehicle',
    title: 'Register Vehicle in New State',
    description: 'Visit DMV with title, insurance, VIN inspection',
    category: 'Transportation',
    daysBeforeMove: -30,
    priority: 'HIGH',
    requiredProfile: { hasCar: true },
    requiredStates: ['TX', 'FL', 'CA'] // Days vary by state
  },
  
  // Utilities
  {
    id: 'disconnect_utilities',
    title: 'Schedule Utility Disconnection',
    description: 'Electric, gas, water for old address',
    category: 'Utilities',
    daysBeforeMove: 14,
    priority: 'HIGH'
  },
  {
    id: 'connect_utilities',
    title: 'Setup Utilities at New Address',
    description: 'Electric, gas, water, internet',
    category: 'Utilities',
    daysBeforeMove: 7,
    priority: 'HIGH'
  },
  
  // Kids - Profile-based
  {
    id: 'school_unenroll',
    title: 'Unenroll Children from Current School',
    description: 'Request records and transcripts',
    category: 'Kids',
    daysBeforeMove: 30,
    priority: 'HIGH',
    requiredProfile: { hasChildren: true }
  },
  {
    id: 'school_enroll',
    title: 'Enroll Children in New School',
    description: 'Bring proof of residence and records',
    category: 'Kids',
    daysBeforeMove: -14,
    priority: 'HIGH',
    requiredProfile: { hasChildren: true }
  },
  
  // Add 40+ more templates...
];

async function generateMovingTasks(movingPlanId: string) {
  const plan = await db.movingPlan.findUnique({
    where: { id: movingPlanId },
    include: {
      user: { include: { profile: true } },
      fromAddress: true,
      toAddress: true
    }
  });
  
  const tasks: Task[] = [];
  
  for (const template of TASK_TEMPLATES) {
    // Check profile requirements
    if (template.requiredProfile) {
      if (template.requiredProfile.hasChildren && !plan.user.profile.hasChildren) continue;
      if (template.requiredProfile.hasCar && plan.user.profile.carCount === 0) continue;
    }
    
    // Check state requirements
    if (template.requiredStates) {
      if (!template.requiredStates.includes(plan.toAddress.state)) continue;
    }
    
    // Calculate due date
    const dueDate = new Date(plan.moveDate);
    dueDate.setDate(dueDate.getDate() + template.daysBeforeMove);
    
    tasks.push({
      userId: plan.userId,
      movingPlanId: plan.id,
      title: template.title,
      description: template.description,
      category: template.category,
      dueDate: dueDate,
      priority: template.priority,
      isAutoGenerated: true,
      templateId: template.id
    });
  }
  
  await db.task.createMany({ data: tasks });
  
  return tasks;
}
```

### State-Specific Rules

#### Example: Texas DMV Rules

```json
{
  "stateCode": "TX",
  "stateName": "Texas",
  "dmvRules": {
    "vehicleRegistration": {
      "deadline": 30,
      "deadlineUnit": "days",
      "description": "Register vehicle within 30 days of establishing residency",
      "requirements": [
        "Current vehicle title",
        "Proof of insurance",
        "VIN inspection (Form VI-30)",
        "Proof of Texas residency"
      ],
      "fees": "Varies by vehicle weight and county"
    },
    "driversLicense": {
      "deadline": 90,
      "deadlineUnit": "days",
      "description": "Obtain TX license within 90 days",
      "requirements": [
        "Proof of identity",
        "Proof of Texas residency",
        "Social Security Number",
        "Pass vision test",
        "Surrender out-of-state license"
      ],
      "cost": "$33"
    }
  },
  "utilityInfo": {
    "electricDeregulated": true,
    "description": "Texas electricity market is deregulated. Compare providers at powertochoose.org",
    "commonProviders": ["TXU Energy", "Reliant", "Direct Energy", "Green Mountain"]
  },
  "taxInfo": {
    "stateIncomeTax": false,
    "propertyTaxHigh": true,
    "salesTaxRate": 6.25,
    "notes": "No state income tax, but property taxes are higher than national average"
  }
}
```

### OCR Processing Flow

```typescript
async function processDocument(file: File, userId: string, serviceId?: string) {
  // 1. Upload to storage
  const fileUrl = await cloudinary.upload(file);
  
  // 2. Create document record
  const document = await db.document.create({
    data: {
      userId,
      serviceId,
      fileName: file.name,
      fileUrl,
      fileType: file.type,
      fileSize: file.size
    }
  });
  
  // 3. Trigger OCR (async job)
  await ocrQueue.add({
    documentId: document.id,
    fileUrl
  });
  
  return document;
}

// OCR Job Handler
async function handleOCR(documentId: string, fileUrl: string) {
  try {
    // 4. Run OCR
    const ocrText = await tesseract.recognize(fileUrl);
    
    // 5. Extract structured data
    const extractedData = await extractBillData(ocrText);
    
    // 6. Update document
    await db.document.update({
      where: { id: documentId },
      data: {
        ocrProcessed: true,
        ocrText,
        extractedData
      }
    });
    
    // 7. If account number found, suggest updating service
    if (extractedData.accountNumber && documentId.serviceId) {
      await suggestServiceUpdate(documentId.serviceId, extractedData);
    }
  } catch (error) {
    console.error('OCR failed:', error);
    await db.document.update({
      where: { id: documentId },
      data: { ocrProcessed: false }
    });
  }
}

function extractBillData(text: string) {
  // Regex patterns for common bill data
  const patterns = {
    accountNumber: /(?:Account|Acct)[\s#:]+(\d{4,})/i,
    amount: /(?:Amount Due|Total|Balance)[\s:$]+(\d+\.\d{2})/i,
    dueDate: /(?:Due Date|Payment Due)[\s:]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    provider: /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/m
  };
  
  return {
    accountNumber: text.match(patterns.accountNumber)?.[1],
    amount: parseFloat(text.match(patterns.amount)?.[1] || '0'),
    dueDate: text.match(patterns.dueDate)?.[1],
    provider: text.match(patterns.provider)?.[1]
  };
}
```

### Gamification System

#### Streak Tracking

```typescript
async function updateStreak(userId: string) {
  const profile = await db.profile.findUnique({
    where: { userId }
  });
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastActive = profile.lastActiveDate ? new Date(profile.lastActiveDate) : null;
  
  if (!lastActive) {
    // First activity
    await db.profile.update({
      where: { userId },
      data: {
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today
      }
    });
    return;
  }
  
  lastActive.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
  
  if (dayDiff === 0) {
    // Same day, no update
    return;
  } else if (dayDiff === 1) {
    // Consecutive day
    const newStreak = profile.currentStreak + 1;
    const longestStreak = Math.max(newStreak, profile.longestStreak);
    
    await db.profile.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak,
        lastActiveDate: today
      }
    });
    
    // Check for streak badges
    await checkStreakBadges(userId, newStreak);
  } else {
    // Streak broken
    await db.profile.update({
      where: { userId },
      data: {
        currentStreak: 1,
        lastActiveDate: today
      }
    });
  }
}

async function checkStreakBadges(userId: string, streak: number) {
  const badgeCodes = [];
  
  if (streak === 7) badgeCodes.push('streak_7');
  if (streak === 30) badgeCodes.push('streak_30');
  if (streak === 100) badgeCodes.push('streak_100');
  
  for (const code of badgeCodes) {
    const badge = await db.badge.findUnique({ where: { code } });
    if (!badge) continue;
    
    const existing = await db.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } }
    });
    
    if (!existing) {
      await db.userBadge.create({
        data: { userId, badgeId: badge.id }
      });
      
      // Send notification/toast
      await sendBadgeNotification(userId, badge);
    }
  }
}
```

#### Badge Awarding

```typescript
async function checkAndAwardBadges(userId: string, trigger: string) {
  switch (trigger) {
    case 'first_address':
      await awardBadge(userId, 'first_home');
      break;
    
    case 'first_service':
      await awardBadge(userId, 'plugged_in');
      break;
    
    case 'first_budget':
      await awardBadge(userId, 'budget_boss');
      break;
    
    case 'tasks_10':
      const taskCount = await db.task.count({
        where: { userId, completed: true }
      });
      if (taskCount >= 10) await awardBadge(userId, 'task_tackler');
      break;
    
    case 'move_completed':
      await awardBadge(userId, 'moving_maestro');
      break;
    
    case 'first_review':
      await awardBadge(userId, 'first_reviewer');
      break;
  }
}

async function awardBadge(userId: string, badgeCode: string) {
  const badge = await db.badge.findUnique({ where: { code: badgeCode } });
  if (!badge) return;
  
  const existing = await db.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } }
  });
  
  if (existing) return; // Already earned
  
  await db.userBadge.create({
    data: { userId, badgeId: badge.id }
  });
  
  await sendBadgeNotification(userId, badge);
}
```

### Smart Suggestions System

```typescript
async function generateSuggestions(userId: string, addressId?: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      addresses: true,
      services: true
    }
  });
  
  const address = addressId 
    ? user.addresses.find(a => a.id === addressId)
    : user.addresses.find(a => a.isPrimary);
  
  if (!address) return [];
  
  const suggestions = [];
  
  // Check for missing utility services
  const hasElectric = user.services.some(s => 
    s.category === 'UTILITY_ELECTRIC' && s.addressId === address.id
  );
  if (!hasElectric) {
    const providers = await getCommonProviders('UTILITY_ELECTRIC', address.state, address.zip);
    suggestions.push({
      category: 'UTILITY_ELECTRIC',
      providers,
      reason: 'Common utility for your area',
      priority: 'HIGH'
    });
  }
  
  // Check based on profile
  if (user.profile.hasCar && user.profile.carCount > 0) {
    const hasAutoInsurance = user.services.some(s => 
      s.category === 'FINANCIAL_INSURANCE_AUTO'
    );
    if (!hasAutoInsurance) {
      suggestions.push({
        category: 'FINANCIAL_INSURANCE_AUTO',
        reason: 'You indicated you have a car',
        priority: 'HIGH'
      });
    }
    
    const hasTollPass = user.services.some(s => 
      s.category === 'TRANSPORTATION_TOLL'
    );
    if (!hasTollPass) {
      const tollProvider = getTollProviderForState(address.state);
      suggestions.push({
        category: 'TRANSPORTATION_TOLL',
        providers: [tollProvider],
        reason: 'Recommended for drivers in ' + address.state,
        priority: 'MEDIUM'
      });
    }
  }
  
  if (user.profile.hasChildren) {
    const hasPediatrician = user.services.some(s => 
      s.category === 'HEALTHCARE_PEDIATRICIAN'
    );
    if (!hasPediatrician) {
      suggestions.push({
        category: 'HEALTHCARE_PEDIATRICIAN',
        reason: 'Important for families with children',
        priority: 'HIGH'
      });
    }
  }
  
  return suggestions;
}
```

---

## 📅 IMPLEMENTATION PHASES

### Phase 1: MVP (Weeks 1-12)

#### Week 1-2: Foundation
- [ ] Initialize monorepo with Next.js 15, Prisma
- [ ] Setup Clerk authentication
- [ ] Create database schema & run migrations
- [ ] Setup shadcn/ui components
- [ ] Configure Tailwind CSS
- [ ] Setup environment variables

#### Week 3-4: User Profile & Onboarding
- [ ] Implement Clerk sign-up/sign-in flows
- [ ] Create wizard layout
- [ ] Build profile questionnaire (Step 1)
- [ ] Implement address form with Google Maps autocomplete (Step 2)
- [ ] Store user profile & addresses in database

#### Week 5-6: Service Management
- [ ] Build service CRUD operations
- [ ] Create service list view with filters
- [ ] Implement service detail page
- [ ] Build service form with category selection
- [ ] Add smart suggestions based on profile

#### Week 7-8: Moving Plan
- [ ] Create moving plan flow
- [ ] Build state rules database (start with 10 states)
- [ ] Implement auto-task generation logic
- [ ] Create timeline view
- [ ] Build task list with complete/incomplete actions

#### Week 9-10: Documents & Budget
- [ ] Implement file upload to Cloudinary
- [ ] Integrate Tesseract.js for basic OCR
- [ ] Create document list view
- [ ] Build budget tracking (monthly view)
- [ ] Implement expense categorization

#### Week 11-12: Polish & Launch
- [ ] Design dashboard with widgets
- [ ] Implement mobile responsive layouts
- [ ] Add gamification (badges, progress bars)
- [ ] Build export feature (PDF, CSV)
- [ ] Integrate Stripe for subscriptions
- [ ] Setup pricing page
- [ ] Beta launch & gather feedback

### Phase 2: Advanced Features (Months 4-6)

#### Month 4: Community & Collaboration
- [ ] Build community review system
- [ ] Implement verified user badges
- [ ] Add helpful/report voting
- [ ] Create family plan sharing
- [ ] Implement role-based permissions

#### Month 5: AI & Automation
- [ ] Integrate Claude API for chatbot
- [ ] Improve OCR with Google Vision API
- [ ] Build AI-powered suggestion engine
- [ ] Add smart reminder system
- [ ] Implement email notifications

#### Month 6: Mobile & QR
- [ ] Complete PWA setup (offline mode)
- [ ] Build QR code generator
- [ ] Create box tracking system
- [ ] Add push notifications
- [ ] Implement background sync

### Phase 3: Scaling (Months 7-9)

#### Expand Coverage
- [ ] Add all 50 states + DC
- [ ] Build admin dashboard
- [ ] Implement analytics
- [ ] Add A/B testing
- [ ] Create referral program

#### Optimize
- [ ] Performance optimization
- [ ] Database indexing
- [ ] Image optimization
- [ ] Code splitting
- [ ] CDN setup

---

## 🚀 DEPLOYMENT & INFRASTRUCTURE

### Development Environment

```bash
# .env.development
DATABASE_URL="file:./dev.db"
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIza..."
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

### Production Environment

**Hosting:**
- **Frontend:** Vercel (Next.js optimized)
- **Database:** Supabase PostgreSQL or Neon
- **File Storage:** Cloudinary
- **Email:** Resend

**Environment Variables:**
```bash
# .env.production
DATABASE_URL="postgresql://user:password@host:5432/db"
CLERK_SECRET_KEY="sk_live_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
NEXT_PUBLIC_APP_URL="https://app.locateflow.com"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
GOOGLE_MAPS_API_KEY="AIza..."
CLOUDINARY_URL="cloudinary://..."
RESEND_API_KEY="re_..."
SENTRY_DSN="https://..."
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run Prisma migrations
        run: pnpm --filter @locateflow/db prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      
      - name: Build
        run: pnpm build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Database Migrations

```bash
# Development
pnpm --filter @locateflow/db prisma migrate dev --name add_new_field

# Production
pnpm --filter @locateflow/db prisma migrate deploy
```

### Monitoring

- **Error Tracking:** Sentry
- **Analytics:** Vercel Analytics + PostHog
- **Uptime:** BetterStack
- **Performance:** Vercel Speed Insights

---

## 🔐 SECURITY CONSIDERATIONS

### Authentication
- All routes under `/app/*` protected by Clerk middleware
- API routes validate JWT tokens
- CSRF protection enabled

### Data Privacy
- User data encrypted at rest (database)
- Sensitive documents stored with secure URLs
- GDPR compliance (data export, deletion)
- No PII in logs

### API Security
- Rate limiting on all endpoints
- Input validation with Zod
- SQL injection prevention (Prisma)
- XSS protection (React escaping)

### File Uploads
- File type validation
- File size limits (10MB per file)
- Virus scanning (ClamAV or Cloudinary moderation)

---

## 📝 ADDITIONAL NOTES

### Accessibility (WCAG 2.1 AA)
- Semantic HTML
- ARIA labels where needed
- Keyboard navigation
- Screen reader support
- Color contrast compliance

### SEO
- Server-side rendering (Next.js)
- Meta tags for all pages
- Open Graph images
- Sitemap generation
- robots.txt

### Performance
- Image optimization (next/image)
- Code splitting
- Lazy loading
- Caching strategy
- Web Vitals monitoring

### Testing
- Unit tests: Vitest
- E2E tests: Playwright
- API tests: Supertest
- Coverage target: 70%+

---

## 🎯 SUCCESS METRICS

### User Engagement
- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Average session duration
- Feature adoption rates

### Business Metrics
- Free trial → Paid conversion: Target 10%
- Individual → Family upgrade: Target 15%
- Monthly churn rate: Target <5%
- Customer Lifetime Value (LTV)

### Product Metrics
- Average services per user: Target 15+
- Average addresses per user: Target 1.5
- Moving plans completed: Track %
- Documents uploaded per user: Track avg

---

## 🚦 GETTING STARTED WITH WINDSURF

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

4. **Setup Clerk:**
   - Create account at clerk.com
   - Create application
   - Copy API keys to .env
   - Follow Clerk Next.js setup guide

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
