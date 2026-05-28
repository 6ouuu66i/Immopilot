import { Bath, Bed, ChevronLeft, ChevronRight, Globe, Heart, MapPin, Square, Star } from 'lucide-react';
import type { Property } from '../../types';

interface PropertyCardProps {
  property: Property;
  carouselIndex: number;
  onCarouselPrev: (e: React.MouseEvent) => void;
  onCarouselNext: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onSelect: () => void;
  isFavorite: boolean;
  selected?: boolean;
}

function scoreGrade(score: number): { label: string; bg: string } {
  if (score >= 75) return { label: 'A', bg: '#1E5A3A' };
  if (score >= 55) return { label: 'B', bg: '#2D6A4F' };
  if (score >= 35) return { label: 'C', bg: '#D97706' };
  if (score >= 15) return { label: 'D', bg: '#92400E' };
  return { label: 'E', bg: '#991B1B' };
}

function tagBadge(property: Property): { label: string; bg: string; text: string } | null {
  if (property.reserved) return { label: 'Réservé', bg: '#374151', text: '#fff' };
  if (property.tag === 'Coup de cœur') return { label: 'Coup de cœur', bg: '#D97706', text: '#fff' };
  if (property.tag === 'Nouveau') return { label: 'Nouveau', bg: '#1E5A3A', text: '#fff' };
  if (property.tag === 'Baisse de prix') return { label: 'Prix', bg: '#1D4ED8', text: '#fff' };
  if (property.tag === 'Republié') return { label: 'Republié', bg: '#7C3AED', text: '#fff' };
  if (property.tag === 'FSBO' || property.fsbo) return { label: 'FSBO', bg: '#0E7490', text: '#fff' };
  return null;
}

const priceFormatter = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function PropertyCard({
  property,
  carouselIndex,
  onCarouselPrev,
  onCarouselNext,
  onToggleFavorite,
  onSelect,
  isFavorite,
  selected,
}: PropertyCardProps) {
  const photos = property.photos.length > 0 ? property.photos : ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80'];
  const currentPhoto = photos[carouselIndex % photos.length];
  const badge = tagBadge(property);
  const grade = scoreGrade(property.score);
  const price = priceFormatter.format(property.price).replace(/\s?EUR/, ' €');

  return (
    <article
      style={{
        background: '#fff',
        border: selected ? '1px solid #1E5A3A' : '1px solid #E6E4DF',
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
        cursor: 'pointer',
        boxShadow: selected ? '0 0 0 3px rgba(30, 90, 58, 0.12)' : 'none',
      }}
      onClick={onSelect}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = selected
          ? '0 0 0 3px rgba(30, 90, 58, 0.12), 0 4px 16px rgba(0,0,0,0.08)'
          : '0 4px 16px rgba(0,0,0,0.08)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = selected ? '0 0 0 3px rgba(30, 90, 58, 0.12)' : 'none';
        (e.currentTarget as HTMLElement).style.transform = 'none';
      }}
    >
      {/* Photo carousel */}
      <div style={{ position: 'relative', height: 180, overflow: 'hidden', background: '#F3F2EF', flexShrink: 0 }}>
        <img
          src={currentPhoto}
          alt={property.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />

        {/* Prev/Next arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={onCarouselPrev}
              style={{
                position: 'absolute', top: '50%', left: 6, transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: '50%',
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              <ChevronLeft size={15} color="#1D1F1E" />
            </button>
            <button
              onClick={onCarouselNext}
              style={{
                position: 'absolute', top: '50%', right: 6, transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.88)', border: 'none', borderRadius: '50%',
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              <ChevronRight size={15} color="#1D1F1E" />
            </button>
          </>
        )}

        {/* Tag badge top-left */}
        {badge && (
          <span style={{
            position: 'absolute', top: 8, left: 8,
            background: badge.bg, color: badge.text,
            fontSize: 11, fontWeight: 600, fontFamily: 'var(--notion-sans)',
            padding: '3px 8px', borderRadius: 4, letterSpacing: '0.02em',
          }}>
            {badge.label}
          </span>
        )}

        {/* "Prix" secondary badge for reserved with price drop */}
        {property.reserved && property.tag === 'Baisse de prix' && (
          <span style={{
            position: 'absolute', top: 8, left: badge ? 80 : 8,
            background: '#1D4ED8', color: '#fff',
            fontSize: 11, fontWeight: 600, fontFamily: 'var(--notion-sans)',
            padding: '3px 8px', borderRadius: 4,
          }}>
            Prix
          </span>
        )}

        {/* Dot indicators */}
        {photos.length > 1 && (
          <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
            {photos.map((_, i) => (
              <span key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i === carouselIndex % photos.length ? '#fff' : 'rgba(255,255,255,0.5)',
              }} />
            ))}
          </div>
        )}

        {/* Favorite heart button */}
        <button
          onClick={onToggleFavorite}
          style={{
            position: 'absolute', bottom: 8, right: 8,
            background: '#fff', border: 'none', borderRadius: '50%',
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}
          title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Heart size={14} fill={isFavorite ? '#ef4444' : 'none'} color={isFavorite ? '#ef4444' : '#6B6F6D'} />
        </button>
      </div>

      {/* Card body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {/* Price + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--notion-sans)', color: '#1D1F1E', lineHeight: 1 }}>
            {price}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 500, fontFamily: 'var(--notion-sans)',
            padding: '2px 8px', borderRadius: 99,
            background: property.reserved ? '#F3F2EF' : '#EAF7EF',
            color: property.reserved ? '#6B6F6D' : '#166534',
          }}>
            {property.reserved ? 'Réservé' : 'Disponible'}
          </span>
        </div>

        {/* Title */}
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 600,
          fontFamily: 'var(--notion-sans)', color: '#1D1F1E',
          lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {property.title}
        </p>

        {/* City */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6B6F6D' }}>
          <MapPin size={12} />
          <span style={{ fontSize: 12, fontFamily: 'var(--notion-sans)' }}>{property.city}</span>
        </div>

        {/* Specs + score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#6B6F6D', fontSize: 12 }}>
            <Square size={11} />
            <span>{property.surface} m²</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#6B6F6D', fontSize: 12 }}>
            <Bed size={11} />
            <span>{property.bedrooms}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#6B6F6D', fontSize: 12 }}>
            <Bath size={11} />
            <span>{property.bathrooms}</span>
          </div>
          <span style={{
            marginLeft: 'auto',
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--notion-mono)',
            background: grade.bg, color: '#fff',
            width: 22, height: 22, borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {grade.label}
          </span>
        </div>

        {/* Source + star */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#9A9A9A' }}>
            <Globe size={12} />
            <span style={{ fontSize: 12, fontFamily: 'var(--notion-sans)' }}>{property.source}</span>
          </div>
          <button
            onClick={onToggleFavorite}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
            title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Star size={14} fill={isFavorite ? '#D97706' : 'none'} color={isFavorite ? '#D97706' : '#E6E4DF'} />
          </button>
        </div>
      </div>
    </article>
  );
}
