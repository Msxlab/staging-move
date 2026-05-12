import { z } from "zod";

// ==================== PROFILE ====================

export const profileSchema = z.strictObject({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  ageRange: z.string().optional(),
  familyStatus: z.enum(["SINGLE", "COUPLE", "FAMILY", "OTHER"]).default("SINGLE"),
  hasChildren: z.boolean().default(false),
  childrenCount: z.number().min(0).max(20).default(0),
  hasPets: z.boolean().default(false),
  petTypes: z.array(z.string()).max(20).default([]),
  carCount: z.number().min(0).max(20).default(0),
  hasMotorcycle: z.boolean().default(false),
  hasBoatRV: z.boolean().default(false),
  needsStorage: z.boolean().default(false),
  hasSenior: z.boolean().default(false),
  hasDisability: z.boolean().default(false),
  isMilitary: z.boolean().default(false),
  moveType: z.enum(["PERSONAL", "BUSINESS", "VACATION"]).default("PERSONAL"),
  isBusinessOwner: z.boolean().default(false),
  isImmigrant: z.boolean().default(false),
  immigrationStatus: z
    .union([
      z.enum(["CITIZEN", "GREEN_CARD", "H1B", "L1", "F1", "OTHER_VISA"]),
      z.literal(""),
    ])
    .default(""),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

// ==================== ADDRESS ====================

export const addressSchema = z.strictObject({
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
  formattedAddress: z.string().max(500).nullable().optional(),
  placeId: z.string().max(191).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

export type AddressFormData = z.infer<typeof addressSchema>;

// ==================== SERVICE ====================

export const serviceSchema = z.strictObject({
  addressId: z.string().min(1, "Address is required"),
  providerId: z.string().max(30).optional(),
  customProviderId: z.string().max(30).optional(),
  category: z.string().min(1, "Category is required"),
  subCategory: z.string().optional(),
  providerName: z.string().min(1, "Provider name is required").max(200),
  migrationAction: z.enum(["TRANSFER", "SWITCH", "NEW", "CANCEL", "KEEP"]).optional(),
  previousServiceId: z.string().max(30).optional(),
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

export const customProviderSchema = z.strictObject({
  name: z.string().min(1, "Provider name is required").max(200),
  category: z.string().min(1, "Category is required").max(50),
  description: z.string().max(1000).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  addressLine1: z.string().max(200).optional().or(z.literal("")),
  addressLine2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().length(2, "Use 2-letter state code").optional().or(z.literal("")),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code").optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  providerType: z.enum([
    "LOCAL_BUSINESS",
    "PROFESSIONAL_SERVICE",
    "HEALTHCARE",
    "LEGAL",
    "DENTAL",
    "PHYSICAL_THERAPY",
    "GYM",
    "OTHER",
  ]).default("OTHER"),
  submitForGlobalReview: z.boolean().optional(),
});

export type CustomProviderFormData = z.infer<typeof customProviderSchema>;

// ==================== MOVING PLAN ====================

export const movingPlanSchema = z.strictObject({
  fromAddressId: z.string().min(1, "Origin address is required"),
  toAddressId: z.string().min(1, "Destination address is required").optional(),
  destinationAddress: addressSchema.optional(),
  moveDate: z.string().min(1, "Move date is required"),
  isTemporary: z.boolean().default(false),
  estimatedDuration: z.number().min(1).optional(),
}).superRefine((value, ctx) => {
  const hasExistingDestination = Boolean(value.toAddressId);
  const hasInlineDestination = Boolean(value.destinationAddress);

  if (!hasExistingDestination && !hasInlineDestination) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["toAddressId"],
      message: "Destination address is required",
    });
  }

  if (hasExistingDestination && hasInlineDestination) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["destinationAddress"],
      message: "Choose either an existing destination or a new destination",
    });
  }
});

export type MovingPlanFormData = z.infer<typeof movingPlanSchema>;

// ==================== TASK ====================

export const taskSchema = z.strictObject({
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

export const budgetSchema = z.strictObject({
  addressId: z.string().optional(),
  month: z.string().min(1, "Month is required"),
  year: z.number().min(2020).max(2100),
  plannedIncome: z.number().min(0).optional(),
  actualIncome: z.number().min(0).optional(),
  plannedExpenses: z.number().min(0).optional(),
  actualExpenses: z.number().min(0).optional(),
  categoryBreakdown: z.union([z.string(), z.record(z.number().min(0))]).optional(),
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
