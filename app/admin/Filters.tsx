"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** One row of filters above a table, as the dataviz guidance prescribes. */
export function Filters({
  filters,
  searchPlaceholder = "Search",
}: {
  filters: { name: string; label: string; options: readonly string[] }[];
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");

  const push = (next: URLSearchParams) => {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    push(next);
  };

  /* Debounce the text box so typing does not fire a query per keystroke. */
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search.trim()) next.set("q", search.trim());
      else next.delete("q");
      push(next);
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const control =
    "min-h-[44px] rounded-xl border-[1.5px] border-bone-200 bg-white px-3.5 text-[14px] font-semibold text-ink-700 outline-none transition-colors focus:border-forest-500";

  const active =
    [...params.keys()].filter((k) => k === "q" || filters.some((f) => f.name === k))
      .length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className={`${control} min-w-[200px] flex-1 font-normal`}
      />
      {filters.map((f) => (
        <select
          key={f.name}
          value={params.get(f.name) ?? ""}
          onChange={(e) => setParam(f.name, e.target.value)}
          aria-label={f.label}
          className={control}
        >
          <option value="">{f.label}: all</option>
          {f.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ))}
      {active && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            router.replace(pathname);
          }}
          className="min-h-[44px] rounded-xl px-3 text-[13.5px] font-bold text-ink-400 underline underline-offset-4 transition-colors hover:text-ink-900"
        >
          Clear
        </button>
      )}
    </div>
  );
}
