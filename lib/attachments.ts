import { z } from "zod";

/**
 * Files a buyer attaches to a request.
 *
 * They travel in the JSON body as base64 and are forwarded straight onto
 * the internal email, so the sourcing team opens the real spreadsheet
 * rather than a description of one. No storage bucket to configure, and
 * nothing to clean up later.
 *
 * Limits are deliberately tight: base64 inflates a file by a third on the
 * way up, Resend caps a message at 40MB, and a purchase order that will not
 * fit in 5MB is not a purchase order. Everything is measured in the browser
 * before a single byte is read, so an oversized file is refused on the spot
 * rather than after a long upload.
 */

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

/** What a buyer would actually send. Anything executable is refused. */
export const ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "rtf",
  "png", "jpg", "jpeg", "webp", "heic", "zip",
] as const;

export const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.string().trim().max(120).optional().or(z.literal("")),
  size: z.number().int().nonnegative().max(MAX_FILE_BYTES),
  /** base64, without any data: prefix. */
  data: z.string().max(Math.ceil(MAX_FILE_BYTES * 1.4)),
});

export type Attachment = z.infer<typeof attachmentSchema>;

export const attachmentsSchema = z
  .array(attachmentSchema)
  .max(MAX_FILES)
  .optional()
  .default([]);

export function extensionOf(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export const isAllowed = (name: string) =>
  (ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(name));

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Bytes already picked, so the next file can be checked against the budget. */
export const totalBytes = (files: { size: number }[]): number =>
  files.reduce((sum, f) => sum + f.size, 0);

/** Roughly what the JSON body weighs once base64 has inflated the files. */
export const encodedBytes = (files: { size: number }[]): number =>
  Math.ceil(totalBytes(files) * 1.37);

/**
 * The one place that decides whether a file may be attached. The browser
 * asks before reading the file, and the server asks again before emailing,
 * so the same sentence explains the refusal in both places.
 */
export function refusalReason(
  file: { name: string; size: number },
  already: { count: number; bytes: number },
): string | null {
  if (already.count >= MAX_FILES) return `only ${MAX_FILES} files can be attached`;
  if (!isAllowed(file.name)) return "that file type is not accepted";
  if (file.size === 0) return "the file is empty";
  if (file.size > MAX_FILE_BYTES)
    return `it is ${humanSize(file.size)} — the limit is ${humanSize(MAX_FILE_BYTES)}`;
  if (already.bytes + file.size > MAX_TOTAL_BYTES)
    return `it would take the request over ${humanSize(MAX_TOTAL_BYTES)} in total`;
  return null;
}

/**
 * Drops anything oversized or of a type we do not accept, and reports what
 * went. A bad file must never cost the buyer their whole request.
 */
export function acceptable(files: Attachment[]): {
  keep: Attachment[];
  rejected: { name: string; why: string }[];
} {
  const keep: Attachment[] = [];
  const rejected: { name: string; why: string }[] = [];
  let total = 0;

  for (const file of files) {
    const why = refusalReason(file, { count: keep.length, bytes: total });
    if (why) {
      rejected.push({ name: file.name, why });
      continue;
    }
    total += file.size;
    keep.push(file);
  }

  return { keep, rejected };
}
