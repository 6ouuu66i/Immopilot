import { Send } from 'lucide-react';

interface NoteComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  submitLabel?: string;
  disabled?: boolean;
}

export function NoteComposer({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ajouter une note...',
  submitLabel = 'Ajouter',
  disabled = false,
}: NoteComposerProps) {
  const canSubmit = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
      style={{ display: 'flex', gap: 8, fontFamily: 'var(--notion-sans)' }}
    >
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          flex: 1,
          minWidth: 0,
          height: 36,
          border: '1px solid #E6E4DF',
          borderRadius: 8,
          padding: '0 11px',
          background: '#FFFFFF',
          color: '#1D1F1E',
          font: 'inherit',
          fontSize: 12.5,
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={!canSubmit}
        title={submitLabel}
        style={{
          width: 38,
          height: 36,
          border: '1px solid #1E5A3A',
          borderRadius: 8,
          display: 'grid',
          placeItems: 'center',
          background: canSubmit ? '#1E5A3A' : '#F3F2EF',
          color: canSubmit ? '#FFFFFF' : '#9A9A9A',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        <Send size={14} />
      </button>
    </form>
  );
}
