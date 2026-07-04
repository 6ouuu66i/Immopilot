import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

export interface ObjectTableColumn<T> {
  id: string;
  header: ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  render: (row: T, index: number) => ReactNode;
}

interface ObjectTableProps<T> {
  columns: ObjectTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  onRowClick?: (row: T, index: number) => void;
  selectedKey?: string | number | null;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ObjectTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  emptyTitle = 'Aucune donnée',
  emptyDescription = 'Les éléments apparaîtront ici dès qu’ils seront disponibles.',
}: ObjectTableProps<T>) {
  const gridTemplateColumns = columns.map((column) => {
    if (typeof column.width === 'number') return `${column.width}px`;
    return column.width ?? 'minmax(0, 1fr)';
  }).join(' ');

  return (
    <section
      style={{
        overflow: 'hidden',
        border: '1px solid var(--color-border-default)',
        borderRadius: 10,
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--notion-sans)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns,
          minHeight: 42,
          alignItems: 'center',
          gap: 12,
          padding: '0 14px',
          borderBottom: '1px solid var(--color-border-default)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--notion-sans)',
          fontSize: 'var(--text-xs)',
          fontWeight: 500,
          letterSpacing: 0,
        }}
      >
        {columns.map((column) => (
          <span key={column.id} style={{ textAlign: column.align ?? 'left', minWidth: 0 }}>
            {column.header}
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: 14 }}>
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        rows.map((row, index) => {
          const key = rowKey(row, index);
          const selected = selectedKey === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onRowClick?.(row, index)}
              style={{
                display: 'grid',
                gridTemplateColumns,
                alignItems: 'center',
                gap: 12,
                width: '100%',
                minHeight: 52,
                padding: '8px 14px',
                border: 0,
                borderBottom: index === rows.length - 1 ? 0 : '1px solid var(--color-border-subtle)',
                background: selected ? 'var(--color-brand-bg)' : 'var(--color-bg-surface)',
                color: 'var(--color-text-primary)',
                textAlign: 'left',
                font: 'inherit',
                fontSize: 12.5,
                cursor: onRowClick ? 'pointer' : 'default',
              }}
            >
              {columns.map((column) => (
                <span
                  key={column.id}
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: column.align ?? 'left',
                  }}
                >
                  {column.render(row, index)}
                </span>
              ))}
            </button>
          );
        })
      )}
    </section>
  );
}
