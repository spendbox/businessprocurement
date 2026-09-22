/**
 * Documents written in plain text, rendered properly.
 *
 * The playbook and the agreement are edited in a text box by people who
 * should never have to see HTML. So they are written in the smallest useful
 * format — the one people already type in messages:
 *
 *   # Heading          ## Smaller heading      ### Smaller still
 *   - a bullet         1. a numbered point     --- a dividing line
 *   **bold words**     a blank line starts a new paragraph
 *
 * and {{merge_fields}} are filled in per person before rendering.
 *
 * Everything is escaped BEFORE any formatting is applied, so nothing typed
 * into a document — or into a name that gets merged into one — can become
 * markup. The output uses inline styles only, so the same HTML survives an
 * email client, a web page and a printer. No imports: this runs in the
 * browser for live preview as well as on the server.
 */

const INK = "#12211b";
const MUTED = "#5f736a";
const LINE = "#e4e2d8";
const FOREST = "#0f7a52";

const FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

export function escapeText(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ------------------------------------------------------------------ */
/* Merge fields                                                        */
/* ------------------------------------------------------------------ */

const FIELD = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/**
 * Fills {{fields}} in. A field with no value is left showing, braces and
 * all, so a typo in a template is obvious in the preview instead of
 * silently becoming a blank in someone's inbox.
 */
export function fillFields(text: string, values: Record<string, string | number | null | undefined>): string {
  return text.replace(FIELD, (whole, key: string) => {
    const value = values[key.toLowerCase()];
    return value === undefined || value === null ? whole : String(value);
  });
}

/** The fields a piece of text uses, for "you have not filled in…" warnings. */
export function fieldsIn(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(FIELD)) found.add(match[1].toLowerCase());
  return [...found];
}

/** Fields still in the text after filling — i.e. ones nothing supplied. */
export const unfilled = (text: string): string[] => fieldsIn(text);

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

/** Bold, after escaping. The only inline formatting there is. */
function inline(text: string): string {
  return escapeText(text).replace(
    /\*\*(.+?)\*\*/g,
    `<strong style="font-weight:700;color:${INK};">$1</strong>`,
  );
}

type Block =
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "hr" };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");

  let paragraph: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "p", lines: paragraph });
    if (list) blocks.push(list);
    paragraph = [];
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flush();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({
        kind: "h",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      flush();
      blocks.push({ kind: "hr" });
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      if (paragraph.length) {
        blocks.push({ kind: "p", lines: paragraph });
        paragraph = [];
      }
      if (!list || list.kind !== kind) {
        if (list) blocks.push(list);
        list = { kind, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }

    /* An indented line straight after a list item continues that item. */
    if (list && /^\s{2,}/.test(raw) && list.items.length) {
      list.items[list.items.length - 1] += ` ${trimmed}`;
      continue;
    }

    if (list) {
      blocks.push(list);
      list = null;
    }
    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}

export type RenderOptions = {
  /** Slightly larger type for a page than for an email. */
  size?: "email" | "page";
};

/** The document as HTML. Safe to drop straight into an email or a page. */
export function renderDoc(source: string, options: RenderOptions = {}): string {
  const body = options.size === "page" ? 16 : 15.5;

  return parse(source)
    .map((block) => {
      switch (block.kind) {
        case "h": {
          const size = block.level === 1 ? 24 : block.level === 2 ? 18.5 : 15.5;
          const top = block.level === 1 ? 6 : 26;
          const family =
            block.level === 1 ? "Georgia,'Times New Roman',serif" : FONT;
          const style =
            block.level === 3
              ? `margin:20px 0 6px;font:700 13px/1.4 ${FONT};letter-spacing:.07em;text-transform:uppercase;color:${FOREST};`
              : `margin:${top}px 0 10px;font:700 ${size}px/1.3 ${family};color:${INK};letter-spacing:-.01em;`;
          return `<h${block.level + 1} style="${style}">${inline(block.text)}</h${block.level + 1}>`;
        }
        case "p":
          return `<p style="margin:0 0 14px;font:400 ${body}px/1.65 ${FONT};color:${INK};">${block.lines
            .map(inline)
            .join("<br>")}</p>`;
        case "ul":
        case "ol": {
          const tag = block.kind;
          return `<${tag} style="margin:0 0 16px;padding:0 0 0 22px;font:400 ${body}px/1.6 ${FONT};color:${INK};">${block.items
            .map((item) => `<li style="margin:0 0 7px;">${inline(item)}</li>`)
            .join("")}</${tag}>`;
        }
        case "hr":
          return `<hr style="margin:22px 0;border:0;border-top:1px solid ${LINE};">`;
      }
    })
    .join("\n");
}

/** A plain-text version for the text/plain part of an email. */
export function plainDoc(source: string): string {
  return parse(source)
    .map((block) => {
      switch (block.kind) {
        case "h":
          return `${block.text.replace(/\*\*/g, "").toUpperCase()}\n`;
        case "p":
          return block.lines.join("\n").replace(/\*\*/g, "");
        case "ul":
          return block.items.map((i) => `  • ${i.replace(/\*\*/g, "")}`).join("\n");
        case "ol":
          return block.items
            .map((i, n) => `  ${n + 1}. ${i.replace(/\*\*/g, "")}`)
            .join("\n");
        case "hr":
          return "—".repeat(24);
      }
    })
    .join("\n\n");
}

/** Muted small print, for the line under a signature block and the like. */
export const smallPrint = (text: string): string =>
  `<p style="margin:0;font:400 12.5px/1.6 ${FONT};color:${MUTED};">${inline(text)}</p>`;
