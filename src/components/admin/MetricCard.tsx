type MetricCardProps = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
};

export function MetricCard({
  label,
  value,
  tone = "default",
}: MetricCardProps) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </article>
  );
}
