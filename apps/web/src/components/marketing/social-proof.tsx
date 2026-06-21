import { Star } from "lucide-react";

/**
 * Social proof — a small wall of testimonial cards.
 *
 * ⚠️ SAMPLE / PLACEHOLDER CONTENT ⚠️
 * The quotes, names, roles, and avatar initials below are illustrative
 * placeholders so the section reads as real social proof during design
 * review. They are NOT real customers. Before this goes live the owner
 * MUST swap these for genuine, attributable testimonials (with consent)
 * or remove the section. Do not ship fabricated quotes to production.
 */
const SAMPLE_TESTIMONIALS = [
  {
    quote:
      "I moved twice in three years and always forgot something. Move kept every provider, renewal, and address change in one place — nothing slipped through this time.",
    name: "Sample Name",
    role: "Recent mover",
    initials: "SN",
  },
  {
    quote:
      "The renewal reminders alone paid for it. I caught a subscription still tied to my old place before it auto-renewed to the wrong address.",
    name: "Sample Name",
    role: "Renter, two cities",
    initials: "SN",
  },
  {
    quote:
      "Finally a calm checklist for the chaos of moving. I shared it with my partner and we stopped doing the same task twice.",
    name: "Sample Name",
    role: "Homeowner",
    initials: "SN",
  },
];

export function SocialProof() {
  // Safety gate: never render fabricated quotes in production (FTC/trust risk).
  // The section stays hidden until the owner replaces EVERY "Sample Name"
  // placeholder with a real, attributable, consented testimonial.
  if (SAMPLE_TESTIMONIALS.some((t) => t.name === "Sample Name")) {
    return null;
  }

  return (
    <section className="container py-20 border-t">
      <div className="text-center mb-12 max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-primary">
          <Star className="h-3.5 w-3.5" />
          <span className="font-mono uppercase tracking-wider">
            What people are saying
          </span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Movers who stopped losing track
        </h2>
        <p className="text-muted-foreground text-lg">
          Real stories of staying on top of every address, service, and renewal.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {SAMPLE_TESTIMONIALS.map((item, idx) => (
          <figure
            key={idx}
            className="flex flex-col rounded-xl border bg-card p-6 space-y-4 hover:shadow-md transition-all"
          >
            <div
              className="flex items-center gap-0.5 text-tone-honey-fg"
              aria-hidden="true"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="text-sm leading-relaxed text-foreground flex-1">
              &ldquo;{item.quote}&rdquo;
            </blockquote>
            <figcaption className="flex items-center gap-3 pt-2 border-t">
              {/* Avatar placeholder — initials in a tinted circle. Swap for a
                  real photo when the testimonial is replaced with a real one. */}
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0"
                aria-hidden="true"
              >
                {item.initials}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {item.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {item.role}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
