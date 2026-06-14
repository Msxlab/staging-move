import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { recordLegalAcceptance } from "@/lib/legal-acceptance";
import { ONBOARDING_COMPLETED_EVENT } from "@/lib/legal";
import {
  ONBOARDING_MOVING_SKIPPED_EVENT,
  ONBOARDING_SERVICES_SKIPPED_EVENT,
} from "@/lib/onboarding-progress";
import { getStoreReviewAccountEmails } from "@/lib/qa-account";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

const STORE_REVIEW_RUNTIME_KEYS = [
  "STORE_REVIEW_ACCOUNT_EMAILS",
  "GOOGLE_PLAY_TEST_PURCHASE_USER_EMAILS",
  "APPLE_SANDBOX_PURCHASE_USER_EMAILS",
] as const;

const SINGLE_EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function parseEmailList(value: string | null | undefined): string[] {
  return (value || "")
    .split(/[,\n;]/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => SINGLE_EMAIL_PATTERN.test(email));
}

export async function getConfiguredStoreReviewAccountEmails(): Promise<string[]> {
  const runtimeValues = await Promise.all(
    STORE_REVIEW_RUNTIME_KEYS.map((key) => getRuntimeConfigValue(key).catch(() => null)),
  );
  return [
    ...new Set([
      ...getStoreReviewAccountEmails(),
      ...runtimeValues.flatMap(parseEmailList),
    ]),
  ];
}

const REVIEW_HOME = {
  type: "HOME",
  nickname: "Review home",
  street: "60 State St",
  city: "Hackensack",
  state: "NJ",
  zip: "07601",
  country: "USA",
  ownership: "RENTER",
  latitude: 40.8859,
  longitude: -74.0435,
};

const REVIEW_SERVICES = [
  {
    category: "UTILITY_ELECTRIC",
    subCategory: "Electric",
    providerName: "PSE&G",
    website: "https://nj.pseg.com",
    monthlyCost: 94,
  },
  {
    category: "UTILITY_INTERNET",
    subCategory: "Internet",
    providerName: "Verizon Fios",
    website: "https://www.verizon.com/home/internet/fios",
    monthlyCost: 75,
  },
  {
    category: "FINANCIAL_INSURANCE_HOME",
    subCategory: "Renters Insurance",
    providerName: "State Farm Renters Insurance",
    website: "https://www.statefarm.com/insurance/home-and-property/renters",
    monthlyCost: 18,
  },
] as const;

export async function provisionStoreReviewAccount(input: {
  userId: string;
  request: NextRequest;
}) {
  const workspaceMember = await prisma.workspaceMember.findFirst({
    where: { userId: input.userId, status: "ACTIVE" },
    select: { workspaceId: true },
    orderBy: { createdAt: "asc" },
  });
  const workspaceId = workspaceMember?.workspaceId ?? null;

  await prisma.profile.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      ageRange: "25-34",
      familyStatus: "SINGLE",
      hasChildren: false,
      childrenCount: 0,
      hasPets: false,
      petTypes: "[]",
      carCount: 1,
      hasMotorcycle: false,
      hasBoatRV: false,
      needsStorage: false,
      hasSenior: false,
      hasDisability: false,
      isMilitary: false,
      moveType: "PERSONAL",
      isBusinessOwner: false,
      isImmigrant: false,
      immigrationStatus: null,
    },
    update: {},
  });

  await recordLegalAcceptance({
    userId: input.userId,
    request: input.request,
    page: "/store-review",
    source: "store_review_account_provisioning",
  });

  const existingAddress = await prisma.address.findFirst({
    where: {
      userId: input.userId,
      deletedAt: null,
      isPrimary: true,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const address = existingAddress ?? (await prisma.address.create({
    data: {
      userId: input.userId,
      ...(workspaceId ? { workspaceId } : {}),
      ...REVIEW_HOME,
      isPrimary: true,
      startDate: new Date(),
      formattedAddress: `${REVIEW_HOME.street}, ${REVIEW_HOME.city}, ${REVIEW_HOME.state} ${REVIEW_HOME.zip}`,
    },
    select: { id: true },
  }));

  const serviceCount = await prisma.service.count({
    where: {
      userId: input.userId,
      addressId: address.id,
      deletedAt: null,
    },
  });
  if (serviceCount === 0) {
    await prisma.service.createMany({
      data: REVIEW_SERVICES.map((service) => ({
        userId: input.userId,
        ...(workspaceId ? { workspaceId } : {}),
        addressId: address.id,
        ...service,
        billingCycle: "MONTHLY",
        isActive: true,
        activatedAt: new Date(),
      })),
    });
  }

  await prisma.userEvent.createMany({
    data: [
      ONBOARDING_SERVICES_SKIPPED_EVENT,
      ONBOARDING_MOVING_SKIPPED_EVENT,
      ONBOARDING_COMPLETED_EVENT,
    ].map((event) => ({
      userId: input.userId,
      event,
      page: "/store-review",
      metadata: JSON.stringify({ source: "store_review_account_provisioning" }),
    })),
  });
}

export async function provisionConfiguredStoreReviewAccounts(input: {
  request: NextRequest;
}) {
  const emails = await getConfiguredStoreReviewAccountEmails();
  if (emails.length === 0) {
    return {
      configured: 0,
      matched: 0,
      verified: 0,
      provisioned: 0,
      skipped: "no_store_review_emails_configured",
    };
  }

  const users = await prisma.user.findMany({
    where: {
      email: { in: emails },
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
    },
  });

  let verified = 0;
  let provisioned = 0;
  for (const user of users) {
    if (!user.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
      verified += 1;
    }
    await provisionStoreReviewAccount({ userId: user.id, request: input.request });
    provisioned += 1;
  }

  return {
    configured: emails.length,
    matched: users.length,
    verified,
    provisioned,
    missing: emails.filter((email) => !users.some((user) => user.email.toLowerCase() === email)),
  };
}
