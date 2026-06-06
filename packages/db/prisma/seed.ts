import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Seed badges
  const badges = [
    {
      code: "first_home",
      name: "First Home",
      description: "Added your first address",
      category: "GETTING_STARTED",
      requirement: "Add 1 address",
      rarity: "COMMON",
      points: 10,
    },
    {
      code: "plugged_in",
      name: "Plugged In",
      description: "Added your first service",
      category: "GETTING_STARTED",
      requirement: "Add 1 service",
      rarity: "COMMON",
      points: 10,
    },
    {
      code: "budget_boss",
      name: "Budget Boss",
      description: "Created your first budget",
      category: "ORGANIZATION",
      requirement: "Create 1 budget",
      rarity: "COMMON",
      points: 15,
    },
    {
      code: "task_tackler",
      name: "Task Tackler",
      description: "Completed 10 tasks",
      category: "ORGANIZATION",
      requirement: "Complete 10 tasks",
      rarity: "UNCOMMON",
      points: 25,
    },
    {
      code: "moving_maestro",
      name: "Moving Maestro",
      description: "Completed a moving plan",
      category: "MOVING",
      requirement: "Complete 1 moving plan",
      rarity: "RARE",
      points: 50,
    },
    {
      code: "streak_7",
      name: "Week Warrior",
      description: "7-day activity streak",
      category: "STREAK",
      requirement: "7 consecutive days of activity",
      rarity: "UNCOMMON",
      points: 30,
    },
    {
      code: "streak_30",
      name: "Monthly Master",
      description: "30-day activity streak",
      category: "STREAK",
      requirement: "30 consecutive days of activity",
      rarity: "RARE",
      points: 75,
    },
    {
      code: "streak_100",
      name: "Century Champion",
      description: "100-day activity streak",
      category: "STREAK",
      requirement: "100 consecutive days of activity",
      rarity: "LEGENDARY",
      points: 200,
    },
    {
      code: "organized",
      name: "Super Organized",
      description: "Added 10+ services across all addresses",
      category: "ORGANIZATION",
      requirement: "Add 10 services",
      rarity: "UNCOMMON",
      points: 30,
    },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { code: badge.code },
      update: badge,
      create: badge,
    });
  }

  // Seed state rules (starting with 10 states)
  const stateRules = [
    {
      stateCode: "TX",
      stateName: "Texas",
      dmvRules: JSON.stringify({
        vehicleRegistration: {
          deadline: 30,
          deadlineUnit: "days",
          description: "Register vehicle within 30 days of establishing residency",
          requirements: [
            "Current vehicle title",
            "Proof of insurance",
            "VIN inspection (Form VI-30)",
            "Proof of Texas residency",
          ],
          fees: "Varies by vehicle weight and county",
        },
        driversLicense: {
          deadline: 90,
          deadlineUnit: "days",
          description: "Obtain TX license within 90 days",
          requirements: [
            "Proof of identity",
            "Proof of Texas residency",
            "Social Security Number",
            "Pass vision test",
            "Surrender out-of-state license",
          ],
          cost: "$33",
        },
      }),
      voterRegistration: JSON.stringify({
        deadline: 30,
        deadlineUnit: "days",
        description: "Register to vote at least 30 days before election",
        onlineRegistration: true,
        url: "https://www.votetexas.gov",
      }),
      utilityInfo: JSON.stringify({
        electricDeregulated: true,
        description: "Texas electricity market is deregulated. Compare providers at powertochoose.org",
        commonProviders: ["TXU Energy", "Reliant", "Direct Energy", "Green Mountain"],
      }),
      taxInfo: JSON.stringify({
        stateIncomeTax: false,
        propertyTaxHigh: true,
        salesTaxRate: 6.25,
        notes: "No state income tax, but property taxes are higher than national average",
      }),
    },
    {
      stateCode: "CA",
      stateName: "California",
      dmvRules: JSON.stringify({
        vehicleRegistration: {
          deadline: 20,
          deadlineUnit: "days",
          description: "Register vehicle within 20 days of establishing residency",
          requirements: [
            "Out-of-state title",
            "Smog certification",
            "Proof of insurance",
            "VIN verification",
          ],
          fees: "Varies, typically $150-$500+",
        },
        driversLicense: {
          deadline: 10,
          deadlineUnit: "days",
          description: "Obtain CA license within 10 days of establishing residency",
          requirements: [
            "Proof of identity",
            "Proof of California residency",
            "Social Security Number",
            "Pass written and vision tests",
          ],
          cost: "$38",
        },
      }),
      utilityInfo: JSON.stringify({
        electricDeregulated: false,
        commonProviders: ["PG&E", "SCE", "SDG&E", "LADWP"],
      }),
      taxInfo: JSON.stringify({
        stateIncomeTax: true,
        topRate: 13.3,
        salesTaxRate: 7.25,
        notes: "Highest state income tax rate in the nation",
      }),
    },
    {
      stateCode: "NY",
      stateName: "New York",
      dmvRules: JSON.stringify({
        vehicleRegistration: {
          deadline: 30,
          deadlineUnit: "days",
          description: "Register vehicle within 30 days",
          requirements: [
            "Proof of identity",
            "Proof of NY insurance",
            "Vehicle title or registration",
          ],
        },
        driversLicense: {
          deadline: 30,
          deadlineUnit: "days",
          description: "Exchange license within 30 days",
          cost: "$64.50",
        },
      }),
      utilityInfo: JSON.stringify({
        electricDeregulated: true,
        commonProviders: ["Con Edison", "National Grid", "NYSEG", "RG&E"],
      }),
      taxInfo: JSON.stringify({
        stateIncomeTax: true,
        topRate: 10.9,
        salesTaxRate: 4.0,
        notes: "NYC has additional city income tax",
      }),
    },
    {
      stateCode: "FL",
      stateName: "Florida",
      dmvRules: JSON.stringify({
        vehicleRegistration: {
          deadline: 10,
          deadlineUnit: "days",
          description: "Register vehicle within 10 days of employment or enrolling children in school",
          requirements: ["Vehicle title", "Proof of FL insurance", "VIN inspection"],
        },
        driversLicense: {
          deadline: 30,
          deadlineUnit: "days",
          description: "Obtain FL license within 30 days of establishing residency",
          cost: "$48",
        },
      }),
      taxInfo: JSON.stringify({
        stateIncomeTax: false,
        salesTaxRate: 6.0,
        notes: "No state income tax",
      }),
    },
    {
      stateCode: "NJ",
      stateName: "New Jersey",
      dmvRules: JSON.stringify({
        vehicleRegistration: {
          deadline: 60,
          deadlineUnit: "days",
          description: "Register vehicle within 60 days",
          requirements: ["Vehicle title", "Proof of NJ insurance", "VIN verification"],
        },
        driversLicense: {
          deadline: 60,
          deadlineUnit: "days",
          description: "Exchange license within 60 days",
          cost: "$24",
        },
      }),
      utilityInfo: JSON.stringify({
        electricDeregulated: true,
        commonProviders: ["PSE&G", "JCP&L", "Atlantic City Electric"],
      }),
      taxInfo: JSON.stringify({
        stateIncomeTax: true,
        topRate: 10.75,
        salesTaxRate: 6.625,
      }),
    },
    {
      stateCode: "PA",
      stateName: "Pennsylvania",
      dmvRules: JSON.stringify({
        vehicleRegistration: {
          deadline: 20,
          deadlineUnit: "days",
          description: "Register vehicle within 20 days",
        },
        driversLicense: {
          deadline: 60,
          deadlineUnit: "days",
          cost: "$30.50",
        },
      }),
      taxInfo: JSON.stringify({
        stateIncomeTax: true,
        flatRate: 3.07,
        salesTaxRate: 6.0,
      }),
    },
    {
      stateCode: "IL",
      stateName: "Illinois",
      dmvRules: JSON.stringify({
        vehicleRegistration: {
          deadline: 30,
          deadlineUnit: "days",
        },
        driversLicense: {
          deadline: 90,
          deadlineUnit: "days",
          cost: "$30",
        },
      }),
      utilityInfo: JSON.stringify({
        electricDeregulated: true,
        commonProviders: ["ComEd", "Ameren Illinois"],
      }),
      taxInfo: JSON.stringify({
        stateIncomeTax: true,
        flatRate: 4.95,
        salesTaxRate: 6.25,
      }),
    },
    {
      stateCode: "GA",
      stateName: "Georgia",
      dmvRules: JSON.stringify({
        vehicleRegistration: {
          deadline: 30,
          deadlineUnit: "days",
        },
        driversLicense: {
          deadline: 30,
          deadlineUnit: "days",
          cost: "$32",
        },
      }),
      taxInfo: JSON.stringify({
        stateIncomeTax: true,
        topRate: 5.49,
        salesTaxRate: 4.0,
      }),
    },
    {
      stateCode: "WA",
      stateName: "Washington",
      dmvRules: JSON.stringify({
        vehicleRegistration: {
          deadline: 30,
          deadlineUnit: "days",
        },
        driversLicense: {
          deadline: 30,
          deadlineUnit: "days",
          cost: "$89",
        },
      }),
      taxInfo: JSON.stringify({
        stateIncomeTax: false,
        salesTaxRate: 6.5,
        notes: "No state income tax but high sales tax",
      }),
    },
    {
      stateCode: "CO",
      stateName: "Colorado",
      dmvRules: JSON.stringify({
        vehicleRegistration: {
          deadline: 90,
          deadlineUnit: "days",
        },
        driversLicense: {
          deadline: 90,
          deadlineUnit: "days",
          cost: "$30.87",
        },
      }),
      taxInfo: JSON.stringify({
        stateIncomeTax: true,
        flatRate: 4.4,
        salesTaxRate: 2.9,
      }),
    },
  ];

  for (const rule of stateRules) {
    await prisma.stateRule.upsert({
      where: { stateCode: rule.stateCode },
      update: rule,
      create: rule,
    });
  }

  console.log("✅ Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
