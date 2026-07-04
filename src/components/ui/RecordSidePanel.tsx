import { X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

interface RecordSidePanelProps {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  media?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
  sticky?: boolean;
  ariaLabel?: string;
}

export function RecordSidePanel({
  title,
  subtitle,
  meta,
  media,
  children,
  footer,
  onClose,
  width = 480,
  sticky = false,
  ariaLabel = 'Fiche detail',
}: RecordSidePanelProps) {
  const panelStyle = {
    '--record-panel-width': `${width}px`,
  } as CSSProperties;

  return (
    <aside
      aria-label={ariaLabel}
      className={`lv-record-panel ${sticky ? 'is-sticky' : 'is-fixed'}`}
      style={panelStyle}
    >
      <header className="lv-record-panel-header">
        <div className="lv-record-panel-title-group">
          {meta && <div className="lv-record-panel-meta">{meta}</div>}
          <h2 className="lv-record-panel-title">{title}</h2>
          {subtitle && <p className="lv-record-panel-subtitle">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="lv-icon-button">
          <X size={18} />
        </button>
      </header>
      {media}
      <div className="lv-record-panel-body">{children}</div>
      {footer && <footer className="lv-record-panel-footer">{footer}</footer>}
    </aside>
  );
}
