/**
 * The Spendbox mark, exactly as drawn in Figma ("Spendbox Logo", node
 * 2001:2): three overlapping ribbon bands forming an S, in the brand's
 * three greens.
 *
 * The paths are the original artwork, untouched. The only thing done here
 * is the viewBox: the source file is a 700×700 canvas with the mark
 * sitting off-centre inside it, so this crops to the mark's real ink
 * bounds (x 173.69–544.12, y 150.36–534.05) and squares that box up, which
 * lets the mark be sized with a plain `h-8 w-8` anywhere it is used.
 */

/** Brand greens, straight from the logo file. */
export const LOGO_GREENS = {
  light: "#5DDA61",
  mid: "#44AC47",
  dark: "#2A772C",
} as const;

function Ribbon() {
  return (
    <>
      <path
        d="M543.742 449.901C400.047 413.815 320.628 390.974 196.748 309.759L284.85 253.186C363.399 317.369 418.17 335.87 522.667 357.782L543.742 449.901Z"
        fill={LOGO_GREENS.light}
      />
      <path
        d="M175.329 216.139C284.063 165.729 347.398 153.204 462.714 150.356L447.818 251.18C394.898 247.86 354.72 249.773 316.41 258.761C278.155 267.736 241.792 283.761 196.489 308.627L175.329 216.139Z"
        fill={LOGO_GREENS.mid}
        stroke="white"
      />
      <path
        d="M544.118 449.302C404.858 506.011 323.134 521.861 173.689 534.051L199.07 429.764C334.441 422.117 405.246 405.776 522.708 355.72L544.118 449.302Z"
        fill={LOGO_GREENS.dark}
      />
    </>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="157.06 140.36 403.7 403.7"
      className={className}
      fill="none"
      aria-hidden
    >
      <Ribbon />
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
