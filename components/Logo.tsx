/**
 * The Spendbox mark: a single-stroke geometric S, cut from a rounded
 * square. Drawn on a 32-unit grid with a 3.1 stroke so the counters stay
 * open — and the letter stays readable — right down to a 16px favicon.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <rect width="32" height="32" rx="9" className="fill-forest-500" />
      <path
        d="M22.1 10.3C20.8 7.9 18.5 6.6 15.5 6.6C11.6 6.6 8.9 8.8 8.9 11.9C8.9 14.4 10.7 16 14.2 16.8L17.8 17.6C21.3 18.4 23.1 20 23.1 22.5C23.1 25.6 20.4 27.8 16.5 27.8C13.5 27.8 11.2 26.5 9.9 24.1"
        stroke="#FFFFFF"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark plus wordmark, used in the header and footer. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className="font-display text-[19px] font-extrabold tracking-[-0.03em] text-ink-900">
        Spendbox
      </span>
    </span>
  );
}
