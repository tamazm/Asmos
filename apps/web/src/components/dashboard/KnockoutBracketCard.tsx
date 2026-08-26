import Link from "next/link";
import { cn } from "@/lib/cn";
import { CardEmpty, DashboardCard, SeeAllLink } from "./primitives";
import { IconBracket, IconCheckCircle, IconTrophy } from "./icons";
import type { BracketData, BracketEntry } from "@/lib/dashboardMetrics";

const MAX_PER_ROUND = 4;

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function BracketBox({ entry, fed }: { entry: BracketEntry; fed: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-md border px-2 py-1 leading-tight",
        fed &&
          "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-[color:var(--color-border)] before:content-['']",
        entry.advanced
          ? "border-[color:var(--color-primary)]/45 bg-[color:var(--color-primary-light)]"
          : entry.eliminated
            ? "border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]"
            : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]",
      )}
    >
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[11px] font-medium leading-tight",
            entry.eliminated
              ? "text-[color:var(--color-text-secondary)] line-through decoration-[color:var(--color-text-secondary)]/50"
              : "text-[color:var(--color-text-primary)]",
          )}
        >
          {entry.name}
        </span>
        {entry.advanced && (
          <IconCheckCircle className="shrink-0 text-[color:var(--color-primary)]" />
        )}
      </div>
      <p
        className={cn(
          "text-[11px] leading-tight tabular-nums",
          entry.eliminated
            ? "text-[color:var(--color-text-secondary)]"
            : "text-[color:var(--color-text-primary)]",
        )}
      >
        {entry.conversionRate === null ? "--.-%" : `${entry.conversionRate.toFixed(1)}%`}
      </p>
    </div>
  );
}

function RoundColumn({
  entries,
  isFirst,
  isLast,
}: {
  entries: BracketEntry[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const shown = entries.slice(0, MAX_PER_ROUND);
  const overflow = entries.length - shown.length;

  return (
    <div className="flex flex-col justify-around gap-2">
      {chunk(shown, 2).map((pair, index) => (
        <div key={index} className="relative flex flex-col gap-2">
          {pair.map((entry) => (
            <BracketBox key={entry.id} entry={entry} fed={!isFirst} />
          ))}
          {!isLast && pair.length === 2 && (
            /* The "]" that joins a pair and hands off to the next round. */
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-3 top-[22%] h-[56%] w-3 rounded-r-sm border-y border-r border-[color:var(--color-border)]"
            />
          )}
        </div>
      ))}
      {overflow > 0 && (
        <p className="text-[10px] text-[color:var(--color-text-secondary)]">+{overflow} more</p>
      )}
    </div>
  );
}

export function KnockoutBracketCard({ bracket }: { bracket: BracketData | null }) {
  if (!bracket) {
    return (
      <DashboardCard icon={<IconBracket />} title="Knockout Bracket" action={<SeeAllLink href="/campaigns" />}>
        <CardEmpty>
          Give a pop-up a second variant and Asmos runs a knockout tournament here, retiring the
          weaker variant round by round.
        </CardEmpty>
      </DashboardCard>
    );
  }

  const settled = bracket.championName !== null;
  const columns = bracket.rounds.length + 1;

  return (
    <DashboardCard
      icon={<IconBracket />}
      title="Knockout Bracket"
      action={<SeeAllLink href={`/campaigns/${bracket.campaignId}`} />}
    >
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/campaigns/${bracket.campaignId}`}
          className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-[color:var(--color-text-primary)] hover:text-[color:var(--color-primary)]"
        >
          {bracket.campaignName}
        </Link>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            settled
              ? "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]"
              : "bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {settled ? "Decided" : "In Progress"}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs text-[color:var(--color-text-secondary)]">
        <span>
          Round {bracket.currentRound} of {bracket.totalRounds}
        </span>
        <span className="tabular-nums">{bracket.percentComplete}% Complete</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
        <div
          className="h-full rounded-full bg-[color:var(--color-primary)]"
          style={{ width: `${Math.max(2, bracket.percentComplete)}%` }}
        />
      </div>

      <div
        className="mt-4 grid flex-1 gap-x-6"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {bracket.rounds.map((round) => (
          <p
            key={`head-${round.round}`}
            className="mb-2 text-[11px] text-[color:var(--color-text-secondary)]"
          >
            Round {round.round}
          </p>
        ))}
        <p className="mb-2 text-[11px] text-[color:var(--color-text-secondary)]">Final</p>

        {bracket.rounds.map((round, index) => (
          <RoundColumn
            key={round.round}
            entries={round.entries}
            isFirst={index === 0}
            isLast={false}
          />
        ))}

        <div className="flex items-center">
          <div
            className={cn(
              "relative w-full rounded-lg border px-2 py-2.5 text-center",
              "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-[color:var(--color-border)] before:content-['']",
              settled
                ? "border-[color:var(--color-primary)]/45 bg-[color:var(--color-primary-light)]"
                : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]",
            )}
          >
            <span
              className={cn(
                "mx-auto flex justify-center",
                settled
                  ? "text-[color:var(--color-primary)]"
                  : "text-[color:var(--color-text-secondary)]",
              )}
            >
              <IconTrophy />
            </span>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-[color:var(--color-text-secondary)]">
              Champion
            </p>
            <p className="truncate text-xs font-semibold text-[color:var(--color-text-primary)]">
              {bracket.championName ?? "TBD"}
            </p>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
