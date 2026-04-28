import { describe, it, expect } from "vitest";
import {
  profileSchema,
  addressSchema,
  serviceSchema,
  movingPlanSchema,
  taskSchema,
  budgetSchema,
  reviewSchema,
  documentUploadSchema,
} from "../validators";

describe("profileSchema", () => {
  it("should accept valid profile data", () => {
    const result = profileSchema.safeParse({
      firstName: "John",
      lastName: "Doe",
      familyStatus: "FAMILY",
      hasChildren: true,
      childrenCount: 2,
      hasPets: false,
      carCount: 1,
    });
    expect(result.success).toBe(true);
  });

  it("should require firstName", () => {
    const result = profileSchema.safeParse({ firstName: "", lastName: "Doe" });
    expect(result.success).toBe(false);
  });

  it("should require lastName", () => {
    const result = profileSchema.safeParse({ firstName: "John", lastName: "" });
    expect(result.success).toBe(false);
  });

  it("should reject childrenCount > 20", () => {
    const result = profileSchema.safeParse({
      firstName: "A",
      lastName: "B",
      childrenCount: 21,
    });
    expect(result.success).toBe(false);
  });

  it("should default familyStatus to SINGLE", () => {
    const result = profileSchema.parse({ firstName: "A", lastName: "B" });
    expect(result.familyStatus).toBe("SINGLE");
  });
});

describe("addressSchema", () => {
  const validAddress = {
    type: "HOME",
    street: "123 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    ownership: "RENTER",
    startDate: "2024-01-01",
  };

  it("should accept valid address", () => {
    const result = addressSchema.safeParse(validAddress);
    expect(result.success).toBe(true);
  });

  it("should reject invalid state code (too long)", () => {
    const result = addressSchema.safeParse({ ...validAddress, state: "TEX" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid ZIP code", () => {
    const result = addressSchema.safeParse({ ...validAddress, zip: "1234" });
    expect(result.success).toBe(false);
  });

  it("should accept ZIP+4 format", () => {
    const result = addressSchema.safeParse({ ...validAddress, zip: "78701-1234" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid address type", () => {
    const result = addressSchema.safeParse({ ...validAddress, type: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("should require street", () => {
    const result = addressSchema.safeParse({ ...validAddress, street: "" });
    expect(result.success).toBe(false);
  });
});

describe("serviceSchema", () => {
  const validService = {
    addressId: "addr-1",
    category: "UTILITY_ELECTRIC",
    providerName: "Austin Energy",
  };

  it("should accept valid service", () => {
    const result = serviceSchema.safeParse(validService);
    expect(result.success).toBe(true);
  });

  it("should require addressId", () => {
    const result = serviceSchema.safeParse({ ...validService, addressId: "" });
    expect(result.success).toBe(false);
  });

  it("should require providerName", () => {
    const result = serviceSchema.safeParse({ ...validService, providerName: "" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid billing day", () => {
    const result = serviceSchema.safeParse({ ...validService, billingDay: 32 });
    expect(result.success).toBe(false);
  });

  it("should accept valid billingDay 1-31", () => {
    expect(serviceSchema.safeParse({ ...validService, billingDay: 1 }).success).toBe(true);
    expect(serviceSchema.safeParse({ ...validService, billingDay: 31 }).success).toBe(true);
  });

  it("should reject negative monthlyCost", () => {
    const result = serviceSchema.safeParse({ ...validService, monthlyCost: -10 });
    expect(result.success).toBe(false);
  });

  it("should accept valid website URL", () => {
    const result = serviceSchema.safeParse({ ...validService, website: "https://example.com" });
    expect(result.success).toBe(true);
  });

  it("should accept empty string for website", () => {
    const result = serviceSchema.safeParse({ ...validService, website: "" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid website URL", () => {
    const result = serviceSchema.safeParse({ ...validService, website: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid billing cycle", () => {
    const result = serviceSchema.safeParse({ ...validService, billingCycle: "WEEKLY" });
    expect(result.success).toBe(false);
  });
});

describe("movingPlanSchema", () => {
  it("should accept valid moving plan", () => {
    const result = movingPlanSchema.safeParse({
      fromAddressId: "addr-1",
      toAddressId: "addr-2",
      moveDate: "2025-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("should require fromAddressId", () => {
    const result = movingPlanSchema.safeParse({
      fromAddressId: "",
      toAddressId: "addr-2",
      moveDate: "2025-06-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("taskSchema", () => {
  it("should accept valid task", () => {
    const result = taskSchema.safeParse({ title: "Pack boxes" });
    expect(result.success).toBe(true);
  });

  it("should require title", () => {
    const result = taskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("should default priority to MEDIUM", () => {
    const result = taskSchema.parse({ title: "Test" });
    expect(result.priority).toBe("MEDIUM");
  });

  it("should reject invalid priority", () => {
    const result = taskSchema.safeParse({ title: "Test", priority: "CRITICAL" });
    expect(result.success).toBe(false);
  });
});

describe("budgetSchema", () => {
  it("should accept valid budget", () => {
    const result = budgetSchema.safeParse({
      month: "January",
      year: 2025,
      plannedExpenses: 1500,
    });
    expect(result.success).toBe(true);
  });

  it("should accept budget category limits without actual expenses", () => {
    const result = budgetSchema.safeParse({
      month: "January",
      year: 2025,
      categoryBreakdown: { Utilities: 300, "Internet & Phone": 150 },
    });
    expect(result.success).toBe(true);
  });

  it("should reject year < 2020", () => {
    const result = budgetSchema.safeParse({ month: "Jan", year: 2019 });
    expect(result.success).toBe(false);
  });

  it("should reject year > 2100", () => {
    const result = budgetSchema.safeParse({ month: "Jan", year: 2101 });
    expect(result.success).toBe(false);
  });
});

describe("reviewSchema", () => {
  const validReview = {
    providerName: "Test Provider",
    category: "UTILITY_ELECTRIC",
    zipCode: "78701",
    city: "Austin",
    state: "TX",
    rating: 4,
    content: "Great service, very reliable and fast.",
  };

  it("should accept valid review", () => {
    const result = reviewSchema.safeParse(validReview);
    expect(result.success).toBe(true);
  });

  it("should reject rating > 5", () => {
    const result = reviewSchema.safeParse({ ...validReview, rating: 6 });
    expect(result.success).toBe(false);
  });

  it("should reject rating < 1", () => {
    const result = reviewSchema.safeParse({ ...validReview, rating: 0 });
    expect(result.success).toBe(false);
  });

  it("should reject content shorter than 10 chars", () => {
    const result = reviewSchema.safeParse({ ...validReview, content: "Short" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid ZIP code", () => {
    const result = reviewSchema.safeParse({ ...validReview, zipCode: "ABCDE" });
    expect(result.success).toBe(false);
  });
});

describe("documentUploadSchema", () => {
  it("should accept valid document upload", () => {
    const result = documentUploadSchema.safeParse({
      category: "BILL",
      description: "Electric bill for January",
    });
    expect(result.success).toBe(true);
  });

  it("should accept empty object (all optional)", () => {
    const result = documentUploadSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should reject invalid category", () => {
    const result = documentUploadSchema.safeParse({ category: "INVALID_CAT" });
    expect(result.success).toBe(false);
  });
});
