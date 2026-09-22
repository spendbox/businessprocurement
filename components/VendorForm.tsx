"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BUSINESS_AGE,
  CATEGORY_OPTIONS,
  FULFILMENT_SPEEDS,
  PAYMENT_TERMS,
  VENDOR_ROLES,
} from "@/lib/catalog";
import { COVERAGE_AREAS } from "@/lib/geo";
import { vendorSchema } from "@/lib/schemas";
import { Sheet } from "./Sheet";
import { MultiCombobox } from "./Combobox";
import { PhoneField } from "./PhoneField";
import {
  CheckboxField,
  ChipGroup,
  CountedTextArea,
  Honeypot,
  Reveal,
  SelectField,
  TextArea,
  TextField,
} from "./Field";
import { ArrowLeft, ArrowRight } from "./Icons";
import { Success } from "./OrderForm";

type Draft = {
  company: string;
  rcNumber: string;
  website: string;
  yearsTrading: string;
  categories: string[];
  supplyDescription: string;
  moq: string;
  fulfilmentSpeed: string;
  regions: string[];
  ownLogistics: boolean;
  paymentTerms: string;
  monthlyCapacity: string;
  contactName: string;
  role: string;
  roleOther: string;
  email: string;
  phone: string;
  notes: string;
  honeypot: string;
};

const EMPTY: Draft = {
  company: "",
  rcNumber: "",
  website: "",
  yearsTrading: "",
  categories: [],
  supplyDescription: "",
  moq: "",
  fulfilmentSpeed: "",
  regions: [],
  ownLogistics: false,
  paymentTerms: "",
  monthlyCapacity: "",
  contactName: "",
  role: "",
  roleOther: "",
  email: "",
  phone: "",
  notes: "",
  honeypot: "",
};

const STEPS = [
  { key: "company", title: "Tell us about your company", subtitle: "The basics we check before approving a merchant." },
  { key: "supply", title: "What do you supply?", subtitle: "This decides which purchase requests reach you." },
  { key: "coverage", title: "Coverage and terms", subtitle: "Where you can deliver, and how you like to be paid." },
  { key: "contact", title: "Who should we contact?", subtitle: "The person who will answer requests." },
  { key: "review", title: "One last look", subtitle: "Change anything before it reaches our merchant team." },
] as const;

const FIELDS_BY_STEP: Record<number, (keyof Draft)[]> = {
  0: ["company", "rcNumber", "website", "yearsTrading"],
  1: ["categories", "supplyDescription", "moq", "fulfilmentSpeed"],
  2: ["regions", "paymentTerms", "monthlyCapacity"],
  3: ["contactName", "role", "email", "phone", "notes"],
  4: [],
};

const ease = [0.22, 0.72, 0.18, 1] as const;

