"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ATTACHMENT_TIMING,
  BUDGET_BANDS,
  CATEGORY_OPTIONS,
  URGENCIES,
  urgencyLabel,
  type UrgencyValue,
} from "@/lib/catalog";
import { COUNTRIES, COUNTRY_NAMES, DEFAULT_COUNTRY, citiesFor, statesFor } from "@/lib/geo";
import { conditionalOrderErrors, orderFields } from "@/lib/schemas";
import { Sheet } from "./Sheet";
import { Combobox } from "./Combobox";
import { PhoneField } from "./PhoneField";
import {
  CheckboxField,
  ChipGroup,
  ChoiceCards,
  Honeypot,
  TextArea,
  TextField,
  YesNo,
} from "./Field";
import { StepFooter, useStepper, type Step } from "./Stepper";
import { Check, Spark } from "./Icons";
import { Success } from "./Success";
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
  need: "", categories: [], quantity: "", hasAttachment: null,
  attachmentTiming: "", attachmentNote: "", urgency: "", hasDeadline: null,
  neededBy: "", country: defaultCountry, region: "", city: "", address: "",
  company: "", contactName: "", email: "", phone: "", budget: "",
  recurring: false, notes: "", honeypot: "",
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
    company: prefill.company ?? "",
    email: prefill.email ?? "",
    contactName: prefill.contactName ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(true);
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

  /* Work the category out from the description so nobody has to scan a list. */
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
        /* a missed suggestion is not worth an error */
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

  /* A new country invalidates the state and city under it. */
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

  const validate = useCallback(
    (fields: (keyof Draft)[]) => {
      if (fields.length === 0) return true;
      const found: Record<string, string> = {};
      const result = orderFields.safeParse(draft);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = String(issue.path[0] ?? "");
          if (fields.includes(key as keyof Draft) && !found[key]) {
            found[key] = issue.message;
          }
        }
      }
      for (const [key, message] of Object.entries(conditionalOrderErrors(draft))) {
        if (fields.includes(key as keyof Draft) && !found[key]) found[key] = message;
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

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const states = statesFor(draft.country);
  const cities = citiesFor(draft.country, draft.region);

  /* ---------------------------------------------------------------- */
  /* One question per screen                                           */
  /* ---------------------------------------------------------------- */

  const steps: Step<Draft>[] = [
    {
      id: "need",
      title: "What do you need?",
      subtitle: "Describe it however you would say it out loud.",
      fields: ["need"],
      render: () => (
        <TextArea
          label="What do you need?"
          hint="Quantity, size, spec — anything you already know."
          placeholder="e.g. 50 ergonomic office chairs with adjustable arms, delivered to our Ikeja office"
          value={draft.need}
          onChange={(v) => set("need", v)}
          error={errors.need}
          rows={5}
          autoFocus
        />
      ),
    },
    {
      id: "categories",
      title: "What kind of thing is it?",
      subtitle: "Adjust these if we guessed wrong.",
      fields: ["categories"],
      render: () => (
        <div className="flex flex-col gap-3">
          {(suggesting || suggested.length > 0) && (
            <p
              aria-live="polite"
              className="flex items-center gap-2 text-[13px] font-semibold text-forest-500"
            >
              <Spark className="h-4 w-4 shrink-0" />
              {suggesting ? "Reading your request…" : "Picked from your description"}
            </p>
          )}
          <ChipGroup
            label="Category"
            options={CATEGORY_OPTIONS}
            selected={draft.categories}
            onToggle={toggleCategory}
            error={errors.categories}
          />
        </div>
      ),
    },
    {
      id: "quantity",
      title: "How much of it?",
      subtitle: "Skip this if you are not sure yet.",
      fields: ["quantity"],
      optional: true,
      render: () => (
        <TextField
          label="Quantity or spec reference"
          optional
          placeholder="e.g. 50 units, or 'per attached BOQ'"
          value={draft.quantity}
          onChange={(v) => set("quantity", v)}
          error={errors.quantity}
          autoFocus
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
      id: "hasDeadline",
      title: "Is there a hard deadline?",
      subtitle: "A date it must be on site by, not just when you would like it.",
      fields: ["hasDeadline"],
      autoAdvance: true,
      render: () => (
        <YesNo
          label="Hard deadline"
          value={draft.hasDeadline}
          onChange={(v) => {
            set("hasDeadline", v);
            if (!v) set("neededBy", "");
            stepper.advanceAfterChoice();
          }}
          error={errors.hasDeadline}
        />
      ),
    },
    {
      id: "neededBy",
      title: "What date must it be there by?",
      when: (d) => d.hasDeadline === true,
      fields: ["neededBy"],
      render: () => (
        <TextField
          label="On site by"
          type="date"
          min={today}
          value={draft.neededBy}
          onChange={(v) => set("neededBy", v)}
          error={errors.neededBy}
          autoFocus
        />
      ),
    },
    {
      id: "where",
      title: "Where is it going?",
      subtitle: "So we only ask merchants who actually cover that route.",
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
            options={cities}
            value={draft.city}
            onChange={(v) => set("city", v)}
            allowCustom
            disabled={!draft.region}
            disabledHint="Pick a state first."
            placeholder={cities.length > 0 ? "Choose a city" : "Type your city"}
            emptyMessage="Not on the list — type it in full and we will use that."
            error={errors.city}
          />
        </div>
      ),
    },
    {
      id: "address",
      title: "What is the delivery address?",
      subtitle: "Only if you already know it — we can collect this later.",
      fields: ["address"],
      optional: true,
      render: () => (
        <TextField
          label="Address"
          optional
          placeholder="12 Allen Avenue"
          value={draft.address}
          onChange={(v) => set("address", v)}
          error={errors.address}
          autoComplete="street-address"
          autoFocus
        />
      ),
    },
    {
      id: "hasAttachment",
      title: "Do you have a purchase order or spreadsheet?",
      subtitle: "If you do, we quote against it line by line instead of guessing.",
      fields: ["hasAttachment"],
      autoAdvance: true,
      render: () => (
        <YesNo
          label="Purchase order"
          value={draft.hasAttachment}
          onChange={(v) => {
            set("hasAttachment", v);
            if (!v) {
              set("attachmentTiming", "");
              set("attachmentNote", "");
            }
            stepper.advanceAfterChoice();
          }}
          yesLabel="Yes, I have one"
          noLabel="No, just my description"
          error={errors.hasAttachment}
        />
      ),
    },
    {
      id: "attachmentTiming",
      title: "When will you send it?",
      when: (d) => d.hasAttachment === true,
      fields: ["attachmentTiming", "attachmentNote"],
      render: () => (
        <div className="flex flex-col gap-5">
          <ChoiceCards
            label="Sending it"
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
            placeholder="e.g. a 40-line BOQ in Excel"
            value={draft.attachmentNote}
            onChange={(v) => set("attachmentNote", v)}
            error={errors.attachmentNote}
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
      subtitle: "Your request is kept against this address, so you can sign in later and track it.",
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
      id: "budget",
      title: "Roughly what is the budget?",
      subtitle: "A band is enough, and it helps us bring back offers you would accept.",
      fields: ["budget"],
      optional: true,
      render: () => (
        <div className="flex flex-col gap-5">
          <Combobox
            label="Budget"
            optional
            options={BUDGET_BANDS}
            value={draft.budget}
            onChange={(v) => set("budget", v)}
            error={errors.budget}
          />
          <CheckboxField
            label="This is a recurring need"
            detail="We will price it as an ongoing supply rather than a one-off."
            checked={draft.recurring}
            onChange={(v) => set("recurring", v)}
          />
        </div>
      ),
    },
    {
      id: "notes",
      title: "Anything else we should know?",
      fields: ["notes"],
      optional: true,
      render: () => (
        <TextArea
          label="Notes"
          optional
          placeholder="Site access hours, preferred brands, invoicing requirements…"
          value={draft.notes}
          onChange={(v) => set("notes", v)}
          error={errors.notes}
          rows={4}
          autoFocus
        />
      ),
    },
    {
      id: "review",
      title: "One last look",
      subtitle: "Change anything before it goes to our sourcing team.",
      fields: [],
      render: () => <Review draft={draft} onEdit={(f) => stepper.goToField(f)} />,
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

function Row({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
}) {
  if (!value.trim()) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-bone-200 py-3.5 last:border-0">
      <div className="min-w-0">
        <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-300">
          {label}
        </dt>
        <dd className="mt-0.5 whitespace-pre-line text-[15px] leading-snug text-ink-800">
          {value}
        </dd>
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

function Review({
  draft,
  onEdit,
}: {
  draft: Draft;
  onEdit: (field: keyof Draft) => void;
}) {
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
    <div className="pt-1">
      <dl className="rounded-2xl border border-bone-200 bg-white px-4 sm:px-5">
        <Row label="Request" value={draft.need} onEdit={() => onEdit("need")} />
        <Row label="Categories" value={draft.categories.join(", ")} onEdit={() => onEdit("categories")} />
        <Row label="Quantity" value={draft.quantity} onEdit={() => onEdit("quantity")} />
        <Row label="Urgency" value={draft.urgency ? urgencyLabel(draft.urgency) : ""} onEdit={() => onEdit("urgency")} />
        <Row
          label="Hard deadline"
          value={draft.hasDeadline ? draft.neededBy : draft.hasDeadline === false ? "No" : ""}
          onEdit={() => onEdit("hasDeadline")}
        />
        <Row
          label="Deliver to"
          value={[draft.address, draft.city, draft.region, draft.country].filter(Boolean).join(", ")}
          onEdit={() => onEdit("country")}
        />
        <Row label="Purchase order" value={attachment} onEdit={() => onEdit("hasAttachment")} />
        <Row label="Business" value={draft.company} onEdit={() => onEdit("company")} />
        <Row label="Contact" value={draft.contactName} onEdit={() => onEdit("contactName")} />
        <Row label="Email" value={draft.email} onEdit={() => onEdit("email")} />
        <Row label="Phone" value={draft.phone} onEdit={() => onEdit("phone")} />
        <Row label="Budget" value={draft.budget} onEdit={() => onEdit("budget")} />
        <Row label="Recurring" value={draft.recurring ? "Yes — ongoing supply" : ""} />
        <Row label="Notes" value={draft.notes} onEdit={() => onEdit("notes")} />
      </dl>

      <p className="mt-4 flex items-start gap-2.5 px-1 text-[13.5px] leading-relaxed text-ink-400">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-500" />
        Sending this costs nothing and does not commit you to buying anything.
      </p>
    </div>
  );
}
