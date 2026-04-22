export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ==================== USER ====================

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  emailVerifiedAt?: string | null;
  mfaEnabled?: boolean;
  ageRange?: string | null;
  familyStatus: string;
  hasChildren: boolean;
  childrenCount: number;
  hasPets: boolean;
  petTypes: string[];
  carCount: number;
  hasMotorcycle: boolean;
  hasBoatRV: boolean;
  needsStorage: boolean;
  hasSenior: boolean;
  hasDisability: boolean;
  onboardingComplete: boolean;
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== ADDRESS ====================

export interface Address {
  id: string;
  userId: string;
  type: string;
  nickname?: string | null;
  street: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  isPrimary: boolean;
  ownership: string;
  startDate: string;
  endDate?: string | null;
  services?: Service[];
  createdAt: string;
  updatedAt: string;
}

// ==================== SERVICE ====================

export interface Service {
  id: string;
  userId: string;
  addressId: string;
  category: string;
  subCategory?: string | null;
  providerName: string;
  accountNumber?: string | null;
  username?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  monthlyCost?: number | null;
  billingDay?: number | null;
  billingCycle?: string | null;
  autoRenewal: boolean;
  contractEndDate?: string | null;
  notes?: string | null;
  isActive: boolean;
  address?: Address;
  createdAt: string;
  updatedAt: string;
}

// ==================== MOVING PLAN ====================

export interface MovingPlan {
  id: string;
  userId: string;
  fromAddressId: string;
  toAddressId: string;
  moveDate: string;
  status: string;
  isTemporary: boolean;
  estimatedDuration?: number | null;
  fromAddress?: Address;
  toAddress?: Address;
  tasks?: Task[];
  createdAt: string;
  updatedAt: string;
}

// ==================== TASK ====================

export interface Task {
  id: string;
  userId: string;
  movingPlanId?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  completedAt?: string | null;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== BUDGET ====================

export interface Budget {
  id: string;
  userId: string;
  addressId?: string | null;
  month: string;
  year: number;
  plannedIncome?: number | null;
  actualIncome?: number | null;
  plannedExpenses?: number | null;
  actualExpenses: number;
  notes?: string | null;
  createdAt: string;
}

// ==================== DOCUMENT ====================

export interface Document {
  id: string;
  userId: string;
  serviceId?: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  category?: string | null;
  description?: string | null;
  ocrText?: string | null;
  createdAt: string;
}

// ==================== REVIEW ====================

export interface Review {
  id: string;
  userId: string;
  providerName: string;
  category: string;
  zipCode: string;
  city: string;
  state: string;
  rating: number;
  title?: string | null;
  content: string;
  speedRating?: number | null;
  reliabilityRating?: number | null;
  customerServiceRating?: number | null;
  valueRating?: number | null;
  helpful: number;
  status: string;
  createdAt: string;
  user?: { firstName?: string | null; lastName?: string | null };
}

// ==================== PROVIDER ====================

export interface ServiceProvider {
  id: string;
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  scope: string;
  states: string[];
  tags: string[];
  score: number;
  isActive: boolean;
}

// ==================== BADGE ====================

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  pointsRequired: number;
  condition: string;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: string;
  badge: Badge;
}

// ==================== NOTIFICATION ====================

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string | null;
  createdAt: string;
}

// ==================== DASHBOARD ====================

export interface DashboardStats {
  addressCount: number;
  serviceCount: number;
  monthlyExpenses: number;
  activePlan: {
    id: string;
    fromCity: string;
    toCity: string;
    moveDate: string;
    status: string;
  } | null;
}

// ==================== SUPPORT TICKETS ====================

export type TicketCategory =
  | "GENERAL"
  | "BUG"
  | "BILLING"
  | "ACCOUNT"
  | "FEATURE_REQUEST";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_USER"
  | "RESOLVED"
  | "CLOSED";
export type TicketPlatform = "WEB" | "MOBILE" | "ADMIN";
export type MessageSenderType = "USER" | "ADMIN" | "SYSTEM";

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  platform: TicketPlatform;
  assignedTo?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  messages?: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: MessageSenderType;
  senderId: string;
  content: string;
  attachmentUrl?: string | null;
  isInternal?: boolean;
  createdAt: string;
}

export interface CreateTicketPayload {
  subject: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  message: string;
  platform?: TicketPlatform;
}

export interface TicketReplyPayload {
  message: string;
}
