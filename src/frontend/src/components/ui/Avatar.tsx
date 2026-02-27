import { cn } from "../../utils/cn";
import { sanitizeMediaUrl } from "../../utils/sanitizeUrl";

type AvatarSize = "sm" | "md" | "lg";

type Props = {
  src?: string;
  alt: string;
  fallback?: string;
  size?: AvatarSize;
  className?: string;
};

const sizeStyles: Record<AvatarSize, string> = {
  sm: "w-8 h-8 text-sm",
  md: "w-12 h-12 text-base",
  lg: "w-16 h-16 text-xl",
};

const sizePx: Record<AvatarSize, number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

export function Avatar({ src, alt, fallback, size = "md", className }: Props) {
  const fallbackText = fallback || alt.charAt(0).toUpperCase();
  const safeSrc = sanitizeMediaUrl(src);

  return (
    <div className={cn("relative rounded-full overflow-hidden flex-shrink-0", sizeStyles[size], className)}>
      {safeSrc ? (
        <img
          src={safeSrc}
          alt={alt}
          width={sizePx[size]}
          height={sizePx[size]}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-white/30 flex items-center justify-center font-bold text-white">
          {fallbackText}
        </div>
      )}
    </div>
  );
}
