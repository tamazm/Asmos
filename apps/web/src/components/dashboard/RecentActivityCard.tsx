import Link from "next/link";
import { CardEmpty, DashboardCard, RowIcon, formatRelativeTime } from "./primitives";
import { IconActivity, IconPencil, IconPlug, IconPopup, IconTrophy, IconUser } from "./icons";
import type { ActivityItem } from "@/lib/dashboardMetrics";

/** Notifications carry no type column, so the glyph is inferred from the
 *  title. An unrecognised title still gets a sensible default rather than a
 *  blank tile. */
function glyphFor(title: string) {
  const text = title.toLowerCase();
  if (text.includes("won") || text.includes("winner") || text.includes("champion")) {
    return <IconTrophy />;
  }
  if (text.includes("lead") || text.includes("captured") || text.includes("subscriber")) {
    return <IconUser />;
  }
  if (text.includes("integration") || text.includes("connected") || text.includes("webhook")) {
    return <IconPlug />;
  }
  if (text.includes("updated") || text.includes("edited")) return <IconPencil />;
  return <IconPopup />;
}

function ActivityRow({ item, first }: { item: ActivityItem; first: boolean }) {
  const content = (
    <>
      <RowIcon>{glyphFor(item.title)}</RowIcon>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-[color:var(--color-text-primary)]">
            {item.title}
          </span>
          {item.unread && first && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-success)]"
              aria-label="Unread"
            />
          )}
        </span>
        <span className="block truncate text-[11px] text-[color:var(--color-text-secondary)]">
          {item.body}
        </span>
      </span>
      <span className="shrink-0 self-start pt-0.5 text-[11px] tabular-nums text-[color:var(--color-text-secondary)]">
        {formatRelativeTime(item.createdAt)}
      </span>
    </>
  );

  const className =
    "-mx-2 flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors duration-200";

  return item.href ? (
    <Link href={item.href} className={`${className} hover:bg-[color:var(--color-surface-sunken)]`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function RecentActivityCard({ activity }: { activity: ActivityItem[] }) {
  return (
    <DashboardCard icon={<IconActivity />} title="Recent Activity">
      {activity.length === 0 ? (
        <CardEmpty>Nothing has happened yet. Activity shows up here as your pop-ups run.</CardEmpty>
      ) : (
        <ul className="flex flex-col">
          {activity.map((item, index) => (
            <li key={item.id}>
              <ActivityRow item={item} first={index === 0} />
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
