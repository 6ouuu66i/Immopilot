import { CalendarClock } from 'lucide-react';
import type { Json } from '../../lib/database.types';
import type { ListingSignal } from '../../lib/services/listingSignalsService';
import { PropertyInsightZone } from './PropertyInsightZone';

export type MandateStatus = 'monitor' | 'watchlist_sortie_probable' | 'activable_sous_verification';

interface MandateStatusZoneProps {
  daysOnline?: number;
  publishedAt?: string;
  signals?: ListingSignal[];
  size?: 'compact' | 'panel';
}

interface MandateContextPanelProps extends MandateStatusZoneProps {
  compact?: boolean;
}

interface MandateSnapshot {
  days: number | null;
  publishedAt: string | null;
  signal: ListingSignal | null;
  status: MandateStatus | null;
}

const STATUS_PRESENTATION: Record<MandateStatus, { label: string; border: string; background: string }> = {
  monitor: {
    label: 'Mandat à suivre',
    border: '#9AA09B',
    background: 'var(--color-bg-muted)',
  },
  watchlist_sortie_probable: {
    label: 'Sortie probable',
    border: '#8A6D1F',
    background: '#F7F1DD',
  },
  activable_sous_verification: {
    label: 'Activable sous vérification',
    border: '#1E5A3A',
    background: '#E8F0EB',
  },
};

function asRecord(value: Json): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}

