// Shows an icon from its SVG markup at a given size. The markup is stored already cleaned by the server (scripts, event handlers, images and external references are removed), so it is safe to place inline; inline is needed so `currentColor` icons follow the text colour and the theme.
import { cn } from "../../lib/cn";

type SvgPreviewProps = {
  svg: string;
  // Edge length in pixels.
  size?: number;
  className?: string;
  // Give a label when the icon is the only thing conveying meaning; otherwise it is hidden from screen readers.
  label?: string;
};

export default function SvgPreview({ svg, size = 32, className, label }: SvgPreviewProps) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0 items-center justify-center text-foreground [&>svg]:h-full [&>svg]:w-full", className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
