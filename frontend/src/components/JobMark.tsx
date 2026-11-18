/** A job's marker: its emoji when it has one, otherwise its colour dot. */
const SIZES = {
  xs: { dot: 6, emoji: 11 },
  sm: { dot: 8, emoji: 13 },
  md: { dot: 10, emoji: 16 },
  lg: { dot: 12, emoji: 20 },
} as const;

export default function JobMark({
  color,
  emoji,
  size = "sm",
  dim = false,
  className = "",
}: {
  color?: string | null;
  emoji?: string | null;
  size?: keyof typeof SIZES;
  dim?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  if (emoji) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
        style={{ fontSize: s.emoji, width: s.emoji + 2, height: s.emoji + 2, opacity: dim ? 0.45 : 1 }}
      >
        {emoji}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ width: s.dot, height: s.dot, backgroundColor: color ?? "var(--ui-tertiary)", opacity: dim ? 0.4 : 1 }}
    />
  );
}
