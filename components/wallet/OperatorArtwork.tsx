export function OperatorArtwork({
  src,
  tier,
  accent,
  imageClassName,
  alt,
  loading,
  onError,
}: Readonly<{
  src: string;
  tier: number;
  accent: string;
  imageClassName: string;
  alt: string;
  loading?: "eager" | "lazy";
  onError?: () => void;
}>) {
  const boundedTier = Math.max(0, Math.min(4, Math.trunc(tier)));
  const large = imageClassName.includes("is-lg") || imageClassName.includes("nft-artwork-full");
  return (
    <span className={`operator-artwork-frame${large ? " is-lg" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Generated same-origin SVG. */}
      <img className={imageClassName} src={src} alt={alt} loading={loading} onError={onError} />
      {boundedTier > 0 && (
        <span
          className="operator-tier-overlay"
          style={{ "--operator-accent": accent } as React.CSSProperties}
          aria-hidden="true"
        >
          {Array.from({ length: boundedTier }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      )}
    </span>
  );
}
