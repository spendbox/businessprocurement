"use client";

import { useEffect, useState } from "react";
import { useShell } from "./Shell";
import { Storefront } from "./Icons";

export function SiteHeader() {
  const { openVendor } = useShell();
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        lifted
          ? "border-b border-bone-200/80 bg-bone-100/80 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a
          href="#top"
          className="flex items-center gap-2 font-display text-[19px] font-extrabold tracking-[-0.03em] text-ink-900"
        >
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-[9px] bg-forest-500 text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5Z" />
              <path d="M12 12v8M4 8.5 12 12l8-3.5" />
            </svg>
          </span>
          Spendbox
        </a>

        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href="#how"
            className="hidden rounded-full px-3.5 py-2 text-[14px] font-semibold text-ink-500 transition-colors hover:bg-bone-200/70 hover:text-ink-900 sm:block"
          >
            How it works
          </a>
          <a
            href="#catalog"
            className="hidden rounded-full px-3.5 py-2 text-[14px] font-semibold text-ink-500 transition-colors hover:bg-bone-200/70 hover:text-ink-900 sm:block"
          >
            What we source
          </a>
          <button
            type="button"
            onClick={openVendor}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border-[1.5px] border-ink-900 px-4 text-[14px] font-bold text-ink-900 transition-all duration-200 hover:bg-ink-900 hover:text-bone-50"
          >
            <Storefront className="h-4 w-4" />
            For vendors
          </button>
        </nav>
      </div>
    </header>
  );
}
