import { Bath, Bed, ChevronLeft, ChevronRight, Globe, Heart, MapPin, Square, Star } from 'lucide-react';
import type { Property } from '../../types';
import { SignalBadges } from '../SignalBadges';
import type { ListingSignal } from '../../lib/services/listingSignalsService';
import { resolvePropertyImages } from '../../lib/propertyImageFallbacks';
import { formatEuro } from '../../lib/formatCurrency';
import { DeferredImage } from '../ui/DeferredImage';

type SignalFamily = 'price' | 'behavior' | 'context' | 'alert';
type PriorityTone = 'high' | 'watch' | 'low';

interface PropertyCardProps {
  property: Property;
  priorityImage?: boolean;
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
  priorityTone?: PriorityTone;
  onSignalBadgeClick?: (signal: ListingSignal) => void;
  onPrimarySignalBadgeClick?: (label: string) => void;
  /** Nom de view-transition posé sur la photo quand cette carte est la source du morphing vers la fiche. */
  photoTransitionName?: string;
}

function cssVar(name: string) {
  return `var(${name})`;
}

// L'état par défaut ne se labellise pas : « Disponible » n'affiche rien,
// seuls les états d'exception (Sous option, Réservé, Archivé) méritent un badge.
function statusBadge(property: Property): { label: string; bg: string; text: string; border: string } | null {
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
  if (property.underOption) {
    return {
      label: 'Sous option',
      bg: cssVar('--color-warning-bg'),
      text: cssVar('--color-warning-text'),
      border: cssVar('--color-warning-border'),
    };
  }
  return null;
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
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return '1 jour';
  return `${days} jours`;
}

// Le rail de couleur ne s'affiche que lorsqu'il a quelque chose à dire :
// vert (score fort) ou ambre (à surveiller). Un score faible/absent n'a pas
// de rail — le gris « par défaut » salissait la carte sans informer.
function priorityAccent(tone: PriorityTone | undefined): string | null {
  if (tone === 'high') return '#1E5A3A';
  if (tone === 'watch') return '#8A6D1F';
  return null;
}

// Les flèches du carrousel vivent dans .lv-photo-nav (index.css) : zone de
// clic large (40×56) pour qu'un clic imprécis ne retombe jamais sur la carte
// (qui ouvrirait la fiche), visuel compact centré, pression au :active.

