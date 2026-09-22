"use client";

import { useCallback, useState } from "react";
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
import { Combobox, MultiCombobox } from "./Combobox";
import { PhoneField } from "./PhoneField";
import {
  CheckboxField,
  ChipGroup,
  CountedTextArea,
  Honeypot,
  TextField,
  TextArea,
} from "./Field";
import { StepFooter, useStepper, type Step } from "./Stepper";
import { Check } from "./Icons";
import { Success } from "./Success";

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
  company: "", rcNumber: "", website: "", yearsTrading: "", categories: [],
  supplyDescription: "", moq: "", fulfilmentSpeed: "", regions: [],
  ownLogistics: false, paymentTerms: "", monthlyCapacity: "", contactName: "",
  role: "", roleOther: "", email: "", phone: "", notes: "", honeypot: "",
};

const ease = [0.22, 0.72, 0.18, 1] as const;

/** "Other" plus a typed answer beats storing the literal word "Other". */
function resolvedRole(draft: Draft): string {
  return draft.role === "Other" ? draft.roleOther.trim() : draft.role;
}

export function VendorForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
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
      [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
    }));

  const validate = useCallback(
    (fields: (keyof Draft)[]) => {
      if (fields.length === 0) return true;
      const found: Record<string, string> = {};
      const result = vendorSchema.safeParse({ ...draft, role: resolvedRole(draft) });
      if (!result.success) {
        for (const issue of result.error.issues) {
          const key = String(issue.path[0] ?? "");
          if (fields.includes(key as keyof Draft) && !found[key]) found[key] = issue.message;
        }
      }
      if (fields.includes("role") && draft.role === "Other" && !draft.roleOther.trim()) {
        found.roleOther = "Tell us your role";
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
      const response = await fetch("/api/vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, role: resolvedRole(draft) }),
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

  const steps: Step<Draft>[] = [
    {
      id: "company",
      title: "What is your company called?",
      subtitle: "The name as it is registered.",
      fields: ["company"],
      render: () => (
        <TextField
          label="Registered company name"
          placeholder="Kanem Supplies Ltd"
          value={draft.company}
          onChange={(v) => set("company", v)}
          error={errors.company}
          autoComplete="organization"
          autoFocus
        />
      ),
    },
    {
      id: "registration",
      title: "Do you have an RC number or a website?",
      subtitle: "Either one speeds up approval. Skip if not.",
      fields: ["rcNumber", "website"],
      optional: true,
      render: () => (
        <div className="flex flex-col gap-5">
          <TextField
            label="RC number"
            optional
            placeholder="RC 1234567"
            value={draft.rcNumber}
            onChange={(v) => set("rcNumber", v)}
            error={errors.rcNumber}
            autoFocus
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
      ),
    },
    {
      id: "yearsTrading",
      title: "How long have you been trading?",
      fields: ["yearsTrading"],
      autoAdvance: true,
      render: () => (
        <Combobox
          label="Years trading"
          options={BUSINESS_AGE}
          value={draft.yearsTrading}
          onChange={(v) => {
            set("yearsTrading", v);
            stepper.advanceAfterChoice();
          }}
          error={errors.yearsTrading}
        />
      ),
    },
    {
      id: "categories",
      title: "What do you supply?",
      subtitle: "Only pick what you can genuinely deliver — these are the requests you will be sent.",
      fields: ["categories"],
      render: () => (
        <ChipGroup
          label="Categories"
          options={CATEGORY_OPTIONS}
          selected={draft.categories}
          onToggle={(v) => toggle("categories", v)}
          error={errors.categories}
        />
      ),
    },
    {
      id: "supplyDescription",
      title: "Tell us more about what you supply",
      subtitle: "Brands you carry, whether you manufacture or import, anything that sets you apart.",
      fields: ["supplyDescription"],
      render: () => (
        <CountedTextArea
          label="What exactly do you supply?"
          placeholder="We import and distribute medical consumables — gloves, syringes, dressings — from three manufacturers, with a warehouse in Apapa."
          value={draft.supplyDescription}
          onChange={(v) => set("supplyDescription", v)}
          error={errors.supplyDescription}
          rows={5}
          minWords={15}
          idealWords={60}
          autoFocus
        />
      ),
    },
    {
      id: "fulfilmentSpeed",
      title: "How fast can you fulfil an order?",
      fields: ["fulfilmentSpeed"],
      autoAdvance: true,
      render: () => (
        <Combobox
          label="Typical fulfilment speed"
          options={FULFILMENT_SPEEDS}
          value={draft.fulfilmentSpeed}
          onChange={(v) => {
            set("fulfilmentSpeed", v);
            stepper.advanceAfterChoice();
          }}
          error={errors.fulfilmentSpeed}
        />
      ),
    },
    {
      id: "moq",
      title: "Is there a minimum order?",
      subtitle: "Skip if you have none.",
      fields: ["moq", "monthlyCapacity"],
      optional: true,
      render: () => (
        <div className="flex flex-col gap-5">
          <TextField
            label="Minimum order"
            optional
            placeholder="e.g. ₦250,000 or 10 cartons"
            value={draft.moq}
            onChange={(v) => set("moq", v)}
            error={errors.moq}
            autoFocus
          />
          <TextField
            label="Rough monthly capacity"
            optional
            hint="Helps us size the requests we send you."
            placeholder="e.g. up to ₦20m of stock per month"
            value={draft.monthlyCapacity}
            onChange={(v) => set("monthlyCapacity", v)}
            error={errors.monthlyCapacity}
          />
        </div>
      ),
    },
    {
      id: "regions",
      title: "Where can you deliver?",
      subtitle: "Everywhere you can actually reach, not just where you are based.",
      fields: ["regions"],
      render: () => (
        <div className="flex flex-col gap-5">
          <MultiCombobox
            label="Coverage"
            options={COVERAGE_AREAS}
            selected={draft.regions}
            onToggle={(v) => toggle("regions", v)}
            onClear={() => setDraft((d) => ({ ...d, regions: [] }))}
            placeholder="Search states, or pick Nationwide"
            error={errors.regions}
          />
          <CheckboxField
            label="We handle our own delivery"
            detail="Leave this unticked if you would rather we arrange the logistics."
            checked={draft.ownLogistics}
            onChange={(v) => set("ownLogistics", v)}
          />
        </div>
      ),
    },
    {
      id: "paymentTerms",
      title: "How do you like to be paid?",
      fields: ["paymentTerms"],
      autoAdvance: true,
      render: () => (
        <Combobox
          label="Preferred payment terms"
          options={PAYMENT_TERMS}
          value={draft.paymentTerms}
          onChange={(v) => {
            set("paymentTerms", v);
            stepper.advanceAfterChoice();
          }}
          error={errors.paymentTerms}
        />
      ),
    },
    {
      id: "contactName",
      title: "Who should we contact?",
      subtitle: "The person who will answer requests.",
      fields: ["contactName"],
      render: () => (
        <TextField
          label="Contact name"
          placeholder="Musa Bello"
          value={draft.contactName}
          onChange={(v) => set("contactName", v)}
          error={errors.contactName}
          autoComplete="name"
          autoFocus
        />
      ),
    },
    {
      id: "role",
      title: "What is their role?",
      fields: ["role", "roleOther"],
      optional: true,
      render: () => (
        <div className="flex flex-col gap-5">
          <Combobox
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
          {draft.role === "Other" && (
            <TextField
              label="What is your role?"
              placeholder="e.g. Warehouse lead"
              value={draft.roleOther}
              onChange={(v) => set("roleOther", v)}
              error={errors.roleOther}
              autoFocus
            />
          )}
        </div>
      ),
    },
    {
      id: "email",
      title: "What email should requests go to?",
      subtitle: "Your application is kept against this address, so you can sign in later to check it.",
      fields: ["email"],
      render: () => (
        <TextField
          label="Email"
          type="email"
          placeholder="musa@kanemsupplies.com"
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
      title: "And a phone number?",
      fields: ["phone"],
      render: () => (
        <PhoneField
          value={draft.phone}
          onChange={(v) => set("phone", v)}
          countryName="Nigeria"
          error={errors.phone}
        />
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
          placeholder="Certifications, notable clients, exclusive distribution rights…"
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
      subtitle: "Change anything before it reaches our merchant team.",
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
      title={done ? "Application received" : stepper.step?.title ?? ""}
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
            submitLabel="Submit application"
            tone="ink"
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
          kind="application"
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

function Review({ draft, onEdit }: { draft: Draft; onEdit: (field: keyof Draft) => void }) {
  return (
    <div className="pt-1">
      <dl className="rounded-2xl border border-bone-200 bg-white px-4 sm:px-5">
        <Row label="Company" value={draft.company} onEdit={() => onEdit("company")} />
        <Row label="RC number" value={draft.rcNumber} onEdit={() => onEdit("rcNumber")} />
        <Row label="Website" value={draft.website} onEdit={() => onEdit("website")} />
        <Row label="Years trading" value={draft.yearsTrading} onEdit={() => onEdit("yearsTrading")} />
        <Row label="Supplies" value={draft.categories.join(", ")} onEdit={() => onEdit("categories")} />
        <Row label="Description" value={draft.supplyDescription} onEdit={() => onEdit("supplyDescription")} />
        <Row label="Fulfilment speed" value={draft.fulfilmentSpeed} onEdit={() => onEdit("fulfilmentSpeed")} />
        <Row label="Minimum order" value={draft.moq} onEdit={() => onEdit("moq")} />
        <Row label="Monthly capacity" value={draft.monthlyCapacity} />
        <Row label="Delivers to" value={draft.regions.join(", ")} onEdit={() => onEdit("regions")} />
        <Row label="Own logistics" value={draft.ownLogistics ? "Yes" : "No"} />
        <Row label="Payment terms" value={draft.paymentTerms} onEdit={() => onEdit("paymentTerms")} />
        <Row
          label="Contact"
          value={draft.contactName + (resolvedRole(draft) ? ` (${resolvedRole(draft)})` : "")}
          onEdit={() => onEdit("contactName")}
        />
        <Row label="Email" value={draft.email} onEdit={() => onEdit("email")} />
        <Row label="Phone" value={draft.phone} onEdit={() => onEdit("phone")} />
        <Row label="Notes" value={draft.notes} onEdit={() => onEdit("notes")} />
      </dl>

      <p className="mt-4 flex items-start gap-2.5 px-1 text-[13.5px] leading-relaxed text-ink-400">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-500" />
        We review new merchants within two working days. No fee, no listing to maintain.
      </p>
    </div>
  );
}
