// Hand-built line-art icon set for the homepage — kept as plain inline SVG
// (currentColor strokes) rather than pulling in an icon library, matching
// the existing Check/Arrow icons already hand-rolled on the homepage.
// Every icon shares a 1.6px rounded stroke so they read as one family.

type IconProps = { className?: string };

const base = "shrink-0";

export function IconAnalyze({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" fill="none" className={`${base} ${className ?? ""}`}>
      <circle cx="17" cy="17" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24.5 24.5L32 32" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 18l3-4 3 2 4-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGenerate({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" fill="none" className={`${base} ${className ?? ""}`}>
      <rect x="6" y="9" width="28" height="20" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 15h28" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="11" cy="12" r="1.1" fill="currentColor" />
      <circle cx="15" cy="12" r="1.1" fill="currentColor" />
      <path d="M13 22l4-4 4 4 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLearn({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M20 6c-6 0-10 4.2-10 9.4 0 3.4 1.8 5.6 3.6 7.2.9.8 1.4 1.6 1.4 2.7V27h10v-1.7c0-1.1.5-1.9 1.4-2.7 1.8-1.6 3.6-3.8 3.6-7.2C30 10.2 26 6 20 6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M17 32h6M18 34.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20 12v6l4 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconStore({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M5 12l1.5-6h19L27 12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5 12v13h22V12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 25v-7h8v7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5 12a3.4 3.4 0 006.8 0 3.4 3.4 0 006.8 0 3.4 3.4 0 006.8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconExperiment({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M13 5h6M14 5v7.5L8.5 23a2 2 0 001.7 3h11.6a2 2 0 001.7-3L18 12.5V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 19h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="23" r="1" fill="currentColor" />
      <circle cx="18" cy="24.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconTraffic({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M5 10c5 0 5 5 10 5s5-5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 22c5 0 5-5 10-5s5 5 10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 7l3 3-3 3M22 19l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAnalytics({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M6 26V10M14 26V6M22 26v-9M26 26H4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10l6 5 6-8 6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBrain({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={`${base} ${className ?? ""}`}>
      <path d="M13 6a4 4 0 00-4 4 4 4 0 00-2 7 4 4 0 004 6 4 4 0 007-2V8a3 3 0 00-5-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M19 6a4 4 0 014 4 4 4 0 012 7 4 4 0 01-4 6 4 4 0 01-7-2V8a3 3 0 015-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 11v12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="1 3.2" />
    </svg>
  );
}

export function IconIntegrations({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={`${base} ${className ?? ""}`}>
      <rect x="4" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="20" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 17h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="0.5 3.2" />
      <path d="M16 13V9m-3 0h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Soft decorative blob used behind the hero — pure CSS-friendly SVG shape,
// tinted with currentColor + low opacity so it inherits whatever section
// it's dropped into instead of hardcoding a color here.
export function DecorativeBlob({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" className={className} style={{ filter: "blur(40px)" }}>
      <path
        fill="currentColor"
        d="M45.7,-58.4C58.5,-49.8,67.4,-34.5,71.6,-17.9C75.8,-1.3,75.2,16.6,67.8,31.4C60.4,46.2,46.1,57.9,29.9,64.8C13.7,71.7,-4.4,73.8,-21.6,69.6C-38.8,65.4,-55.1,54.9,-64.4,40.1C-73.7,25.3,-76,6.2,-72.1,-11.2C-68.2,-28.6,-58.1,-44.3,-44.4,-53C-30.7,-61.7,-15.3,-63.4,1.6,-65.5C18.6,-67.6,33,-67,45.7,-58.4Z"
        transform="translate(100 100)"
      />
    </svg>
  );
}
