"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BUDGET_BANDS, CATEGORY_OPTIONS, URGENCIES, urgencyLabel, type UrgencyValue } from "@/lib/catalog";
import { COUNTRIES, COUNTRY_NAMES, DEFAULT_COUNTRY, citiesFor, statesFor } from "@/lib/geo";
import { orderFields } from "@/lib/schemas";
import type { Understanding } from "@/lib/understand";
import { humanSize } from "@/lib/attachments";
import { Sheet } from "./Sheet";
import { Combobox } from "./Combobox";
import { PhoneField } from "./PhoneField";
import { CheckboxField, ChipGroup, ChoiceCards, Honeypot, TextField } from "./Field";
import { SmartComposer } from "./SmartComposer";
import type { PickedFile } from "./FileDrop";
import { StepFooter, useStepper, type Step } from "./Stepper";
import { Check } from "./Icons";
import { Success } from "./Success";
import type { Prefill } from "./Shell";

type Draft = {
  need: string;
  categories: string[];
  quantity: string;
  budget: string;
  urgency: UrgencyValue | "";
  neededBy: string;
  country: string;
  region: string;
  city: string;
  address: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  recurring: boolean;
  attachments: PickedFile[];
  honeypot: string;
};

const defaultCountry =
  COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY)?.name ?? "Nigeria";

