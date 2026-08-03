import type { ReactNode } from "react";

export type StatusTone = "info" | "success" | "warning" | "neutral" | "danger";

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span className={`tr-status tr-status--${tone}`}>
      <span aria-hidden="true" className="tr-status__dot" />
      {children}
    </span>
  );
}
