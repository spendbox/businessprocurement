"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { fieldsIn, fillFields, renderDoc } from "@/lib/doc-render";

/**
 * Editing a document people will receive.
 *
 * Text on the left, exactly what they will see on the right, filled in with
 * a sample person so the {{fields}} read naturally. A field the document
 * does not know is flagged before it can reach anyone.
 */

type MetaField = { key: string; label: string; suffix?: string; hint?: string };

export function DocumentEditor({
  docKey,
  initial,
  original,
  isDefault,
  updatedAt,
  updatedBy,
  fields,
  sample,
  metaFields = [],
}: {
  docKey: "marketer_playbook" | "vendor_mou";
  initial: { title: string; body: string; meta: Record<string, unknown> };
  original: { title: string; body: string };
  isDefault: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  fields: { field: string; means: string }[];
  /** Values to fill the preview with. */
  sample: Record<string, string>;
  metaFields?: MetaField[];
}) {
  const router = useRouter();
  const textarea = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [meta, setMeta] = useState<Record<string, string>>(
    Object.fromEntries(metaFields.map((m) => [m.key, String(initial.meta[m.key] ?? "")])),
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [view, setView] = useState<"both" | "edit" | "preview">("both");

  const known = useMemo(() => new Set(fields.map((f) => f.field)), [fields]);
  const unknown = useMemo(
    () => [...new Set([...fieldsIn(title), ...fieldsIn(body)])].filter((f) => !known.has(f)),
    [title, body, known],
  );

  const preview = useMemo(() => renderDoc(fillFields(body, sample), { size: "page" }), [body, sample]);
  const dirty =
    title !== initial.title ||
    body !== initial.body ||
    metaFields.some((m) => meta[m.key] !== String(initial.meta[m.key] ?? ""));

  /* Puts a {{field}} where the cursor is, rather than making anyone type braces. */
  const insert = (field: string) => {
    const el = textarea.current;
    const token = `{{${field}}}`;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async (reset = false) => {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: docKey,
          title,
          body,
          meta: Object.fromEntries(
            Object.entries(meta).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, Number(v)]),
          ),
          reset,
        }),
      });
      const data = await response.json().catch(() => null);
      setResult({ ok: Boolean(data?.ok), message: data?.message ?? "Could not save." });
      if (data?.ok) {
        if (reset) {
          setTitle(original.title);
          setBody(original.body);
        }
        router.refresh();
      }
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  const field =
    "min-h-[46px] w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-3.5 text-[14.5px] text-ink-800 outline-none transition-colors focus:border-forest-500";

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13.5px] text-ink-400">
        {isDefault
          ? "You are looking at the original text. Save to make it yours."
          : `Last saved ${updatedAt ? new Date(updatedAt).toLocaleString("en-GB") : ""}${
              updatedBy ? ` by ${updatedBy}` : ""
            }.`}
      </p>

      {metaFields.length > 0 && (
        <div className="grid gap-3 rounded-2xl border border-bone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          {metaFields.map((m) => (
            <label key={m.key} className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold uppercase tracking-[0.07em] text-ink-400">
                {m.label}
              </span>
              <span className="flex items-center gap-2">
                <input
                  value={meta[m.key] ?? ""}
                  onChange={(e) => setMeta((all) => ({ ...all, [m.key]: e.target.value }))}
                  inputMode="numeric"
                  className={`${field} tabular-nums`}
                />
                {m.suffix && (
                  <span className="shrink-0 text-[13px] font-semibold text-ink-400">{m.suffix}</span>
                )}
              </span>
              {m.hint && <span className="text-[12px] text-ink-300">{m.hint}</span>}
            </label>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-bold uppercase tracking-[0.07em] text-ink-400">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
      </label>

      <div className="flex w-full gap-1 self-start rounded-xl border border-bone-200 bg-white p-1 sm:w-auto lg:hidden">
        {(["edit", "preview"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg px-4 py-2 text-[13.5px] font-bold capitalize ${
              view === v || (view === "both" && v === "edit")
                ? "bg-ink-900 text-bone-50"
                : "text-ink-500"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={`flex flex-col gap-2 ${view === "preview" ? "hidden lg:flex" : ""}`}>
          <textarea
            ref={textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck
            className="min-h-[560px] w-full rounded-2xl border-[1.5px] border-bone-200 bg-white px-4 py-3.5 font-mono text-[13.5px] leading-relaxed text-ink-800 outline-none transition-colors focus:border-forest-500"
          />
          <p className="text-[12.5px] leading-relaxed text-ink-400">
            <span className="font-mono">#</span> heading ·{" "}
            <span className="font-mono">##</span> smaller heading ·{" "}
            <span className="font-mono">-</span> bullet ·{" "}
            <span className="font-mono">1.</span> numbered ·{" "}
            <span className="font-mono">**bold**</span> ·{" "}
            <span className="font-mono">---</span> line · blank line = new paragraph
          </p>
        </div>

        <div
          className={`rounded-2xl border border-bone-200 bg-white p-6 ${
            view === "edit" || view === "both" ? "hidden lg:block" : ""
          }`}
        >
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-300">
            What they see — filled in with a sample
          </p>
          <div
            className="max-h-[640px] overflow-y-auto"
            /* renderDoc escapes every character of the text before formatting it. */
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      </div>

      {unknown.length > 0 && (
        <p
          role="alert"
          className="rounded-xl border-[1.5px] border-amber-400/50 bg-amber-400/10 px-4 py-3 text-[13.5px] font-semibold text-amber-500"
        >
          Not a field this document knows: {unknown.map((f) => `{{${f}}}`).join(", ")}. It would
          reach people with the braces showing.
        </p>
      )}

      <details className="rounded-2xl border border-bone-200 bg-white">
        <summary className="cursor-pointer px-5 py-4 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
          Fields you can use — click one to insert it
        </summary>
        <ul className="grid gap-1.5 border-t border-bone-200 p-4 sm:grid-cols-2">
          {fields.map((f) => (
            <li key={f.field}>
              <button
                type="button"
                onClick={() => insert(f.field)}
                className="flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-bone-100"
              >
                <span className="shrink-0 font-mono text-[12.5px] font-semibold text-forest-600">
                  {`{{${f.field}}}`}
                </span>
                <span className="text-[12.5px] text-ink-400">{f.means}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={busy || unknown.length > 0 || (!dirty && !isDefault)}
          className="inline-flex min-h-[46px] items-center rounded-full bg-forest-500 px-5 text-[14.5px] font-bold text-white transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {!isDefault && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Throw away your version and go back to the original text?")) {
                void save(true);
              }
            }}
            disabled={busy}
            className="inline-flex min-h-[46px] items-center rounded-full px-4 text-[14px] font-bold text-ink-400 transition-colors hover:text-clay-400"
          >
            Reset to the original
          </button>
        )}
        {dirty && <span className="text-[13px] font-semibold text-amber-500">Unsaved changes</span>}
        {result && (
          <span
            role="status"
            className={`text-[13.5px] font-semibold ${result.ok ? "text-forest-600" : "text-clay-400"}`}
          >
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}
