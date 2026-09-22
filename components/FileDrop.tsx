"use client";

import { useRef, useState } from "react";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILES,
  MAX_FILE_BYTES,
  humanSize,
  isAllowed,
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
  const [problem, setProblem] = useState<string | null>(null);

  const add = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    setProblem(null);

    const next = [...files];
    const refused: string[] = [];

    for (const file of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        refused.push(`${file.name} (only ${MAX_FILES} files)`);
        continue;
      }
      if (!isAllowed(file.name)) {
        refused.push(`${file.name} (type not accepted)`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        refused.push(`${file.name} (over ${humanSize(MAX_FILE_BYTES)})`);
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
        refused.push(`${file.name} (could not be read)`);
      }
    }

    onChange(next);
    if (refused.length > 0) setProblem(`Not attached: ${refused.join(", ")}`);
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
                onClick={() => onChange(files.filter((_, n) => n !== i))}
                aria-label={`Remove ${f.name}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-bone-200 hover:text-ink-800"
              >
                <Close className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length < MAX_FILES && (
        <label
          htmlFor="request-files"
          className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-bone-300 bg-bone-50 px-4 text-[14.5px] font-semibold text-ink-500 transition-colors hover:border-forest-500 hover:bg-forest-50 hover:text-ink-800"
        >
          <Paperclip className="h-[18px] w-[18px]" />
          {busy
            ? "Reading…"
            : files.length === 0
              ? "Attach a purchase order or spreadsheet"
              : "Attach another"}
        </label>
      )}

      <p className="text-[12.5px] leading-snug text-ink-300">
        PDF, Word, Excel, CSV or photos. Up to {MAX_FILES} files,{" "}
        {humanSize(MAX_FILE_BYTES)} each.
      </p>

      {problem && (
        <p role="alert" className="text-[13px] font-semibold text-clay-400">
          {problem}
        </p>
      )}
    </div>
  );
}
