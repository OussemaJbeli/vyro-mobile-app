import { openDatabase, type Database } from '../client';
import { migrations } from '../migrations';
import { runMigrations } from '../migrations/runner';
import { createRepositories, type Repositories } from '../repositories';
import { seedId } from '../seed/ids';
import { seedDatabase } from '../seed/seed';
import { openNodeDriver } from '../testing/nodeDriver';

let db: Database;
let r: Repositories;
beforeEach(async () => {
  db = await openDatabase(openNodeDriver());
  await runMigrations(db, migrations);
  await seedDatabase(db);
  r = createRepositories(db);
});
afterEach(() => db.driver.close());

describe('exercise media', () => {
  it('adds images, GIFs and videos in order; thumbnails use the first image; makeFirst reorders', async () => {
    const bench = seedId.exercise('bench_press');
    const video = await r.exerciseMedia.add({
      exerciseId: bench,
      kind: 'video',
      filePath: null,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    const img = await r.exerciseMedia.add({
      exerciseId: bench,
      kind: 'image',
      filePath: 'media/exercises/a.jpg',
      url: null,
    });
    const gif = await r.exerciseMedia.add({
      exerciseId: bench,
      kind: 'gif',
      filePath: 'media/exercises/b.gif',
      url: null,
    });
    expect((await r.exerciseMedia.list(bench)).map((m) => m.id)).toEqual([
      video.id,
      img.id,
      gif.id,
    ]);
    expect(await r.exerciseMedia.thumbnails()).toEqual({ [bench]: 'media/exercises/a.jpg' });
    await r.exerciseMedia.makeFirst(bench, gif.id);
    expect(await r.exerciseMedia.thumbnails()).toEqual({ [bench]: 'media/exercises/b.gif' });
    await r.exerciseMedia.remove(gif.id);
    expect((await r.exerciseMedia.list(bench)).map((m) => m.id)).toEqual([video.id, img.id]);
  });

  it('rejects absolute paths, non-https links and a video without a URL', async () => {
    const bench = seedId.exercise('bench_press');
    await expect(
      r.exerciseMedia.add({ exerciseId: bench, kind: 'image', filePath: '/etc/x.jpg', url: null }),
    ).rejects.toBeTruthy();
    await expect(
      r.exerciseMedia.add({
        exerciseId: bench,
        kind: 'video',
        filePath: null,
        url: 'http://x.com',
      }),
    ).rejects.toBeTruthy();
    await expect(
      db.run(
        "INSERT INTO exercise_media (id, exercise_id, kind, order_index, created_at, updated_at) VALUES ('x', ?, 'video', 0, 'a', 'a')",
        [bench],
      ),
    ).rejects.toBeTruthy();
  });
});
