"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { CATEGORIES } from "@/lib/catalog";
import { CommandBar } from "./CommandBar";
import { useShell } from "./Shell";
import { ArrowRight, Chevron, Clock, Spark, Storefront } from "./Icons";

type Chapter = {
  id: string;
  eyebrow: string;
  title: string[];
  sub: string;
  /** Two-stop wash behind the chapter. */
  wash: [string, string];
};

const CHAPTERS: Chapter[] = [
  {
    id: "ask",
    eyebrow: "Business procurement",
    title: ["What does your", "business need to buy?"],
    sub: "Type it the way you would say it. We source it, compare the offers and come back with the best ones.",
    wash: ["#e9f4ee", "#f5f4ed"],
  },
  {
    id: "process",
    eyebrow: "How it works",
    title: ["One message.", "That's the whole process."],
    sub: "No catalog to search. No forms to learn. No account to create before you are allowed to ask a question.",
    wash: ["#f3efe4", "#f5f4ed"],
  },
  {
    id: "range",
    eyebrow: "What we source",
    title: ["Anything a business", "actually buys."],
    sub: "From two hundred boxes of gloves to a forty kVA generator, installed and serviced.",
    wash: ["#eaf0f4", "#f5f4ed"],
  },
  {
    id: "people",
    eyebrow: "Not a marketplace",
    title: ["No catalogs.", "No endless comparing."],
    sub: "You never browse anything. Real people do the sourcing, the haggling and the vetting, then hand you offers worth reading.",
    wash: ["#efeee6", "#f5f4ed"],
  },
  {
    id: "merchants",
    eyebrow: "For merchants",
    title: ["Sell to businesses.", "No storefront needed."],
    sub: "Get matched to real purchase requests in your categories and reply with your best offer. No listings to maintain.",
    wash: ["#e7f1ec", "#f5f4ed"],
  },
];

const POPULAR = [
  "50 office chairs",
  "Nitrile gloves, bulk",
  "10 laptops",
  "Branded packaging",
  "40kVA generator",
  "Monthly cleaning supply",
];

const STEPS = [
  {
    n: "01",
    title: "You send your request",
    body: "One field. Plain words, or paste your purchase order.",
  },
  {
    n: "02",
    title: "Merchants send quotes",
    body: "We take it to vetted suppliers and push them on price.",
  },
  {
    n: "03",
    title: "Best offers come back",
    body: "You pick one. We handle the order from there.",
  },
];

const PROOF = [
  {
    icon: Spark,
    title: "Vetted merchants only",
    body: "Every supplier is checked before a single quote reaches you.",
  },
  {
    icon: Clock,
    title: "Offers, not catalogs",
    body: "You read a short list of real prices, not a thousand listings.",
  },
  {
    icon: Storefront,
    title: "One order, one contact",
    body: "However many suppliers it takes, you deal with us.",
  },
];

const ease = [0.22, 0.72, 0.18, 1] as const;

const fade = {
  initial: { opacity: 0, y: 18, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -14, filter: "blur(6px)" },
};

