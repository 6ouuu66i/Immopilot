import { Bath, Bed, ChevronLeft, ChevronRight, Globe, Heart, MapPin, Square, Star } from 'lucide-react';
import type { Property } from '../../types';
import { SignalBadges } from '../SignalBadges';
import type { ListingSignal } from '../../lib/services/listingSignalsService';
import { propertyImageFallbacks } from '../../lib/propertyImageFallbacks';
import { formatEuro } from '../../lib/formatCurrency';

type SignalFamily = 'price' | 'behavior' | 'context' | 'alert';

interface PropertyCardProps {
  property: Property;
  carouselIndex: number;
  onCarouselPrev: (e: React.MouseEvent) => void;
  onCarouselNext: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onSelect: () => void;
  isFavorite: boolean;
  selected?: boolean;
  primarySignal?: string;
  secondarySignalCount?: number;
  opportunityReason?: string;
  nextAction?: string;
  contactName?: string;
  signals?: ListingSignal[];
  scoreContent?: React.ReactNode;
}

function cssVar(name: string) {
  return `var(${name})`;
}

function statusBadge(property: Property): { label: string; bg: string; text: string; border: string } {
  const status = property.status ?? (property.reserved ? 'réservé' : 'disponible');
  if (status === 'archivé') {
    return {
      label: 'Archivé',
      bg: cssVar('--color-neutral-bg'),
      text: cssVar('--color-neutral-text'),
      border: cssVar('--color-neutral-border'),
    };
  }
  if (status === 'réservé' || property.reserved) {
    return {
      label: 'Réservé',
      bg: cssVar('--color-warning-bg'),
      text: cssVar('--color-warning-text'),
      border: cssVar('--color-warning-border'),
    };
  }
  return {
    label: 'Disponible',
    bg: cssVar('--color-bg-muted'),
    text: cssVar('--color-text-secondary'),
    border: cssVar('--color-border-default'),
  };
}

function signalFamily(label: string): SignalFamily {
  const value = label.toLowerCase();
  if (value.includes('prix sous') || value.includes('baisse') || value.includes('prix')) return 'price';
  if (value.includes('repub') || value.includes('ancien') || value.includes('multi')) return 'behavior';
  if (value.includes('fsbo') || value.includes('nouveau') || value.includes('particulier')) return 'context';
  if (value.includes('urgent') || value.includes('deadline') || value.includes('rappel')) return 'alert';
  return 'context';
}

function signalBadge(label: string): { bg: string; text: string; border: string } {
  const normalized = label.toLowerCase();
  if (normalized.includes('sous march') || normalized.includes('sous-march')) {
    return {
      bg: '#E8F0EB',
      text: '#1E5A3A',
      border: 'color-mix(in srgb, #1E5A3A 24%, transparent)',
    };
  }
  if (normalized.includes('surcot') || normalized.includes('sur-cot')) {
    return {
      bg: '#FAEDE9',
      text: '#B3402E',
      border: 'color-mix(in srgb, #B3402E 24%, transparent)',
    };
  }
  if (normalized.includes('tva')) {
    return {
      bg: '#F7F1DD',
      text: '#8A6D1F',
      border: 'color-mix(in srgb, #8A6D1F 26%, transparent)',
    };
  }
  if (normalized.includes('nouveau')) {
    return {
      bg: cssVar('--color-neutral-bg'),
      text: cssVar('--color-neutral-text'),
      border: cssVar('--color-neutral-border'),
    };
  }

  const family = signalFamily(label);
  return {
    bg: cssVar(`--color-signal-${family}-bg`),
    text: cssVar(`--color-signal-${family}-text`),
    border: cssVar(`--color-signal-${family}-border`),
  };
}

function sellerLabel(property: Property): string {
  if (property.fsbo) return 'Particulier';
  if (property.source === 'Biddit') return 'Notaire';
  return 'Agence';
}

function daysOnlineLabel(days: number): string {
  if (days <= 0) return 'Aujourd hui';
  if (days === 1) return '1 jour';
  return `${days} jours`;
}

const photoNavStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 0,
  borderRadius: 'var(--radius)',
  background: 'color-mix(in srgb, var(--color-text-primary) 48%, transparent)',
  opacity: 0,
  cursor: 'pointer',
  padding: 0,
  transition: 'opacity 0.14s ease',
};

