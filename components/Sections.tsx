"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { CATEGORIES, URGENCIES } from "@/lib/catalog";
import { useShell } from "./Shell";
import { ArrowRight, ArrowUpRight, Chevron, Storefront } from "./Icons";
import { Logo } from "./Logo";

const ease = [0.22, 0.72, 0.18, 1] as const;

/** Reveal-on-scroll wrapper used by every section below the stage. */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-[680px] text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-500">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-[clamp(28px,5.2vw,44px)] font-bold leading-[1.08] tracking-[-0.025em] text-ink-900 text-balance">
        {title}
      </h2>
      {sub && (
        <p className="mx-auto mt-4 max-w-[54ch] text-pretty text-[16px] leading-relaxed text-ink-500">
          {sub}
        </p>
      )}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* What we source — the full picture gallery                           */
/* ------------------------------------------------------------------ */

export function CategoryGallery() {
  const { openOrder } = useShell();

  return (
    <section id="catalog" className="relative scroll-mt-20 bg-bone-100 px-5 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          eyebrow="What we source"
          title="Twelve categories. One way to ask."
          sub="Pick the one closest to what you need — or ignore these entirely and just describe it. Nothing here is a catalog; it is only a starting point."
        />

        <ul className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c, i) => (
            <li key={c.slug}>
              <Reveal delay={Math.min(i, 7) * 0.04}>
                <button
                  type="button"
                  onClick={() =>
                    openOrder({ categories: [c.name], need: c.examples[0] })
                  }
                  className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-bone-200 bg-white text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-forest-200 hover:shadow-lift"
                >
                  <span className="relative block overflow-hidden">
                    <Image
                      src={c.image}
                      alt=""
                      width={640}
                      height={480}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                    />
                    <span
                      aria-hidden
                      className="absolute right-2.5 top-2.5 grid h-8 w-8 translate-y-1 place-items-center rounded-full bg-white/95 text-forest-500 opacity-0 shadow-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col gap-1 p-3.5 sm:p-4">
                    <span className="text-[14.5px] font-bold leading-tight text-ink-900">
                      {c.name}
                    </span>
                    <span className="text-[12.5px] leading-snug text-ink-400">
                      {c.blurb}
                    </span>
                    <span className="mt-2 text-[12px] font-semibold italic text-ink-300">
                      “{c.examples[0]}”
                    </span>
                  </span>
                </button>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal delay={0.1}>
          <p className="mt-10 text-center text-[15px] text-ink-400">
            Not on this list?{" "}
            <button
              type="button"
              onClick={() => openOrder()}
              className="font-bold text-forest-500 underline decoration-forest-200 decoration-2 underline-offset-4 transition-colors hover:text-forest-600"
            >
              Ask anyway
            </button>
            . We source most of it.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works, including how urgency changes things                  */
/* ------------------------------------------------------------------ */

const TIMELINE = [
  {
    n: "01",
    title: "Tell us what you need",
    body: "One field, plain words. Attach a purchase order or spreadsheet if you already have one — we will work straight from it.",
    aside: "Takes about 90 seconds",
  },
  {
    n: "02",
    title: "Say how soon you need it",
    body: "Urgency changes how we work the request. Needed today gets a phone call within the hour; a planned purchase gets more time to find a better price.",
    aside: "This is the field that matters most",
  },
  {
    n: "03",
    title: "We source and compare",
    body: "Your request goes to vetted merchants in that category. We push on price, check stock and confirm they can actually deliver where you are.",
    aside: "You do nothing during this part",
  },
  {
    n: "04",
    title: "You pick an offer",
    body: "A short list of real prices with delivery times, not a thousand listings. Choose one and we handle the order, the delivery and the paperwork.",
    aside: "One contact, however many suppliers",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      className="relative scroll-mt-20 overflow-hidden bg-ink-900 px-5 py-24 text-bone-100 sm:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[10%] top-[10%] h-[40vmax] w-[40vmax] rounded-full bg-forest-500/20 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[12%] bottom-[5%] h-[34vmax] w-[34vmax] rounded-full bg-amber-400/10 blur-[100px]"
      />

      <div className="relative mx-auto max-w-5xl">
        <Reveal className="max-w-[640px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-200">
            How it works
          </p>
          <h2 className="mt-3 font-display text-[clamp(28px,5.2vw,46px)] font-bold leading-[1.08] tracking-[-0.025em] text-balance">
            Four steps, and three of them are ours.
          </h2>
        </Reveal>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-2">
          {TIMELINE.map((t, i) => (
            <li key={t.n} className="bg-ink-900">
              <Reveal delay={i * 0.06} className="h-full">
                <div className="flex h-full flex-col gap-3 p-7 sm:p-9">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-forest-500 font-display text-[13px] font-bold text-white">
                      {t.n}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-forest-200">
                      {t.aside}
                    </span>
                  </div>
                  <h3 className="font-display text-[21px] font-bold leading-tight tracking-[-0.015em]">
                    {t.title}
                  </h3>
                  <p className="text-[14.5px] leading-relaxed text-bone-300/85">
                    {t.body}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>

        {/* urgency legend */}
        <Reveal delay={0.1}>
          <div className="mt-12 rounded-3xl border border-white/12 bg-white/[0.04] p-7 sm:p-9">
            <h3 className="font-display text-[20px] font-bold tracking-[-0.015em]">
              What each urgency actually means
            </h3>
            <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {URGENCIES.map((u) => (
                <li key={u.value} className="flex items-start gap-3.5">
                  <span aria-hidden className="mt-1.5 flex w-14 shrink-0 gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <i
                        key={n}
                        className={`h-1 flex-1 rounded-full ${
                          n <= u.heat ? "bg-amber-400" : "bg-white/15"
                        }`}
                      />
                    ))}
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-bold">{u.label}</span>
                    <span className="block text-[13px] text-bone-300/75">
                      {u.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* For vendors                                                         */
/* ------------------------------------------------------------------ */

const VENDOR_POINTS = [
  {
    title: "No storefront to build",
    body: "No listings, no photos, no shop page to keep updated. You exist in our system the moment you are approved.",
  },
  {
    title: "Real requests, not leads",
    body: "Every request we send you is a business that has already told us what they need and when they need it.",
  },
  {
    title: "You quote, they choose",
    body: "Reply with your best price and lead time. If the buyer picks you, we handle the paperwork and the payment.",
  },
];

export function VendorPitch() {
  const { openVendor } = useShell();

  return (
    <section
      id="vendors"
      className="relative scroll-mt-20 bg-bone-100 px-5 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
          <Reveal>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-forest-500">
              For merchants
            </p>
            <h2 className="mt-3 font-display text-[clamp(28px,5.2vw,46px)] font-bold leading-[1.08] tracking-[-0.025em] text-ink-900 text-balance">
              Sell to businesses without building a shop.
            </h2>
            <p className="mt-4 max-w-[52ch] text-pretty text-[16px] leading-relaxed text-ink-500">
              If you supply anything on this page, fill the merchant form. Once you
              are approved we start sending you purchase requests that match your
              categories and your delivery area.
            </p>

            <ul className="mt-8 flex flex-col gap-5">
              {VENDOR_POINTS.map((p) => (
                <li key={p.title} className="flex items-start gap-3.5">
                  <span
                    aria-hidden
                    className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest-500 text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12.5l5 5L20 6.5" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-[15.5px] font-bold text-ink-900">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-[14px] leading-relaxed text-ink-500">
                      {p.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={openVendor}
              className="group mt-9 inline-flex min-h-[54px] items-center gap-2.5 rounded-full bg-ink-900 px-7 text-[15.5px] font-bold text-bone-50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <Storefront className="h-[18px] w-[18px]" />
              Open the merchant form
              <ArrowRight className="h-4.5 w-4.5 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="relative rounded-[28px] border border-bone-200 bg-white p-2 shadow-lift">
              <div className="rounded-[22px] bg-bone-50 p-5 sm:p-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-300">
                  A request in your inbox
                </p>
                <div className="mt-4 rounded-2xl border border-bone-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-500">
                      In 1–2 days
                    </span>
                    <span className="font-mono text-[12px] text-ink-300">SPB-7F3M-QK2</span>
                  </div>
                  <p className="mt-4 font-display text-[19px] font-bold leading-snug tracking-[-0.01em] text-ink-900">
                    200 boxes of nitrile gloves, size M
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-bone-200 pt-4">
                    {[
                      ["Deliver to", "Ikeja, Lagos"],
                      ["Category", "PPE & safety"],
                      ["Budget band", "₦500,000 – ₦2m"],
                      ["Recurring", "Yes, monthly"],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-300">
                          {k}
                        </dt>
                        <dd className="mt-0.5 text-[13.5px] font-semibold text-ink-800">
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex gap-2">
                    <span className="flex-1 rounded-full bg-forest-500 py-2.5 text-center text-[13.5px] font-bold text-white">
                      Send my price
                    </span>
                    <span className="rounded-full border-[1.5px] border-bone-200 px-4 py-2.5 text-[13.5px] font-bold text-ink-400">
                      Pass
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-center text-[12.5px] text-ink-300">
                  Illustration of a merchant request
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

const FAQS = [
  {
    q: "Do I need an account to send a request?",
    a: "No. The form asks for your business name and a way to reach you, and that is it. You get a reference number by email straight away.",
  },
  {
    q: "What does it cost the buyer?",
    a: "Sending a request costs nothing, and you are never obliged to accept an offer. Our margin sits in the price you are quoted, so what you see is what you pay.",
  },
  {
    q: "How fast is 'urgent'?",
    a: "If you mark a request as needed today, someone calls you within the hour. Marked as one to two days, we come back with offers the same working day. Everything else is within 24 hours.",
  },
  {
    q: "Can you deliver outside Lagos?",
    a: "Yes. Tell us the city and state in the form and we match you to merchants who actually cover that route, including sites outside the main cities.",
  },
  {
    q: "I already have a purchase order. Can you just work from that?",
    a: "That is the fastest route. Mention it in the request and we will reply to collect the file, then quote line by line against it.",
  },
  {
    q: "How do you vet merchants?",
    a: "Every merchant fills the same application you can open from this page. We check registration, references and delivery capacity before any request reaches them.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 bg-bone-200/50 px-5 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl">
        <SectionHead eyebrow="Questions" title="The things people ask first." />

        <ul className="mt-12 flex flex-col gap-2.5">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <li key={f.q}>
                <Reveal delay={Math.min(i, 5) * 0.04}>
                  <div className="overflow-hidden rounded-2xl border border-bone-200 bg-white">
                    <h3>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                      >
                        <span className="text-[15.5px] font-bold text-ink-900">
                          {f.q}
                        </span>
                        <Chevron
                          className={`h-4.5 w-4.5 shrink-0 text-ink-400 transition-transform duration-300 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </h3>
                    <motion.div
                      initial={false}
                      animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                      transition={{ duration: 0.34, ease }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-ink-500 sm:px-6 sm:pb-6">
                        {f.a}
                      </p>
                    </motion.div>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Closing call to action + footer                                     */
/* ------------------------------------------------------------------ */

export function Closer() {
  const { openOrder, openVendor } = useShell();

  return (
    <section className="bg-bone-100 px-5 pb-36 pt-24 sm:pb-40 sm:pt-32">
      <Reveal className="mx-auto max-w-[720px] text-center">
        <h2 className="font-display text-[clamp(30px,6vw,52px)] font-bold leading-[1.06] tracking-[-0.028em] text-ink-900 text-balance">
          Tell us what you need. We will come back with the best offers.
        </h2>
        <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-relaxed text-ink-500">
          No account, no catalog, no obligation to buy.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => openOrder()}
            className="group inline-flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-full bg-forest-500 px-7 text-[15.5px] font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-forest-600 hover:shadow-lift sm:w-auto"
          >
            Place a request
            <ArrowRight className="h-4.5 w-4.5 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
          <button
            type="button"
            onClick={openVendor}
            className="inline-flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-full border-[1.5px] border-bone-300 px-7 text-[15.5px] font-bold text-ink-800 transition-all duration-200 hover:border-ink-900 hover:bg-white sm:w-auto"
          >
            <Storefront className="h-[18px] w-[18px]" />
            I&apos;m a vendor
          </button>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  const { openOrder, openVendor } = useShell();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-bone-200 bg-bone-100 px-5 pb-28 pt-12 sm:pb-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo />
          <p className="mt-1.5 max-w-[34ch] text-[13.5px] leading-relaxed text-ink-400">
            Business procurement, handled by people. One message is the whole
            process.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-[14px]">
          <a href="#how" className="font-semibold text-ink-500 transition-colors hover:text-ink-900">
            How it works
          </a>
          <a href="#catalog" className="font-semibold text-ink-500 transition-colors hover:text-ink-900">
            What we source
          </a>
          <a href="#faq" className="font-semibold text-ink-500 transition-colors hover:text-ink-900">
            Questions
          </a>
          <button
            type="button"
            onClick={openVendor}
            className="font-semibold text-ink-500 transition-colors hover:text-ink-900"
          >
            For vendors
          </button>
          <button
            type="button"
            onClick={() => openOrder()}
            className="font-semibold text-forest-500 transition-colors hover:text-forest-600"
          >
            Place a request
          </button>
        </nav>
      </div>

      <p className="mx-auto mt-10 max-w-6xl text-[12.5px] text-ink-300">
        © {year} Spendbox · spendbox.site
      </p>
    </footer>
  );
}