export function ScrollStage() {
  const stage = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const { openOrder, openVendor, setDocked } = useShell();

  const { scrollYProgress } = useScroll({
    target: stage,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = Math.min(
      CHAPTERS.length - 1,
      Math.max(0, Math.floor(p * CHAPTERS.length + 0.0001)),
    );
    setIndex((current) => (current === next ? current : next));

    // Progress hits 1 exactly as the sticky layer unpins, which is the
    // moment the bar needs to reappear docked at the bottom.
    setDocked(p > 0.995);
  });

  const goTo = (i: number) => {
    const node = stage.current;
    if (!node) return;
    const top = node.offsetTop + (node.offsetHeight / CHAPTERS.length) * i + 8;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const chapter = CHAPTERS[index];

  return (
    <section
      ref={stage}
        aria-label="What Spendbox does"
        style={{ height: `${CHAPTERS.length * 100}svh` }}
        className="relative"
      >
        <div className="sticky top-0 grid h-[100svh] grid-rows-[1fr_auto_1fr] overflow-hidden">
          {/* ---------- backdrop ---------- */}
          <motion.div
            aria-hidden
            className="grain absolute inset-0 -z-10"
            animate={{
              background: `radial-gradient(120% 80% at 50% 8%, ${chapter.wash[0]} 0%, ${chapter.wash[1]} 62%)`,
            }}
            transition={{ duration: 0.9, ease }}
          />
          <Orbs index={index} />

          {/* ---------- chapter copy (above the bar) ---------- */}
          <div className="relative row-start-1 grid items-end justify-items-center px-5 pb-5 pt-20 sm:pb-8">
            <div className="grid w-full max-w-[860px] grid-cols-[minmax(0,1fr)] [grid-template-areas:'stack']">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={chapter.id}
                  {...fade}
                  transition={{ duration: 0.5, ease }}
                  className="[grid-area:stack] min-w-0 text-center"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-500">
                    {chapter.eyebrow}
                  </p>
                  <h2 className="mt-3 font-display text-[clamp(30px,7.2vw,58px)] font-bold leading-[1.04] tracking-[-0.025em] text-ink-900">
                    {chapter.title.map((line, i) => (
                      <span key={i} className="block text-balance">
                        {line}
                      </span>
                    ))}
                  </h2>
                  <p className="mx-auto mt-4 max-w-[52ch] text-pretty text-[15px] leading-relaxed text-ink-500 sm:text-[17px]">
                    {chapter.sub}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ---------- the bar that never moves ---------- */}
          <div className="relative z-20 row-start-2 px-4 sm:px-5">
            <div className="mx-auto w-full max-w-[720px]">
              <CommandBar chapter={index} />
            </div>
          </div>

          {/* ---------- chapter extra (below the bar) ---------- */}
          <div className="relative row-start-3 overflow-hidden px-5 pb-16 pt-6 sm:pt-8">
            <div className="grid h-full w-full grid-cols-[minmax(0,1fr)] [grid-template-areas:'stack']">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={chapter.id}
                  {...fade}
                  transition={{ duration: 0.5, ease, delay: 0.06 }}
                  className="[grid-area:stack] w-full min-w-0"
                >
                  {index === 0 && (
                    <div className="mx-auto flex w-full max-w-[860px] flex-col items-center gap-3">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-300">
                        Popular requests
                      </p>
                      <div className="no-bar -mx-5 flex w-[calc(100%+2.5rem)] gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:w-full sm:flex-wrap sm:justify-center sm:px-0">
                        {POPULAR.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => openOrder({ need: p })}
                            className="shrink-0 rounded-full border-[1.5px] border-bone-200 bg-white/80 px-4 py-2.5 text-[13.5px] font-semibold text-ink-500 backdrop-blur transition-all duration-200 hover:-translate-y-px hover:border-forest-200 hover:bg-forest-50 hover:text-ink-800"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {index === 1 && (
                    <ol className="mx-auto grid max-w-[900px] gap-2.5 sm:grid-cols-3">
                      {STEPS.map((s) => (
                        <li
                          key={s.n}
                          className="flex items-start gap-3 rounded-2xl border border-bone-200 bg-white/70 p-4 backdrop-blur sm:flex-col sm:gap-2"
                        >
                          <span className="font-display text-[15px] font-bold text-forest-500">
                            {s.n}
                          </span>
                          <div>
                            <p className="text-[14.5px] font-bold text-ink-800">
                              {s.title}
                            </p>
                            <p className="mt-0.5 text-[13px] leading-snug text-ink-400">
                              {s.body}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  {index === 2 && <CategoryMarquee />}

                  {index === 3 && (
                    <ul className="mx-auto grid max-w-[900px] gap-2.5 sm:grid-cols-3">
                      {PROOF.map((p) => (
                        <li
                          key={p.title}
                          className="flex items-start gap-3 rounded-2xl border border-bone-200 bg-white/70 p-4 backdrop-blur sm:flex-col"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-500">
                            <p.icon className="h-[18px] w-[18px]" />
                          </span>
                          <div>
                            <p className="text-[14.5px] font-bold text-ink-800">
                              {p.title}
                            </p>
                            <p className="mt-0.5 text-[13px] leading-snug text-ink-400">
                              {p.body}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {index === 4 && (
                    <div className="mx-auto flex max-w-[860px] flex-col items-center gap-3">
                      <button
                        type="button"
                        onClick={openVendor}
                        className="group inline-flex min-h-[52px] items-center gap-2.5 rounded-full bg-ink-900 px-6 text-[15px] font-bold text-bone-50 transition-all duration-200 hover:-translate-y-px hover:bg-ink-800 hover:shadow-lift"
                      >
                        <Storefront className="h-[18px] w-[18px]" />
                        I'm a vendor — sign us up
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </button>
                      <p className="text-[13px] text-ink-400">
                        Takes about two minutes. We review merchants within two
                        working days.
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ---------- progress rail ---------- */}
          <nav
            aria-label="Sections"
            className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-1 sm:flex lg:right-7"
          >
            {CHAPTERS.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={c.eyebrow}
                aria-current={i === index ? "true" : undefined}
                className="grid h-9 w-7 place-items-center"
              >
                <span
                  className={`w-[9px] rounded-full transition-all duration-500 ${
                    i === index
                      ? "h-7 bg-forest-500"
                      : "h-[9px] bg-ink-300/50 hover:bg-ink-300"
                  }`}
                />
              </button>
            ))}
          </nav>

          {/* ---------- scroll hint ---------- */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: index === 0 ? 1 : 0 }}
            transition={{ duration: 0.4 }}
            className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-ink-300"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              Scroll
            </span>
            <Chevron className="h-4 w-4 motion-safe:animate-[nudge_1.9s_ease-in-out_infinite]" />
          </motion.div>
          <style>{`@keyframes nudge{0%,100%{transform:translateY(0)}50%{transform:translateY(5px)}}`}</style>
        </div>
      </section>
  );
}

/* ------------------------------------------------------------------ */
/* Soft moving orbs — the only thing that changes colour per chapter   */
/* ------------------------------------------------------------------ */

const ORB_TINTS: [string, string][] = [
  ["#0f7a52", "#e8b44a"],
  ["#cc7355", "#0f7a52"],
  ["#3d7ea6", "#0f7a52"],
  ["#8b7d5a", "#0f7a52"],
  ["#0f7a52", "#2f9a6d"],
];

function Orbs({ index }: { index: number }) {
  const [a, b] = ORB_TINTS[index] ?? ORB_TINTS[0];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.span
        className="absolute -left-[18%] top-[6%] h-[46vmax] w-[46vmax] rounded-full blur-[90px]"
        animate={{ backgroundColor: a, opacity: 0.16, x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{
          backgroundColor: { duration: 1 },
          opacity: { duration: 1 },
          x: { duration: 22, repeat: Infinity, ease: "easeInOut" },
          y: { duration: 18, repeat: Infinity, ease: "easeInOut" },
        }}
      />
      <motion.span
        className="absolute -right-[14%] bottom-[2%] h-[40vmax] w-[40vmax] rounded-full blur-[90px]"
        animate={{ backgroundColor: b, opacity: 0.14, x: [0, -26, 0], y: [0, 24, 0] }}
        transition={{
          backgroundColor: { duration: 1 },
          opacity: { duration: 1 },
          x: { duration: 26, repeat: Infinity, ease: "easeInOut" },
          y: { duration: 20, repeat: Infinity, ease: "easeInOut" },
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category marquee — the images, in motion                            */
/* ------------------------------------------------------------------ */

function CategoryMarquee() {
  const { openOrder } = useShell();
  const loop = [...CATEGORIES, ...CATEGORIES];

  return (
    <div
      className="relative -mx-5 w-[calc(100%+2.5rem)] overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, #000 5%, #000 95%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, #000 5%, #000 95%, transparent)",
      }}
    >
      <ul className="flex w-max gap-3 px-5 motion-safe:animate-[slide_48s_linear_infinite] hover:[animation-play-state:paused]">
        {loop.map((c, i) => (
          <li key={`${c.slug}-${i}`}>
            <button
              type="button"
              tabIndex={i < CATEGORIES.length ? 0 : -1}
              aria-hidden={i >= CATEGORIES.length}
              onClick={() => openOrder({ categories: [c.name], need: c.examples[0] })}
              className="group block w-[168px] overflow-hidden rounded-2xl border border-bone-200 bg-white text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:w-[196px]"
            >
              <Image
                src={c.image}
                alt={c.name}
                width={640}
                height={480}
                className="h-[104px] w-full object-cover sm:h-[122px]"
              />
              <span className="block px-3 py-2.5 text-[13px] font-bold text-ink-800">
                {c.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <style>{`@keyframes slide{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  );
}
