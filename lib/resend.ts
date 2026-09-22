import { Resend } from "resend";

let client: Resend | null = null;

/** Lazily built so a missing key never breaks the build or a cold start. */
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

function internalRecipients(): string[] {
  return (process.env.EMAIL_TO_INTERNAL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** Files forwarded verbatim; `content` is base64 without a data: prefix. */
  attachments?: { filename: string; content: string }[];
};

export type SendResult = { ok: boolean; id?: string; error?: string };

async function send(args: SendArgs): Promise<SendResult> {
  const resend = getClient();
  if (!resend) return { ok: false, error: "RESEND_API_KEY is not set" };

  const from = process.env.EMAIL_FROM ?? "Spendbox <onboarding@resend.dev>";

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
      ...(args.attachments?.length ? { attachments: args.attachments } : {}),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

/** To our own team. Silently skipped if no internal address is configured. */
export async function sendInternal(
  args: Omit<SendArgs, "to">,
): Promise<SendResult> {
  const to = internalRecipients();
  if (to.length === 0)
    return { ok: false, error: "EMAIL_TO_INTERNAL is not set" };
  return send({ ...args, to });
}

/** To the person who filled the form. */
export async function sendToCustomer(args: SendArgs): Promise<SendResult> {
  return send({
    ...args,
    replyTo: args.replyTo ?? process.env.EMAIL_REPLY_TO,
  });
}
