/**
 * Blog example posts.
 *
 * A set of evergreen, AI-friendly articles seeded so a fresh database
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
  type: "h2" | "h3" | "p" | "ul" | "ol" | "blockquote" | "img";
  text?: string;
  items?: string[];
  /** For `img` sections: a site-relative path under /public, e.g. "/blog/foo.svg". */
  src?: string;
  /** For `img` sections: alt text, also rendered as a <figcaption>. */
  caption?: string;
}

type CategorySlug = "moving" | "money" | "logistics" | "government" | "tools";

interface SamplePost {
  slug: string;
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  categorySlug: CategorySlug;
  categoryName: string;
  readingMinutes: number;
  sections: Section[];
}

// --- Sample posts ---------------------------------------------------------

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
  {
    slug: "dmv-deadline-trap-license-after-move",
    title: "The DMV deadline trap: how few days you actually have to update your license",
    excerpt:
      "Most states give you between 10 and 60 days after moving to update your driver's license — and the clock starts the day you sleep at the new address, not the day you sign the lease. Miss it and your insurance, your registration, and in some states your voting may quietly turn invalid.",
    seoTitle: "How long to update your driver's license after moving — by state",
    seoDescription:
      "State-by-state deadlines for updating your driver's license after a move, what triggers the clock, and the silent consequences (insurance, registration, voting) of missing the window.",
    categorySlug: "government",
    categoryName: "Government",
    readingMinutes: 6,
    sections: [
      {
        type: "p",
        text: "If you've moved within the last month, there is a fair chance that your driver's license is currently expired in the eyes of your state — even though the photo on the front says it's valid until 2029.",
      },
      {
        type: "p",
        text: "States separate two ideas the public conflates: \"is this license still valid as ID\" (the expiration date), and \"does the address on this license match where you actually live\" (the residency requirement). The second one has its own deadline, its own consequences, and almost no public-facing reminders.",
      },
      { type: "h2", text: "What the clock looks like in practice" },
      {
        type: "p",
        text: "The deadline ranges from ten days to sixty depending on the state. The shortest windows belong to:",
      },
      {
        type: "ul",
        items: [
          "Pennsylvania — 15 days for the address change on file.",
          "California — 10 days, and the requirement also extends to vehicle registration.",
          "Florida — 30 days, but the same trip handles the registration so the deadlines move together.",
          "Texas — 30 days for the license, 30 for vehicle registration.",
          "New York — 10 days, and the DMV's online form handles it without a visit.",
        ],
      },
      {
        type: "p",
        text: "Other states (Illinois, Massachusetts, Washington) give you 30 days. A few outliers — notably Vermont — give you closer to 60. The exact day count is published on the state DMV's site, but it's almost never the first thing they show you.",
      },
      { type: "h2", text: "When the clock actually starts" },
      {
        type: "p",
        text: "This is the part that catches people. The clock does not start when you sign a lease, when you receive keys, or when the moving truck unloads. It starts when you become a resident — operationally, the day you start sleeping at the new address as your principal home.",
      },
      {
        type: "blockquote",
        text: "If you moved on the 1st but stayed at a hotel until the 5th, your residency began the 5th. Use that date when calculating the deadline; states will not split the difference.",
      },
      { type: "h2", text: "What goes wrong if you miss it" },
      {
        type: "p",
        text: "The license itself does not get pulled. You won't be stopped on the highway and disarmed. The consequences are quieter and three categories deep:",
      },
      {
        type: "ol",
        items: [
          "Insurance — auto policies require an accurate garaging address. A claim filed on a policy with the wrong state can be reduced or denied; a claim on the right state but wrong ZIP usually pays out but at the wrong rate.",
          "Vehicle registration — many states tie the registration renewal to the license address. Expired registration earns a fine and, in some states, a tow.",
          "Voting + jury duty — the voter roll mirrors the license. Move out of state without updating, and you're registered in a state you don't live in; move within state, and you may be summoned for jury duty in the wrong county.",
        ],
      },
      { type: "h2", text: "The thing nobody tells you about REAL ID" },
      {
        type: "p",
        text: "Updating your address with the DMV is not the same as keeping your REAL ID compliant. If you do the address change online, you usually get a sticker or a paper update — fine for traffic stops, not enough for airport security after the deadline. If you've moved more than once since your last full renewal, plan one in-person trip with the document set: passport, two proofs of address, social security card.",
      },
      { type: "h2", text: "The cleanest path" },
      {
        type: "p",
        text: "Within the first week of the new address, do three things in this order: (1) check your state's specific deadline, (2) bookmark the online address-change form if your state offers one, (3) update the license address before you update auto insurance. The order matters — insurance carriers will sometimes ask to see the new license, and being able to upload it ten minutes after issuance saves a phone call.",
      },
    ],
  },
  {
    slug: "utility-setup-calling-order-new-home",
    title: "Setting up utilities at a new home — the calling order that saves your weekend",
    excerpt:
      "Internet has the longest lead time. Power has the strictest deposit rules. Water is usually owned by the city and forgotten. Here's the order to call providers in, and why doing them out of order costs you a Saturday.",
    seoTitle: "What order to set up utilities when moving — internet, power, water",
    seoDescription:
      "A pragmatic order for setting up utilities at a new home: internet first because of lead time, power second because of deposits, water third because it's often city-managed. Plus the four extras most movers forget.",
    categorySlug: "moving",
    categoryName: "Moving",
    readingMinutes: 5,
    sections: [
      {
        type: "p",
        text: "The first weekend in a new home goes one of two ways. Either every utility is on, the internet works, the showers are hot, and you spend the day unpacking — or you discover at 6pm that the previous tenant cancelled the water two days ago and there's no shower until Monday.",
      },
      {
        type: "p",
        text: "The difference is usually not effort. It's order. Utility providers have wildly different lead times, and calling them in the wrong sequence creates a queue of dependencies that all expire at the worst moment.",
      },
      { type: "h2", text: "The order, with reasons" },
      {
        type: "ol",
        items: [
          "Internet — call 2–3 weeks before move-in. Cable and fiber providers often need to physically pull a line into the unit; a same-week appointment is rare and the rare slots get filled by people who called earlier.",
          "Electricity — call 1 week before move-in. Most utilities can transfer service to your name in a single phone call, but some require a deposit or proof of identity that takes 48–72 hours to clear.",
          "Gas — call 1 week before, simultaneously with electricity. The pilot light usually has to be lit in person, which means a window appointment.",
          "Water — call 2–3 days before move-in, often through the city utility office rather than a private provider. Many cities require you to pick up service in person at city hall the first time.",
          "Trash + recycling — call after move-in, once you know the bin schedule for your block. Some cities include this in property tax; in others, it's a separate vendor with a 30-day lag.",
        ],
      },
      { type: "h2", text: "The four extras most movers forget" },
      {
        type: "ul",
        items: [
          "HOA — if you're in a building or planned community, the HOA may need to register your name for parking, gym, mailroom, and pool access. None of this is automatic from the lease.",
          "Pest control — many landlords have a contract you inherit; some don't. Check before the first roach or you'll pay for an emergency visit.",
          "Lawn / snow — the rule changes by lease. Lawn service is sometimes included; snow removal almost never is.",
          "Mail-tied subscriptions (food delivery, pharmacy auto-refill) — these aren't utilities but they share the same dependency: they need your address by move-in or they fail silently.",
        ],
      },
      { type: "h2", text: "What \"deposit\" actually means" },
      {
        type: "p",
        text: "When a utility asks for a deposit, they're not pricing risk on you specifically — they're pricing risk on the address. A history of late payments at the unit, even by previous tenants, can mean a higher deposit. Ask if the utility offers a \"letter of credit waiver\" — providing a clean payment record from your previous utility provider often skips the deposit entirely.",
      },
      { type: "h2", text: "Saturday morning rule" },
      {
        type: "p",
        text: "If you're moving in on a Saturday, every call above should already be made. Saturdays are when utility offices are closed, when same-day technician slots are unavailable, and when the deposit you didn't pay can't be paid. Friday afternoon by 4pm is the last responsible window. After that, you're betting on luck.",
      },
    ],
  },
  {
    slug: "auto-insurance-after-move-zip-code-rate",
    title: "Why your auto insurance might triple after a move (and what to do about it)",
    excerpt:
      "Auto insurance premiums are quoted by ZIP code, not by you. A two-mile move can swing your monthly rate 40% in either direction. Here's what determines the swing, and how to know which way it'll go before you sign the lease.",
    seoTitle: "Auto insurance after moving — why ZIP code changes your rate",
    seoDescription:
      "Auto insurance is rated by ZIP code, not driver. Moving two miles can swing your premium 40% — sometimes up, sometimes down. Here's how to predict the change and what to ask your carrier before the move.",
    categorySlug: "money",
    categoryName: "Money",
    readingMinutes: 6,
    sections: [
      {
        type: "p",
        text: "Most people learn about ZIP-code-based insurance pricing the wrong way: they update their address with the carrier, and the next month's bill comes in $90 higher than the last one. There's no negotiation; it's not a punishment. The carrier is doing exactly what they did before — pricing the territory rather than the driver.",
      },
      { type: "h2", text: "What the carrier actually weighs" },
      {
        type: "p",
        text: "When you change address, the carrier reruns four signals against your existing policy:",
      },
      {
        type: "ul",
        items: [
          "Garaging risk — what's the theft and vandalism rate of cars in this ZIP? Major cities have well-known hotspots.",
          "Collision frequency — how often do parked or moving vehicles get hit per registered vehicle in this ZIP? Dense urban areas are higher.",
          "Uninsured-motorist density — what fraction of drivers in this state carry no insurance? You pay a small share of their accidents through your premium.",
          "Weather — flood, hail, falling-tree exposure. ZIP-level granularity lets carriers price one suburb differently from the next.",
        ],
      },
      {
        type: "p",
        text: "Your driving record stays the same; the territory underneath you doesn't. The new premium is the old one with these factors swapped in.",
      },
      { type: "h2", text: "How to predict the swing" },
      {
        type: "p",
        text: "Before you sign a lease, run a quote on the new ZIP with your existing policy details. Most carriers let you do this without committing to anything. Compare:",
      },
      {
        type: "ol",
        items: [
          "Old ZIP, current vehicles, current coverage — your baseline.",
          "New ZIP, same everything else — your projected baseline.",
          "New ZIP with one coverage tweak (raising your deductible $250) — your contingency.",
        ],
      },
      {
        type: "p",
        text: "If the difference between (1) and (2) is more than $30/month, it's worth a five-minute call to the carrier to ask about discount programs that may apply at the new address (parking off-street vs on-street; using public transit for the commute; multi-policy bundling that wasn't worth it before).",
      },
      { type: "h2", text: "The mistake to avoid" },
      {
        type: "blockquote",
        text: "Don't just \"forget\" to update the address. The premium is rated against the registered address; if there's a claim, the carrier can adjust the payout retroactively to what you would have paid at the actual address.",
      },
      {
        type: "p",
        text: "This is one of the most common ways insurance claims get reduced. The carrier is required to pay; what they pay is governed by the policy, and the policy's premium is governed by the address. If those two diverge, the math at claim time gets ugly.",
      },
      { type: "h2", text: "When the move makes the rate go down" },
      {
        type: "p",
        text: "Rural and suburban moves usually drop the premium 10–25%. Moves toward smaller cities, away from coastal flood zones, or out of high-theft ZIPs can drop it more. If you're moving in this direction, update the address the same day you take possession — the savings start the moment the policy is repriced. Don't leave money on the table out of inertia.",
      },
      { type: "h2", text: "The shopping window" },
      {
        type: "p",
        text: "The 30 days after a move is the right time to shop. Loyalty rewards have already been mostly priced into your old quote; competitors will pull a fresh quote against the new ZIP with no anchoring. Get three quotes, compare on the same coverage levels, and make the call. The savings on the old address are gone either way; the savings on the new one are decided in the next month.",
      },
    ],
  },
  {
    slug: "60-day-magazine-mail-forwarding-gap",
    title: "The 60-day mail forwarding gap nobody warns you about",
    excerpt:
      "Standard USPS forwarding gives First-Class mail twelve months. Magazines and newspapers get sixty days. By month three at the new address, your subscriptions stop arriving, and the publisher never tells you why.",
    seoTitle: "Why magazines and newspapers stop arriving 60 days after a move",
    seoDescription:
      "USPS forwards First-Class mail for 12 months but Periodicals (magazines, newspapers) only for 60 days. Here's why your subscriptions silently stop, and the one form to file with each publisher to keep them coming.",
    categorySlug: "logistics",
    categoryName: "Logistics",
    readingMinutes: 4,
    sections: [
      {
        type: "p",
        text: "Two months after a move, something quietly stops working. The bills still arrive forwarded. The bank statements still come through. But The Atlantic stopped showing up, your local paper hasn't been on the porch in weeks, and the trade magazine you've subscribed to for six years just disappeared from your mailbox.",
      },
      {
        type: "p",
        text: "This isn't a delivery error. It's a deliberate USPS policy that almost nobody knows about until it bites them.",
      },
      { type: "h2", text: "Two clocks, not one" },
      {
        type: "p",
        text: "USPS Change of Address has two separate forwarding windows depending on the mail class:",
      },
      {
        type: "ul",
        items: [
          "First-Class Mail (bills, letters, statements, government mail): forwarded for 12 months from your move date.",
          "Periodicals (anything mailed at the periodicals rate — magazines, newspapers, newsletters): forwarded for 60 days.",
        ],
      },
      {
        type: "p",
        text: "On day 61, periodicals to your old address are returned to the publisher, not forwarded. The publisher is technically supposed to update your address; in practice, many simply mark the issue as undeliverable and move on without telling you.",
      },
      { type: "h2", text: "Why the policy exists" },
      {
        type: "p",
        text: "Periodicals get a deeply discounted postage rate in exchange for the publisher being responsible for keeping the mailing list current. The 60-day forwarding is a bridge, not a permanent service — USPS expects publishers to receive the change-of-address notification and update their list within that window. Most automated lists do; many older subscriber lists don't.",
      },
      { type: "h2", text: "What to actually do" },
      {
        type: "ol",
        items: [
          "Make a list of every magazine, newspaper, or newsletter that arrives at your old address. Look at the last two months of mail before the move; physical periodicals are easy to remember in batch.",
          "For each one, log into the publisher's account directly and update the address. Don't assume USPS has done it.",
          "If the publication doesn't have an online account (small newsletters, hobby publications), call the customer service number on the masthead and update by phone.",
          "Trade and professional journals tied to your employer often go to the office address by default. If you've also changed jobs, double-check.",
        ],
      },
      { type: "h2", text: "The forgotten case" },
      {
        type: "p",
        text: "Periodicals also include free local papers, alumni magazines, and shareholder communications from companies you own a small position in. Investor mail in particular is annoying to fix because the company outsources its mailing to a transfer agent — the address has to be updated through the brokerage, not the company. By the time you notice the proxy statement is missing, the vote has happened.",
      },
      { type: "h2", text: "The shortcut" },
      {
        type: "p",
        text: "Two weeks after the move, audit the mailbox at the new address. Anything that was a regular Periodical at the old place and hasn't shown up is suspect. Update the publisher directly, then mark a calendar reminder for two months later — that's when the 60-day forwarding ends and any remaining gaps go silent.",
      },
    ],
  },
  {
    slug: "voter-registration-after-a-move",
    title: "Voter registration after a move: the deadline you can't see coming",
    excerpt:
      "Most states close voter registration two to four weeks before any election — including the one you weren't planning to vote in. Move three weeks before a runoff and you may discover you can't vote in either jurisdiction. Here's how to avoid the gap.",
    seoTitle: "Voter registration after moving — deadlines and the residency gap",
    seoDescription:
      "Voter registration deadlines close 14–30 days before each election, by state. Moving creates a gap where neither your old nor your new registration is valid. Here's the playbook to keep your vote.",
    categorySlug: "government",
    categoryName: "Government",
    readingMinutes: 5,
    sections: [
      {
        type: "p",
        text: "Of all the things that go wrong in a move, losing the right to vote in a specific election is the one with the cleanest fix and the worst PR. The fix is a 5-minute online form. The PR problem is that nobody tells you the form is needed, and you find out the day you show up at a polling place that isn't expecting you.",
      },
      { type: "h2", text: "How registration actually works" },
      {
        type: "p",
        text: "Voter registration is per-residence, not per-person. You're not \"registered to vote in America\" — you're registered to vote at a specific address, in a specific county, in a specific state. Move to a new address, and three things have to happen for your vote to count at the new place:",
      },
      {
        type: "ol",
        items: [
          "Your old registration must be cancelled (most states do this automatically when you register at the new address, but only if you do so within the same state).",
          "Your new registration must be filed before that state's deadline for the election in question.",
          "Your name must show up correctly on the new precinct's rolls — sometimes a 1–2 week processing lag after the form clears.",
        ],
      },
      { type: "h2", text: "The deadlines" },
      {
        type: "p",
        text: "By state, the closing window before each election ranges from same-day (most permissive — Colorado, Illinois on election day) to 30 days (most restrictive — most southern states). The most common is 14 days. Special elections, runoffs, and primaries usually use the same window as the general election but you have to confirm — a few states have shorter windows for primaries.",
      },
      {
        type: "blockquote",
        text: "The most common loss is moving 20 days before a runoff. Old state registration is cancelled or pending; new state's 30-day deadline has already passed. You can't vote in either.",
      },
      { type: "h2", text: "The interstate gap" },
      {
        type: "p",
        text: "Moving across state lines is harder than moving within a state. Most state registrations don't transfer; they cancel cleanly when the new state's process completes, but during the gap, you're not on either roll. If an election falls in that gap, your vote is gone for that cycle.",
      },
      { type: "h2", text: "What to do" },
      {
        type: "ol",
        items: [
          "Within 48 hours of moving, register at the new address. Most states accept the online form and email confirmation within hours.",
          "Pull the new precinct's polling place from the state's lookup tool. It's not always the closest physical building.",
          "If you've registered close to a deadline, follow up by checking your status on the state's voter portal a week later. Don't assume submitted = registered.",
          "If there's an election within 60 days of the move, file the new registration the same day you move, not at the end of the week.",
        ],
      },
      { type: "h2", text: "Absentee, provisional, and the safety net" },
      {
        type: "p",
        text: "If the gap is unavoidable — if you moved too close to an election to register at the new place — you sometimes have a fallback. In some states, you can request an absentee ballot at your old address as long as your prior registration was valid for that election (read each state's rule; this is not universal). At the new place, you can usually cast a provisional ballot, which gets counted if registration completes in time. Both are imperfect; both are better than not voting at all.",
      },
      {
        type: "p",
        text: "The cleanest answer is the boring one: register the day you move. Five minutes online. The deadline you can't see coming becomes a deadline you cleared a month early.",
      },
    ],
  },
  {
    slug: "pet-move-vet-records-microchip-tag",
    title: "The pet move: vet records, microchip updates, and the tag that gets your dog home",
    excerpt:
      "Three pet records change at every move and exactly zero of them update automatically. The microchip registry, the vet's address on file, and the metal tag on the collar — all need 30 minutes of work and they're the difference between a found pet and a lost one.",
    seoTitle: "Pet records to update when moving — microchip, vet, and ID tag",
    seoDescription:
      "Three pet records change with every move and none of them update automatically: the microchip registry, the vet's records, and the physical ID tag. Here's the 30-minute checklist that makes a found pet possible.",
    categorySlug: "moving",
    categoryName: "Moving",
    readingMinutes: 4,
    sections: [
      {
        type: "p",
        text: "The most common cause of a permanently lost pet after a move isn't the pet getting out — it's the recovery infrastructure being attached to the wrong address. A neighbor finds the dog, takes it to a shelter, the shelter scans the chip, and the registry rings a phone number that doesn't work and an address that's eight states away.",
      },
      {
        type: "p",
        text: "Three records do this. None of them update automatically.",
      },
      { type: "h2", text: "The microchip registry" },
      {
        type: "p",
        text: "Most pets are chipped, but the chip is just a serial number. The number resolves to a record in a registry — there are several (HomeAgain, AKC Reunite, 24PetWatch among the largest in the US). The registry is what holds your phone, email, and address. Moving doesn't update any of this.",
      },
      {
        type: "ol",
        items: [
          "Find the registry your chip is in. The vet who placed the chip will know; failing that, AAHA's universal lookup tool (petmicrochiplookup.org) will tell you.",
          "Log in or create an account using the chip number and your email.",
          "Update the address, primary phone, and secondary contact (often a parent or partner). Verify the email is one you actively check.",
          "Test the lookup by entering the chip number on the registry's public lookup page; your contact info should appear correctly.",
        ],
      },
      { type: "h2", text: "The vet's records" },
      {
        type: "p",
        text: "Even if you're keeping the same vet, their records show your old address. More commonly, you're switching vets entirely. Two parallel actions:",
      },
      {
        type: "ul",
        items: [
          "At the old vet, request a transfer of records. Most clinics will email a PDF directly to the new vet within 1–2 business days.",
          "At the new vet, schedule a meet-and-greet visit even if no shots are due. The visit gets the pet a chart, gets you on the call list, and lets the new vet flag anything unusual the old chart didn't capture.",
        ],
      },
      {
        type: "p",
        text: "If the move crossed state lines, the rabies certificate may need to be re-issued in the new state's format, even if the vaccine itself is current. The new vet will know if it does.",
      },
      { type: "h2", text: "The physical ID tag" },
      {
        type: "p",
        text: "The metal tag on the collar is the single most effective recovery tool, more so than the microchip. Most found pets are returned by the neighbor who reads the tag, not by the shelter. A current tag costs about $10 and arrives in a week.",
      },
      {
        type: "blockquote",
        text: "Tag should have: pet's name, your phone number, and the city. Address is optional and many people skip it for privacy. The phone is what matters.",
      },
      { type: "h2", text: "The cross-border move" },
      {
        type: "p",
        text: "If you're moving internationally — even to Canada or Mexico — the documentation requirements get more involved. Health certificates, parasite treatments, and breed-specific paperwork have country-specific rules and dated windows (most countries want a vet exam within 7–10 days of entry). Start the process at least a month out; some countries need 90+ days for the rabies titer test.",
      },
      { type: "h2", text: "The thirty-minute checklist" },
      {
        type: "p",
        text: "Within the first weekend at the new address: update the registry online (5 minutes), order new tags (5 minutes), email the old vet to transfer records (10 minutes), schedule the meet-and-greet at the new vet (10 minutes). Done. The next time the pet gets out, the recovery path actually works.",
      },
    ],
  },
  {
    slug: "winter-move-saves-30-percent",
    title: "Why moving in winter saves you 30% (and what it costs you in stress)",
    excerpt:
      "Movers' rates drop 25–40% between November and February — same trucks, same crews, just less demand. The trade-off is real but specific: weather risk, shorter daylight, and a narrow window when school-aged families can't move at all. Here's the math.",
    seoTitle: "Off-season moving — when to move for the cheapest rate",
    seoDescription:
      "Moving company rates drop 25–40% between November and February. Here's the demand math behind the discount, the risks (weather, daylight, holidays) that come with it, and the four weeks each year when the savings vanish.",
    categorySlug: "money",
    categoryName: "Money",
    readingMinutes: 5,
    sections: [
      {
        type: "p",
        text: "The moving industry is one of the most demand-skewed in the consumer economy. Roughly half of all US household moves happen between Memorial Day and Labor Day, a 14-week window where prices climb and crews are booked solid. The other half spread across the remaining 38 weeks, with rates falling sharply once school starts and falling further once the holidays close out.",
      },
      { type: "h2", text: "What the discount actually looks like" },
      {
        type: "p",
        text: "Quotes from the same company on the same route can swing meaningfully across the calendar. A typical pattern looks like:",
      },
      {
        type: "ul",
        items: [
          "Late June through early August: peak. Premium rates, weekend booking only available 4–6 weeks out.",
          "September: shoulder. Rates drop 10–15% as families finish back-to-school moves.",
          "Late October through mid-November: discount window. 20–25% off peak, weekend availability the same week.",
          "Late November through mid-February: deepest discount. 25–40% off peak; weekday availability often next-day.",
          "March through April: shoulder again. Rates climb back as spring leases turn over.",
        ],
      },
      { type: "h2", text: "What the discount costs you" },
      {
        type: "p",
        text: "Three real trade-offs. Two are manageable, one is a hard constraint.",
      },
      {
        type: "ol",
        items: [
          "Weather risk. Snow, ice, freezing rain. Movers will work in most weather but it's slower, the truck has to be parked further from the door, and the floors of both homes get wet. Pad for it: schedule a 1.5x time buffer.",
          "Daylight. Northern states lose useful daylight by 5pm in December. A move that starts at 9am on a long June day can stretch into evening; the same move in December has to be finished or floodlit by 4pm.",
          "Holidays. The four weeks between Thanksgiving and New Year's combine peak personal stress with shortened business hours at every utility, every government office, and every school. The discount is real but the move is on hard mode.",
        ],
      },
      { type: "h2", text: "The window that vanishes the savings" },
      {
        type: "p",
        text: "If you have school-aged kids, the practical winter moving window is two weeks: late December (between fall and spring semester) and early January (before classes restart). Outside that, you're either pulling kids out mid-semester or paying the peak summer rate. The off-season discount mostly accrues to households without that constraint — empty-nesters, students moving between semesters, and remote workers.",
      },
      { type: "h2", text: "Booking the discount" },
      {
        type: "p",
        text: "Off-season demand is so much lower that the same companies that turn down summer inquiries will compete actively in February. Three quotes, same route, same date — the spread between them is often $300–$500 in the off-season versus $50–$100 in the summer. Take the time to compare; it pays back at $100/hour for the call.",
      },
      {
        type: "blockquote",
        text: "Best price isn't always the right pick in the off-season. A flat rate looks cheap until the snow doubles the labor hours; a per-hour rate with a competent crew often comes out lower than a flat rate from a budget shop.",
      },
      { type: "h2", text: "When to ignore all of this" },
      {
        type: "p",
        text: "Some moves can't wait. Job starts, lease ends, family emergencies — peak season pricing is the cost of moving on someone else's schedule. The discount is real but only available to people whose schedule is genuinely flexible. If yours isn't, don't read another sentence about saving money in February; book the date you actually need and move.",
      },
    ],
  },
  {
    slug: "organize-moving-documents-find-in-30-seconds",
    title: "How to organize moving documents so you can find them in 30 seconds, two years later",
    excerpt:
      "Two years after a move, you'll need exactly four documents: the closing statement, the lease or deed, the utility transfer confirmations, and the change-of-address receipt. They're never together, and the original folder you kept is in the basement. Here's the file structure that survives.",
    seoTitle: "How to organize moving documents — a folder structure that works",
    seoDescription:
      "Most moving documents live in three different places. Two years later, you can't find any of them. Here's the digital folder structure (and naming convention) that keeps every document findable in 30 seconds.",
    categorySlug: "tools",
    categoryName: "Tools",
    readingMinutes: 5,
    sections: [
      {
        type: "p",
        text: "Two years from now, your accountant will ask for the closing statement. Three years from now, your insurance carrier will ask for proof of when you took possession. Five years from now, a tax dispute will ask for the date the utility account opened in your name. Each one will arrive at a different moment, with no warning, and the answer needs to be on screen within thirty seconds or you've lost the thread.",
      },
      {
        type: "p",
        text: "The folder structure that handles this is unromantic but durable.",
      },
      { type: "h2", text: "The structure" },
      {
        type: "p",
        text: "One top-level folder per address, named with the year you moved in:",
      },
      {
        type: "ul",
        items: [
          "2026-Newaddress-StreetName/",
          "  ├── 01-occupancy/  ← lease, deed, closing statement, walk-through photos",
          "  ├── 02-utilities/  ← service confirmations, deposit receipts, account numbers",
          "  ├── 03-government/ ← USPS COA, DMV update receipt, voter reg confirmation",
          "  ├── 04-financial/  ← bank/card address change confirmations, insurance updates",
          "  ├── 05-pets-medical/ ← vet records transfer, microchip update receipt, prescription transfers",
          "  └── 99-correspondence/ ← any letter from old address that arrived forwarded",
        ],
      },
      {
        type: "p",
        text: "Six subfolders. Numbered prefixes so they sort consistently. The numbering matters more than the names — it's what makes the folder usable five years later when the names have started to blur.",
      },
      { type: "h2", text: "The naming convention" },
      {
        type: "p",
        text: "Inside each subfolder, every file gets the same prefix structure: YYYY-MM-DD-source-document. So a lease from January 2026 becomes 2026-01-15-landlord-lease.pdf. A USPS receipt from January 8 is 2026-01-08-usps-coa.pdf.",
      },
      {
        type: "p",
        text: "Two reasons this works. First, files sort chronologically inside each folder, so the timeline of the move is visible at a glance. Second, the source name is a search anchor — five years later you don't remember the document's title, but you remember it came from USPS or the bank. Searching for \"usps\" or \"bank\" returns every document from that source across every move.",
      },
      { type: "h2", text: "What to scan and what to ignore" },
      {
        type: "ol",
        items: [
          "Scan: anything signed, any receipt over $100, any government correspondence, any insurance change confirmation, any account number printed on paper.",
          "Photograph: the meter readings on move-out day, the move-in walk-through, any pre-existing damage at the new place.",
          "Ignore: junk mail, marketing letters, USPS welcome packets, retailer change-of-address acknowledgments. These will outnumber the real documents 5-to-1; saving them dilutes the search.",
        ],
      },
      { type: "h2", text: "The cloud question" },
      {
        type: "p",
        text: "Pick one cloud service and put the address folder inside it. Dropbox, Google Drive, iCloud — all of them work; the choice doesn't matter as long as you commit. The folder needs to outlive your current laptop, your current phone, and probably your current cloud provider. The naming convention is what makes the move from one to the next survivable.",
      },
      {
        type: "blockquote",
        text: "The single most useful upgrade you can make to a personal document system is consistent date prefixes. Everything else comes out of that.",
      },
      { type: "h2", text: "What LocateFlow handles automatically" },
      {
        type: "p",
        text: "Several of these folders — utilities, financial, government — have account-level records that don't need to live in your file system at all if you've added them to LocateFlow. The address, account number, and last-update date are already structured fields; the receipts attach to those records and travel with them. The folder structure above is the right minimum even if you're using us; if you aren't, it's the structure to build by hand.",
      },
    ],
  },
  {
    slug: "move-file-before-the-move",
    title: "How to set up a 'move file' before the move so the chaos has a home",
    excerpt:
      "Three weeks before a move, the chaos starts: lease drafts, school enrollment forms, contractor quotes, insurance comparisons. Most people lose half of these by move day. The fix is a single document — set up before the chaos, not during it.",
    seoTitle: "How to set up a moving file before the chaos starts",
    seoDescription:
      "Three weeks before a move, set up a single 'move file' to capture every document, decision, and account number. This is what to put in it, when to start, and the one habit that keeps the file working.",
    categorySlug: "tools",
    categoryName: "Tools",
    readingMinutes: 4,
    sections: [
      {
        type: "p",
        text: "Three weeks out, the move is theoretical. Five days out, it's a controlled fire. The difference between a move that goes smoothly and a move that goes badly is rarely effort; it's whether the information needed at any given moment is in one place or twenty.",
      },
      {
        type: "p",
        text: "A move file solves this. It's not a checklist (those exist; they're useful for tasks). It's a single living document where everything decision-shaped or fact-shaped lives.",
      },
      { type: "h2", text: "What goes in the move file" },
      {
        type: "p",
        text: "Five sections, in this order:",
      },
      {
        type: "ol",
        items: [
          "Identity facts — old address, new address, move date, date of first night at new place. The thing every customer service rep asks first.",
          "Account numbers — bank, credit cards, utilities, insurance, with the customer service phone number for each. Filing each one as you find it beats hunting later.",
          "Decisions made — \"chose Mover Co for $4,200 flat\" or \"declined renter's insurance because covered under HO-3\". Anything where you might second-guess yourself in three days.",
          "Open questions — items still being researched, with the deadline by which they need to be resolved. \"Decide on internet provider by Oct 10\" makes the question visible until it's gone.",
          "Receipts and confirmations — every email confirmation number from a utility, every receipt from a deposit, every signed contract — pasted in or linked.",
        ],
      },
      { type: "h2", text: "When to start" },
      {
        type: "p",
        text: "Three weeks before the move is the right moment. By that point, the lease or sale is signed, the move date is real, and the chaos is starting to assemble. Earlier, and the file is mostly empty and you forget about it; later, and you spend the first day populating it from memory and miss things.",
      },
      { type: "h2", text: "The format" },
      {
        type: "p",
        text: "A single Google Doc, Notion page, or text file beats a fancy app. The format is the lowest-friction one your phone can edit at a customer service counter. Apps with login flows and category trees lose to a one-page document with five headers — every time.",
      },
      {
        type: "blockquote",
        text: "The move file is read three times more often than it's written to. Optimize it for skim, not for entry.",
      },
      { type: "h2", text: "The habit that keeps it working" },
      {
        type: "p",
        text: "After every phone call, every email, every form filled — 30 seconds in the move file. Add the confirmation number, the agent's name, the date. The skim later is what makes those 30 seconds worth several hours during the move week.",
      },
      { type: "h2", text: "After the move" },
      {
        type: "p",
        text: "The file goes in the new address's document folder (see our piece on the folder structure that survives) and gets read once at the 30-day mark, once at six months, and once at one year. After year one, it becomes archive; the working file is now whatever account directory you keep going forward — LocateFlow if you've adopted it, a spreadsheet if you haven't. The chaos has a home; the home becomes a habit; the habit becomes the address book that will outlast this move and the next one.",
      },
    ],
  },
  {
    slug: "irs-address-change-form-8822",
    title: "Telling the IRS you moved: Form 8822 and the address the agency actually uses",
    excerpt:
      "The IRS does not learn your new address from USPS forwarding, and a refund check sent to the wrong place can take months to reissue. Here are the four ways the IRS updates your address, which one to use, and when each takes effect.",
    seoTitle: "IRS address change after moving — Form 8822 explained",
    seoDescription:
      "The IRS doesn't pull your new address from USPS forwarding. Here's how to update it — Form 8822, your next return, and what happens to a refund or notice if you don't.",
    categorySlug: "government",
    categoryName: "Government",
    readingMinutes: 6,
    sections: [
      {
        type: "img",
        src: "/blog/irs-form-8822.svg",
        caption: "Updating your address with the IRS after a move.",
      },
      {
        type: "p",
        text: "Of every account that needs your new address, the IRS is the one people most reliably forget — partly because you only hear from them once or twice a year, and partly because nobody tells you the agency keeps its own address record that USPS forwarding does not touch.",
      },
      {
        type: "p",
        text: "That gap is quiet until it isn't. A paper refund check, a notice about your return, or a letter that starts a 30-day clock all go to the address the IRS has on file. If that address is two moves stale, you may not see the letter until the deadline inside it has passed.",
      },
      { type: "h2", text: "The four ways the IRS updates your address" },
      {
        type: "p",
        text: "There is no single button. The IRS recognizes an address change through any of these, and they take effect at different speeds:",
      },
      {
        type: "ol",
        items: [
          "Your tax return — filing with the new address updates it automatically. This is the simplest path if you're moving between filing seasons and aren't expecting mid-year correspondence.",
          "Form 8822 (Change of Address) — the dedicated form. Use it when you've moved after filing and want the record current before next season, especially if a refund or notice is pending.",
          "A written, signed statement — mailed to the IRS center where you file, including your full name, old and new addresses, and SSN. Functionally the same as 8822, just less structured.",
          "Calling or in person — the IRS can update it after verifying your identity. Slower and only worth it if you also have another reason to contact them.",
        ],
      },
      {
        type: "blockquote",
        text: "Allow several weeks for any address change to fully process. It is not instant — file it well before you expect a refund check or a notice, not the week you need it.",
      },
      { type: "h2", text: "If you're married or moved separately" },
      {
        type: "p",
        text: "If you filed jointly and now live apart, each spouse should notify the IRS of their own new address — one 8822 does not cover two destinations. If only one of you moved, that person files separately so the other's record stays intact.",
      },
      { type: "h2", text: "State tax agencies are a separate notification" },
      {
        type: "p",
        text: "Updating the federal IRS does nothing for your state department of revenue. If you moved within a state, update the state agency too. If you moved across state lines, you may have a part-year return to file in both states next season — the address on file is what determines where notices land, so update both.",
      },
      { type: "h2", text: "The clean version" },
      {
        type: "p",
        text: "If you moved after filing this year, send Form 8822 now and don't wait for next April to fix it through the return. If you moved before filing, just use the new address on the return and you're done. Either way, set a reminder to check that any expected refund or notice actually arrives — the IRS letter you never received is the one that costs you. Keeping the date you filed each address change in your move record turns a vague worry into a checkable fact.",
      },
    ],
  },
  {
    slug: "avoid-internet-gap-when-moving",
    title: "How to move without an internet gap: lead times, self-install, and the overlap week",
    excerpt:
      "Internet has the longest lead time of anything you set up at a new home — and the one service where calling a week early isn't early enough. Here's how to schedule a transfer or a fresh install so you're online on day one.",
    seoTitle: "Avoid an internet gap when moving — transfer vs new install",
    seoDescription:
      "Internet has the longest lead time of any utility. Here's how to schedule the transfer or new install so you're online on move-in day — and the overlap trick that prevents a dead week.",
    categorySlug: "logistics",
    categoryName: "Logistics",
    readingMinutes: 6,
    sections: [
      {
        type: "img",
        src: "/blog/internet-gap-when-moving.svg",
        caption: "Setting up internet at a new home without a coverage gap.",
      },
      {
        type: "p",
        text: "Power gets turned on with a phone call. Water is usually a same-week thing through the city. Internet is the outlier — it can need a technician, a line pulled to the unit, and an appointment slot that books out two to three weeks. It is the single most common reason a new home has everything working except the one thing you need to work from it.",
      },
      { type: "h2", text: "First question: transfer or new account?" },
      {
        type: "p",
        text: "The answer depends entirely on whether your current provider serves the new address.",
      },
      {
        type: "ul",
        items: [
          "Same provider serves both addresses — you transfer service. Keep your account, often keep your plan price, and the disconnect-at-old / connect-at-new dates are scheduled together. This is the smoothest path.",
          "Different providers — you cancel one and open a new account at the other. Now you're a new customer with a new install, a possible credit check, and equipment to return on the old end.",
        ],
      },
      {
        type: "p",
        text: "Check coverage at the exact new address before you assume anything — service can change street by street, and the plan available two miles away may not exist at the new place.",
      },
      { type: "h2", text: "The lead-time ladder" },
      {
        type: "ol",
        items: [
          "Three weeks out: confirm which providers serve the new address and whether you're transferring or starting fresh. Book the install slot now — the earliest slots go first.",
          "Two weeks out: if a technician visit is required, lock the date for move-in day or the day before, not after.",
          "Move week: confirm the appointment by phone. Self-install kits ship to the new address, so make sure someone can receive the box.",
          "Old address: schedule the disconnect for a day or two after you leave, not before — a too-early cutoff strands you during the last packing days.",
        ],
      },
      {
        type: "blockquote",
        text: "The overlap week is worth paying for. A few days of double billing on internet is cheaper than a week of working from a coffee shop because the disconnect fired before the connect.",
      },
      { type: "h2", text: "The self-install trap and the fallback" },
      {
        type: "p",
        text: "Self-install kits are convenient until the line into the unit was never activated, in which case the modem blinks and you still need a technician — now on a next-available slot. If you're cutting it close, ask the provider directly whether the address has a live, provisioned line. If the answer is unclear, book a technician visit anyway and cancel it if the self-install works.",
      },
      {
        type: "p",
        text: "Have a fallback for day one regardless: a phone hotspot plan or a known nearby workspace. The most reliable internet on move-in day is the one you already had in your pocket.",
      },
      { type: "h2", text: "Don't forget the disconnect" },
      {
        type: "p",
        text: "The new connection gets all the attention; the old one quietly keeps billing. Return leased equipment (modem, router, cable boxes) and get a receipt — unreturned-equipment fees are a common surprise charge weeks after a move. Note the cancellation confirmation number alongside your other move records so a wrongful charge is easy to dispute.",
      },
    ],
  },
  {
    slug: "transfer-healthcare-doctors-prescriptions-when-moving",
    title: "Moving your healthcare: doctors, prescriptions, and the insurance network trap",
    excerpt:
      "A move can quietly push your doctors out of network and strand a prescription mid-refill. Healthcare is the move task with the most moving parts and the least forgiving timing. Here's the order that keeps care continuous.",
    seoTitle: "Transfer healthcare when moving — doctors, prescriptions, networks",
    seoDescription:
      "Moving can push your doctors out of network and strand a refill. Here's the order to move your healthcare — insurance, prescriptions, records, and new providers — without a gap in care.",
    categorySlug: "moving",
    categoryName: "Moving",
    readingMinutes: 7,
    sections: [
      {
        type: "img",
        src: "/blog/healthcare-transfer-when-moving.svg",
        caption: "Transferring doctors, prescriptions, and coverage when you move.",
      },
      {
        type: "p",
        text: "Most move checklists treat healthcare as one line item: \"find a new doctor.\" In practice it's four separate systems — your insurance network, your prescriptions, your records, and your actual providers — and they have to move in a specific order or you get a gap exactly when you can least afford one.",
      },
      { type: "h2", text: "Start with insurance, because it gates everything else" },
      {
        type: "p",
        text: "Your plan's network is geographic. A plan that covered every doctor near the old place may cover almost none near the new one, and an out-of-network visit can cost several times an in-network one.",
      },
      {
        type: "ul",
        items: [
          "If you have employer coverage and stayed at the same job, the plan usually follows you — but the in-network providers near your new home are a different list. Check it before you book anyone.",
          "A move across state lines can be a qualifying life event that opens a special enrollment window. If you buy your own coverage, a new state often means a new marketplace and new plans entirely.",
          "Medicare and Medicaid have their own move rules; Medicaid in particular is state-administered, so an interstate move means re-applying in the new state.",
        ],
      },
      { type: "h2", text: "Refill prescriptions before you go" },
      {
        type: "p",
        text: "The prescription is the time-critical piece. Pharmacy chains can transfer a prescription between their own locations in minutes, but a controlled substance, a new state, or a different chain complicates it. Two weeks before the move:",
      },
      {
        type: "ol",
        items: [
          "Refill everything you can so you have a buffer that outlasts any transfer delay.",
          "For chain pharmacies, confirm there's a branch near the new address and ask them to transfer the prescription on file.",
          "For controlled medications, ask the prescriber what the new state requires — some need a fresh in-state prescription, not a transfer.",
          "If you're switching insurers, confirm the medication is on the new plan's formulary before you rely on it being covered.",
        ],
      },
      {
        type: "blockquote",
        text: "A prescription transfer is fast; a prescription transfer plus a new state plus a new insurer plus a controlled-substance rule is not. Assume the slowest path and build a buffer.",
      },
      { type: "h2", text: "Request records before you leave, not after" },
      {
        type: "p",
        text: "Ask each current provider — primary care, specialists, dentist, eye doctor — to send your records to the new provider or to you directly. Most will send a secure PDF within a few business days. Doing this before you leave is easier than chasing a clinic two time zones away that has no reason to prioritize a former patient.",
      },
      { type: "h2", text: "Then find providers — in that order" },
      {
        type: "p",
        text: "Only once you know your network can you pick providers without an out-of-network surprise. Book a primary-care meet-and-greet even if nothing is wrong; it gets you into the system so that when something is wrong, you're not starting from zero. Carry a short medication-and-condition list for the first visit so nothing depends on records that haven't arrived yet.",
      },
      {
        type: "p",
        text: "Healthcare is the move task where a forgotten step shows up as a denied claim or a missed dose, not just a hassle. Tracking which providers you've moved, which records have arrived, and what the new plan covers — in one place rather than across a dozen browser tabs — is the difference between continuous care and a scramble.",
      },
    ],
  },
  {
    slug: "update-bank-accounts-cards-without-breaking-autopay",
    title: "Updating your bank and cards after a move without breaking autopay",
    excerpt:
      "Changing a card's billing address sounds harmless until the next autopay charge declines because the address on file no longer matches. Here's the order to update financial accounts so nothing bounces and no card gets mailed to the old place.",
    seoTitle: "Change your address with banks without breaking autopay",
    seoDescription:
      "Updating a card's billing address can decline the next autopay charge or mail a replacement card to your old home. Here's the order to update banks and cards after a move safely.",
    categorySlug: "money",
    categoryName: "Money",
    readingMinutes: 5,
    sections: [
      {
        type: "img",
        src: "/blog/bank-accounts-autopay.svg",
        caption: "Updating banks and cards after a move without breaking autopay.",
      },
      {
        type: "p",
        text: "Banks and cards feel like a safe, low-stakes address update — until you realize how much hangs off the billing address. Replacement cards, fraud alerts, statements, and the address-verification check that some autopay merchants run all key off it. Update it carelessly and the next automatic payment can decline for a reason that looks like fraud.",
      },
      { type: "h2", text: "Why autopay breaks on an address change" },
      {
        type: "p",
        text: "Some recurring merchants verify the billing ZIP against the card on file (it's called AVS — address verification). When you change the billing address with your bank but the merchant still has the old ZIP stored, the next charge can be rejected as a mismatch. The payment doesn't fail because there's no money; it fails because two systems disagree about where you live.",
      },
      { type: "h2", text: "The order that avoids a bounce" },
      {
        type: "ol",
        items: [
          "Update the bank or card issuer's billing address first. This is the source of truth and the one that controls where replacement cards and statements go.",
          "Make a list of every merchant on autopay against that card — your statement from the last 90 days is the complete list.",
          "Update the billing address stored at each of those merchants to match. This is the step people skip, and it's the one that prevents the decline.",
          "Only then change anything else (new cards, closed accounts), so you're not chasing a mismatch across a dozen merchants at once.",
        ],
      },
      {
        type: "blockquote",
        text: "The bank's address and the merchant's stored address have to agree. Updating one without the other is what turns a routine autopay into a declined payment and a late fee.",
      },
      { type: "h2", text: "Watch the replacement-card timing" },
      {
        type: "p",
        text: "Changing your address sometimes triggers the bank to mail a new card or a confirmation letter. If you change it before you've actually moved, that mail goes to an address you've already left. Change the address on or just after move-in, and make sure USPS forwarding is active as a safety net for anything that slips through.",
      },
      { type: "h2", text: "The accounts behind the accounts" },
      {
        type: "ul",
        items: [
          "Joint accounts: updating your login may not update your partner's card record. Confirm both.",
          "Old savings or brokerage accounts you rarely log into still mail tax documents in January — update them now, not in April.",
          "Buy-now-pay-later and store cards are easy to forget because they're not in your main banking app, but they bill on a schedule like everything else.",
          "Digital wallets (the card stored in your phone) carry their own billing address — update it there too.",
        ],
      },
      {
        type: "p",
        text: "Financial accounts reward doing this in one focused sitting rather than piecemeal. Pull the statement, work the list top to bottom, and note each confirmation. The half hour it takes is the half hour that keeps a single address change from becoming three late fees and a fraud hold.",
      },
    ],
  },
  {
    slug: "enroll-kids-new-school-district-after-move",
    title: "Enrolling your kids in a new school district: records, residency proof, and timing",
    excerpt:
      "School enrollment is the move task with a hard external deadline you don't control — the school calendar. It also needs documents that take time to gather. Here's the paperwork, the residency proof that trips people up, and when to start.",
    seoTitle: "Enroll kids in a new school district after moving — checklist",
    seoDescription:
      "New-district enrollment needs proof of residency, immunization records, and sometimes an IEP handoff. Here's the document set, the residency-proof rules, and the timing that avoids a gap.",
    categorySlug: "government",
    categoryName: "Government",
    readingMinutes: 6,
    sections: [
      {
        type: "img",
        src: "/blog/school-enrollment-new-district.svg",
        caption: "Enrolling children in a new school district after a move.",
      },
      {
        type: "p",
        text: "Most move tasks bend to your schedule. School enrollment doesn't — the academic calendar is fixed, the registration windows are real, and the documents a district requires take longer to assemble than parents expect. Start this one early and it's paperwork; start it late and it's a child sitting out of class while you chase a transcript.",
      },
      { type: "h2", text: "The document set every district wants" },
      {
        type: "p",
        text: "Specifics vary by district, but the core set is consistent. Gather these before you try to register:",
      },
      {
        type: "ul",
        items: [
          "Proof of residency — usually two documents (a lease or deed plus a utility bill or bank statement) showing your name at the new address.",
          "The child's birth certificate or other proof of age.",
          "Immunization records — districts enforce state vaccination requirements, and an out-of-state record sometimes needs reformatting by a local provider.",
          "The most recent report card or transcript, and for older students, the records that determine course placement.",
          "Any IEP or 504 plan, if the child receives special-education or accommodation services.",
        ],
      },
      { type: "h2", text: "Residency proof is the step that surprises people" },
      {
        type: "p",
        text: "Districts are funded by residents, so they verify that you actually live in the attendance zone — sometimes strictly. If you're staying with family temporarily, renting before a lease is signed, or between addresses, the standard two-document proof may not exist yet. Call the district's registrar and ask what they accept in your exact situation before enrollment day; they have seen it before and there's usually a documented alternative.",
      },
      {
        type: "blockquote",
        text: "Confirm the attendance zone for your exact address, not the neighborhood. Two homes on the same street can feed different schools, and the catchment map is the only authority.",
      },
      { type: "h2", text: "The IEP/504 handoff can't be informal" },
      {
        type: "p",
        text: "If your child has an IEP or 504 plan, the new district must provide comparable services, but it needs the actual plan to do so. Request the full special-education file from the old district in writing and hand-carry a copy to the new one. Don't rely on district-to-district transfer alone — the services depend on the document arriving, and the start of the school year is the worst time for it to be in transit.",
      },
      { type: "h2", text: "When to start" },
      {
        type: "ol",
        items: [
          "As soon as the new address is firm, identify the assigned school and its registration process — online portal, in person, or both.",
          "Request records from the current school before you leave; mid-summer is when school offices are least staffed and slowest to respond.",
          "Schedule any required immunization updates with enough lead time that a missing shot doesn't delay the start date.",
          "Confirm transportation — bus eligibility is keyed to the address and isn't always automatic.",
        ],
      },
      {
        type: "p",
        text: "School enrollment rewards treating it as a project with a deadline rather than an errand. Keep the document set and each request date together so that when the registrar asks for the one thing you forgot, you know exactly where it is — and the first day at the new school is just a first day, not a paperwork emergency.",
      },
    ],
  },
  {
    slug: "insurance-coverage-gap-moving-day",
    title: "The insurance coverage gap on moving day nobody plans for",
    excerpt:
      "On the day your belongings are most exposed — in boxes, on a truck, between two homes — they may be covered by no policy at all. Here's how renters, homeowners, and mover coverage overlap, and the gap that opens in the middle.",
    seoTitle: "Moving-day insurance gap — renters, home, and stuff in transit",
    seoDescription:
      "Your belongings can be uninsured the moment they're on the truck. Here's how renters, homeowners, and mover coverage overlap — and how to close the gap that opens on moving day.",
    categorySlug: "money",
    categoryName: "Money",
    readingMinutes: 6,
    sections: [
      {
        type: "img",
        src: "/blog/insurance-coverage-gap-moving-day.svg",
        caption: "Closing the insurance coverage gap on moving day.",
      },
      {
        type: "p",
        text: "Insurance is built around a fixed address. Moving day is the one day your life isn't at a fixed address — your belongings are in transit, the old policy may be ending, and the new one may not have started. That's not a hypothetical edge case; it's a predictable few hours where a dropped box of electronics could be covered by nobody.",
      },
      { type: "h2", text: "Three policies, three different jobs" },
      {
        type: "ul",
        items: [
          "Homeowners or renters insurance covers your belongings — sometimes even while they're temporarily away from home, but with limits and conditions worth reading before you rely on them.",
          "The moving company's liability is usually minimal by default — often valued by weight, not by what the item is actually worth. A released-value settlement on a damaged laptop can be a few dollars.",
          "Full-value protection or separate moving insurance covers the actual replacement value, but you usually have to elect and pay for it before the move.",
        ],
      },
      { type: "h2", text: "Where the gap opens" },
      {
        type: "p",
        text: "The gap has two common shapes. The first is timing: if you cancel the old policy the day you leave and the new one starts the day you arrive, anything that happens on the road in between falls outside both. The second is scope: your homeowners policy might cover goods in transit at a reduced limit, while the mover's default liability is far below replacement cost — so a serious loss is only partly covered by either.",
      },
      {
        type: "blockquote",
        text: "Don't let the old policy lapse before the new one is active. A one-day overlap costs almost nothing; a one-day gap can cost the value of everything on the truck.",
      },
      { type: "h2", text: "How to close it" },
      {
        type: "ol",
        items: [
          "Overlap the policies. Start the new policy the day before you leave and cancel the old one the day after you arrive, so coverage is continuous through the move.",
          "Ask your insurer specifically how belongings are covered while in transit and what the limit is. Get the answer before you need it.",
          "Decide on mover coverage deliberately. For a valuable load, full-value protection is usually worth the cost; for a budget move of replaceable items, default liability may be acceptable.",
          "Photograph high-value items before they're packed. A claim is far easier with a dated photo and a rough value than with a memory.",
        ],
      },
      { type: "h2", text: "The address change is also a re-rating" },
      {
        type: "p",
        text: "Updating your address isn't just administrative — both home and auto premiums are rated on location, so the same coverage can cost more or less at the new ZIP. Update it promptly either way: if the rate drops you want the savings immediately, and if a claim ever arises, a policy with the wrong address can be adjusted against you.",
      },
      {
        type: "p",
        text: "Moving-day coverage is cheap insurance against an expensive few hours. Decide the overlap dates and the mover coverage level a week out, while it's a calm decision — not on the morning the truck is idling in the driveway.",
      },
    ],
  },
  {
    slug: "first-30-days-after-moving-timeline",
    title: "The first 30 days after moving: a week-by-week address-change timeline",
    excerpt:
      "The address changes that matter most are also the ones with deadlines — and most of them fall inside the first month. Here's a week-by-week plan that puts the high-stakes, time-limited updates first and the rest in their place.",
    seoTitle: "First 30 days after moving — a week-by-week checklist",
    seoDescription:
      "A week-by-week plan for the first month after a move: what to update on day one, in week one, and before the 30-day deadlines on licenses, registration, and insurance close.",
    categorySlug: "moving",
    categoryName: "Moving",
    readingMinutes: 7,
    sections: [
      {
        type: "img",
        src: "/blog/first-30-days-timeline.svg",
        caption: "A week-by-week timeline for the first 30 days after moving.",
      },
      {
        type: "p",
        text: "The problem with address changes isn't volume — it's that they're all due at once and a few of them have hard deadlines hiding inside. Several states give you as little as ten days to update a driver's license; insurance is rated the moment you move; school and utility windows don't wait. A week-by-week order turns an undifferentiated pile into a sequence.",
      },
      { type: "h2", text: "Day one: the safety nets" },
      {
        type: "ol",
        items: [
          "Confirm USPS Change of Address is active — it's the net that catches everything you forget, not a replacement for updating accounts.",
          "Make a single reference with your old address, new address, and move date. Every call this month starts by reading from it.",
          "Verify the essentials work: power, water, heat, and internet. Anything broken on day one needs a same-day call before offices close.",
        ],
      },
      { type: "h2", text: "Week one: identity, money, and the legal clocks" },
      {
        type: "ul",
        items: [
          "Driver's license and vehicle registration — check your state's deadline first; the shortest are about ten days and the clock starts when you begin living at the new address.",
          "Auto and home/renters insurance — update the address; it re-rates the premium and a claim on a stale address can be reduced.",
          "Banks and credit cards — update the billing address, then update the same address at every autopay merchant so nothing declines.",
          "Voter registration — deadlines close weeks before any election; do it now while it's on your mind.",
        ],
      },
      {
        type: "blockquote",
        text: "If a task has a legal deadline — license, registration, voter registration — it belongs in week one. Everything without a deadline can wait for week two without consequence.",
      },
      { type: "h2", text: "Week two: government and health" },
      {
        type: "ol",
        items: [
          "IRS (and your state tax agency) — file Form 8822 or notify them; they don't learn your address from USPS.",
          "Health insurance, doctors, and prescriptions — confirm the new address is in-network and transfer refills before the buffer runs out.",
          "Employer HR and any benefits — your tax forms and any mailed benefits documents follow this record.",
          "If you have kids or pets: school enrollment and the microchip registry both need attention and neither updates itself.",
        ],
      },
      { type: "h2", text: "Weeks three and four: the long tail" },
      {
        type: "p",
        text: "By now the deadlines are handled and what's left is the steady drip of smaller accounts: subscriptions, loyalty programs, online retailers, and the occasional forwarded letter that reveals an account you forgot. Work these as they surface. A forwarded envelope with the yellow label is a direct signal: that sender still has your old address — fix it while the envelope is in your hand.",
      },
      { type: "h2", text: "The 30-day review" },
      {
        type: "p",
        text: "At day 30, do one pass: did every expected bill, statement, and card arrive at the new place? Anything missing is an account that didn't get the update. This single review catches the silent failures — the joint card nobody re-pointed, the annual statement that hasn't come due yet. A move tracked as a checklist with dates, rather than held in memory, is what makes that review take ten minutes instead of an afternoon.",
      },
    ],
  },
  {
    slug: "vehicle-registration-second-dmv-deadline",
    title: "Vehicle registration vs driver's license: the second DMV deadline people miss",
    excerpt:
      "Updating your license and re-registering your vehicle are two different tasks with two different deadlines — and the registration one is the one people miss. Here's how they differ, why an interstate move resets the whole thing, and what rides on it.",
    seoTitle: "Vehicle registration after moving — the second DMV deadline",
    seoDescription:
      "Updating your license and re-registering your vehicle are separate DMV deadlines. Here's how they differ by state, plus the title, emissions, and insurance effects of a move.",
    categorySlug: "government",
    categoryName: "Government",
    readingMinutes: 6,
    sections: [
      {
        type: "img",
        src: "/blog/vehicle-registration-deadline.svg",
        caption: "Vehicle registration is a separate DMV deadline from your license.",
      },
      {
        type: "p",
        text: "People treat the DMV as one errand: update the license, done. But your driver's license and your vehicle registration are two separate records with two separate deadlines, and the registration is the one that quietly lapses — because the sticker on your plate looks fine until the day it isn't.",
      },
      { type: "h2", text: "Two records, two clocks" },
      {
        type: "ul",
        items: [
          "Your driver's license carries your address as identification. Updating it is often a quick online change within a short deadline after you move.",
          "Your vehicle registration ties a specific car to an address and a jurisdiction for taxes, fees, and emissions. Within a state it's an address update; across state lines it's frequently a full re-registration with inspection.",
        ],
      },
      {
        type: "p",
        text: "Within the same state, the two often move together and the deadlines are short — sometimes the same ten-to-thirty-day window as the license. Across state lines, registration is the bigger job and the one with the most attached requirements.",
      },
      { type: "h2", text: "What an interstate move actually requires" },
      {
        type: "ol",
        items: [
          "Register the vehicle in the new state, usually within a set number of days of establishing residency.",
          "Pass any required safety or emissions inspection — some states require it before they'll register, some don't require it at all.",
          "Update the title if the new state requires titling there; if there's a lien, the lender may need to be involved.",
          "Get new plates and a new registration, and surrender or retire the old plates per the old state's rules.",
        ],
      },
      {
        type: "blockquote",
        text: "The plate sticker gives no warning. Expired registration is usually discovered at a traffic stop or a renewal notice that went to the old address — both after the deadline has already passed.",
      },
      { type: "h2", text: "What rides on getting it right" },
      {
        type: "ul",
        items: [
          "Insurance — your policy's garaging address should match the registration. A mismatch can complicate a claim and is sometimes treated as misrepresentation.",
          "Tolls and tickets — automated systems mail to the registered address. A stale one means you don't see the notice until it's a penalty.",
          "Emissions and renewal cycles — the new state's schedule may differ from the old one, so the renewal date you remember may no longer apply.",
        ],
      },
      { type: "h2", text: "The clean sequence" },
      {
        type: "p",
        text: "Update the license first (it's quick and other steps may ask to see it), then tackle registration with the document set the new state lists — proof of insurance in that state, proof of residency, the title or lienholder details, and any inspection certificate. Treat registration as its own task with its own deadline, not a footnote to the license, and the second DMV clock stops being the one that catches you out.",
      },
    ],
  },
  {
    slug: "senior-parent-relocation-checklist",
    title: "Moving an aging parent: the relocation checklist that protects benefits and care",
    excerpt:
      "Relocating an older parent touches Medicare, Social Security, prescriptions, and a care network — each with its own update path and its own consequence for getting it wrong. Here's the checklist that keeps benefits intact and care continuous.",
    seoTitle: "Senior relocation checklist — benefits, care, and records",
    seoDescription:
      "Relocating an older parent touches Medicare, Social Security, prescriptions, and care networks — each with its own update path. Here's the checklist that keeps benefits and care intact.",
    categorySlug: "moving",
    categoryName: "Moving",
    readingMinutes: 7,
    sections: [
      {
        type: "img",
        src: "/blog/senior-parent-relocation.svg",
        caption: "A relocation checklist for moving an aging parent.",
      },
      {
        type: "p",
        text: "Moving an older parent carries everything a normal move does, plus a layer most moves don't: benefits and care that are tied to a specific address and a specific provider network, where a missed update isn't an inconvenience but an interruption in coverage or treatment. The order matters more here than almost anywhere.",
      },
      { type: "h2", text: "Benefits: what's federal and what's local" },
      {
        type: "ul",
        items: [
          "Social Security follows the person nationally, but the address still needs updating so payments, tax forms, and notices arrive — and direct deposit should be confirmed unchanged.",
          "Original Medicare travels anywhere in the country, but a Medicare Advantage or Part D drug plan has a regional network — a move can take the parent out of it and opens a special enrollment window to choose a plan that works at the new address.",
          "Medicaid is administered by each state, so an interstate move means re-applying in the new state, and there can be a gap to plan around.",
          "Any pension or annuity payer needs the new address for the same reasons as Social Security.",
        ],
      },
      { type: "h2", text: "Care continuity is the time-critical part" },
      {
        type: "ol",
        items: [
          "Refill all prescriptions to a comfortable buffer before the move, and confirm the medications are covered under whatever plan applies at the new address.",
          "Request medical records from every current provider — primary care, specialists, pharmacy — and hand-carry copies.",
          "Line up new providers in-network before the move where possible, especially for any ongoing or specialty care.",
          "If there's home care, adult day services, or durable medical equipment, arrange the equivalent at the new location before the old one ends.",
        ],
      },
      {
        type: "blockquote",
        text: "For an older adult, a two-week gap in a prescription or a specialist is not an administrative hiccup — it's a health event. Build the buffer first, then move the paperwork.",
      },
      { type: "h2", text: "The documents that make decisions possible" },
      {
        type: "p",
        text: "Make sure powers of attorney, healthcare directives, and insurance cards are gathered and accessible during the move, not packed in a box. If any legal document names a state, check whether it's still valid after an interstate move — some need to be re-executed under the new state's rules.",
      },
      { type: "h2", text: "The everyday accounts still apply" },
      {
        type: "p",
        text: "Underneath the benefits layer, the ordinary move still happens — banks, utilities, insurance, USPS forwarding, voter registration. For a parent who isn't managing it themselves, these often fall to you, which makes a shared, written record especially valuable: it lets siblings or caregivers see what's done and what's pending without a dozen phone calls.",
      },
      {
        type: "p",
        text: "A senior move is the case where tracking it once — benefits, providers, prescriptions, accounts, and the date each was handled — pays back the most. The stakes are higher and the people involved are usually more than one. A single source of truth turns a stressful, error-prone handoff into something the whole family can rely on.",
      },
    ],
  },
  {
    slug: "mail-packages-new-home-informed-delivery",
    title: "Mail and packages at the new place: Informed Delivery, lockers, and porch theft",
    excerpt:
      "A change-of-address form forwards letters; it does nothing for the packages already in transit or the ones a retailer will ship to the address it has on file. Here's how to make sure mail and parcels actually reach the new place.",
    seoTitle: "Set up mail and packages at a new home — Informed Delivery",
    seoDescription:
      "Beyond a change-of-address: USPS Informed Delivery, package lockers, and redirecting in-transit shipments so nothing lands at the old address or on a stranger's porch.",
    categorySlug: "logistics",
    categoryName: "Logistics",
    readingMinutes: 5,
    sections: [
      {
        type: "img",
        src: "/blog/mail-packages-new-home.svg",
        caption: "Setting up mail and packages so they reach the new home.",
      },
      {
        type: "p",
        text: "Most people file a USPS Change of Address and consider mail handled. It forwards letters, which is genuinely useful — but it does nothing for packages, which ship to whatever address a retailer has stored, and it does nothing for parcels already on a truck when you move. Mail and packages are two different problems with two different fixes.",
      },
      { type: "h2", text: "Turn on Informed Delivery at the new address" },
      {
        type: "p",
        text: "USPS Informed Delivery shows you a daily preview of the letter mail scheduled to arrive — and many incoming packages. After a move it's the single best tool for catching what's still going to the old address: if you see (or stop seeing) mail you expected, you immediately know which senders still have stale information. Set it up for the new address as soon as you can verify it.",
      },
      { type: "h2", text: "Packages don't forward — they follow the address on file" },
      {
        type: "ul",
        items: [
          "Update the default shipping address in every retail account you order from — the marketplace, the pharmacy auto-refill, the subscription box, the grocery delivery. Each stores its own address.",
          "For a package already in transit, use the carrier's redirect or hold feature (USPS, UPS, and FedEx each have one) before it attempts delivery to the old place — once it's out for delivery it may be too late.",
          "Carrier forwarding is not the same as USPS forwarding; a UPS or FedEx parcel addressed to the old home won't be rerouted by a USPS change-of-address form.",
        ],
      },
      {
        type: "blockquote",
        text: "USPS forwarding moves letters. Packages move only when you update the address stored in each account that ships to you. Those are separate actions, and only one of them is automatic.",
      },
      { type: "h2", text: "The receiving setup at the new place" },
      {
        type: "p",
        text: "Where packages land at the new home is its own small project. If it's a building, find out whether there's a mailroom, a parcel locker, or a front desk, and how delivery access works — some buildings require you to register for locker codes or buzzer access before anything can be delivered. If it's a house with an exposed porch, a lock box, a parcel locker, or routing deliveries to a pickup point reduces the porch-theft window that's highest right after a move, when packages arrive daily.",
      },
      { type: "h2", text: "The two-week mailbox audit" },
      {
        type: "p",
        text: "Two weeks in, look at what's actually arriving. Anything you expected that hasn't shown up points to a sender with the wrong address; anything still trickling to the old place (a forwarding label is the tell) is an account to fix at the source. Catching it now, while forwarding is still active, is the difference between a quick login and a letter lost for good. Keeping a short list of which senders you've re-pointed makes the audit a check, not a guess.",
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
    case "img":
      return { type: "image", attrs: { src: section.src!, alt: section.caption ?? "" } };
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
    case "img":
      return (
        `<figure><img src="${section.src!}" alt="${escapeHtml(section.caption ?? "")}" loading="lazy" />` +
        (section.caption ? `<figcaption>${escapeHtml(section.caption)}</figcaption>` : "") +
        `</figure>`
      );
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
    case "img":
      // Images carry no body copy — skip them in the plain-text/search index
      // (mirrors htmlToText's `img: skip` selector on the public side).
      return "";
  }
}

function buildPostContent(post: SamplePost) {
  const json = {
    type: "doc",
    content: post.sections.map(sectionToTiptap),
  };
  const html = post.sections.map(sectionToHtml).join("");
  const text = post.sections
    .map(sectionToText)
    .filter((t) => t.length > 0)
    .join("\n\n");
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
  const categoryConfig: Record<CategorySlug, { slug: string; name: string; description: string }> = {
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
    government: {
      slug: "government",
      name: "Government",
      description: "DMV, voter registration, IRS — the official paperwork that has its own deadlines.",
    },
    tools: {
      slug: "tools",
      name: "Tools",
      description: "Systems and document habits that turn moving chaos into something you can manage.",
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

  // Stagger publish dates so the homepage strip doesn't show every
  // post on the same day. Most recent goes to the hero. Posts beyond
  // the offset table fall back to a 7-day stride from the last one.
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const publishOffsets = [
    2,   // newest — featured hero
    6,
    11,
    17,
    24,
    32,
    41,
    51,
    62,
    74,  // oldest
  ].map((d) => d * DAY_MS);

  for (const [idx, post] of POSTS.entries()) {
    const { json, html, text } = buildPostContent(post);
    const offset = publishOffsets[idx] ?? publishOffsets[publishOffsets.length - 1] + (idx - publishOffsets.length + 1) * 7 * DAY_MS;
    const publishedAt = new Date(now - offset);

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
