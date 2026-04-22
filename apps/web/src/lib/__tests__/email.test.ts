import { describe, it, expect } from "vitest";
import { billReminderHtml, contractReminderHtml, weeklyDigestHtml } from "../email";

describe("billReminderHtml", () => {
  const data = {
    userName: "John Doe",
    serviceName: "Austin Energy",
    category: "UTILITY ELECTRIC",
    amount: 125.5,
    dueDate: "Mar 15, 2025",
    daysUntilDue: 3,
  };

  it("should contain the user name", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("John Doe");
  });

  it("should contain the service name", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("Austin Energy");
  });

  it("should contain the formatted amount", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("$125.50");
  });

  it("should contain the due date", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("Mar 15, 2025");
  });

  it("should show 'today' when daysUntilDue is 0", () => {
    const html = billReminderHtml({ ...data, daysUntilDue: 0 });
    expect(html).toContain("today");
  });

  it("should show correct plural for days", () => {
    const html3 = billReminderHtml({ ...data, daysUntilDue: 3 });
    expect(html3).toContain("3 days");

    const html1 = billReminderHtml({ ...data, daysUntilDue: 1 });
    expect(html1).toContain("1 day");
    expect(html1).not.toContain("1 days");
  });

  it("should contain View Services link", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("/services");
  });

  it("should be valid HTML structure", () => {
    const html = billReminderHtml(data);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });
});

describe("weeklyDigestHtml", () => {
  const data = {
    userName: "Jane Smith",
    weekStart: "Mar 1",
    weekEnd: "Mar 7",
    upcomingBills: [
      { name: "Electric", amount: 100, dueDate: "Mar 10" },
      { name: "Internet", amount: 59.99, dueDate: "Mar 12" },
    ],
    totalExpenses: 450.0,
    newServices: 2,
  };

  it("should contain the user name", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("Jane Smith");
  });

  it("should contain the date range", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("Mar 1");
    expect(html).toContain("Mar 7");
  });

  it("should contain monthly expenses", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("450");
    expect(html).toContain(">2<"); // newServices
  });

  it("should contain upcoming bills table", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("Electric");
    expect(html).toContain("$100.00");
    expect(html).toContain("Internet");
    expect(html).toContain("$59.99");
  });

  it("should contain total expenses", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("$450");
  });

  it("should hide bills section when empty", () => {
    const html = weeklyDigestHtml({ ...data, upcomingBills: [] });
    expect(html).not.toContain("Upcoming Bills");
  });

  it("should contain Open Dashboard link", () => {
    const html = weeklyDigestHtml(data);
    expect(html).toContain("/dashboard");
  });
});

describe("contractReminderHtml", () => {
  const data = {
    userName: "Sam Taylor",
    serviceName: "Spectrum Internet",
    contractEndDate: "Apr 10, 2026",
    daysRemaining: 14,
    serviceLink: "http://localhost:3000/services/abc123",
  };

  it("should contain the user and service names", () => {
    const html = contractReminderHtml(data);
    expect(html).toContain("Sam Taylor");
    expect(html).toContain("Spectrum Internet");
  });

  it("should contain the contract end date and days remaining", () => {
    const html = contractReminderHtml(data);
    expect(html).toContain("Apr 10, 2026");
    expect(html).toContain("14 days");
  });

  it("should contain the service review link", () => {
    const html = contractReminderHtml(data);
    expect(html).toContain("/services/abc123");
  });
});
