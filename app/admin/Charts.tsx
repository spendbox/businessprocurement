/**
 * Dashboard charts.
 *
 * Every chart here answers a magnitude question for a single series, so
 * each uses one brand hue rather than a categorical palette — there is no
 * identity to encode, and a rainbow would imply one. Bars are thin with
 * rounded data-ends anchored to a shared baseline, grid lines stay
 * recessive, and values are labelled directly so nobody has to measure
 * against an axis. Text keeps ink tokens; the mark alone carries colour.
 */

type Datum = { label: string; value: number };

function niceMax(values: number[]): number {
  const max = Math.max(1, ...values);
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitude) * magnitude;
}

/** Horizontal bars: the right form when the labels are words, not dates. */
export function BarList({
  data,
  caption,
  emptyMessage = "Nothing yet.",
}: {
  data: Datum[];
  caption?: string;
  emptyMessage?: string;
}) {
  const rows = data.filter((d) => d.value > 0);
  if (rows.length === 0) {
    return <p className="py-2 text-[14px] text-ink-300">{emptyMessage}</p>;
  }

  const max = niceMax(rows.map((d) => d.value));

  return (
    <figure className="m-0">
      <ul className="flex flex-col gap-3">
        {rows.map((d) => (
          <li key={d.label} title={`${d.label}: ${d.value}`} className="group">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13.5px] font-semibold capitalize text-ink-700">
                {d.label}
              </span>
              <span className="shrink-0 text-[14px] font-bold tabular-nums text-ink-900">
                {d.value}
              </span>
            </div>
            <span className="block h-2 w-full overflow-hidden rounded-full bg-bone-200">
              <span
                className="block h-full rounded-full bg-forest-500 transition-[width,background-color] duration-500 group-hover:bg-forest-600"
                style={{ width: `${Math.max(3, (d.value / max) * 100)}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
      {caption && (
        <figcaption className="mt-4 text-[12.5px] text-ink-300">{caption}</figcaption>
      )}
    </figure>
  );
}

/** Fourteen days of intake. Columns, because the x axis is time. */
export function DailyColumns({ data }: { data: { date: string; value: number }[] }) {
  const max = niceMax(data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <p className="py-2 text-[14px] text-ink-300">
        No requests in the last fourteen days.
      </p>
    );
  }

  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  return (
    <figure className="m-0">
      <div className="flex h-[132px] items-end gap-1.5" role="img" aria-label="Requests per day over the last fourteen days">
        {data.map((d) => (
          <span
            key={d.date}
            className="group relative flex h-full flex-1 flex-col justify-end"
            title={`${fmt(d.date)}: ${d.value} request${d.value === 1 ? "" : "s"}`}
          >
            <span
              className={`block w-full rounded-t-[4px] transition-colors ${
                d.value > 0 ? "bg-forest-500 group-hover:bg-forest-600" : "bg-bone-200"
              }`}
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </span>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-bone-200 pt-2 text-[11.5px] text-ink-300">
        <span>{fmt(data[0].date)}</span>
        <span className="font-semibold text-ink-500">{total} in 14 days</span>
        <span>{fmt(data[data.length - 1].date)}</span>
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>Requests per day</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Requests</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <th scope="row">{fmt(d.date)}</th>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** A headline number. Not a chart, and better than one for a single value. */
export function StatTile({
  label,
  value,
  detail,
  tone = "plain",
}: {
  label: string;
  value: number | string;
  detail?: string;
  tone?: "plain" | "alert";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        tone === "alert" && Number(value) > 0
          ? "border-clay-400/40 bg-clay-400/8"
          : "border-bone-200 bg-white"
      }`}
    >
      <p className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink-400">
        {label}
      </p>
      <p className="mt-2 font-display text-[34px] font-bold leading-none tracking-[-0.02em] text-ink-900 tabular-nums">
        {value}
      </p>
      {detail && <p className="mt-2 text-[12.5px] leading-snug text-ink-400">{detail}</p>}
    </div>
  );
}
