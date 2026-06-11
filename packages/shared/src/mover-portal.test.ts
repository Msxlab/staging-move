import { describe, expect, it } from "vitest";
import {
  isAllowedMoverDocContentType,
  isMoverApplicationStatus,
  isMoverDocumentKind,
  moverServiceLabels,
  moverStatusLabel,
  validateMoverApplication,
} from "./mover-portal";

const VALID = {
  companyLegalName: "  Lone Star Moving LLC  ",
  dbaName: "",
  usdotNumber: "1234567",
  mcNumber: "MC-987654",
  contactName: "Jordan Diaz",
  contactEmail: "OPS@LoneStar.com",
  contactPhone: "512-555-0199",
  website: "lonestarmoving.com",
  serviceStates: ["tx", "TX", "ok", "ZZ"], // dupes + invalid ZZ are dropped
  services: ["LOCAL", "PACKING", "NOT_A_SERVICE"],
  fleetSize: "12",
  yearsInBusiness: 8,
  attestation: true,
};

describe("validateMoverApplication", () => {
  it("accepts + normalizes a complete valid submission", () => {
    const { ok, errors, value } = validateMoverApplication(VALID);
    expect(ok).toBe(true);
    expect(errors).toEqual({});
    expect(value).toEqual({
      companyLegalName: "Lone Star Moving LLC",
      dbaName: null,
      usdotNumber: 1234567,
      mcNumber: "987654", // "MC-" prefix stripped
      contactName: "Jordan Diaz",
      contactEmail: "ops@lonestar.com", // lowercased
      contactPhone: "512-555-0199",
      website: "https://lonestarmoving.com", // scheme added
      serviceStates: "TX,OK", // deduped, uppercased, invalid dropped
      services: "LOCAL,PACKING", // invalid dropped
      fleetSize: 12,
      yearsInBusiness: 8,
      attestation: true,
    });
  });

  it("requires the core fields", () => {
    const { ok, errors, value } = validateMoverApplication({});
    expect(ok).toBe(false);
    expect(value).toBeNull();
    expect(errors).toMatchObject({
      companyLegalName: expect.any(String),
      usdotNumber: expect.any(String),
      contactName: expect.any(String),
      contactEmail: expect.any(String),
      serviceStates: expect.any(String),
      services: expect.any(String),
      attestation: expect.any(String),
    });
  });

  it("rejects a submission with no valid service state", () => {
    const { ok, errors } = validateMoverApplication({ ...VALID, serviceStates: ["ZZ", "QQ"] });
    expect(ok).toBe(false);
    expect(errors.serviceStates).toBeDefined();
  });

  it("rejects a non-positive USDOT number", () => {
    expect(validateMoverApplication({ ...VALID, usdotNumber: 0 }).errors.usdotNumber).toBeDefined();
    expect(validateMoverApplication({ ...VALID, usdotNumber: "abc" }).errors.usdotNumber).toBeDefined();
  });

  it("requires the accuracy attestation", () => {
    expect(validateMoverApplication({ ...VALID, attestation: false }).errors.attestation).toBeDefined();
    expect(validateMoverApplication({ ...VALID, attestation: "true" }).errors.attestation).toBeDefined();
  });

  it("rejects a malformed email", () => {
    expect(validateMoverApplication({ ...VALID, contactEmail: "not-an-email" }).errors.contactEmail).toBeDefined();
  });

  it("treats optional numeric fields as nullable, not zero", () => {
    const { value } = validateMoverApplication({ ...VALID, fleetSize: "", yearsInBusiness: undefined });
    expect(value?.fleetSize).toBeNull();
    expect(value?.yearsInBusiness).toBeNull();
  });
});

describe("mover-portal vocabulary helpers", () => {
  it("isMoverApplicationStatus narrows known statuses", () => {
    expect(isMoverApplicationStatus("APPROVED")).toBe(true);
    expect(isMoverApplicationStatus("BOGUS")).toBe(false);
  });

  it("moverStatusLabel maps to plain English", () => {
    expect(moverStatusLabel("NEEDS_INFO")).toBe("Needs info");
    expect(moverStatusLabel("PENDING")).toBe("Pending");
  });

  it("isMoverDocumentKind validates document kinds", () => {
    expect(isMoverDocumentKind("INSURANCE_COI")).toBe(true);
    expect(isMoverDocumentKind("RANDOM")).toBe(false);
  });

  it("isAllowedMoverDocContentType accepts pdf/images and ignores charset suffixes", () => {
    expect(isAllowedMoverDocContentType("application/pdf")).toBe(true);
    expect(isAllowedMoverDocContentType("image/png")).toBe(true);
    expect(isAllowedMoverDocContentType("application/pdf; charset=binary")).toBe(true);
    expect(isAllowedMoverDocContentType("application/zip")).toBe(false);
    expect(isAllowedMoverDocContentType("text/html")).toBe(false);
  });

  it("moverServiceLabels resolves stored CSV to labels, passing through unknowns", () => {
    expect(moverServiceLabels("LOCAL,PACKING")).toEqual(["Local moves", "Packing & unpacking"]);
    expect(moverServiceLabels("LOCAL,MYSTERY")).toEqual(["Local moves", "MYSTERY"]);
  });
});