function metadataNumber(metadata: Json, key: string): number | null {
  const value = asRecord(metadata)[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function metadataString(metadata: Json, key: string): string | null {
  const value = asRecord(metadata)[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeStatus(value: string | null): MandateStatus | null {
  if (!value) return null;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (normalized === 'monitor') return 'monitor';
  if (normalized === 'watchlist_sortie_probable') return 'watchlist_sortie_probable';
  if (normalized === 'activable_sous_verification') return 'activable_sous_verification';
  return null;
}

function statusFromMetadata(signal: ListingSignal): MandateStatus | null {
  const metadata = asRecord(signal.metadata);
  const candidates = [metadata.state, metadata.status, metadata.mandate_status, metadata.aging_status];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const status = normalizeStatus(candidate);
    if (status) return status;
  }
  return null;
}

// Les signaux historiques ne stockent pas encore l'état catégoriel. La vue
// conserve alors trois paliers prudents et explicites, sans transformer le
// statut en score : 6-7 mois, 7-9 mois, puis 9 mois et plus.
function statusFromDays(days: number | null): MandateStatus {
  if (days === null || days < 210) return 'monitor';
  if (days < 270) return 'watchlist_sortie_probable';
  return 'activable_sous_verification';
}

function activeMandateSignals(signals: ListingSignal[]) {
  return signals.filter((signal) => signal.signal_type === 'agency_mandate_aging' && signal.is_active);
}

export function mandateSnapshot(
  signals: ListingSignal[] = [],
  fallbackPublishedAt?: string,
  fallbackDays?: number,
): MandateSnapshot {
  const mandateSignals = activeMandateSignals(signals);
  if (mandateSignals.length === 0) {
    return {
      days: typeof fallbackDays === 'number' ? fallbackDays : null,
      publishedAt: fallbackPublishedAt ?? null,
      signal: null,
      status: null,
    };
  }

  let selected = mandateSignals[0];
  let selectedDays = metadataNumber(selected.metadata, 'days_on_market');
  for (const signal of mandateSignals.slice(1)) {
    const days = metadataNumber(signal.metadata, 'days_on_market');
    if ((days ?? -1) > (selectedDays ?? -1)) {
      selected = signal;
      selectedDays = days;
    }
  }

  const publishedAt = metadataString(selected.metadata, 'published_at') ?? fallbackPublishedAt ?? null;
  return {
    days: selectedDays ?? (typeof fallbackDays === 'number' ? fallbackDays : null),
    publishedAt,
    signal: selected,
    status: statusFromMetadata(selected) ?? statusFromDays(selectedDays),
  };
}

export function mandatePriorityTone(signals: ListingSignal[] = []): 'high' | 'watch' | 'low' {
  const status = mandateSnapshot(signals).status;
  if (status === 'activable_sous_verification') return 'high';
  if (status === 'watchlist_sortie_probable') return 'watch';
  return 'low';
}

function formatDate(value: string | null) {
  if (!value) return 'Date source indisponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date source indisponible';
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function MandateBadge({ snapshot }: { snapshot: MandateSnapshot }) {
  if (!snapshot.status) {
    return (
      <span style={{
        display: 'inline-flex',
        width: 'fit-content',
        maxWidth: '100%',
        border: '1px solid var(--color-border-strong)',
        borderRadius: 0,
        background: 'var(--color-bg-muted)',
        color: 'var(--color-text-secondary)',
        padding: '4px 7px',
        fontFamily: 'var(--font-mono, var(--notion-mono))',
        fontSize: 10.5,
        fontWeight: 680,
        lineHeight: 1.2,
      }}>
        Aucun signal de mandat
      </span>
    );
  }

  const presentation = STATUS_PRESENTATION[snapshot.status];
  return (
    <span style={{
      display: 'inline-flex',
      width: 'fit-content',
      maxWidth: '100%',
      border: `1px solid ${presentation.border}`,
      borderRadius: 0,
      background: presentation.background,
      color: 'var(--color-text-primary)',
      padding: '4px 7px',
      fontFamily: 'var(--font-mono, var(--notion-mono))',
      fontSize: 10.5,
      fontWeight: 720,
      lineHeight: 1.2,
    }}>
      {presentation.label}
    </span>
  );
}

export function MandateStatusZone({
  daysOnline,
  publishedAt,
  signals = [],
  size = 'compact',
}: MandateStatusZoneProps) {
  const snapshot = mandateSnapshot(signals, publishedAt, daysOnline);
  const accent = snapshot.status ? STATUS_PRESENTATION[snapshot.status].border : '#9AA09B';

  return (
    <PropertyInsightZone
      ariaLabel="Statut du mandat agence"
      size={size}
      leading={(
        <span style={{
          width: size === 'panel' ? 72 : 38,
          height: size === 'panel' ? 54 : 38,
          display: 'grid',
          placeItems: 'center',
          border: `1px solid ${accent}`,
          borderRadius: 0,
          color: accent,
          background: 'var(--color-bg-surface)',
        }}>
          <CalendarClock size={size === 'panel' ? 22 : 16} strokeWidth={1.8} />
        </span>
      )}
    >
      <MandateBadge snapshot={snapshot} />
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 10.5, lineHeight: 1.35 }}>
        {snapshot.signal && snapshot.days !== null
          ? `${snapshot.days.toLocaleString('fr-BE')} jours depuis publication`
          : 'Aucune ancienneté mandat active détectée'}
      </span>
    </PropertyInsightZone>
  );
}

export function MandateContextPanel({
  compact = false,
  daysOnline,
  publishedAt,
  signals = [],
}: MandateContextPanelProps) {
  const snapshot = mandateSnapshot(signals, publishedAt, daysOnline);
  return (
    <section
      aria-label="Contexte du statut mandat"
      style={{
        border: '1px solid var(--color-border-default)',
        borderRadius: 0,
        background: 'var(--color-bg-surface)',
        padding: compact ? 12 : 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <strong style={{ color: 'var(--color-text-primary)', fontSize: 12.5, fontWeight: 720 }}>
          Pourquoi ce statut mandat
        </strong>
        <MandateBadge snapshot={snapshot} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 8 }}>
          <span style={{ display: 'block', color: 'var(--color-text-tertiary)', fontSize: 10.5 }}>Publication source</span>
          <strong style={{ display: 'block', marginTop: 3, color: 'var(--color-text-primary)', fontSize: 12 }}>{formatDate(snapshot.publishedAt)}</strong>
        </div>
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 8 }}>
          <span style={{ display: 'block', color: 'var(--color-text-tertiary)', fontSize: 10.5 }}>Ancienneté observée</span>
          <strong style={{ display: 'block', marginTop: 3, color: 'var(--color-text-primary)', fontSize: 12 }}>
            {snapshot.days === null ? 'Indisponible' : `${snapshot.days.toLocaleString('fr-BE')} jours`}
          </strong>
        </div>
      </div>
      <p style={{ margin: '11px 0 0', color: 'var(--color-text-secondary)', fontSize: 11.5, lineHeight: 1.5 }}>
        En Belgique, une mission d’intermédiation exclusive avec un consommateur est limitée à 6 mois. La date de publication ne prouve ni la date de signature, ni l’exclusivité, ni l’expiration du contrat.
      </p>
      <p style={{ margin: '6px 0 0', color: 'var(--color-text-primary)', fontSize: 11.5, fontWeight: 650, lineHeight: 1.5 }}>
        Statut potentiellement en évolution, à vérifier avant tout contact. Aucun démarchage automatique n’est suggéré.
      </p>
    </section>
  );
}
