"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ATTACHMENT_TIMING,
  BUDGET_BANDS,
  CATEGORY_OPTIONS,
  URGENCIES,
  urgencyLabel,
  type UrgencyValue,
} from "@/lib/catalog";
import {
  COUNTRY_NAMES,
  DEFAULT_COUNTRY,
  COUNTRIES,
  citiesFor,
  statesFor,
} from "@/lib/geo";
import { conditionalOrderErrors, orderFields } from "@/lib/schemas";
import { Sheet } from "./Sheet";
import { Combobox } from "./Combobox";
import { PhoneField } from "./PhoneField";
import {
  CheckboxField,
  ChipGroup,
  ChoiceCards,
  Honeypot,
  Reveal,
  SelectField,
  TextArea,
  TextField,
  YesNo,
} from "./Field";
import { ArrowLeft, ArrowRight, Check, Spark } from "./Icons";
import type { Prefill } from "./Shell";

type Draft = {
  need: string;
  categories: string[];
  quantity: string;
  hasAttachment: boolean | null;
  attachmentTiming: string;
  attachmentNote: string;
  urgency: UrgencyValue | "";
  hasDeadline: boolean | null;
  neededBy: string;
  country: string;
  region: string;
  city: string;
  address: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  budget: string;
  recurring: boolean;
  notes: string;
  honeypot: string;
};

const defaultCountry =
  COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY)?.name ?? "Nigeria";

const EMPTY: Draft = {
  need: "",
  categories: [],
  quantity: "",
  hasAttachment: null,
  attachmentTiming: "",
  attachmentNote: "",
  urgency: "",
  hasDeadline: null,
  neededBy: "",
  country: defaultCountry,
  region: "",
  city: "",
  address: "",
  company: "",
  contactName: "",
  email: "",
  phone: "",
  budget: "",
  recurring: false,
  notes: "",
  honeypot: "",
};

const STEPS = [
  { key: "need", title: "What do you need?", subtitle: "Describe it however you would say it out loud." },
  { key: "when", title: "How soon, and where?", subtitle: "Urgency is the part that changes how we work your request." },
  { key: "who", title: "Who are we quoting?", subtitle: "So the offers reach the right person." },
  { key: "review", title: "One last look", subtitle: "Change anything before it goes to our sourcing team." },
] as const;

const FIELDS_BY_STEP: Record<number, (keyof Draft)[]> = {
  0: ["need", "categories", "quantity", "hasAttachment", "attachmentTiming", "attachmentNote"],
  1: ["urgency", "hasDeadline", "neededBy", "country", "region", "city", "address"],
  2: ["company", "contactName", "email", "phone", "budget", "notes"],
  3: [],
};

const ease = [0.22, 0.72, 0.18, 1] as const;

