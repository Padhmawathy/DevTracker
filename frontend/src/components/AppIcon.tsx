import { useId } from "react";

/**
 * The DevTrack app icon, drawn inline so it stays sharp at any size.
 * Keep in sync with src-tauri/icons/source/devtrack-icon.svg (the master
 * used to generate the desktop and Store icons).
 */
export default function AppIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  const id = useId();
  const bg = `${id}-bg`;
  const sheen = `${id}-sheen`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a3e" />
          <stop offset="1" stopColor="#151517" />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="230" fill={`url(#${bg})`} />
      <rect width="1024" height="1024" rx="230" fill={`url(#${sheen})`} />
      <g fill="none" strokeWidth="92" strokeLinecap="round" transform="rotate(-90 512 512)">
        <circle cx="512" cy="512" r="270" stroke="#0a84ff" strokeDasharray="520 1177" strokeDashoffset="0" />
        <circle cx="512" cy="512" r="270" stroke="#30d158" strokeDasharray="410 1287" strokeDashoffset="-682" />
        <circle cx="512" cy="512" r="270" stroke="#ff9f0a" strokeDasharray="280 1417" strokeDashoffset="-1254" />
      </g>
      <path
        d="M410 520l72 72 140-152"
        fill="none"
        stroke="#ffffff"
        strokeWidth="64"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
