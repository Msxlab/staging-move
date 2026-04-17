import { z } from "zod";

// ==================== PROFILE ====================

export const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  ageRange: z.string().optional(),
  familyStatus: z.enum(["SINGLE", "COUPLE", "FAMILY", "OTHER"]).default("SINGLE"),
  hasChildren: z.boolean().default(false),
  childrenCount: z.number().min(0).max(20).default(0),
  hasPets: z.boolean().default(false),
  petTypes: z.array(z.string()).default([]),
  carCount: z.number().min(0).max(20).default(0),
  hasMotorcycle: z.boolean().default(false),
  hasBoatRV: z.boolean().default(false),
  needsStorage: z.boolean().default(false),
  hasSenior: z.boolean().default(false),
  hasDisability: z.boolean().default(false),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

// ==================== ADDRESS ====================

export const addressSchema = z.object({
  type: z.enum(["HOME", "WORK", "VACATION", "TEMPORARY", "STORAGE", "OTHER"]),
  nickname: z.string().max(50).optional(),
  street: z.string().min(1, "Street address is required").max(200),
  street2: z.string().max(200).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().length(2, "Use 2-letter state code"),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  country: z.string().default("USA"),
  isPrimary: z.boolean().default(false),
  ownership: z.enum(["OWNER", "RENTER", "FAMILY", "OTHER"]),
  startDate: z.string().min(1, "Move-in date is required"),
  endDate: z.string().optional(),
});

export type AddressFormData = z.infer<typeof addressSchema>;

// ==================== SERVICE ====================

export const serviceSchema = z.object({
  addressId: z.string().min(1, "Address is required"),
  category: z.string().min(1, "Category is required"),
  subCategory: z.string().optional(),
  providerName: z.string().min(1, "Provider name is required").max(200),
  accountNumber: z.string().max(100).optional(),
  username: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  monthlyCost: z.number().min(0).optional(),
  billingDay: z.number().min(1).max(31).optional(),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"]).optional(),
  autoRenewal: z.boolean().default(false),
  contractEndDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  isActive: z.boolean().default(true),
});

export type ServiceFormData = z.infer<typeof serviceSchema>;

// ==================== MOVING PLAN ====================

export const movingPlanSchema = z.object({
  fromAddressId: z.string().min(1, "Origin address is required"),
  toAddressId: z.string().min(1, "Destination address is required"),
  moveDate: z.string().min(1, "Move date is required"),
  isTemporary: z.boolean().default(false),
  estimatedDuration: z.number().min(1).optional(),
});

export type MovingPlanFormData = z.infer<typeof movingPlanSchema>;

// ==================== TASK ====================

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  category: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  movingPlanId: z.string().optional(),
  assignedTo: z.string().optional(),
});

export type TaskFormData = z.infer<typeof taskSchema>;

// ==================== BUDGET ====================

export const budgetSchema = z.object({
  addressId: z.string().optional(),
  month: z.string().min(1, "Month is required"),
  year: z.number().min(2020).max(2100),
  plannedIncome: z.number().min(0).optional(),
  actualIncome: z.number().min(0).optional(),
  plannedExpenses: z.number().min(0).optional(),
  actualExpenses: z.number().min(0),
  notes: z.string().max(1000).optional(),
});

export type BudgetFormData = z.infer<typeof budgetSchema>;

// ==================== REVIEW ====================

export const reviewSchema = z.object({
  providerName: z.string().min(1, "Provider name is required"),
  category: z.string().min(1, "Category is required"),
  zipCode: z.string().regex(/^\d{5}$/, "Invalid ZIP code"),
  city: z.string().min(1, "City is required"),
  state: z.string().length(2, "Use 2-letter state code"),
  rating: z.number().min(1).max(5),
  title: z.string().max(100).optional(),
  content: z.string().min(10, "Review must be at least 10 characters").max(2000),
  speedRating: z.number().min(1).max(5).optional(),
  reliabilityRating: z.number().min(1).max(5).optional(),
  customerServiceRating: z.number().min(1).max(5).optional(),
  valueRating: z.number().min(1).max(5).optional(),
});

export type ReviewFormData = z.infer<typeof reviewSchema>;

// ==================== DOCUMENT ====================

export const documentUploadSchema = z.object({
  serviceId: z.string().optional(),
  category: z.enum([
    "BILL", "CONTRACT", "RECEIPT", "INSURANCE_POLICY", "LEASE_AGREEMENT",
    "MORTGAGE_DOCUMENT", "TAX_DOCUMENT", "MEDICAL_RECORD", "SCHOOL_RECORD",
    "ID_DOCUMENT", "OTHER"
  ]).optional(),
  description: z.string().max(500).optional(),
});

export type DocumentUploadFormData = z.infer<typeof documentUploadSchema>;
