import { useState } from 'react';
import type { NoteWithAuthor } from '../../lib/services/notesService';

interface NotesListProps {
  notes: NoteWithAuthor[];
  isLoading?: boolean;
  canEditNote: (note: NoteWithAuthor) => boolean;
  onUpdate: (noteId: string, content: string) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
  emptyText?: string;
  compact?: boolean;
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "à l'instant";
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'hier';

  return `le ${date.toLocaleDateString('fr-BE', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })}`;
}

function authorName(note: NoteWithAuthor): string {
  return note.author?.full_name || note.author?.email || 'Agent';
}

export function NotesList({
  notes,
  isLoading = false,
  canEditNote,
  onUpdate,
  onDelete,
  emptyText = 'Aucune note.',
  compact = false,
}: NotesListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (isLoading) {
    return <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 12 }}>Chargement des notes...</p>;
  }

  if (notes.length === 0) {
    return <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 12 }}>{emptyText}</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      {notes.map((note) => {
        const editable = canEditNote(note);
        const isEditing = editingId === note.id;

        return (
          <div
            key={note.id}
            style={{
              padding: compact ? '8px 10px' : '9px 10px',
              borderRadius: 8,
              background: 'var(--color-bg-page)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-primary)',
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 650 }}>
                {authorName(note)} · {formatRelativeDate(note.created_at)}
              </span>
              {editable && (
                <span style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(note.id);
                      setDraft(note.content);
                    }}
                    style={{ border: 0, background: 'transparent', padding: 0, color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(note.id)}
                    style={{ border: 0, background: 'transparent', padding: 0, color: 'var(--color-danger-text)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                  >
                    Supprimer
                  </button>
                </span>
              )}
            </div>

            {isEditing ? (
              <div style={{ display: 'grid', gap: 7 }}>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 7,
                    padding: 8,
                    font: 'inherit',
                    fontSize: 12,
                    background: 'var(--color-bg-surface)',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', borderRadius: 7, height: 28, padding: '0 9px', fontSize: 11.5, cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void onUpdate(note.id, draft);
                      setEditingId(null);
                    }}
                    style={{ border: 0, background: 'var(--color-brand)', color: 'var(--color-text-inverse)', borderRadius: 7, height: 28, padding: '0 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap' }}>{note.content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
