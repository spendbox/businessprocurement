import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { ROLE_DETAIL, ROLE_LABEL } from "@/lib/roles";
import { TeamUnavailable, listTeam, vendorCounts } from "@/lib/team";
import { Panel } from "../AdminUI";
import { AddMember, MemberRow } from "./TeamUI";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await requireAdminPage();

  let team;
  let counts: Record<string, number> = {};
  try {
    [team, counts] = await Promise.all([listTeam(), vendorCounts()]);
  } catch (error) {
    if (error instanceof TeamUnavailable) {
      return (
        <div className="rounded-2xl border-[1.5px] border-amber-400/40 bg-amber-400/8 p-6 sm:p-8">
          <h2 className="font-display text-[20px] font-bold tracking-[-0.015em] text-ink-900">
            The team needs one more step
          </h2>
          <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed text-ink-500">
            {error.message}
          </p>
          <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-ink-500">
            Open your Supabase project, go to the SQL editor, paste the contents
            of{" "}
            <code className="rounded bg-bone-200 px-1.5 py-0.5 font-mono text-[13px]">
              supabase/schema.sql
            </code>{" "}
            and run it. It is safe on a database that already has data. Your own
            sign-in keeps working either way — it does not come from this table.
          </p>
        </div>
      );
    }
    throw error;
  }

  const coordinators = team.filter((m) => m.role === "coordinator").length;
  const marketers = team.filter((m) => m.role === "marketer").length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">
          Team
        </h1>
        <p className="mt-1 max-w-[70ch] text-[14.5px] leading-relaxed text-ink-400">
          {team.length === 0
            ? "Nobody yet. Add the people who work with you below."
            : `${team.length} ${team.length === 1 ? "person" : "people"}${
                coordinators > 0
                  ? ` · ${coordinators} ${coordinators === 1 ? "coordinator" : "coordinators"}`
                  : ""
              }${marketers > 0 ? ` · ${marketers} ${marketers === 1 ? "marketer" : "marketers"}` : ""}`}
        </p>
      </div>

      {/* What the two roles mean, in one place, before anyone picks one. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(["admin", "coordinator", "marketer"] as const).map((role) => (
          <div
            key={role}
            className="rounded-2xl border border-bone-200 bg-white px-4 py-3.5"
          >
            <p className="text-[13px] font-bold uppercase tracking-[0.07em] text-ink-500">
              {ROLE_LABEL[role]}
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-400">
              {ROLE_DETAIL[role]}
            </p>
            {role === "marketer" && (
              <Link
                href="/admin/marketers"
                className="mt-2 inline-block text-[13px] font-bold text-forest-500 hover:text-forest-600"
              >
                Manage marketers →
              </Link>
            )}
          </div>
        ))}
      </div>

      {team.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {team.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              vendors={counts[member.id] ?? 0}
              isSelf={session.memberId === member.id}
              others={team
                .filter(
                  (o) =>
                    o.id !== member.id &&
                    (o.role === "marketer") === (member.role === "marketer"),
                )
                .map((o) => ({ id: o.id, name: o.name }))}
            />
          ))}
        </ul>
      )}

      <Panel title="Add someone to the team">
        <p className="mb-4 max-w-[70ch] text-[14px] leading-relaxed text-ink-400">
          A person with a password can sign in at{" "}
          <span className="font-mono text-[13px] text-ink-600">/admin/login</span>{" "}
          with their own email. A person without one is just a name you can hand
          merchants to. Your own sign-in is separate and always works.
        </p>
        <AddMember />
      </Panel>
    </div>
  );
}
