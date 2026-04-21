import Link from "next/link";

/**
 * Inline SVG logo mark. Used in the landing header, footer, and wherever
 * we need the brand on a neutral background. Takes its color from the
 * primary theme variable so dark/light mode handling is automatic.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect width="64" height="64" rx="14" fill="hsl(var(--primary))" />
      <path d="M40 20 L52 30 L52 46 L30 46 L30 30 Z" fill="white" opacity="0.28" />
      <path d="M12 30 L26 18 L40 30 L40 48 L12 48 Z" fill="white" opacity="0.55" />
      <path
        d="M26 16 C30 16 33 19 33 23 C33 28 26 34 26 34 C26 34 19 28 19 23 C19 19 22 16 26 16 Z"
        fill="white"
      />
      <circle cx="26" cy="23" r="3" fill="hsl(var(--primary))" />
    </svg>
  );
}

/** Mark + wordmark combo used in header / footer brand rows. */
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 shrink-0">
      <LogoMark size={32} />
      <span className="text-xl font-bold tracking-tight">LocateFlow</span>
    </Link>
  );
}
