import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselNavButtonProps {
  direction: 'previous' | 'next';
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  persistent?: boolean;
}

export function CarouselNavButton({ direction, onClick, persistent = false }: CarouselNavButtonProps) {
  const isPrevious = direction === 'previous';
  const Icon = isPrevious ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      className={`lv-photo-nav${persistent ? ' lv-photo-nav--persistent' : ''}`}
      data-photo-nav
      data-card-interactive
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick(event);
      }}
      style={isPrevious ? { left: 0 } : { right: 0 }}
      aria-label={isPrevious ? 'Photo précédente' : 'Photo suivante'}
    >
      <span><Icon size={15} /></span>
    </button>
  );
}