export function PropertyCard({
  property,
  priorityImage = false,
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
  priorityTone,
  onSignalBadgeClick,
  onPrimarySignalBadgeClick,
  photoTransitionName,
}: PropertyCardProps) {
  const photos = resolvePropertyImages(property.id, property.photos);
  const currentPhoto = photos[carouselIndex % photos.length];
  const status = statusBadge(property);
  const signalLabel = primarySignal ?? property.tag;
  const signal = signalBadge(signalLabel);
  const price = formatEuro(property.price);
  const hoverShadow = 'none';
  const selectedShadow = 'inset 3px 0 0 var(--color-brand)';
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
        position: 'relative',
        transition: 'box-shadow 150ms ease, border-color 150ms ease',
        boxShadow: selected ? selectedShadow : defaultShadow,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.boxShadow = selected ? selectedShadow : hoverShadow;
        event.currentTarget.style.borderColor = selected ? 'var(--color-brand)' : 'var(--color-border-strong)';
        event.currentTarget.querySelectorAll<HTMLElement>('[data-photo-nav]').forEach((button) => { button.style.opacity = '1'; });
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.boxShadow = selected ? selectedShadow : defaultShadow;
        event.currentTarget.style.borderColor = selected ? 'var(--color-brand)' : 'var(--color-border-default)';
        event.currentTarget.querySelectorAll<HTMLElement>('[data-photo-nav]').forEach((button) => { button.style.opacity = '0'; });
      }}
    >
      {priorityAccent(priorityTone) && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '0 auto 0 0',
            width: 3,
            background: priorityAccent(priorityTone) as string,
            opacity: 0.9,
            zIndex: 1,
          }}
        />
      )}
      <div className="lv-property-card-media" style={{ position: 'relative', height: 168, overflow: 'hidden', background: cssVar('--color-bg-muted'), flexShrink: 0 }}>
        <button
          type="button"
          className="lv-property-card-photo-button"
          onClick={onSelect}
          aria-label={`Ouvrir la fiche de ${property.title}`}
        >
          <DeferredImage
            key={currentPhoto}
            className="lv-property-card-photo"
            src={currentPhoto}
            alt={property.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: cssVar('--color-bg-muted'), viewTransitionName: photoTransitionName }}
            eager={priorityImage}
            loading={priorityImage ? 'eager' : 'lazy'}
            decoding="async"
            onError={(event) => {
              event.currentTarget.style.opacity = '0';
            }}
          />
        </button>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="lv-photo-nav"
              data-photo-nav
              data-card-interactive
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onCarouselPrev}
              style={{ left: 0 }}
              onFocus={(event) => { event.currentTarget.style.opacity = '1'; }}
              aria-label="Photo précédente"
            >
              <span><ChevronLeft size={15} /></span>
            </button>
            <button
              type="button"
              className="lv-photo-nav"
              data-photo-nav
              data-card-interactive
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onCarouselNext}
              style={{ right: 0 }}
              onFocus={(event) => { event.currentTarget.style.opacity = '1'; }}
              aria-label="Photo suivante"
            >
              <span><ChevronRight size={15} /></span>
            </button>
          </>
        )}

        {signalLabel && (
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 6, maxWidth: 'calc(100% - 62px)' }}>
            <button
              type="button"
              onClick={(event) => {
                if (!onPrimarySignalBadgeClick) return;
                event.stopPropagation();
                onPrimarySignalBadgeClick(signalLabel);
              }}
              style={{
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
              cursor: onPrimarySignalBadgeClick ? 'pointer' : 'default',
            }}>
              {signalLabel}
            </button>
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

        <span
          className={`lv-photo-counter${photos.length === 1 ? ' is-single' : ''}`}
          data-photo-nav
          aria-label={photos.length === 1 ? 'Une seule photo disponible' : `Photo ${(carouselIndex % photos.length) + 1} sur ${photos.length}`}
        >
          {photos.length === 1 ? '1 photo' : `${(carouselIndex % photos.length) + 1}/${photos.length}`}
        </span>

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
          type="button"
          data-card-interactive
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

      <div
        style={{ padding: '11px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, cursor: 'pointer' }}
        onClick={(event) => {
          if ((event.target as Element).closest('button, a, [data-card-interactive]')) return;
          onSelect();
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16.5, fontWeight: 700, fontFamily: 'var(--lv-font-title, var(--font-sans))', fontVariantNumeric: 'tabular-nums', color: cssVar('--color-text-primary'), lineHeight: 1 }}>
            {price}
          </span>
          {property.price > 0 && property.surface > 0 && (
            <span style={{ fontSize: 11, color: cssVar('--color-text-tertiary'), fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {Math.round(property.price / property.surface).toLocaleString('fr-BE')} €/m²
            </span>
          )}
          {status && (
            <span style={{
              fontSize: 11,
              fontWeight: 650,
              padding: '2px 8px',
              borderRadius: 0,
              background: status.bg,
              color: status.text,
              border: `1px solid ${status.border}`,
            }}>
              {status.label}
            </span>
          )}
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

        {/* Zones à hauteur FIXE : une seule ligne de badges (1 + compteur « +N »),
            jamais de retour à la ligne — le ring de score tombe ainsi exactement
            à la même hauteur sur toutes les cartes de la grille.
            L'absence de signal est une information, pas un trou : on l'écrit. */}
        <div style={{ height: 24, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          {signals.length > 0 ? (
            <SignalBadges signals={signals} onSignalClick={onSignalBadgeClick} maxVisible={1} />
          ) : (
            <span style={{ color: cssVar('--color-text-tertiary'), fontSize: 10.5, lineHeight: 1 }}>
              Aucun signal actif
            </span>
          )}
        </div>

        <div style={{ height: 48, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          {scoreContent}
        </div>

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
          // Absorbe l'espace excédentaire des rangées égalisées : le pied de
          // carte (jours/vendeur + métriques) reste ancré en bas partout, et le
          // filet supérieur fait lire l'espace au-dessus comme une respiration
          // voulue, pas comme un manque.
          marginTop: 'auto',
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: 8,
        }}>
          <span style={{
            fontVariantNumeric: 'tabular-nums',
            // Au-delà de 90 jours, la durée devient un signal en soi : vendeur fatigué.
            color: property.publishedDays > 90 ? cssVar('--lv-ocre') : undefined,
            fontWeight: property.publishedDays > 90 ? 680 : undefined,
          }}>{daysOnlineLabel(property.publishedDays)}</span>
          <span aria-hidden="true">·</span>
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
