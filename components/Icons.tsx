/** Inline stroke icons — no icon font, no extra request. */
type P = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const ArrowRight = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const ArrowLeft = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

export const ArrowUpRight = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

export const Check = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

export const Close = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const Search = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M16.5 16.5 21 21" />
  </svg>
);

export const Paperclip = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M20 11.5 12.4 19a4.6 4.6 0 0 1-6.5-6.5l7.8-7.8a3.1 3.1 0 0 1 4.4 4.4l-7.8 7.8a1.6 1.6 0 0 1-2.2-2.2l7-7" />
  </svg>
);

export const Clock = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3.2 2" />
  </svg>
);



export const Storefront = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 9.5V20h16V9.5M3 9.5 5.5 4h13L21 9.5Z" />
    <path d="M9.5 20v-6h5v6" />
  </svg>
);

export const Spark = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 3.5 13.6 9l5.4 1.6L13.6 12l-1.6 5.5L10.4 12 5 10.6 10.4 9Z" />
    <path d="M18.5 4.5 19 6l1.5.5L19 7l-.5 1.5L18 7l-1.5-.5L18 6Z" />
  </svg>
);

export const Chevron = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 9.5 12 15l6-5.5" />
  </svg>
);