const EMPTY: Draft = {
  need: "", categories: [], quantity: "", budget: "", urgency: "", neededBy: "",
  country: defaultCountry, region: "", city: "", address: "", company: "",
  contactName: "", email: "", phone: "", recurring: false, attachments: [],
  honeypot: "",
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(true);

  const [understanding, setUnderstanding] = useState<Understanding | null>(null);
  const [reading, setReading] = useState(false);
  /** Fields the person has corrected by hand are never overwritten again. */
  const [touched, setTouched] = useState<Set<keyof Draft>>(new Set());

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setTouched((t) => new Set(t).add(key));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  /** Applied from the reading, so it must not count as a human edit. */
  const fill = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (touched.has(key) ? d : { ...d, [key]: value }));

  /*
   * Read the request as it is written and fill everything it implies.
   * The person sees what was picked up and can correct any of it; nothing
   * here ever blocks them from sending.
   */
  useEffect(() => {
    const text = draft.need.trim();
    if (text.length < 15) {
      setUnderstanding(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setReading(true);
      try {
        const response = await fetch("/api/understand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        const data = (await response.json()) as Understanding;
        setUnderstanding(data);
        if (data.categories?.length) fill("categories", data.categories);
        if (data.quantity) fill("quantity", data.quantity);
        if (data.budget) fill("budget", data.budget);
        if (data.region) fill("region", data.region);
        if (data.city) fill("city", data.city);
        if (data.urgency) fill("urgency", data.urgency as UrgencyValue);
      } catch {
        /* a missed reading is not worth an error — the words still go through */
      } finally {
        setReading(false);
      }
    }, 800);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      setReading(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.need]);

  /* A new country invalidates the state and city under it. */
  useEffect(() => {
    setDraft((d) => {
      if (!d.region) return d;
      const states = statesFor(d.country);
      if (states.length > 0 && !states.includes(d.region)) {
        return { ...d, region: "", city: "" };
      }
      return d;
    });
  }, [draft.country]);

  const validate = useCallback(
    (fields: (keyof Draft)[]) => {
      if (fields.length === 0) return true;
      const found: Record<string, string> = {};
      const result = orderFields.safeParse({ ...draft, attachments: [] });
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = String(issue.path[0] ?? "");
          if (fields.includes(key as keyof Draft) && !found[key]) {
            found[key] = issue.message;
          }
        }
      }
      if (Object.keys(found).length === 0) return true;
      setErrors(found);
      return false;
    },
    [draft],
  );

  const submit = useCallback(async () => {
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
        setFormError(data?.message ?? "Something went wrong on our side. Try again in a moment.");
        return;
      }
      setConfirmationSent(data.confirmationSent !== false);
      setReference(data.reference as string);
    } catch {
      setFormError("We could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }, [draft]);

  const states = statesFor(draft.country);
  const cities = citiesFor(draft.country, draft.region);

  /* ---------------------------------------------------------------- */

  const steps: Step<Draft>[] = [
    {
      id: "need",
      title: "Tell us what you need",
      subtitle: "One message. We will read it and work out the rest.",
      fields: ["need"],
      render: () => (
        <SmartComposer
          value={draft.need}
          onChange={(v) => {
            setDraft((d) => ({ ...d, need: v }));
            setErrors((e) => (e.need ? { ...e, need: "" } : e));
          }}
          files={draft.attachments}
          onFilesChange={(f) => set("attachments", f)}
          understanding={understanding}
          reading={reading}
          error={errors.need}
        />
      ),
    },
    {
      id: "urgency",
      title: "How soon do you need it?",
      subtitle: "This sets the priority and how hard we push suppliers.",
      fields: ["urgency"],
      autoAdvance: true,
      render: () => (
        <ChoiceCards
          label="How soon"
          options={URGENCIES.map((u) => ({
            value: u.value,
            label: u.label,
            detail: u.detail,
            heat: u.heat,
          }))}
          value={draft.urgency}
          onChange={(v) => {
            set("urgency", v);
            stepper.advanceAfterChoice();
          }}
          error={errors.urgency}
        />
      ),
    },
    {
      id: "where",
      title: "Where is it going?",
      subtitle: understanding?.region
        ? "We picked this up from your message — change it if it is wrong."
        : "So we only ask merchants who cover that route.",
      fields: ["country", "region", "city"],
      render: () => (
        <div className="flex flex-col gap-5">
          <Combobox
            label="Country"
            options={COUNTRY_NAMES}
            value={draft.country}
            onChange={(v) => set("country", v)}
            error={errors.country}
          />
          <Combobox
            label="State or region"
            options={states}
            value={draft.region}
            onChange={(v) => set("region", v)}
            allowCustom={states.length === 0}
            placeholder={states.length > 0 ? "Choose a state" : "Type your state or region"}
            error={errors.region}
          />
          <Combobox
            label="City or area"
            optional
            options={cities}
            value={draft.city}
            onChange={(v) => set("city", v)}
            allowCustom
            disabled={!draft.region}
            disabledHint="Pick a state first."
            placeholder={cities.length > 0 ? "Choose a city" : "Type your city"}
            error={errors.city}
          />
        </div>
      ),
    },
    {
      id: "company",
      title: "What is your business called?",
      fields: ["company"],
      render: () => (
        <TextField
          label="Business name"
          placeholder="Northgate Logistics Ltd"
          value={draft.company}
          onChange={(v) => set("company", v)}
          error={errors.company}
          autoComplete="organization"
          autoFocus
        />
      ),
    },
    {
      id: "contactName",
      title: "And your name?",
      fields: ["contactName"],
      render: () => (
        <TextField
          label="Your name"
          placeholder="Ada Okoye"
          value={draft.contactName}
          onChange={(v) => set("contactName", v)}
          error={errors.contactName}
          autoComplete="name"
          autoFocus
        />
      ),
    },
    {
      id: "email",
      title: "Where should the offers go?",
      fields: ["email"],
      render: () => (
        <TextField
          label="Email"
          type="email"
          placeholder="ada@northgate.ng"
          value={draft.email}
          onChange={(v) => set("email", v)}
          error={errors.email}
          autoComplete="email"
          autoFocus
        />
      ),
    },
    {
      id: "phone",
      title: "What number can we reach you on?",
      subtitle: "We only call if something needs clarifying.",
      fields: ["phone"],
      render: () => (
        <PhoneField
          value={draft.phone}
          onChange={(v) => set("phone", v)}
          countryName={draft.country}
          error={errors.phone}
        />
      ),
    },
    {
      id: "review",
      title: "One last look",
      subtitle: "Correct anything we read wrongly before it goes out.",
      fields: [],
      render: () => (
        <Review
          draft={draft}
          onSet={set}
          onEdit={(f) => stepper.goToField(f)}
          states={states}
        />
      ),
    },
  ];

  const stepper = useStepper<Draft>({ steps, draft, validate, onFinish: submit });
  const done = Boolean(reference);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={done ? "Request received" : stepper.step?.title ?? ""}
      subtitle={done ? undefined : stepper.step?.subtitle}
      progress={done ? 1 : stepper.progress}
      stepLabel={done ? undefined : `${stepper.index + 1} of ${stepper.total}`}
      scrollKey={done ? "done" : stepper.step?.id}
      footer={
        done ? (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[56px] w-full rounded-full bg-ink-900 text-[16px] font-bold text-bone-50 transition-colors hover:bg-ink-800"
          >
            Done
          </button>
        ) : (
          <StepFooter
            stepper={stepper}
            submitting={submitting}
            submitLabel="Send my request"
            onSubmit={submit}
          />
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stepper.step?.id}
              initial={{ opacity: 0, x: stepper.direction * 22 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: stepper.direction * -22 }}
              transition={{ duration: 0.26, ease }}
              className="pt-1"
            >
              {stepper.step?.render()}
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

function Row({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  if (!value.trim()) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-bone-200 py-3.5 last:border-0">
      <div className="min-w-0">
        <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-300">{label}</dt>
        <dd className="mt-0.5 whitespace-pre-line text-[15px] leading-snug text-ink-800">{value}</dd>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-full px-3 py-1.5 text-[13.5px] font-bold text-forest-500 transition-colors hover:bg-forest-50"
        >
          Edit
        </button>
      )}
    </div>
  );
}

/**
 * The review doubles as the correction screen for everything that was read
 * out of the message rather than typed — category, quantity and budget are
 * editable right here, so a wrong reading costs one tap.
 */
function Review({
  draft,
  onSet,
  onEdit,
  states,
}: {
  draft: Draft;
  onSet: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  onEdit: (field: keyof Draft) => void;
  states: string[];
}) {
  const toggleCategory = (name: string) =>
    onSet(
      "categories",
      draft.categories.includes(name)
        ? draft.categories.filter((c) => c !== name)
        : [...draft.categories, name],
    );

  return (
    <div className="flex flex-col gap-5 pt-1">
      <dl className="rounded-2xl border border-bone-200 bg-white px-4 sm:px-5">
        <Row label="Your message" value={draft.need} onEdit={() => onEdit("need")} />
        <Row
          label="Attached"
          value={draft.attachments.map((f) => `${f.name} (${humanSize(f.size)})`).join("\n")}
          onEdit={() => onEdit("need")}
        />
        <Row label="How soon" value={draft.urgency ? urgencyLabel(draft.urgency) : ""} onEdit={() => onEdit("urgency")} />
        <Row
          label="Deliver to"
          value={[draft.address, draft.city, draft.region, draft.country].filter(Boolean).join(", ")}
          onEdit={() => onEdit("country")}
        />
        <Row label="Business" value={draft.company} onEdit={() => onEdit("company")} />
        <Row label="Contact" value={draft.contactName} onEdit={() => onEdit("contactName")} />
        <Row label="Email" value={draft.email} onEdit={() => onEdit("email")} />
        <Row label="Phone" value={draft.phone} onEdit={() => onEdit("phone")} />
      </dl>

      <div className="rounded-2xl border border-bone-200 bg-white p-4 sm:p-5">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
          What we read from your message
        </p>
        <p className="mt-1 text-[13px] leading-snug text-ink-400">
          Correct anything that is wrong — or leave it, we will confirm when we
          call.
        </p>

        <div className="mt-4 flex flex-col gap-5">
          <ChipGroup
            label="Category"
            options={CATEGORY_OPTIONS}
            selected={draft.categories}
            onToggle={toggleCategory}
          />
          <TextField
            label="Quantity"
            optional
            placeholder="e.g. 50 units"
            value={draft.quantity}
            onChange={(v) => onSet("quantity", v)}
          />
          <Combobox
            label="Budget"
            optional
            options={BUDGET_BANDS}
            value={draft.budget}
            onChange={(v) => onSet("budget", v)}
          />
          <CheckboxField
            label="This is a recurring need"
            detail="We will price it as an ongoing supply rather than a one-off."
            checked={draft.recurring}
            onChange={(v) => onSet("recurring", v)}
          />
          {states.length > 0 && !draft.region && (
            <p className="text-[13px] font-semibold text-clay-400">
              We could not tell where this is going — go back and pick a state.
            </p>
          )}
        </div>
      </div>

      <p className="flex items-start gap-2.5 px-1 text-[13.5px] leading-relaxed text-ink-400">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-500" />
        Sending this costs nothing and does not commit you to buying anything.
      </p>
    </div>
  );
}
