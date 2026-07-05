import { useEffect, useRef, useState } from 'react';

interface DeferredImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  eager?: boolean;
  rootMargin?: string;
}

export function DeferredImage({
  src,
  eager = false,
  rootMargin = '240px 0px',
  loading = 'lazy',
  decoding = 'async',
  ...imgProps
}: DeferredImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(eager);

  useEffect(() => {
    if (eager || shouldLoad) return undefined;

    const element = imageRef.current;
    if (!element) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [eager, rootMargin, shouldLoad]);

  return (
    <img
      {...imgProps}
      ref={imageRef}
      src={shouldLoad ? src : undefined}
      data-src={src}
      loading={loading}
      decoding={decoding}
    />
  );
}
