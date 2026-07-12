interface LoadingBarProps {
  label?: string;
}

export function LoadingBar({ label = 'Chargement...' }: LoadingBarProps) {
  return (
    <div className="ip-loading-state" role="status" aria-live="polite">
      <span>{label}</span>
      <span className="ip-loading-track" role="progressbar" aria-label={label}>
        <span className="ip-loading-fill" />
      </span>
    </div>
  );
}