export function PropertyCard({
  property,
  carouselIndex,
  onCarouselPrev,
  onCarouselNext,
  onToggleFavorite,
  onSelect,
  isFavorite,
  selected,
  primarySignal,
  secondarySignalCount = 0,
  opportunityReason,
  contactName,
  signals = [],
  scoreContent,
}: PropertyCardProps) {
  const photos = property.photos.length > 0 ? property.photos : propertyImageFallbacks(property.id);
  const currentPhoto = photos[carouselIndex % photos.length];
  const status = statusBadge(property);
  const signalLabel = primarySignal ?? property.tag;
  const signal = signalBadge(signalLabel);
  const price = formatEuro(property.price);
  const selectedShadow = 'none';
  const defaultShadow = 'none';

  return (
    <article
      className={`lv-property-card ${selected ? 'is-selected' : ''}`}
      style={{
        background: cssVar('--color-bg-surface'),
        border: selected ? '1px solid var(--color-brand)' : '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 150ms ease, border-color 150ms ease, transform 150ms ease',
        cursor: 'pointer',
        boxShadow: selected ? selectedShadow : defaultShadow,
      }}
      onClick={onSelect}
      onMouseEnter={(event) => {
        event.currentTarget.style.boxShadow = 'none';
        event.currentTarget.style.borderColor = 'var(--color-border-strong)';
        event.currentTarget.style.transform = 'translateY(-1px)';
        event.currentTarget.querySelectorAll<HTMLElement>('[data-photo-nav]').forEach((button) => { button.style.opacity = '1'; });
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.boxShadow = selected ? selectedShadow : defaultShadow;
        event.currentTarget.style.borderColor = selected ? 'var(--color-brand)' : 'var(--color-border-default)';
        event.currentTarget.style.transform = 'none';
        event.currentTarget.querySelectorAll<HTMLElement>('[data-photo-nav]').forEach((button) => { button.style.opacity = '0'; });
      }}
    >
      <div style={{ position: 'relative', height: 168, overflow: 'hidden', background: cssVar('--color-bg-muted'), flexShrink: 0 }}>
        <img
          src={currentPhoto}
          alt={property.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: cssVar('--color-bg-muted') }}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.opacity = '0';
          }}
        />

        {photos.length > 1 && (
          <>
            <button
              data-photo-nav
              onClick={onCarouselPrev}
              style={{ ...photoNavStyle, left: 6 }}
              onFocus={(event) => { event.currentTarget.style.opacity = '1'; }}
              aria-label="Photo précédente"
            >
              <ChevronLeft size={14} color={cssVar('--color-text-inverse')} />
            </button>
            <button
              data-photo-nav
              onClick={onCarouselNext}
              style={{ ...photoNavStyle, right: 6 }}
              onFocus={(event) => { event.currentTarget.style.opacity = '1'; }}
              aria-label="Photo suivante"
            >
              <ChevronRight size={14} color={cssVar('--color-text-inverse')} />
            </button>
          </>
        )}

        {signalLabel && (
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 6, maxWidth: 'calc(100% - 62px)' }}>
            <span style={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              background: signal.bg,
              color: signal.text,
              border: `1px solid ${signal.border}`,
              fontSize: 10.5,
              fontWeight: 650,
              fontFamily: 'var(--lv-font-mono, var(--notion-mono))',
              padding: '3px 8px',
              borderRadius: 0,
            }}>
              {signalLabel}
            </span>
            {secondarySignalCount > 0 && (
              <span style={{
                color: cssVar('--color-text-secondary'),
                background: 'color-mix(in srgb, var(--color-bg-surface) 84%, transparent)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 0,
                padding: '2px 6px',
                fontSize: 10.5,
                fontWeight: 650,
                fontFamily: 'var(--lv-font-mono, var(--notion-mono))',
                whiteSpace: 'nowrap',
              }}>
                + {secondarySignalCount} autres
              </span>
            )}
          </div>
        )}

        {photos.length > 1 && (
          <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
            {photos.map((_, index) => (
              <span key={index} style={{
                width: 6,
                height: 6,
                borderRadius: 'var(--radius)',
                background: index === carouselIndex % photos.length ? cssVar('--color-bg-surface') : 'color-mix(in srgb, var(--color-bg-surface) 50%, transparent)',
              }} />
            ))}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            maxWidth: 'calc(100% - 54px)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            borderRadius: 'var(--radius)',
            background: 'color-mix(in srgb, var(--color-text-primary) 70%, transparent)',
            color: 'color-mix(in srgb, var(--color-text-inverse) 90%, transparent)',
            fontSize: 10,
            fontWeight: 650,
            padding: '2px 6px',
            lineHeight: 1.1,
          }}
          title={property.source}
        >
          <Globe size={10} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{property.source}</span>
        </div>

        <button
          onClick={onToggleFavorite}
          style={{
            position: 'absolute', bottom: 8, right: 8,
            background: isFavorite ? cssVar('--color-favorite-bg') : 'color-mix(in srgb, var(--color-bg-surface) 88%, transparent)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius)',
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            boxShadow: 'none',
          }}
          title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Heart size={14} fill={isFavorite ? cssVar('--color-favorite') : 'none'} color={isFavorite ? cssVar('--color-favorite') : cssVar('--color-text-secondary')} />
        </button>
      </div>

      <div style={{ padding: '11px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--lv-font-mono, var(--notion-mono))', fontVariantNumeric: 'tabular-nums', color: cssVar('--color-text-primary'), lineHeight: 1 }}>
            {price}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 650,
            fontFamily: 'var(--lv-font-mono, var(--notion-mono))',
            padding: '2px 8px',
            borderRadius: 0,
            background: status.bg,
            color: status.text,
            border: `1px solid ${status.border}`,
          }}>
            {status.label}
          </span>
        </div>

        <p style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--font-sans, var(--notion-sans))',
          color: cssVar('--color-text-primary'),
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {property.title}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: cssVar('--color-text-secondary') }}>
          <MapPin size={12} />
          <span style={{ fontSize: 12, fontFamily: 'var(--font-sans, var(--notion-sans))' }}>{property.city}</span>
        </div>

        <SignalBadges signals={signals} />

        {scoreContent}

        {contactName && opportunityReason && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '13px minmax(0, 1fr)',
              alignItems: 'center',
              gap: 6,
              padding: '7px 8px',
              borderRadius: 'var(--radius)',
              background: cssVar('--color-signal-price-bg'),
              border: '1px solid var(--color-signal-price-border)',
              color: cssVar('--color-signal-price-text'),
              fontSize: 11.5,
              fontWeight: 650,
              lineHeight: 1.25,
            }}
            title={opportunityReason}
          >
            <Star size={12} fill={cssVar('--color-signal-price-text')} color={cssVar('--color-signal-price-text')} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opportunityReason}
            </span>
          </div>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          color: cssVar('--color-text-tertiary'),
          fontSize: 11.5,
          fontWeight: 560,
          marginTop: 1,
        }}>
          <span style={{ fontFamily: 'var(--lv-font-mono, var(--notion-mono))', fontVariantNumeric: 'tabular-nums' }}>{daysOnlineLabel(property.publishedDays)}</span>
          <span aria-hidden="true">-</span>
          <span style={{ color: property.fsbo ? cssVar('--color-brand') : cssVar('--color-text-secondary'), fontWeight: property.fsbo ? 680 : 560 }}>
            {sellerLabel(property)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: cssVar('--color-text-secondary'), fontSize: 12 }}>
            <Square size={11} />
            <span style={{ fontFamily: 'var(--lv-font-mono, var(--notion-mono))', fontVariantNumeric: 'tabular-nums' }}>{property.surface} m²</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: cssVar('--color-text-secondary'), fontSize: 12 }}>
            <Bed size={11} />
            <span style={{ fontFamily: 'var(--lv-font-mono, var(--notion-mono))', fontVariantNumeric: 'tabular-nums' }}>{property.bedrooms}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: cssVar('--color-text-secondary'), fontSize: 12 }}>
            <Bath size={11} />
            <span style={{ fontFamily: 'var(--lv-font-mono, var(--notion-mono))', fontVariantNumeric: 'tabular-nums' }}>{property.bathrooms}</span>
          </div>
        </div>

      </div>
    </article>
  );
}
