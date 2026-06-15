import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { useState } from 'react';
import { ImageLightbox } from './ImageLightbox';

interface PhotoGalleryProps {
  images: string[];
  title: string;
  height?: number;
  showThumbnails?: boolean;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

export function PhotoGallery({
  images,
  title,
  height = 220,
  showThumbnails = true,
  initialIndex = 0,
  onIndexChange,
}: PhotoGalleryProps) {
  const safeImages = images.length > 0
    ? images
    : ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=900&q=80'];
  const [index, setIndex] = useState(initialIndex);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const currentIndex = ((index % safeImages.length) + safeImages.length) % safeImages.length;
  const currentImage = safeImages[currentIndex];

  const setSafeIndex = (nextIndex: number) => {
    const normalized = ((nextIndex % safeImages.length) + safeImages.length) % safeImages.length;
    setIndex(normalized);
    onIndexChange?.(normalized);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--notion-sans)' }}>
      <figure
        style={{
          position: 'relative',
          width: '100%',
          height,
          margin: 0,
          overflow: 'hidden',
          borderRadius: '8px 8px 0 0',
          background: '#E6E4DF',
        }}
      >
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label="Agrandir la photo"
          style={{ width: '100%', height: '100%', border: 0, padding: 0, background: 'transparent', cursor: 'zoom-in' }}
        >
          <img src={currentImage} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </button>

        {safeImages.length > 1 && (
          <>
            <button type="button" onClick={() => setSafeIndex(currentIndex - 1)} aria-label="Photo précédente" style={navButtonStyle('left')}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => setSafeIndex(currentIndex + 1)} aria-label="Photo suivante" style={navButtonStyle('right')}>
              <ChevronRight size={18} />
            </button>
          </>
        )}

        <button type="button" onClick={() => setLightboxOpen(true)} aria-label="Agrandir" style={expandButtonStyle}>
          <Maximize2 size={15} />
        </button>
        <figcaption style={counterStyle}>
          {currentIndex + 1} / {safeImages.length}
        </figcaption>
      </figure>

      {showThumbnails && safeImages.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(safeImages.length, 5)}, minmax(0, 1fr))`, gap: 6 }}>
          {safeImages.slice(0, 5).map((image, imageIndex) => (
            <button
              key={`${image}-${imageIndex}`}
              type="button"
              onClick={() => setSafeIndex(imageIndex)}
              style={{
                height: 52,
                padding: 0,
                border: imageIndex === currentIndex ? '2px solid #1E5A3A' : '2px solid transparent',
                borderRadius: 6,
                overflow: 'hidden',
                background: '#E6E4DF',
                cursor: 'pointer',
              }}
            >
              <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}

      <ImageLightbox
        open={lightboxOpen}
        images={safeImages}
        index={currentIndex}
        title={title}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setSafeIndex}
      />
    </div>
  );
}

function navButtonStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: 8,
    transform: 'translateY(-50%)',
    width: 30,
    height: 30,
    border: 0,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(255,255,255,0.9)',
    color: '#1D1F1E',
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(29,31,30,0.14)',
  };
}

const expandButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: 10,
  top: 10,
  width: 30,
  height: 30,
  border: 0,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(255,255,255,0.9)',
  color: '#1D1F1E',
  cursor: 'pointer',
  boxShadow: '0 1px 4px rgba(29,31,30,0.14)',
};

const counterStyle: React.CSSProperties = {
  position: 'absolute',
  left: 10,
  bottom: 10,
  padding: '4px 8px',
  borderRadius: 999,
  background: 'rgba(29,31,30,0.82)',
  color: '#FFFFFF',
  fontFamily: 'var(--notion-mono)',
  fontSize: 10.5,
  fontWeight: 700,
};
