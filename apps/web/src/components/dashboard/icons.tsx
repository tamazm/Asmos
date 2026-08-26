/** 16px stroke icons used by the dashboard cards. Kept together so every card
 *  header pulls from one visual family instead of drifting per file. */
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  "aria-hidden": true,
} as const;

export function IconPopup() {
  return (
    <svg {...base}>
      <rect x="1.5" y="2.5" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 14h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconBolt() {
  return (
    <svg {...base}>
      <path
        d="M8.8 1.5 3.5 9h3.2l-.5 5.5L12.5 7H9.2l-.4-5.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconBracket() {
  return (
    <svg {...base}>
      <path d="M1.5 1.5v3M1.5 14.5v-3M14.5 1.5v3M14.5 14.5v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M1.5 1.5h3M1.5 14.5h3M14.5 1.5h-3M14.5 14.5h-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="5.5" y="6" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconLeadCapture() {
  return (
    <svg {...base}>
      <rect x="1.5" y="2.5" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 6h4M4.5 9h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconRank() {
  return (
    <svg {...base}>
      <rect x="1.5" y="9" width="3.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="6.25" y="5.5" width="3.5" height="9" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11" y="2" width="3.5" height="12.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconTarget() {
  return (
    <svg {...base}>
      <rect x="2" y="1.5" width="12" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 5.5h6M5 8h6M5 10.5h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconActivity() {
  return (
    <svg {...base}>
      <path d="M2 4h1.5M2 8h1.5M2 12h1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 4h8M6 8h8M6 12h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconTable() {
  return (
    <svg {...base}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 6.5h13M6 6.5v7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconTrophy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9H3.5L4.5 12.5H6.5M18 9h2.5L19.5 12.5H17.5M12 17.5v3m-3.5 0h7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 3.5h11V11a5.5 5.5 0 0 1-11 0V3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className}>
      <circle cx="7" cy="7" r="6.25" fill="currentColor" />
      <path
        d="M4.5 7.2 6.2 8.9 9.6 5.4"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconUser() {
  return (
    <svg {...base}>
      <circle cx="8" cy="5.5" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.8 13.5c0-2.8 2.3-4.3 5.2-4.3s5.2 1.5 5.2 4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlug() {
  return (
    <svg {...base}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function IconPencil() {
  return (
    <svg {...base}>
      <path d="M10.5 2.5l3 3-8 8-3.5.5.5-3.5 8-8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
