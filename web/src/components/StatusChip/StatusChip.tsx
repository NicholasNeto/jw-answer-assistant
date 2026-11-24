import "./StatusChip.css";

export type ChipTone = "ok" | "warn" | "err" | "neutral";

type StatusChipProps = {
  label: string;
  tone?: ChipTone;
  title?: string;
};

export default function StatusChip({ label, tone = "ok", title }: StatusChipProps) {
  return (
    <span className={`status-chip status-chip--${tone}`} role="status" title={title}>
      <span className="status-chip__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
