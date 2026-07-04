import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect } from 'react';

interface ImageLightboxProps {
  open: boolean;
  images: string[];
  index: number;
  title?: string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function ImageLightbox({
  open,
  images,
  index,
  title = 'Image agrandie',
  onClose,
  onIndexChange,
}: ImageLightboxProps) {
  const safeImages = images.length > 0 ? images : [];
  const currentIndex = safeImages.length ? ((index % safeImages.length) + safeImages.length) % safeImages.length : 0;
  const currentImage = safeImages[currentIndex];

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') goTo(-1);
      if (event.key === 'ArrowRight') goTo(1);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, currentIndex, safeImages.length, onClose]);

  const goTo = (direction: 1 | -1) => {
    if (safeImages.length <= 1) return;
    onIndexChange(((currentIndex + direction) % safeImages.length + safeImages.length) % safeImages.length);
  };

  if (!open || !currentImage) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'grid',
        placeItems: 'center',
        padding: 32,
        background: 'color-mix(in srgb, var(--color-text-primary) 82%, transparent)',
        fontFamily: 'var(--notion-sans)',
      }}
    >
      <button type="button" onClick={onClose} aria-label="Fermer" style={closeStyle}>
        <X size={20} />
      </button>

      {safeImages.length > 1 && (
        <>
          <button type="button" onClick={(event) => { event.stopPropagation(); goTo(-1); }} aria-label="Image précédente" style={navStyle('left')}>
            <ChevronLeft size={24} />
          </button>
          <button type="button" onClick={(event) => { event.stopPropagation(); goTo(1); }} aria-label="Image suivante" style={navStyle('right')}>
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <figure
        onClick={(event) => event.stopPropagation()}
        style={{
          margin: 0,
          width: 'min(1180px, 92vw)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <img
          src={currentImage}
          alt={title}
          style={{
            maxWidth: '100%',
            maxHeight: '82vh',
            objectFit: 'contain',
            borderRadius: 10,
            background: 'var(--color-text-primary)',
            boxShadow: '0 24px 80px color-mix(in srgb, var(--color-text-primary) 36%, transparent)',
          }}
        />
        {safeImages.length > 1 && (
          <figcaption style={{ color: 'var(--color-text-inverse)', fontSize: 12.5, fontWeight: 650, opacity: 0.86 }}>
            {currentIndex + 1} / {safeImages.length} · {title}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

const closeStyle: React.CSSProperties = {
  position: 'fixed',
  top: 18,
  right: 18,
  width: 38,
  height: 38,
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--color-text-inverse) 32%, transparent)',
  background: 'color-mix(in srgb, var(--color-text-inverse) 12%, transparent)',
  color: 'var(--color-text-inverse)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  backdropFilter: 'blur(10px)',
};

function navStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'fixed',
    top: '50%',
    [side]: 24,
    transform: 'translateY(-50%)',
    width: 46,
    height: 46,
    borderRadius: 999,
    border: '1px solid color-mix(in srgb, var(--color-text-inverse) 32%, transparent)',
    background: 'color-mix(in srgb, var(--color-text-inverse) 14%, transparent)',
    color: 'var(--color-text-inverse)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(10px)',
  };
}
