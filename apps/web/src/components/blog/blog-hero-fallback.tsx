import { cn } from "@/lib/utils";
import { RaccoonReading } from "@/components/illustrations/RaccoonReading";

type BlogHeroFallbackProps = {
  /**
   * `hero` — the large featured card / per-post cover slot (bigger raccoon,
   * room for a soft eyebrow). `card` — the smaller grid + related thumbnails.
   */
  variant?: "hero" | "card";
  className?: string;
};

/**
 * Default illustrated header treatment for blog posts that ship without a
 * cover image. Replaces the previous bare radial-gradient placeholder with a
 * calm, on-brand banner: a layered primary/foil gradient wash, a faint
 * dotted-grid texture, and the reading-raccoon mascot so empty cards still
 * feel intentional and branded rather than blank.
 *
 * Fully theme-aware — every color is a shadcn/brand token (`--primary`,
 * `--foil-c`, `--border`), so it tracks dark/light mode and the per-plan
 * primary overrides. The artwork is decorative (`aria-hidden`); the post
 * title and excerpt rendered alongside carry the meaning.
 */
export function BlogHeroFallback({ variant = "card", className }: BlogHeroFallbackProps) {
  const isHero = variant === "hero";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {/* base wash — brand primary fading into the foil accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.16] via-primary/[0.05] to-transparent" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 78% 82%, var(--foil-c, hsl(var(--primary)/0.10)), transparent 55%)",
          opacity: 0.18,
        }}
      />
      {/* faint dotted-grid texture for a touch of paper/field-notes feel */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(hsl(var(--foreground)/0.10) 1px, transparent 1px)",
          backgroundSize: isHero ? "22px 22px" : "16px 16px",
          maskImage: "linear-gradient(to bottom, transparent, black 40%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 40%, transparent)",
        }}
      />
      {/* mascot — anchored toward the lower edge so it reads as "peeking up" */}
      <RaccoonReading
        size={isHero ? 184 : 116}
        className={cn(
          "relative translate-y-[8%] text-primary/45 transition-transform duration-500 group-hover:translate-y-[3%]",
          isHero && "sm:translate-y-[6%]",
        )}
      />
    </div>
  );
}

export default BlogHeroFallback;