export function OrderForm({
  open,
  onClose,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  prefill: Prefill;
}) {
  const [draft, setDraft] = useState<Draft>({
    ...EMPTY,
    need: prefill.need ?? "",
    categories: prefill.categories ?? [],
  });
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(true);

  /* Category suggestion state */
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const pickedByHand = useRef((prefill.categories ?? []).length > 0);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const toggleCategory = (name: string) => {
    pickedByHand.current = true;
    setDraft((d) => ({
      ...d,
      categories: d.categories.includes(name)
        ? d.categories.filter((c) => c !== name)
        : [...d.categories, name],
    }));
    setErrors((e) => (e.categories ? { ...e, categories: "" } : e));
  };

  /*
   * Work out the category from what they typed, so nobody has to scan a
   * list of twelve. Debounced, and it never overrides a choice made by
   * hand — it only fills in the blank.
   */
  useEffect(() => {
    const text = draft.need.trim();
    if (text.length < 12 || pickedByHand.current) {
      setSuggesting(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggesting(true);
      try {
        const response = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        const data = (await response.json()) as { categories?: string[] };
        const picks = Array.isArray(data.categories) ? data.categories : [];
        if (picks.length > 0 && !pickedByHand.current) {
          setSuggested(picks);
          setDraft((d) => ({ ...d, categories: picks }));
        }
      } catch {
        // A missed suggestion is not worth showing anyone an error over.
      } finally {
        setSuggesting(false);
      }
    }, 700);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      setSuggesting(false);
    };
  }, [draft.need]);

  /* Clear the state and city when the country changes under them. */
  useEffect(() => {
    setDraft((d) => {
      if (!d.region && !d.city) return d;
      const states = statesFor(d.country);
      if (states.length > 0 && !states.includes(d.region)) {
        return { ...d, region: "", city: "" };
      }
      return d;
    });
  }, [draft.country]);

  const validateStep = (index: number) => {
    const keys = FIELDS_BY_STEP[index] ?? [];
    if (keys.length === 0) return true;

    const stepErrors: Record<string, string> = {};
    const result = orderFields.safeParse(draft);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (keys.includes(key as keyof Draft) && !stepErrors[key]) {
          stepErrors[key] = issue.message;
        }
      }
    }
    for (const [key, message] of Object.entries(conditionalOrderErrors(draft))) {
      if (keys.includes(key as keyof Draft) && !stepErrors[key]) {
        stepErrors[key] = message;
      }
    }

    if (Object.keys(stepErrors).length === 0) return true;
    setErrors(stepErrors);
    return false;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setDirection(1);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const back = () => {
    setDirection(-1);
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length - 1; i += 1) {
      if (!validateStep(i)) {
        setDirection(-1);
        setStep(i);
        return;
      }
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        if (data?.errors) setErrors(data.errors);
        setFormError(
          data?.message ?? "Something went wrong on our side. Try again in a moment.",
        );
        return;
      }
      setConfirmationSent(data.confirmationSent !== false);
      setReference(data.reference as string);
    } catch {
      setFormError("We could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const current = STEPS[step];
  const done = Boolean(reference);

  const states = statesFor(draft.country);
  const cities = citiesFor(draft.country, draft.region);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={done ? "Request received" : current.title}
      subtitle={done ? undefined : current.subtitle}
      progress={done ? 1 : (step + 1) / STEPS.length}
      scrollKey={done ? "done" : current.key}
      footer={
        done ? (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[52px] w-full rounded-full bg-ink-900 text-[15px] font-bold text-bone-50 transition-colors hover:bg-ink-800"
          >
            Done
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={back}
                disabled={submitting}
                className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border-[1.5px] border-bone-300 text-ink-500 transition-colors hover:border-ink-800 hover:text-ink-900 disabled:opacity-50"
                aria-label="Back"
              >
                <ArrowLeft className="h-[18px] w-[18px]" />
              </button>
            )}
            <button
              type="button"
              onClick={step === STEPS.length - 1 ? submit : next}
              disabled={submitting}
              className="group flex min-h-[52px] flex-1 items-center justify-center gap-2.5 rounded-full bg-forest-500 text-[15px] font-bold text-white transition-all duration-200 hover:bg-forest-600 disabled:cursor-wait disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Spinner /> Sending…
                </>
              ) : step === STEPS.length - 1 ? (
                <>
                  Send my request
                  <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        )
      }
    >
      <Honeypot value={draft.honeypot} onChange={(v) => set("honeypot", v)} />

      {done ? (
        <Success
          reference={reference!}
          email={draft.email}
          urgency={draft.urgency}
          confirmationSent={confirmationSent}
        />
      ) : (
        <div className="relative">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={current.key}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.3, ease }}
              className="flex flex-col gap-6 pt-1"
            >
              {step === 0 && (
                <>
                  <TextArea
                    label="What do you need?"
                    hint="Quantity, size, spec — anything you already know. Plain words are fine."
                    placeholder="e.g. 50 ergonomic office chairs with adjustable arms, delivered to our Ikeja office"
                    value={draft.need}
                    onChange={(v) => set("need", v)}
                    error={errors.need}
                    rows={4}
                    autoFocus
                  />

                  <Reveal show={draft.need.trim().length >= 10}>
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <SuggestionNote
                          busy={suggesting}
                          suggested={suggested}
                          applies={
                            suggested.length > 0 &&
                            !pickedByHand.current &&
                            suggested.every((s) => draft.categories.includes(s))
                          }
                        />
                        <ChipGroup
                          label="Which category is it closest to?"
                          hint="Adjust these if we guessed wrong."
                          options={CATEGORY_OPTIONS}
                          selected={draft.categories}
                          onToggle={toggleCategory}
                          error={errors.categories}
                        />
                      </div>
                    </div>
                  </Reveal>

                  <Reveal show={draft.categories.length > 0}>
                    <div className="flex flex-col gap-6">
                      <TextField
                        label="Quantity or spec reference"
                        optional
                        placeholder="e.g. 50 units, or 'per attached BOQ'"
                        value={draft.quantity}
                        onChange={(v) => set("quantity", v)}
                        error={errors.quantity}
                      />

                      <YesNo
                        label="Do you have a purchase order or spreadsheet?"
                        hint="If you do, we quote against it line by line instead of guessing."
                        value={draft.hasAttachment}
                        onChange={(v) => {
                          set("hasAttachment", v);
                          if (!v) {
                            set("attachmentTiming", "");
                            set("attachmentNote", "");
                          }
                        }}
                        yesLabel="Yes, I have one"
                        noLabel="No, just my description"
                        error={errors.hasAttachment}
                      />
                    </div>
                  </Reveal>

                  <Reveal show={draft.hasAttachment === true}>
                    <div className="flex flex-col gap-6">
                      <ChoiceCards
                        label="When would you like to send it?"
                        options={ATTACHMENT_TIMING.map((t) => ({
                          value: t.value,
                          label: t.label,
                          detail: t.detail,
                        }))}
                        value={draft.attachmentTiming as "now" | "later" | ""}
                        onChange={(v) => set("attachmentTiming", v)}
                        error={errors.attachmentTiming}
                      />
                      <TextField
                        label="What is in the file?"
                        optional
                        hint="A line about it helps us line up the right merchants before it even arrives."
                        placeholder="e.g. a 40-line BOQ in Excel"
                        value={draft.attachmentNote}
                        onChange={(v) => set("attachmentNote", v)}
                        error={errors.attachmentNote}
                      />
                    </div>
                  </Reveal>
                </>
              )}

              {step === 1 && (
                <>
                  <ChoiceCards
                    label="How soon do you need it?"
                    hint="This sets the priority on your request and how hard we push suppliers."
                    options={URGENCIES.map((u) => ({
                      value: u.value,
                      label: u.label,
                      detail: u.detail,
                      heat: u.heat,
                    }))}
                    value={draft.urgency}
                    onChange={(v) => set("urgency", v)}
                    error={errors.urgency}
                  />

                  <Reveal show={Boolean(draft.urgency)}>
                    <YesNo
                      label="Is there a hard deadline?"
                      hint="A date it must be on site by, not just when you would like it."
                      value={draft.hasDeadline}
                      onChange={(v) => {
                        set("hasDeadline", v);
                        if (!v) set("neededBy", "");
                      }}
                      error={errors.hasDeadline}
                    />
                  </Reveal>

                  <Reveal show={draft.hasDeadline === true}>
                    <TextField
                      label="It must be there by"
                      type="date"
                      min={today}
                      value={draft.neededBy}
                      onChange={(v) => set("neededBy", v)}
                      error={errors.neededBy}
                    />
                  </Reveal>

                  <Reveal show={draft.hasDeadline !== null}>
                    <div className="flex flex-col gap-6">
                      <Combobox
                        label="Country"
                        options={COUNTRY_NAMES}
                        value={draft.country}
                        onChange={(v) => set("country", v)}
                        placeholder="Search countries"
                        error={errors.country}
                      />

                      <Combobox
                        label="State or region"
                        options={states}
                        value={draft.region}
                        onChange={(v) => set("region", v)}
                        allowCustom={states.length === 0}
                        placeholder={
                          states.length > 0 ? "Search states" : "Type your state or region"
                        }
                        error={errors.region}
                      />
                    </div>
                  </Reveal>

                  <Reveal show={Boolean(draft.region)}>
                    <div className="flex flex-col gap-6">
                      <Combobox
                        label="City or area"
                        options={cities}
                        value={draft.city}
                        onChange={(v) => set("city", v)}
                        allowCustom
                        placeholder={
                          cities.length > 0 ? "Search cities" : "Type your city"
                        }
                        emptyMessage="Not on the list — type it in full and we will use that."
                        error={errors.city}
                      />
                      <TextField
                        label="Delivery address"
                        optional
                        hint="Only if you already know it — we can collect this later."
                        placeholder="12 Allen Avenue"
                        value={draft.address}
                        onChange={(v) => set("address", v)}
                        error={errors.address}
                        autoComplete="street-address"
                      />
                    </div>
                  </Reveal>
                </>
              )}

              {step === 2 && (
                <>
                  <TextField
                    label="Business name"
                    placeholder="Northgate Logistics Ltd"
                    value={draft.company}
                    onChange={(v) => set("company", v)}
                    error={errors.company}
                    autoComplete="organization"
                    autoFocus
                  />

                  <Reveal show={draft.company.trim().length >= 2}>
                    <TextField
                      label="Your name"
                      placeholder="Ada Okoye"
                      value={draft.contactName}
                      onChange={(v) => set("contactName", v)}
                      error={errors.contactName}
                      autoComplete="name"
                    />
                  </Reveal>

                  <Reveal show={draft.contactName.trim().length >= 2}>
                    <TextField
                      label="Email"
                      type="email"
                      placeholder="ada@northgate.ng"
                      value={draft.email}
                      onChange={(v) => set("email", v)}
                      error={errors.email}
                      autoComplete="email"
                    />
                  </Reveal>

                  <Reveal show={draft.email.includes("@")}>
                    <PhoneField
                      value={draft.phone}
                      onChange={(v) => set("phone", v)}
                      countryName={draft.country}
                      hint="We only call if something about the request needs clarifying."
                      error={errors.phone}
                    />
                  </Reveal>

                  <Reveal show={draft.phone.replace(/\D/g, "").length >= 8}>
                    <div className="flex flex-col gap-6">
                      <SelectField
                        label="Rough budget"
                        optional
                        hint="A band is enough. It helps us bring back offers you would actually accept."
                        options={BUDGET_BANDS}
                        value={draft.budget}
                        onChange={(v) => set("budget", v)}
                        error={errors.budget}
                      />
                      <CheckboxField
                        label="This is a recurring need"
                        detail="Tick this and we will price it as an ongoing supply rather than a one-off."
                        checked={draft.recurring}
                        onChange={(v) => set("recurring", v)}
                      />
                      <TextArea
                        label="Anything else we should know?"
                        optional
                        placeholder="Site access hours, preferred brands, invoicing requirements…"
                        value={draft.notes}
                        onChange={(v) => set("notes", v)}
                        error={errors.notes}
                        rows={3}
                      />
                    </div>
                  </Reveal>
                </>
              )}

              {step === 3 && (
                <Review
                  draft={draft}
                  onEdit={(index) => {
                    setDirection(-1);
                    setStep(index);
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {formError && (
            <p
              role="alert"
              className="mt-5 rounded-xl border-[1.5px] border-clay-400/40 bg-clay-400/10 px-4 py-3 text-[14px] font-semibold text-clay-400"
            >
              {formError}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

function SuggestionNote({
  busy,
  suggested,
  applies,
}: {
  busy: boolean;
  suggested: string[];
  applies: boolean;
}) {
  if (!busy && !applies) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 text-[12.5px] font-semibold text-forest-500"
      aria-live="polite"
    >
      <Spark className="h-4 w-4 shrink-0" />
      {busy
        ? "Reading your request…"
        : `Picked ${suggested.length === 1 ? "this" : "these"} from your description`}
    </motion.p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-bone-200 py-3 last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-300">
        {label}
      </dt>
      <dd className="whitespace-pre-line text-[14.5px] leading-snug text-ink-800">
        {value}
      </dd>
    </div>
  );
}

function Group({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-bone-200 bg-white px-4 py-1 sm:px-5">
      <header className="flex items-center justify-between gap-3 border-b border-bone-200 py-3">
        <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
          {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full px-3 py-1.5 text-[13px] font-bold text-forest-500 transition-colors hover:bg-forest-50"
        >
          Edit
        </button>
      </header>
      <dl>{children}</dl>
    </section>
  );
}

function Review({ draft, onEdit }: { draft: Draft; onEdit: (index: number) => void }) {
  const attachment =
    draft.hasAttachment === true
      ? `Yes — ${
          ATTACHMENT_TIMING.find((t) => t.value === draft.attachmentTiming)?.label ??
          "sending it"
        }${draft.attachmentNote ? ` (${draft.attachmentNote})` : ""}`
      : draft.hasAttachment === false
        ? "No — working from the description"
        : "";

  return (
    <div className="flex flex-col gap-3 pt-1">
      <Group title="What you need" onEdit={() => onEdit(0)}>
        <Row label="Request" value={draft.need} />
        <Row label="Categories" value={draft.categories.join(", ")} />
        <Row label="Quantity / spec" value={draft.quantity} />
        <Row label="Purchase order" value={attachment} />
      </Group>

      <Group title="When and where" onEdit={() => onEdit(1)}>
        <Row label="Urgency" value={draft.urgency ? urgencyLabel(draft.urgency) : ""} />
        <Row
          label="Hard deadline"
          value={draft.hasDeadline ? draft.neededBy : draft.hasDeadline === false ? "No" : ""}
        />
        <Row
          label="Deliver to"
          value={[draft.address, draft.city, draft.region, draft.country]
            .filter(Boolean)
            .join(", ")}
        />
      </Group>

      <Group title="Who we are quoting" onEdit={() => onEdit(2)}>
        <Row label="Business" value={draft.company} />
        <Row label="Contact" value={draft.contactName} />
        <Row label="Email" value={draft.email} />
        <Row label="Phone" value={draft.phone} />
        <Row label="Budget" value={draft.budget} />
        <Row label="Recurring" value={draft.recurring ? "Yes — ongoing supply" : ""} />
        <Row label="Notes" value={draft.notes} />
      </Group>

      <p className="px-1 pt-1 text-[13px] leading-relaxed text-ink-400">
        Sending this costs nothing and does not commit you to buying anything.
        You will get a confirmation email with a reference number straight away.
      </p>
    </div>
  );
}

export function Success({
  reference,
  email,
  urgency,
  kind = "request",
  confirmationSent = true,
}: {
  reference: string;
  email: string;
  urgency?: string;
  kind?: "request" | "application";
  /** False when the confirmation email could not be sent. */
  confirmationSent?: boolean;
}) {
  const promise =
    kind === "application"
      ? "We review new merchants within two working days, then start sending you matching requests."
      : urgency === "same-day"
        ? "You marked this as needed today, so someone will call you within the hour."
        : urgency === "48-hours"
          ? "You marked this as urgent, so we will come back with offers today."
          : "We will come back with the best offers within 24 hours.";

  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <motion.span
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="grid h-16 w-16 place-items-center rounded-full bg-forest-500 text-white"
      >
        <Check className="h-7 w-7" />
      </motion.span>

      <div>
        <h3 className="font-display text-[24px] font-bold tracking-[-0.015em] text-ink-900">
          {kind === "application" ? "You are on the list" : "We have your request"}
        </h3>
        <p className="mx-auto mt-2 max-w-[42ch] text-[15px] leading-relaxed text-ink-500">
          {promise}
        </p>
      </div>

      <div className="w-full rounded-2xl border border-bone-200 bg-white px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-300">
          Your reference
        </p>
        <p className="mt-1 font-mono text-[22px] font-bold tracking-[0.04em] text-ink-900">
          {reference}
        </p>
      </div>

      {confirmationSent ? (
        <p className="max-w-[42ch] text-[13.5px] leading-relaxed text-ink-400">
          A confirmation is on its way to{" "}
          <span className="font-semibold text-ink-700">{email}</span>. If it has
          not landed in a few minutes, check your spam folder.
        </p>
      ) : (
        /* Never promise an email that did not send. */
        <p className="max-w-[44ch] rounded-xl border-[1.5px] border-amber-400/40 bg-amber-400/10 px-4 py-3 text-[13.5px] leading-relaxed text-ink-700">
          We have your {kind === "application" ? "application" : "request"} and our
          team has been notified, but the confirmation email to{" "}
          <span className="font-semibold">{email}</span> did not go through. Keep
          the reference above — it is all we need to find you.
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
    />
  );
}
