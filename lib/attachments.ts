import { z } from "zod";

/**
 * Files a buyer attaches to a request.
 *
 * They travel in the JSON body as base64 and are forwarded straight onto
 * the internal email, so the sourcing team opens the real spreadsheet
 * rather than a description of one. No storage bucket to configure, and
 * nothing to clean up later.
 *
 * Limits are deliberately tight: Resend caps a message at 40MB, and a
 * purchase order that will not fit in 8MB is not a purchase order.
 */

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

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

  for (const file of files.slice(0, MAX_FILES)) {
    if (!isAllowed(file.name)) {
      rejected.push({ name: file.name, why: "file type not accepted" });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({ name: file.name, why: `over ${humanSize(MAX_FILE_BYTES)}` });
      continue;
    }
    if (total + file.size > MAX_TOTAL_BYTES) {
      rejected.push({ name: file.name, why: "would exceed the total size limit" });
      continue;
    }
    total += file.size;
    keep.push(file);
  }

  return { keep, rejected };
}
