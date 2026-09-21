/**
 * Email rendering. Deliberately plain: table layout, inline styles, no
 * web fonts and no external images, because that is what survives Outlook,
 * Gmail's clipper and dark mode.
 */

const INK = "#12211b";
const MUTED = "#5f736a";
const LINE = "#e4e2d8";
const FOREST = "#0f7a52";
const BONE = "#f5f4ed";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Turns newlines in user text into <br> after escaping. */
function multiline(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

export type Row = { label: string; value: unknown; wide?: boolean };

/** A definition list that degrades to stacked rows on a phone. */
export function rows(items: Row[]): string {
  const visible = items.filter(
    (r) => r.value !== undefined && r.value !== null && String(r.value).trim() !== "",
  );
  return visible
    .map(
      (r) => `<tr>
  <td style="padding:12px 0 4px;font:600 11px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};">${escapeHtml(
    r.label,
  )}</td>
</tr>
<tr>
  <td style="padding:0 0 14px;border-bottom:1px solid ${LINE};font:400 16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">${multiline(
    r.value,
  )}</td>
</tr>`,
    )
    .join("");
}

type LayoutOptions = {
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  reference?: string;
  body: string;
  cta?: { label: string; href: string };
  footnote?: string;
};

export function layout(o: LayoutOptions): string {
  const cta = o.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
  <tr><td style="border-radius:999px;background:${FOREST};">
    <a href="${escapeHtml(o.cta.href)}" style="display:inline-block;padding:14px 26px;font:700 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;">${escapeHtml(
      o.cta.label,
    )}</a>
  </td></tr>
</table>`
    : "";

  const reference = o.reference
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 26px;background:${BONE};border:1px solid ${LINE};border-radius:14px;">
  <tr><td style="padding:16px 20px;">
    <div style="font:600 11px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:${MUTED};">Reference</div>
    <div style="margin-top:4px;font:700 22px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${INK};letter-spacing:.04em;">${escapeHtml(
      o.reference,
    )}</div>
  </td></tr>
</table>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(o.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#eceae0;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
    o.preheader,
  )}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eceae0;">
<tr><td align="center" style="padding:32px 16px;">

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">
    <tr><td style="padding:0 4px 18px;">
      <span style="font:800 19px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};letter-spacing:-.02em;">Spendbox</span>
      <span style="font:500 13px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">&nbsp;&nbsp;business procurement</span>
    </td></tr>

    <tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:20px;padding:34px 30px;">
      <div style="font:700 11px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:${FOREST};">${escapeHtml(
        o.eyebrow,
      )}</div>
      <h1 style="margin:10px 0 12px;font:700 28px/1.2 Georgia,'Times New Roman',serif;color:${INK};letter-spacing:-.01em;">${escapeHtml(
        o.heading,
      )}</h1>
      <p style="margin:0 0 24px;font:400 16px/1.62 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">${multiline(
        o.intro,
      )}</p>
      ${reference}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${o.body}</table>
      ${cta}
    </td></tr>

    <tr><td style="padding:20px 6px 0;font:400 13px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">
      ${o.footnote ? `${multiline(o.footnote)}<br><br>` : ""}
      Spendbox &middot; business procurement, handled by people.<br>
      You are receiving this because a request was submitted with this email address.
    </td></tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
}

/** Plain-text fallback, generated from the same rows. */
export function textVersion(
  heading: string,
  reference: string | undefined,
  items: Row[],
): string {
  const lines = [heading, "=".repeat(heading.length), ""];
  if (reference) lines.push(`Reference: ${reference}`, "");
  for (const r of items) {
    if (r.value === undefined || r.value === null || String(r.value).trim() === "")
      continue;
    lines.push(`${r.label}: ${String(r.value).replace(/\s*\n\s*/g, " / ")}`);
  }
  lines.push("", "— Spendbox");
  return lines.join("\n");
}
