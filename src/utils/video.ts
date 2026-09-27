/** Video links for exercise media: YouTube (id + thumbnail) or any other https link. */
export type VideoLink =
  | { kind: 'youtube'; id: string; url: string; thumbnail: string }
  | { kind: 'link'; url: string; host: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseVideoUrl(input: string): VideoLink | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      id = m?.[2] ?? null;
    }
  }
  if (id && YT_ID.test(id)) {
    return {
      kind: 'youtube',
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    };
  }
  if (host.endsWith('youtube.com') || host === 'youtu.be') return null; // a YouTube URL without a video
  return { kind: 'link', url: u.toString(), host };
}