export function VendorForm({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(true);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const toggle = (key: "categories" | "regions", value: string) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value)
        ? d[key].filter((v) => v !== value)
        : [...d[key], value],
    }));

  const validateStep = (index: number) => {
    const keys = FIELDS_BY_STEP[index] ?? [];
    if (keys.length === 0) return true;
    const result = vendorSchema.safeParse(draft);
    if (result.success) return true;

    const stepErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (keys.includes(key as keyof Draft) && !stepErrors[key]) {
        stepErrors[key] = issue.message;
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
      const response = await fetch("/api/vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, role: resolvedRole(draft) }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        if (data?.errors) setErrors(data.errors);
        setFormError(
          data?.message ??
            "Something went wrong on our side. Try again in a moment.",
        );
        return;
      }
      setConfirmationSent(data.confirmationSent !== false);
      setReference(data.reference as string);
    } catch {
      setFormError(
        "We could not reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const current = STEPS[step];
  const done = Boolean(reference);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={done ? "Application received" : current.title}
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
                aria-label="Back"
                className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border-[1.5px] border-bone-300 text-ink-500 transition-colors hover:border-ink-800 hover:text-ink-900 disabled:opacity-50"
              >
                <ArrowLeft className="h-[18px] w-[18px]" />
              </button>
            )}
            <button
              type="button"
              onClick={step === STEPS.length - 1 ? submit : next}
              disabled={submitting}
              className="group flex min-h-[52px] flex-1 items-center justify-center gap-2.5 rounded-full bg-ink-900 text-[15px] font-bold text-bone-50 transition-all duration-200 hover:bg-ink-800 disabled:cursor-wait disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-bone-50/35 border-t-bone-50"
                  />{" "}
                  Sending…
                </>
              ) : step === STEPS.length - 1 ? (
                <>
                  Submit application
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
          kind="application"
          confirmationSent={confirmationSent}
        />
      ) : (
        <div className="relative">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={current.key}
              custom={direction}
              initial={{ opacity: 0, x: direction * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -28 }}
              transition={{ duration: 0.32, ease }}
              className="flex flex-col gap-6 pt-1"
            >
              {step === 0 && (
                <>
                  <TextField
                    label="Registered company name"
                    placeholder="Kanem Supplies Ltd"
                    value={draft.company}
                    onChange={(v) => set("company", v)}
                    error={errors.company}
                    autoComplete="organization"
                    autoFocus
                  />

                  <Reveal show={draft.company.trim().length >= 2}>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <TextField
                        label="RC number"
                        optional
                        hint="Speeds up approval."
                        placeholder="RC 1234567"
                        value={draft.rcNumber}
                        onChange={(v) => set("rcNumber", v)}
                        error={errors.rcNumber}
                      />
                      <TextField
                        label="Website or socials"
                        optional
                        placeholder="kanemsupplies.com"
                        value={draft.website}
                        onChange={(v) => set("website", v)}
                        error={errors.website}
                        autoComplete="url"
                      />
                    </div>
                  </Reveal>

                  <Reveal show={draft.company.trim().length >= 2}>
                    <SelectField
                      label="How long have you been trading?"
                      options={BUSINESS_AGE}
                      value={draft.yearsTrading}
                      onChange={(v) => set("yearsTrading", v)}
                      error={errors.yearsTrading}
                    />
                  </Reveal>
                </>
              )}

              {step === 1 && (
                <>
                  <ChipGroup
                    label="Which categories do you supply?"
                    hint="Only pick the ones you can genuinely deliver on — these are the requests you will be sent."
                    options={CATEGORY_OPTIONS}
                    selected={draft.categories}
                    onToggle={(v) => toggle("categories", v)}
                    error={errors.categories}
                  />

                  <Reveal show={draft.categories.length > 0}>
                    <CountedTextArea
                      label="What exactly do you supply?"
                      hint="Brands you carry, whether you manufacture or import, anything that sets you apart."
                      placeholder="We import and distribute medical consumables — gloves, syringes, dressings — from three manufacturers, with a warehouse in Apapa."
                      value={draft.supplyDescription}
                      onChange={(v) => set("supplyDescription", v)}
                      error={errors.supplyDescription}
                      rows={4}
                      minWords={15}
                      idealWords={60}
                    />
                  </Reveal>

                  <Reveal show={draft.supplyDescription.trim().length >= 20}>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <TextField
                        label="Minimum order"
                        optional
                        placeholder="e.g. ₦250,000 or 10 cartons"
                        value={draft.moq}
                        onChange={(v) => set("moq", v)}
                        error={errors.moq}
                      />
                      <SelectField
                        label="Typical fulfilment speed"
                        options={FULFILMENT_SPEEDS}
                        value={draft.fulfilmentSpeed}
                        onChange={(v) => set("fulfilmentSpeed", v)}
                        error={errors.fulfilmentSpeed}
                      />
                    </div>
                  </Reveal>
                </>
              )}

              {step === 2 && (
                <>
                  <MultiCombobox
                    label="Where can you deliver?"
                    hint="Search for every state you can actually reach, not just where you are based."
                    options={COVERAGE_AREAS}
                    selected={draft.regions}
                    onToggle={(v) => toggle("regions", v)}
                    onClear={() => setDraft((d) => ({ ...d, regions: [] }))}
                    placeholder="Search states, or pick Nationwide"
                    error={errors.regions}
                  />

                  <Reveal show={draft.regions.length > 0}>
                    <div className="flex flex-col gap-6">
                      <CheckboxField
                        label="We handle our own delivery"
                        detail="Leave this unticked if you would rather we arrange the logistics."
                        checked={draft.ownLogistics}
                        onChange={(v) => set("ownLogistics", v)}
                      />
                      <SelectField
                        label="Preferred payment terms"
                        options={PAYMENT_TERMS}
                        value={draft.paymentTerms}
                        onChange={(v) => set("paymentTerms", v)}
                        error={errors.paymentTerms}
                      />
                    </div>
                  </Reveal>

                  <Reveal show={Boolean(draft.paymentTerms)}>
                    <TextField
                      label="Rough monthly capacity"
                      optional
                      hint="Helps us size the requests we send you."
                      placeholder="e.g. up to ₦20m of stock per month"
                      value={draft.monthlyCapacity}
                      onChange={(v) => set("monthlyCapacity", v)}
                      error={errors.monthlyCapacity}
                    />
                  </Reveal>
                </>
              )}

              {step === 3 && (
                <>
                  <TextField
                    label="Contact name"
                    placeholder="Musa Bello"
                    value={draft.contactName}
                    onChange={(v) => set("contactName", v)}
                    error={errors.contactName}
                    autoComplete="name"
                    autoFocus
                  />

                  <Reveal show={draft.contactName.trim().length >= 2}>
                    <div className="flex flex-col gap-6">
                      <SelectField
                        label="Role"
                        optional
                        options={VENDOR_ROLES}
                        value={draft.role}
                        onChange={(v) => {
                          set("role", v);
                          if (v !== "Other") set("roleOther", "");
                        }}
                        error={errors.role}
                      />
                      <Reveal show={draft.role === "Other"}>
                        <TextField
                          label="What is your role?"
                          placeholder="e.g. Warehouse lead"
                          value={draft.roleOther}
                          onChange={(v) => set("roleOther", v)}
                          error={errors.roleOther}
                        />
                      </Reveal>
                    </div>
                  </Reveal>

                  <Reveal show={draft.contactName.trim().length >= 2}>
                    <TextField
                      label="Email"
                      type="email"
                      placeholder="musa@kanemsupplies.com"
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
                      countryName={
                        draft.regions.some((r) => r === "Import / outside Nigeria") &&
                        draft.regions.length === 1
                          ? undefined
                          : "Nigeria"
                      }
                      error={errors.phone}
                    />
                  </Reveal>

                  <Reveal show={draft.phone.replace(/\D/g, "").length >= 8}>
                    <TextArea
                      label="Anything else we should know?"
                      optional
                      placeholder="Certifications, notable clients, exclusive distribution rights…"
                      value={draft.notes}
                      onChange={(v) => set("notes", v)}
                      error={errors.notes}
                      rows={3}
                    />
                  </Reveal>
                </>
              )}

              {step === 4 && (
                <VendorReview
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

/** "Other" plus a typed answer beats storing the literal word "Other". */
function resolvedRole(draft: Draft): string {
  if (draft.role === "Other") return draft.roleOther.trim();
  return draft.role;
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

function VendorReview({
  draft,
  onEdit,
}: {
  draft: Draft;
  onEdit: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 pt-1">
      <Group title="Company" onEdit={() => onEdit(0)}>
        <Row label="Name" value={draft.company} />
        <Row label="RC number" value={draft.rcNumber} />
        <Row label="Website" value={draft.website} />
        <Row label="Years trading" value={draft.yearsTrading} />
      </Group>

      <Group title="What you supply" onEdit={() => onEdit(1)}>
        <Row label="Categories" value={draft.categories.join(", ")} />
        <Row label="Description" value={draft.supplyDescription} />
        <Row label="Minimum order" value={draft.moq} />
        <Row label="Fulfilment speed" value={draft.fulfilmentSpeed} />
      </Group>

      <Group title="Coverage and terms" onEdit={() => onEdit(2)}>
        <Row label="Delivers to" value={draft.regions.join(", ")} />
        <Row label="Own logistics" value={draft.ownLogistics ? "Yes" : "No"} />
        <Row label="Payment terms" value={draft.paymentTerms} />
        <Row label="Monthly capacity" value={draft.monthlyCapacity} />
      </Group>

      <Group title="Contact" onEdit={() => onEdit(3)}>
        <Row
          label="Name"
          value={
            draft.contactName +
            (resolvedRole(draft) ? ` (${resolvedRole(draft)})` : "")
          }
        />
        <Row label="Email" value={draft.email} />
        <Row label="Phone" value={draft.phone} />
        <Row label="Notes" value={draft.notes} />
      </Group>

      <p className="px-1 pt-1 text-[13px] leading-relaxed text-ink-400">
        We review new merchants within two working days. There is no fee to
        join and no listing to maintain.
      </p>
    </div>
  );
}
