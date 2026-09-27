import { type ProgressPhoto } from '@/types/domain';

import { categoryTree, purgeable, resolvePath } from '../paths';
import { createPhotoStore, type PhotoFs, type PhotoRepoLike } from '../storage';

function fakeFs(): PhotoFs & { files: Set<string> } {
  const files = new Set<string>();
  return {
    files,
    writeImage: async (_src, rel) => {
      files.add(rel);
      return { width: 1536, height: 2048, bytes: 1000 };
    },
    remove: async (rel) => {
      files.delete(rel);
    },
    exists: (rel) => files.has(rel),
    listFiles: () => [...files],
  };
}

function fakeRepo(fail = false): PhotoRepoLike & { rows: ProgressPhoto[] } {
  const rows: ProgressPhoto[] = [];
  return {
    rows,
    create: async (input, opts) => {
      if (fail) throw new Error('DB write failed');
      const row = { ...input, id: opts?.id ?? 'x', createdAt: '', updatedAt: '', deletedAt: null };
      rows.push(row);
      return row;
    },
    softDelete: async (id) => {
      rows.find((r) => r.id === id)!.deletedAt = new Date(NOW - 8 * 86_400_000).toISOString();
    },
    deleted: async () => rows.filter((r) => r.deletedAt !== null),
    purge: async (id) => {
      rows.splice(
        rows.findIndex((r) => r.id === id),
        1,
      );
    },
    all: async () => rows.filter((r) => r.deletedAt === null),
  };
}

const NOW = Date.parse('2026-09-26T10:00:00Z');

describe('photo store', () => {
  it('writes the original and thumbnail, then the row', async () => {
    const fs = fakeFs();
    const repo = fakeRepo();
    const p = await createPhotoStore(fs, repo, () => NOW).savePhoto('file:///tmp/a.jpg', {
      category: 'body',
      subCategory: 'body.front',
    });
    expect(p.filePath).toBe(`photos/body/2026/${p.id}.jpg`);
    expect(p.thumbPath).toBe(`thumbs/${p.id}.jpg`);
    expect([...fs.files].sort()).toEqual([p.filePath, p.thumbPath].sort());
  });

  it('removes written files when the database insert fails (no orphans)', async () => {
    const fs = fakeFs();
    await expect(
      createPhotoStore(fs, fakeRepo(true), () => NOW).savePhoto('file:///tmp/a.jpg', {
        category: 'hair',
        subCategory: null,
      }),
    ).rejects.toThrow('DB write failed');
    expect(fs.files.size).toBe(0);
  });

  it('purges files and rows only after the 7-day window; sweeps orphans', async () => {
    const fs = fakeFs();
    const repo = fakeRepo();
    const store = createPhotoStore(fs, repo, () => NOW);
    const p = await store.savePhoto('file:///tmp/a.jpg', {
      category: 'body',
      subCategory: 'body.side',
    });
    fs.files.add('thumbs/stray.jpg');
    expect((await store.sweepOrphans()).filesWithoutRows).toEqual(['thumbs/stray.jpg']);
    await store.deletePhoto(p.id);
    expect(await store.purgeExpired()).toBe(1);
    expect(fs.files.has(p.filePath)).toBe(false);
    expect(repo.rows).toHaveLength(0);
  });
});

describe('paths and categories', () => {
  it('resolves only private relative paths', () => {
    expect(resolvePath('file:///data/app/', 'thumbs/a.jpg')).toBe(
      'file:///data/app/vyro-private/thumbs/a.jpg',
    );
    expect(() => resolvePath('file:///data', '/etc/passwd')).toThrow();
    expect(() => resolvePath('file:///data', '../x.jpg')).toThrow();
  });

  it('purgeable keeps photos deleted less than 7 days ago', () => {
    const day = 86_400_000;
    const rows = [
      { id: 'a', deletedAt: new Date(NOW - 6 * day).toISOString() },
      { id: 'b', deletedAt: new Date(NOW - 7 * day).toISOString() },
      { id: 'c', deletedAt: null },
    ];
    expect(purgeable(rows, NOW).map((r) => r.id)).toEqual(['b']);
  });

  it('builds the Body/Hair/Beard tree', () => {
    const tree = categoryTree([
      { slug: 'hair', parentSlug: null, orderIndex: 1 },
      { slug: 'body', parentSlug: null, orderIndex: 0 },
      { slug: 'body.side', parentSlug: 'body', orderIndex: 1 },
      { slug: 'body.front', parentSlug: 'body', orderIndex: 0 },
      { slug: 'hair.top', parentSlug: 'hair', orderIndex: 0 },
    ]);
    expect(tree).toEqual([
      { slug: 'body', children: ['body.front', 'body.side'] },
      { slug: 'hair', children: ['hair.top'] },
    ]);
  });
});
