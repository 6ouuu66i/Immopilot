interface PageIllustrationHeaderProps {
  imageUrl: string;
  height?: number;
  padding?: string;
  borderRadius?: number;
  backgroundColor?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  marginTop?: number;
  className?: string;
}

export function PageIllustrationHeader({
  imageUrl,
  height = 150,
  padding = '12px 32px 0',
  borderRadius = 10,
  backgroundColor = '#F7F6F3',
  backgroundSize = '100% auto',
  backgroundPosition = 'center 50%',
  marginTop = 0,
  className,
}: PageIllustrationHeaderProps) {
  return (
    <div className={className} style={{ padding, marginTop }}>
      <div
        aria-hidden="true"
        style={{
          width: '100%',
          height,
          borderRadius,
          overflow: 'hidden',
          backgroundColor,
          backgroundImage: `url("${imageUrl}")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition,
          backgroundSize,
        }}
      />
    </div>
  );
}
