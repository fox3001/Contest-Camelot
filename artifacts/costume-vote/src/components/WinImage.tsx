import { optimizedImage } from "@/lib/images";
import { useTheme } from "@/lib/theme";

/** Immagine mostrata a chi vince la Target Hunt (si cambia da Aspetto); senza immagine, una coppa. */
export function WinImage({ small = false }: { small?: boolean }) {
  const { theme } = useTheme();
  const url = theme.winImage.url;
  if (!url) {
    return (
      <p className={small ? "text-3xl" : "text-7xl"} aria-hidden="true">
        🏆
      </p>
    );
  }
  return (
    <img
      src={optimizedImage(url, 800)}
      alt="Premio"
      className={`mx-auto rounded-2xl object-contain ${small ? "max-h-32" : "max-h-[38vh]"} max-w-full`}
    />
  );
}
