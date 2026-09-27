import { parseVideoUrl } from '../video';

describe('parseVideoUrl', () => {
  it('recognises YouTube watch, short, shorts and embed links', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ]) {
      expect(parseVideoUrl(url)).toEqual({
        kind: 'youtube',
        id: 'dQw4w9WgXcQ',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      });
    }
  });

  it('keeps other https links; rejects http, garbage and YouTube pages without a video', () => {
    expect(parseVideoUrl('https://vimeo.com/123456')).toEqual({
      kind: 'link',
      url: 'https://vimeo.com/123456',
      host: 'vimeo.com',
    });
    expect(parseVideoUrl('http://example.com/v.mp4')).toBeNull();
    expect(parseVideoUrl('not a url')).toBeNull();
    expect(parseVideoUrl('https://www.youtube.com/@channel')).toBeNull();
  });
});
