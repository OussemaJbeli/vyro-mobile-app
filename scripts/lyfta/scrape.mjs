#!/usr/bin/env node
/**
 * Personal-use importer: exercise data + cover image + short video from lyfta.app for the
 * exercises in scripts/lyfta/targets.mjs. The media are Gymvisual assets licensed to
 * Lyfta: keep them private (they are git-ignored), never publish them.
 *
 *   node scripts/lyfta/scrape.mjs            # resumes; skips files already downloaded
 *   node scripts/lyfta/scrape.mjs --refresh  # re-fetch the pages too
 *
 * Output: scripts/lyfta/data/exercises.json, assets/images/exercises/<slug>.png,
 * assets/videos/exercises/<slug>.mp4. Polite: one request at a time, ~1 s apart.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TARGETS } from './targets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const cacheDir = join(here, 'cache');
const pagesDir = join(cacheDir, 'pages');
const imgDir = join(root, 'assets', 'images', 'exercises');
const vidDir = join(root, 'assets', 'videos', 'exercises');
const outFile = join(here, 'data', 'exercises.json');
for (const d of [cacheDir, pagesDir, imgDir, vidDir, dirname(outFile)]) {
  mkdirSync(d, { recursive: true });
}

const refresh = process.argv.includes('--refresh');
const UA = 'Mozilla/5.0 (personal exercise importer)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;

async function get(url, as = 'text') {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const wait = Math.max(0, last + 1000 - Date.now());
    if (wait) await sleep(wait);
    last = Date.now();
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (res.ok) return as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer());
      if (res.status === 404) return null;
      console.warn(`  ${res.status} ${url} (attempt ${attempt})`);
    } catch (e) {
      console.warn(`  ${e.message} ${url} (attempt ${attempt})`);
    }
    await sleep(2000 * attempt);
  }
  return null;
}

async function exerciseUrls() {
  const cached = join(cacheDir, 'exercise_urls.txt');
  if (existsSync(cached)) return readFileSync(cached, 'utf8').split('\n').filter(Boolean);
  const index = (await get('https://www.lyfta.app/sitemap.xml')) ?? '';
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = new Set();
  for (const m of maps) {
    const xml = (await get(m)) ?? '';
    for (const [, u] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (/lyfta\.app\/(en\/)?exercise\//.test(u)) urls.add(u.replace('/en/', '/'));
    }
  }
  writeFileSync(cached, [...urls].sort().join('\n'));
  return [...urls];
}

const baseName = (u) =>
  u
    .split('/')
    .pop()
    .replace(/-+[0-9a-z]{1,4}$/, '');
const suffix = (u) => u.split('/').pop().slice(baseName(u).length);

/** Candidate pages: exact names in priority order (canonical single-dash ids first), then the pattern. */
function candidates(target, urls) {
  const out = [];
  const rank = (a, b) =>
    (suffix(a).startsWith('--') ? 1 : 0) - (suffix(b).startsWith('--') ? 1 : 0) ||
    suffix(a).length - suffix(b).length;
  for (const n of target.names) out.push(...urls.filter((u) => baseName(u) === n).sort(rank));
  if (target.re) {
    const re = new RegExp(target.re);
    out.push(
      ...urls
        .filter((u) => re.test(baseName(u)) && !out.includes(u))
        .sort((a, b) => baseName(a).length - baseName(b).length || rank(a, b)),
    );
  }
  return [...new Set(out)].slice(0, 6);
}

async function page(url) {
  const file = join(pagesDir, `${url.split('/').pop()}.json`);
  if (!refresh && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const html = await get(url);
  const m =
    html && html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  const data = m ? (JSON.parse(m[1]).props?.pageProps?.firstData ?? null) : null;
  writeFileSync(file, JSON.stringify(data));
  return data;
}

const texts = (x) =>
  Array.isArray(x)
    ? x.map((s) => (typeof s === 'string' ? s : (s?.text ?? s?.step ?? JSON.stringify(s))))
    : [];

function ids(v) {
  if (Array.isArray(v)) return v.map(String);
  try {
    return JSON.parse(v ?? '[]').map(String);
  } catch {
    return [];
  }
}

async function main() {
  const urls = await exerciseUrls();
  console.log(`${urls.length} exercise pages in the sitemap; ${TARGETS.length} targets.`);
  const results = [];
  const missing = [];
  for (const [i, t] of TARGETS.entries()) {
    const list = candidates(t, urls);
    let picked = null;
    for (const u of list) {
      const d = await page(u);
      if (d?.video_file && d?.image_name) {
        picked = { url: u, d };
        break;
      }
    }
    if (!picked) {
      console.log(
        `[${i + 1}/${TARGETS.length}] ${t.slug}: no page with a video (${list.length} tried)`,
      );
      missing.push(t.slug);
      continue;
    }
    const { url, d } = picked;
    const img = join(imgDir, `${t.slug}.png`);
    const vid = join(vidDir, `${t.slug}.mp4`);
    if (!existsSync(img)) {
      const b = await get(d.image_name, 'buffer');
      if (b) writeFileSync(img, b);
    }
    if (!existsSync(vid)) {
      const b = await get(d.video_file, 'buffer');
      if (b) writeFileSync(vid, b);
    }
    results.push({
      slug: t.slug,
      extra: !!t.extra,
      name: d.name,
      source: url,
      exerciseType: d.exercise_type ?? null,
      bodyPartIds: ids(d.body_part_id),
      equipmentIds: ids(d.equipment_id),
      targetMuscleIds: ids(d.Target_muscles_id),
      synergistMuscleIds: ids(d.Synergist_muscles_id),
      overview: d.overview ?? '',
      instructions: texts(d.ex_instructions),
      tips: texts(d.exercise_tips),
      image: `assets/images/exercises/${t.slug}.png`,
      video: `assets/videos/exercises/${t.slug}.mp4`,
    });
    console.log(`[${i + 1}/${TARGETS.length}] ${t.slug} ← ${d.name} (${url.split('/').pop()})`);
  }
  writeFileSync(
    outFile,
    JSON.stringify({ importedAt: new Date().toISOString(), exercises: results, missing }, null, 2),
  );
  console.log(
    `\nDone: ${results.length} saved, ${missing.length} missing${missing.length ? `: ${missing.join(', ')}` : ''}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
