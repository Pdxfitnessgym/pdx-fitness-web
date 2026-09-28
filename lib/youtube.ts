// Handles every form YouTube hands out when you tap Share: watch links, youtu.be
// short links, embeds, Shorts and live URLs. Shorts in particular are easy to
// paste from a phone and used to silently fail to render.
export function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([^&\n?#/]+)/,
  );
  return match ? match[1] : null;
}
