const C = { primary: "#7c3aed", secondary: "#06b6d4", text: "#334155", muted: "#64748b", light: "#f1f5f9" };
function wrap(title: string, content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="background:linear-gradient(135deg,${C.primary},${C.secondary});padding:32px 24px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:20px;">${title}</h1></div><div style="padding:24px;">${content}</div><div style="padding:16px 24px;text-align:center;border-top:1px solid ${C.light};"><p style="color:#94a3b8;font-size:11px;margin:0;">LocateFlow &middot; Smart relocation management</p></div></div></body></html>`;
}
const btn = (href: string, label: string) => `<a href="${href}" style="display:block;text-align:center;background:${C.primary};color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;margin-top:20px;">${label}</a>`;
const p = (t: string) => `<p style="color:${C.text};font-size:15px;line-height:1.6;">${t}</p>`;
const sm = (t: string) => `<p style="color:${C.muted};font-size:12px;margin-top:16px;">${t}</p>`;
const stat = (val: string, label: string) => `<div style="flex:1;background:${C.light};border-radius:12px;padding:16px;text-align:center;"><p style="margin:0;font-size:24px;font-weight:700;color:${C.primary};">${val}</p><p style="margin:4px 0 0;font-size:11px;color:${C.muted};">${label}</p></div>`;
const row = (l: string, r: string) => `<tr><td style="padding:6px 0;color:${C.muted};font-size:14px;">${l}</td><td style="text-align:right;font-weight:600;font-size:14px;">${r}</td></tr>`;

export const EMAIL_TEMPLATES_ALL = [
  {
    slug: "welcome", name: "Welcome Email", subject: "Welcome to LocateFlow!", category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "email", "appUrl"]), isActive: true, isDefault: true,
    body: wrap("Welcome to LocateFlow!", p("Hi <strong>{{firstName}}</strong>,") + p("Welcome to LocateFlow! We're excited to help you manage your relocation with ease.") + `<ol style="color:${C.text};font-size:14px;line-height:1.8;"><li>Add your current address</li><li>Connect your services (utilities, insurance, etc.)</li><li>Create a moving plan when you're ready</li></ol>` + btn("{{appUrl}}/dashboard", "Go to Dashboard")),
  },
  {
    slug: "email-verify", name: "Email Verification", subject: "Verify your email address", category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "verifyLink"]), isActive: true, isDefault: true,
    body: wrap("Verify Your Email", p("Hi <strong>{{firstName}}</strong>,") + p("Please verify your email address by clicking the button below:") + btn("{{verifyLink}}", "Verify Email") + sm("If you didn't create an account, you can safely ignore this email.")),
  },
  {
    slug: "password-reset", name: "Password Reset", subject: "Reset your password", category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "resetLink"]), isActive: true, isDefault: true,
    body: wrap("Reset Password", p("Hi <strong>{{firstName}}</strong>,") + p("We received a request to reset your password. Click below to set a new one:") + btn("{{resetLink}}", "Reset Password") + sm("This link expires in 1 hour. If you didn't request this, you can safely ignore it.")),
  },
  {
    slug: "bill-reminder", name: "Bill Reminder", subject: "Bill reminder: {{serviceName}} is due soon", category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "serviceName", "amount", "dueDate", "daysLeft", "appUrl"]), isActive: true, isDefault: true,
    body: wrap("Bill Reminder", p("Hi <strong>{{firstName}}</strong>,") + p(`Your <strong>{{serviceName}}</strong> bill of <strong style="color:${C.primary};">$\{{amount}}</strong> is due in <strong>{{daysLeft}} days</strong>.`) + `<div style="background:${C.light};border-radius:12px;padding:16px;margin:16px 0;"><table style="width:100%;border-collapse:collapse;">${row("Service", "{{serviceName}}")}${row("Amount", `<span style="color:${C.primary};">$\{{amount}}</span>`)}${row("Due Date", "{{dueDate}}")}</table></div>` + btn("{{appUrl}}/services", "View Services")),
  },
  {
    slug: "weekly-digest", name: "Weekly Digest", subject: "Your weekly summary", category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "tasksDone", "pendingTasks", "totalCost", "appUrl"]), isActive: true, isDefault: true,
    body: wrap("Weekly Digest", p("Hi <strong>{{firstName}}</strong>, here's your weekly summary:") + `<div style="display:flex;gap:12px;margin:16px 0;">${stat("{{tasksDone}}", "Tasks Done")}${stat("{{pendingTasks}}", "Pending")}${stat("${{totalCost}}", "Monthly Cost")}</div>` + btn("{{appUrl}}/dashboard", "Open Dashboard")),
  },
  {
    slug: "move-reminder", name: "Moving Day Reminder", subject: "Your move is coming up!", category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "moveDate", "fromCity", "toCity", "pendingTasks", "appUrl"]), isActive: true, isDefault: true,
    body: wrap("Moving Day Reminder", p("Hi <strong>{{firstName}}</strong>,") + p("Your move from <strong>{{fromCity}}</strong> to <strong>{{toCity}}</strong> is scheduled for <strong>{{moveDate}}</strong>!") + p("You have <strong>{{pendingTasks}} pending tasks</strong> remaining.") + btn("{{appUrl}}/moving", "View Moving Plan")),
  },
  {
    slug: "review-approved", name: "Review Approved", subject: "Your review has been approved", category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "providerName", "appUrl"]), isActive: true, isDefault: true,
    body: wrap("Review Approved", p("Hi <strong>{{firstName}}</strong>,") + p("Your review for <strong>{{providerName}}</strong> has been approved and is now visible to the community. Thank you for sharing your experience!") + btn("{{appUrl}}/community", "View Community")),
  },
  {
    slug: "review-rejected", name: "Review Rejected", subject: "Your review needs attention", category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "providerName", "reason", "appUrl"]), isActive: true, isDefault: true,
    body: wrap("Review Update", p("Hi <strong>{{firstName}}</strong>,") + p("Your review for <strong>{{providerName}}</strong> could not be published.") + p("<strong>Reason:</strong> {{reason}}") + sm("You can edit and resubmit your review at any time.") + btn("{{appUrl}}/community", "Edit Review")),
  },
  {
    slug: "family-invite", name: "Family Invitation", subject: "You've been invited to join a family on LocateFlow", category: "TRANSACTIONAL",
    variables: JSON.stringify(["inviterName", "role", "inviteLink"]), isActive: true, isDefault: true,
    body: wrap("Family Invitation", p("<strong>{{inviterName}}</strong> has invited you to join their family on LocateFlow as a <strong>{{role}}</strong>.") + p("LocateFlow helps families manage their relocation together — tracking addresses, services, and moving plans in one place.") + btn("{{inviteLink}}", "Accept Invitation")),
  },
  {
    slug: "subscription-upgrade", name: "Plan Upgraded", subject: "Welcome to {{planName}}!", category: "TRANSACTIONAL",
    variables: JSON.stringify(["firstName", "planName", "appUrl"]), isActive: true, isDefault: true,
    body: wrap("Plan Upgraded!", p("Hi <strong>{{firstName}}</strong>,") + p("Your plan has been upgraded to <strong>{{planName}}</strong>! You now have access to all premium features.") + `<ul style="color:${C.text};font-size:14px;line-height:1.8;"><li>Unlimited addresses and services</li><li>Family sharing</li><li>Priority support</li><li>Advanced analytics</li></ul>` + btn("{{appUrl}}/dashboard", "Explore Features")),
  },
  {
    slug: "trial-expiring", name: "Trial Expiring Soon", subject: "Your free trial expires in {{daysLeft}} days", category: "MARKETING",
    variables: JSON.stringify(["firstName", "daysLeft", "upgradeLink"]), isActive: true, isDefault: true,
    body: wrap("Trial Expiring", p("Hi <strong>{{firstName}}</strong>,") + p("Your free trial expires in <strong>{{daysLeft}} days</strong>. Upgrade now to keep all your data and unlock premium features.") + `<div style="background:${C.light};border-radius:12px;padding:16px;margin:16px 0;"><p style="color:${C.text};font-size:14px;margin:0 0 8px;"><strong>What you'll lose:</strong></p><ul style="color:${C.muted};font-size:13px;margin:0;padding-left:20px;"><li>All your saved addresses and services</li><li>Moving plan progress</li><li>Document storage</li></ul></div>` + btn("{{upgradeLink}}", "Upgrade Now")),
  },
  {
    slug: "monthly-report", name: "Monthly Summary", subject: "Your {{month}} summary", category: "NOTIFICATION",
    variables: JSON.stringify(["firstName", "month", "totalSpend", "servicesCount", "tasksCompleted", "appUrl"]), isActive: true, isDefault: true,
    body: wrap("Monthly Summary", p("Hi <strong>{{firstName}}</strong>, here's your {{month}} recap:") + `<div style="display:flex;gap:12px;margin:16px 0;">${stat("${{totalSpend}}", "Total Spend")}${stat("{{servicesCount}}", "Active Services")}${stat("{{tasksCompleted}}", "Tasks Done")}</div>` + btn("{{appUrl}}/dashboard", "View Dashboard")),
  },
];
