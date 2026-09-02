"use client";

type EventOption = {
  id: string;
  label: string;
  description?: string;
};

export function EventSelector({
  options,
  selected,
  onToggle,
}: {
  options: ReadonlyArray<EventOption>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-3">
      <legend className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[color:var(--color-text-primary)]">Events</span>
        <span className="text-[11px] text-[color:var(--color-text-secondary)]">
          {selected.length} selected
        </span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label
              key={option.id}
              className={`group flex cursor-pointer items-start gap-2.5 rounded-lg border bg-[color:var(--color-surface)] p-2.5 transition-colors hover:border-[color:var(--color-primary)]/50 ${checked ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)]" : "border-[color:var(--color-border)]"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(option.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[color:var(--color-text-inverse)] transition-colors ${checked ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]" : "border-[color:var(--color-border)]"}`}
              >
                {checked && (
                  <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none">
                    <path d="m3.25 8.25 3 3 6.5-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium leading-4 text-[color:var(--color-text-primary)]">
                  {option.label}
                </span>
                {option.description && (
                  <span className="mt-0.5 block text-[11px] leading-4 text-[color:var(--color-text-secondary)]">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function EventSummary({
  events,
  eventLabel,
}: {
  events: string[];
  eventLabel: (event: string) => string | undefined;
}) {
  return (
    <div className="rounded-xl bg-[color:var(--color-surface-sunken)] px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-secondary)]">
          Sends on
        </span>
        <span className="text-[11px] text-[color:var(--color-text-secondary)]">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {events.map((event) => (
          <span
            key={event}
            className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1 text-[11px] font-medium text-[color:var(--color-text-primary)]"
          >
            {eventLabel(event) ?? event}
          </span>
        ))}
      </div>
    </div>
  );
}
