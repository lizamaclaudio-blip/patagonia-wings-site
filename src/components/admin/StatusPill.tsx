type StatusPillProps = {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
};

export function StatusPill({
  children,
  tone = "default",
}: StatusPillProps) {
  return <span className={`status-pill tone-${tone}`}>{children}</span>;
}
