"use client";

import { useRef, useState } from "react";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  humanSize,
  refusalReason,
  totalBytes,
} from "@/lib/attachments";
import { Close, Paperclip } from "./Icons";

export type PickedFile = { name: string; type: string; size: number; data: string };

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      // strip the "data:<type>;base64," prefix
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });

export function FileDrop({
  files,
  onChange,
}: {
  files: PickedFile[];
  onChange: (files: PickedFile[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [refused, setRefused] = useState<{ name: string; why: string }[]>([]);

  const used = totalBytes(files);
  const left = Math.max(0, MAX_TOTAL_BYTES - used);
  const full = files.length >= MAX_FILES || left === 0;

  const add = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    setRefused([]);

    const next = [...files];
    const turnedAway: { name: string; why: string }[] = [];

    for (const file of Array.from(list)) {
      /*
       * Checked against the file's size BEFORE it is read. Reading a
       * 40MB spreadsheet into memory only to refuse it wastes the
       * buyer's time and, on a phone, sometimes the whole tab.
       */
      const why = refusalReason(file, {
        count: next.length,
        bytes: totalBytes(next),
      });
      if (why) {
        turnedAway.push({ name: file.name, why });
        continue;
      }
      try {
        next.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: await readAsBase64(file),
        });
      } catch {
        turnedAway.push({ name: file.name, why: "it could not be read" });
      }
    }

    onChange(next);
    setRefused(turnedAway);
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2.5">
      <input
        ref={input}
        type="file"
        multiple
        accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")}
        onChange={(e) => add(e.target.files)}
        className="sr-only"
        id="request-files"
      />

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2.5 rounded-xl border border-bone-200 bg-white px-3 py-2.5"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-forest-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink-800">
                  {f.name}
                </span>
                <span className="block text-[12px] text-ink-300">{humanSize(f.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setRefused([]);
                  onChange(files.filter((_, n) => n !== i));
                }}
                aria-label={`Remove ${f.name}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-bone-200 hover:text-ink-800"
              >
                <Close className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <label
          htmlFor="request-files"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void add(e.dataTransfer.files);
          }}
          className={`flex min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed px-4 text-[14.5px] font-semibold transition-colors ${
            dragging
              ? "border-forest-500 bg-forest-50 text-ink-800"
              : "border-bone-300 bg-bone-50 text-ink-500 hover:border-forest-500 hover:bg-forest-50 hover:text-ink-800"
          }`}
        >
          <Paperclip className="h-[18px] w-[18px]" />
          {busy
            ? "Checking…"
            : files.length === 0
              ? "Attach a purchase order or spreadsheet"
              : "Attach another"}
        </label>
      )}

      {/* How much of the budget is gone, so nobody is surprised by a refusal. */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-bone-200">
            <span
              className={`block h-full rounded-full transition-[width] duration-300 ${
                used > MAX_TOTAL_BYTES * 0.9 ? "bg-amber-400" : "bg-forest-500"
              }`}
              style={{ width: `${Math.min(100, (used / MAX_TOTAL_BYTES) * 100)}%` }}
            />
          </span>
          <p className="text-[12.5px] text-ink-400" aria-live="polite">
            {humanSize(used)} of {humanSize(MAX_TOTAL_BYTES)} used
            {full
              ? " — that is the limit."
              : ` · ${humanSize(left)} still free`}
          </p>
        </div>
      )}

      <p className="text-[12.5px] leading-snug text-ink-300">
        PDF, Word, Excel, CSV or photos. Up to {MAX_FILES} files and{" "}
        {humanSize(MAX_FILE_BYTES)} per file, {humanSize(MAX_TOTAL_BYTES)} in
        total. Anything bigger is best sent as a link in your message.
      </p>

      {refused.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border-[1.5px] border-clay-400/40 bg-clay-400/10 px-3.5 py-3"
        >
          <p className="text-[13px] font-bold text-clay-400">
            {refused.length === 1
              ? "One file was not attached"
              : `${refused.length} files were not attached`}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {refused.map((r, i) => (
              <li key={`${r.name}-${i}`} className="text-[13px] leading-snug text-ink-600">
                <span className="font-semibold">{r.name}</span> — {r.why}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
