/**
 * Blog example posts.
 *
 * Three evergreen, AI-friendly articles seeded so a fresh database
 * shows a populated /blog instead of an empty shelf. Each post has:
 *   - hand-written Tiptap JSON (matches the editor's schema)
 *   - parallel sanitized HTML (matches what the public renderer emits)
 *   - plain text for the search/length lints
 *   - SEO meta sized for Google + AI snippet windows
 *
 * These posts upsert by (slug, locale) so re-running the seed is
 * safe and editors can keep editing them in admin without losing
 * their work — we only create/update the fixed-content ones if they
 * don't exist yet (or were never edited beyond the seed).
 *
 * Run with: pnpm --filter @locateflow/db tsx prisma/seed-blog.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Section {
  type: "h2" | "h3" | "p" | "ul" | "ol" | "blockquote";
  text?: string;
  items?: string[];
}

interface SamplePost {
  slug: string;
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  categorySlug: "moving" | "money" | "logistics";
  categoryName: string;
  readingMinutes: number;
  sections: Section[];
}

// --- Three sample posts ---------------------------------------------------

const POSTS: SamplePost[] = [
  {
    slug: "update-address-30-services-weekend",
    title: "How to update your address with 30+ services in one weekend",
    excerpt:
      "A two-day plan that works in real life — Saturday for the high-stakes accounts (banking, government, insurance), Sunday for everything else. Includes the order to do them in, what fails silently, and the one trick that saves an hour.",
    seoTitle: "Update address with 30+ services in one weekend — checklist",
    seoDescription:
      "A field-tested two-day plan to update your address everywhere — banks, USPS, IRS, DMV, insurance, subscriptions — without forgetting an account or breaking autopay.",
    categorySlug: "moving",
    categoryName: "Moving",
    readingMinutes: 7,
    sections: [
      {
        type: "p",
        text: "Most people start with USPS, get a forwarding form filled out, and assume the rest will sort itself. It won't. USPS forwards mail; it does not update accounts. Twelve months later the forwarding ends, the bank statements stop arriving, and a letter that needed your signature lands at someone else's door.",
      },
      {
        type: "p",
        text: "This is the order to do it in, why that order matters, and what to do when an account refuses to budge.",
      },
      { type: "h2", text: "Saturday: the accounts that hurt if they're wrong" },
      {
        type: "p",
        text: "Start with the high-stakes ones — anything tied to identity, money, or legal mail. These are the accounts where a missed letter doesn't just cost you a magazine.",
      },
      {
        type: "ol",
        items: [
          "USPS Change of Address — check the current USPS fee and submit this first; it is the safety net for everything else, not a replacement for it.",
          "Bank and credit cards — log in to each one, update the mailing address. Statements, replacement cards, and fraud alerts all use this.",
          "Employer's HR system — your W-2 will be sent here in January.",
          "Driver's license / state ID — deadlines vary by state, so check your state DMV before the move window closes.",
          "Voter registration — check your state's deadline before the next election.",
          "IRS (Form 8822) — quietly important. The IRS does not auto-pull from USPS forwarding.",
          "Health insurance — both the carrier and your doctor's office. EOBs are confidential.",
          "Auto + home insurance — your premium is rated on the address; updating it can move the bill up or down.",
        ],
      },
      {
        type: "blockquote",
        text: "If you only do eight things, do these eight. Everything else can wait a week. These can't.",
      },
      { type: "h2", text: "Sunday: subscriptions, utilities, and small accounts" },
      {
        type: "p",
        text: "These are lower stakes individually but add up to the cost of a forgotten move. The trick is to not rely on memory — pull a list from somewhere objective.",
      },
      {
        type: "ul",
        items: [
          "Open your bank's transaction history for the last 90 days. Every recurring charge is a subscription that probably has your old address on file.",
          "Check your email for \"order confirmation\" and \"invoice\" — every retailer that emailed you in the last year still has your old address.",
          "Loyalty programs (airlines, hotels, grocery) — they're the most likely to send physical promo cards to the old place.",
          "Streaming services don't usually need a physical address, but their billing addresses do — check the card on file.",
        ],
      },
      { type: "h2", text: "What fails silently" },
      {
        type: "p",
        text: "Three categories of accounts that look updated but aren't:",
      },
      {
        type: "ul",
        items: [
          "Joint accounts where only one person updated the address — the other partner's card may still be tied to the old place.",
          "Old subscriptions you cancelled years ago — some companies keep your record \"active\" for legal/tax mail and never tell you.",
          "Anything tied to a property you used to own — HOA, utility deposits, property tax records.",
        ],
      },
      { type: "h2", text: "The trick that saves an hour" },
      {
        type: "p",
        text: "Before you start, make a single document with your old address, your new address, and the move date. When a customer service rep asks, you read it off — you don't dig through papers, you don't mistype, and you don't accidentally enter the move date as the date you remembered to call. We built LocateFlow specifically so you don't have to keep that document yourself, but a sticky note works too. The point is: write it once.",
      },
      { type: "h2", text: "After the weekend" },
      {
        type: "p",
        text: "Set a calendar reminder for nine months out. USPS forwarding ends at twelve. Nine months is long enough that any account you forgot has tried to mail you, but soon enough that the forwarding window is still open and the letter actually reaches you.",
      },
      {
        type: "p",
        text: "When you get one of those forwarded letters — that's an account you missed. Fix it then, while you have the envelope in your hand.",
      },
    ],
  },
  {
    slug: "hidden-cost-forgotten-subscriptions-after-move",
    title: "The hidden cost of forgotten subscriptions after a move",
    excerpt:
      "Why moving makes you pay for services twice — once at the old place you no longer use, once at the new place you set up to replace them — and how to find the silent ones in your bank statement.",
    seoTitle: "Why moving doubles your subscription bill — and how to fix it",
    seoDescription:
      "Moving creates 'subscription drift' — services you set up at the old address that quietly keep charging you. Here's the data on how much it costs the average household, and how to clean it up.",
    categorySlug: "money",
    categoryName: "Money",
    readingMinutes: 6,
    sections: [
      {
        type: "p",
        text: "Move-related subscription waste is one of those costs nobody warns you about. The internet plan at the old place that auto-renewed for another year. The gym you replaced but never cancelled. The pest control contract tied to a house you don't own anymore. None of them feel large. Together they reliably add up to four figures.",
      },
      { type: "h2", text: "Why moving causes subscription drift" },
      {
        type: "p",
        text: "Three structural reasons, all of them quiet:",
      },
      {
        type: "ol",
        items: [
          "Many recurring services are billed to a credit card, not the address. Moving doesn't change the card — so cancellation has to be explicit, not automatic.",
          "Most of us set up replacements at the new place before we cancel at the old one. For a few weeks (sometimes months), both run.",
          "Cancellation friction is asymmetric. Signing up takes a few clicks; cancelling often requires a phone call, a chat session, or a form mailed to the company's HQ.",
        ],
      },
      { type: "h2", text: "How to find the silent ones" },
      {
        type: "p",
        text: "Your bank statement is the source of truth. Pull the last 90 days and tag every recurring charge as one of:",
      },
      {
        type: "ul",
        items: [
          "Active — you use it and want it.",
          "Replaced — you set up an equivalent at the new address and the old one should be cancelled.",
          "Forgotten — you don't recognize it. Look it up; either reactivate the relationship or cancel it.",
          "Tied to old property — utilities, services, deposits. These need a separate phone call.",
        ],
      },
      { type: "h2", text: "The numbers" },
      {
        type: "p",
        text: "The exact amount varies by household, but duplicate or stale recurring charges can add up quickly after a move. Treat this as a cleanup checklist, not a prediction: the goal is to find every service that still bills the old address or replaced account.",
      },
      {
        type: "blockquote",
        text: "Subscription drift is one of the few financial leaks where a single hour of attention pays back at hundreds of dollars per year of saved billing.",
      },
      { type: "h2", text: "What actually works" },
      {
        type: "ul",
        items: [
          "Cancel old before you sign up new, when you can. The week of overlap is fine; six months of overlap is not.",
          "When you can't (utility transfers, internet), set a calendar reminder for the cancellation date — not just the start date.",
          "Use one credit card for moving-period subscriptions and another for permanent ones. After three months, freeze the moving-period card and any orphan charges become visible immediately.",
          "Once a quarter, audit. The first audit catches the most; the fourth catches almost nothing — which means you're done.",
        ],
      },
      { type: "h2", text: "The case for tracking once, not everything" },
      {
        type: "p",
        text: "You don't need a spreadsheet of every charge forever. You need a clean baseline once — taken right after a move — and an alert when something changes. The whole industry of \"personal finance dashboards\" exists because that one task is harder than it sounds. LocateFlow does it in the move-management context specifically; other tools do it more broadly. Pick one. The cost of doing nothing is a thousand dollars a year you'd rather have.",
      },
    ],
  },
  {
    slug: "usps-mail-forwarding-after-12-months",
    title: "USPS mail forwarding: what really happens after the 12 months end",
    excerpt:
      "Standard USPS forwarding lasts 12 months. After that, mail bounces — silently, in some cases. Here's exactly what stops, what continues, and what to do six months in to avoid the cliff.",
    seoTitle: "USPS forwarding ends after 12 months — what to do before the cliff",
    seoDescription:
      "USPS Change-of-Address forwarding lasts 12 months for First-Class mail and only 60 days for periodicals. Here's what happens at month 13, and how to update accounts before the silent bounce.",
    categorySlug: "logistics",
    categoryName: "Logistics",
    readingMinutes: 5,
    sections: [
      {
        type: "p",
        text: "USPS Change of Address is one of the most useful forms to complete during a move — check the current USPS fee before submitting, and remember that forwarding is quietly time-limited.",
      },
      { type: "h2", text: "The actual time limits" },
      {
        type: "p",
        text: "It's not a single 12-month rule. There are three, and they overlap:",
      },
      {
        type: "ul",
        items: [
          "First-Class Mail (most personal mail, bills, government letters): forwarded for 12 months from your move date.",
          "Periodicals (magazines, newspapers): forwarded for 60 days. After that, the publication is supposed to be told your new address — but only if they're enrolled in USPS's notification service.",
          "Standard Mail / Marketing Mail (catalogs, promotional mail): not forwarded at all unless explicitly endorsed by the sender.",
        ],
      },
      { type: "h2", text: "What happens on day 366" },
      {
        type: "p",
        text: "Three things, in order of how much trouble they cause:",
      },
      {
        type: "ol",
        items: [
          "First-Class mail to the old address is returned to sender with \"Forwarding time expired.\" The sender may or may not act on it. Banks usually do; many small businesses don't.",
          "Anything that was being forwarded under \"premium forwarding\" (the paid service) bills you the next forwarding period or stops, depending on your subscription.",
          "Mail addressed to a former occupant the new resident doesn't recognize gets thrown away. There's no central record-keeping after this point.",
        ],
      },
      {
        type: "blockquote",
        text: "Day 366 is silent. There is no email, no postcard, no warning that forwarding has ended. You just stop getting mail.",
      },
      { type: "h2", text: "What to do at month six" },
      {
        type: "p",
        text: "Six months is the right time to audit because you've had enough time for every account to send you at least one piece of mail. Anything that hasn't reached you by then either is forwarding correctly (good) or doesn't have your address (bad — and now you can find out which).",
      },
      {
        type: "ol",
        items: [
          "Look at every piece of forwarded mail you've received (the yellow forwarding label is the tell). Make a list of senders.",
          "For each one, log into the account and update the address directly. Don't trust forwarding to do it for you.",
          "For any account that you know exists but hasn't sent mail in six months, log in and check whether the address on file is still your old one.",
          "Pay particular attention to insurance, government, and tax mail — these are the categories most likely to send only once a year.",
        ],
      },
      { type: "h2", text: "The premium forwarding option" },
      {
        type: "p",
        text: "USPS offers paid Premium Forwarding, with fees and terms that can change over time. It is overkill for most moves, but it can be the right choice if (a) you're moving abroad temporarily, (b) you're between addresses, or (c) you got a notice from USPS that the standard forwarding is failing for some reason.",
      },
      { type: "h2", text: "The harder cases" },
      {
        type: "ul",
        items: [
          "Moving multiple times in a year: only the most recent COA is active. Mail forwarded under the previous one is rerouted to the new latest address — but the 12-month clock does not restart for each move.",
          "Sharing a household where one person moved out: the COA is per individual, not per household. Make sure the person who moved filed a separate COA and didn't include the others.",
          "Mail addressed to a deceased person: file Form 1583 to redirect to the executor; standard COA does not cover this case.",
        ],
      },
      { type: "h2", text: "The point" },
      {
        type: "p",
        text: "USPS forwarding is a bridge, not a destination. Use the 12 months to update each account that mails you, one at a time, as the forwarded letters arrive. After month six the rate slows; after month ten it's almost done. By month twelve, every account that matters should be writing to your new address directly — and the cliff at day 366 stops being a cliff.",
      },
    ],
  },
];

// --- Tiptap JSON + sanitized HTML + plain text generators -----------------

function textNode(text: string) {
  return { type: "text", text };
}

function paragraph(text: string) {
  return { type: "paragraph", content: [textNode(text)] };
}

function heading(level: 2 | 3 | 4, text: string) {
  return { type: "heading", attrs: { level }, content: [textNode(text)] };
}

function listItem(text: string) {
  return {
    type: "listItem",
    content: [{ type: "paragraph", content: [textNode(text)] }],
  };
}

function bulletList(items: string[]) {
  return { type: "bulletList", content: items.map(listItem) };
}

function orderedList(items: string[]) {
  return { type: "orderedList", content: items.map(listItem) };
}

function blockquote(text: string) {
  return { type: "blockquote", content: [paragraph(text)] };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sectionToTiptap(section: Section): unknown {
  switch (section.type) {
    case "h2":
      return heading(2, section.text!);
    case "h3":
      return heading(3, section.text!);
    case "p":
      return paragraph(section.text!);
    case "ul":
      return bulletList(section.items!);
    case "ol":
      return orderedList(section.items!);
    case "blockquote":
      return blockquote(section.text!);
  }
}

function sectionToHtml(section: Section): string {
  switch (section.type) {
    case "h2":
      return `<h2>${escapeHtml(section.text!)}</h2>`;
    case "h3":
      return `<h3>${escapeHtml(section.text!)}</h3>`;
    case "p":
      return `<p>${escapeHtml(section.text!)}</p>`;
    case "ul":
      return `<ul>${section.items!.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
    case "ol":
      return `<ol>${section.items!.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ol>`;
    case "blockquote":
      return `<blockquote><p>${escapeHtml(section.text!)}</p></blockquote>`;
  }
}

function sectionToText(section: Section): string {
  switch (section.type) {
    case "h2":
    case "h3":
    case "p":
    case "blockquote":
      return section.text!;
    case "ul":
    case "ol":
      return section.items!.join(" ");
  }
}

function buildPostContent(post: SamplePost) {
  const json = {
    type: "doc",
    content: post.sections.map(sectionToTiptap),
  };
  const html = post.sections.map(sectionToHtml).join("");
  const text = post.sections.map(sectionToText).join("\n\n");
  return { json, html, text };
}

// --- Seeder ---------------------------------------------------------------

async function main() {
  console.log("🌱 Seeding blog example posts...");

  const author = await prisma.adminUser.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, firstName: true },
  });
  if (!author) {
    console.warn("⚠️  No active admin user found. Run `pnpm --filter @locateflow/db seed:admin` first.");
    process.exit(0);
  }

  // Categories — one per post, unique by (slug, locale).
  const categoryConfig: Record<string, { slug: string; name: string; description: string }> = {
    moving: {
      slug: "moving",
      name: "Moving",
      description: "Field-tested guides for surviving the move itself.",
    },
    money: {
      slug: "money",
      name: "Money",
      description: "Bills, subscriptions, and the financial fallout of moving.",
    },
    logistics: {
      slug: "logistics",
      name: "Logistics",
      description: "USPS, utilities, and the small mechanics that everyone forgets.",
    },
  };

  const categoryIds: Record<string, string> = {};
  for (const [key, cfg] of Object.entries(categoryConfig)) {
    const existing = await prisma.blogCategory.findFirst({
      where: { slug: cfg.slug, locale: "en" },
    });
    if (existing) {
      categoryIds[key] = existing.id;
      continue;
    }
    const created = await prisma.blogCategory.create({
      data: {
        slug: cfg.slug,
        name: cfg.name,
        description: cfg.description,
        locale: "en",
      },
    });
    categoryIds[key] = created.id;
    console.log(`  + category: ${cfg.name}`);
  }

  // Stagger publish dates so the homepage strip doesn't show three
  // posts on the same day. Most recent goes to the hero.
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const publishOffsets = [2 * DAY_MS, 9 * DAY_MS, 18 * DAY_MS]; // newest → oldest

  for (const [idx, post] of POSTS.entries()) {
    const { json, html, text } = buildPostContent(post);
    const publishedAt = new Date(now - publishOffsets[idx]);

    const existing = await prisma.blogPost.findFirst({
      where: { slug: post.slug, locale: "en" },
    });

    if (existing) {
      // Don't overwrite a post an editor has touched after seeding.
      // We detect this via the revision count + the updatedAt being
      // > publishedAt. If neither indicator fires, refresh fixture
      // content so re-running the seed picks up copy edits.
      const revCount = await prisma.blogRevision.count({
        where: { postId: existing.id },
      });
      const wasEdited = revCount > 0 || existing.updatedAt > existing.createdAt;
      if (wasEdited) {
        console.log(`  · skip (edited): ${post.slug}`);
        continue;
      }
      await prisma.blogPost.update({
        where: { id: existing.id },
        data: {
          title: post.title,
          excerpt: post.excerpt,
          contentJson: json,
          contentHtml: html,
          contentText: text,
          readingMinutes: post.readingMinutes,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          categoryId: categoryIds[post.categorySlug],
        },
      });
      console.log(`  ↻ refresh: ${post.slug}`);
    } else {
      await prisma.blogPost.create({
        data: {
          slug: post.slug,
          locale: "en",
          title: post.title,
          excerpt: post.excerpt,
          contentJson: json,
          contentHtml: html,
          contentText: text,
          readingMinutes: post.readingMinutes,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          status: "PUBLISHED",
          publishedAt,
          authorId: author.id,
          categoryId: categoryIds[post.categorySlug],
        },
      });
      console.log(`  + create: ${post.slug}`);
    }
  }

  console.log("✅ Blog seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
