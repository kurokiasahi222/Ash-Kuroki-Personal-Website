// Inline SVG icons for the UI overlay. All are decorative (aria-hidden): every
// control that shows one also carries a text name.

import type { ReactNode } from "react";

function Icon({
  children,
  size = 20,
  className,
}: {
  children: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className ? `ui-icon ${className}` : "ui-icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <Icon>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      {on ? (
        <>
          <path d="M15.5 9a4 4 0 0 1 0 6" />
          <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
        </>
      ) : (
        <path d="m16 9.5 5 5m0-5-5 5" />
      )}
    </Icon>
  );
}

export function GlobeIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5S14.4 18.1 12 20.5M12 3.5C9.6 5.9 8.5 8.7 8.5 12s1.1 6.1 3.5 8.5" />
    </Icon>
  );
}

export function PageIcon() {
  return (
    <Icon>
      <rect x="5" y="3.5" width="14" height="17" rx="3" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="m6.5 6.5 11 11m0-11-11 11" />
    </Icon>
  );
}

export function ChevronIcon({ className }: { className?: string }) {
  return (
    <Icon size={18} className={className}>
      <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
    </Icon>
  );
}

export function ExternalIcon() {
  return (
    <Icon size={16}>
      <path d="M8 16 16.5 7.5M9.5 7.5h7v7" />
    </Icon>
  );
}

export function RideDownIcon() {
  return (
    <Icon>
      <rect x="5" y="3.5" width="14" height="17" rx="3" />
      <path d="M12 7.5v8m-3.5-3.5L12 15.5l3.5-3.5" />
    </Icon>
  );
}

export function CodeIcon() {
  return (
    <Icon size={22}>
      <path d="m8.5 7.5-5 4.5 5 4.5m7-9 5 4.5-5 4.5M13.5 5l-3 14" />
    </Icon>
  );
}

export function PersonIcon() {
  return (
    <Icon size={22}>
      <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
      <circle cx="9" cy="10.5" r="2" />
      <path d="M5.8 16c.6-1.6 1.7-2.5 3.2-2.5s2.6.9 3.2 2.5M14.5 9.5h3.5M14.5 13h3.5" />
    </Icon>
  );
}

export function KeysIcon() {
  return (
    <Icon size={18}>
      <rect x="2.5" y="6" width="19" height="12" rx="3" />
      <path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8" />
    </Icon>
  );
}

export function TapIcon() {
  return (
    <Icon size={18}>
      <path d="M9.5 11V6a1.75 1.75 0 0 1 3.5 0v5l4 .8a2 2 0 0 1 1.6 2.2l-.6 4.5a2.5 2.5 0 0 1-2.5 2H11a2.5 2.5 0 0 1-2-1l-3-4a1.6 1.6 0 0 1 2.5-2z" />
      <path d="M6 5.5a5 5 0 0 1 10 0" />
    </Icon>
  );
}

export function CanIcon() {
  return (
    <Icon size={18}>
      <path d="M8 3.5h8M7 6h10v13.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5zM7 10h10M7 16h10" />
    </Icon>
  );
}

export function GaugeIcon() {
  return (
    <Icon size={18}>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 17-3.5-4.5" />
    </Icon>
  );
}

/** A tiny stylized Tokyo Tower for the title card: tower orange with white bands. */
export function TowerMark() {
  return (
    <svg
      className="ui-tower-mark"
      width="40"
      height="64"
      viewBox="0 0 40 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="19.25"
        y="0"
        width="1.5"
        height="13"
        rx="0.75"
        fill="var(--tower-white)"
      />
      <path d="M17.5 12h5l2.2 14h-9.4z" fill="var(--tower)" />
      <rect
        x="13"
        y="25"
        width="14"
        height="4"
        rx="1.5"
        fill="var(--tower-white)"
      />
      <path d="M15 29h10l4 15H11z" fill="var(--tower)" />
      <rect
        x="8"
        y="43"
        width="24"
        height="4.5"
        rx="1.5"
        fill="var(--tower-white)"
      />
      <path
        d="M9.5 47.5h21L37 64h-7.5L20 54.5 10.5 64H3z"
        fill="var(--tower)"
      />
    </svg>
  );
}
