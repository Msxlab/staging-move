/**
 * AI Review Moderation Engine
 * 
 * Analyzes review content and generates a moderation score (0-1).
 * Uses rule-based heuristics as a built-in engine.
 * Can be extended with OpenAI or other LLM APIs for advanced analysis.
 * 
 * Score thresholds:
 *   >= 0.80 → Auto-approve
 *   0.40 - 0.79 → Needs manual review (FLAGGED)
 *   < 0.40 → Auto-reject
 */

interface ModerationResult {
  score: number;
  analysis: string;
  flags: string[];
  action: "APPROVED" | "FLAGGED" | "REJECTED";
}

const SPAM_PATTERNS = [
  /buy\s+now/i, /click\s+here/i, /free\s+money/i, /act\s+now/i,
  /limited\s+time/i, /congratulations/i, /winner/i, /\$\$\$/,
  /bit\.ly/i, /tinyurl/i, /https?:\/\/[^\s]+\.(xyz|tk|ml|ga|cf)\b/i,
  /whatsapp/i, /telegram\s+group/i, /crypto\s+invest/i,
];

const PROFANITY_PATTERNS = [
  /\bf+u+c+k+/i, /\bs+h+i+t+/i, /\ba+s+s+h+o+l+e+/i,
  /\bb+i+t+c+h+/i, /\bd+a+m+n+/i, /\bh+e+l+l+\b/i,
];

const THREAT_PATTERNS = [
  /i\s+will\s+(kill|hurt|destroy|sue)/i,
  /you\s+will\s+(pay|regret|suffer)/i,
  /death\s+threat/i, /bomb/i,
];

export function analyzeReview(review: {
  comment: string;
  overallRating: number;
  serviceRating?: number | null;
  priceRating?: number | null;
  supportRating?: number | null;
  providerName?: string;
}): ModerationResult {
  const flags: string[] = [];
  let score = 1.0;
  const comment = review.comment || "";

  // 1. Length checks
  if (comment.length < 10) {
    flags.push("too_short");
    score -= 0.3;
  }
  if (comment.length < 5) {
    flags.push("extremely_short");
    score -= 0.3;
  }

  // 2. Spam detection
  let spamCount = 0;
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(comment)) {
      spamCount++;
    }
  }
  if (spamCount > 0) {
    flags.push(`spam_detected:${spamCount}`);
    score -= spamCount * 0.25;
  }

  // 3. Profanity check
  let profanityCount = 0;
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(comment)) {
      profanityCount++;
    }
  }
  if (profanityCount > 0) {
    flags.push(`profanity:${profanityCount}`);
    score -= profanityCount * 0.15;
  }

  // 4. Threat detection
  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(comment)) {
      flags.push("threat_detected");
      score -= 0.5;
      break;
    }
  }

  // 5. ALL CAPS abuse (>60% uppercase, length > 20)
  if (comment.length > 20) {
    const upperRatio = (comment.replace(/[^A-Z]/g, "").length) / comment.replace(/\s/g, "").length;
    if (upperRatio > 0.6) {
      flags.push("excessive_caps");
      score -= 0.1;
    }
  }

  // 6. Repetitive characters (e.g., "sooooo baaad")
  if (/(.)\1{4,}/i.test(comment)) {
    flags.push("repetitive_chars");
    score -= 0.1;
  }

  // 7. Rating consistency check
  const ratings = [
    review.overallRating,
    review.serviceRating,
    review.priceRating,
    review.supportRating,
  ].filter((r): r is number => r != null);

  if (ratings.length >= 2) {
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const maxDiff = Math.max(...ratings.map((r) => Math.abs(r - avg)));
    if (maxDiff > 2.5) {
      flags.push("inconsistent_ratings");
      score -= 0.1;
    }
  }

  // 8. Extreme ratings with short comment (suspicious)
  if ((review.overallRating === 1 || review.overallRating === 5) && comment.length < 30) {
    flags.push("extreme_rating_short_comment");
    score -= 0.1;
  }

  // 9. URL detection (not necessarily bad, but worth flagging)
  const urlCount = (comment.match(/https?:\/\/[^\s]+/g) || []).length;
  if (urlCount > 2) {
    flags.push(`multiple_urls:${urlCount}`);
    score -= 0.15;
  }

  // 10. Gibberish detection (consonant clusters)
  const words = comment.split(/\s+/);
  const gibberishWords = words.filter((w) =>
    w.length > 3 && /^[^aeiou\s\d]+$/i.test(w)
  );
  if (gibberishWords.length > 2) {
    flags.push("possible_gibberish");
    score -= 0.2;
  }

  // Normalize score to 0-1
  score = Math.max(0, Math.min(1, score));

  // Build analysis text
  const analysis = buildAnalysis(score, flags, comment);

  // Determine action
  let action: ModerationResult["action"];
  if (score >= 0.80) {
    action = "APPROVED";
  } else if (score >= 0.40) {
    action = "FLAGGED";
  } else {
    action = "REJECTED";
  }

  return { score: Math.round(score * 100) / 100, analysis, flags, action };
}

function buildAnalysis(score: number, flags: string[], comment: string): string {
  const parts: string[] = [];

  if (flags.length === 0) {
    parts.push("Review passes all moderation checks.");
  } else {
    parts.push(`${flags.length} issue(s) detected.`);
  }

  if (flags.includes("too_short") || flags.includes("extremely_short")) {
    parts.push("Review text is very short and may lack useful content.");
  }
  if (flags.some((f) => f.startsWith("spam_detected"))) {
    parts.push("Possible spam content detected.");
  }
  if (flags.some((f) => f.startsWith("profanity"))) {
    parts.push("Review contains profanity.");
  }
  if (flags.includes("threat_detected")) {
    parts.push("Review contains threatening language.");
  }
  if (flags.includes("excessive_caps")) {
    parts.push("Excessive use of capital letters.");
  }
  if (flags.includes("inconsistent_ratings")) {
    parts.push("Individual ratings are inconsistent with overall rating.");
  }

  if (score >= 0.80) {
    parts.push("Recommendation: Auto-approve.");
  } else if (score >= 0.40) {
    parts.push("Recommendation: Needs manual review.");
  } else {
    parts.push("Recommendation: Auto-reject.");
  }

  return parts.join(" ");
}

/**
 * Batch analyze multiple reviews.
 */
export function analyzeReviews(reviews: Parameters<typeof analyzeReview>[0][]): ModerationResult[] {
  return reviews.map(analyzeReview);
}
