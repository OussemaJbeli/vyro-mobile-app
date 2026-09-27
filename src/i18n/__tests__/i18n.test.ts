import { i18n, resolveLanguage, setLanguage } from '..';
import { resources } from '../resources';

type Tree = { [k: string]: string | Tree };

const flatten = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`),
  );

describe('i18n', () => {
  it('has the same keys in English and French for every namespace', () => {
    expect(Object.keys(resources.fr).sort()).toEqual(Object.keys(resources.en).sort());
    for (const ns of Object.keys(resources.en) as (keyof typeof resources.en)[]) {
      const en = flatten(resources.en[ns] as Tree).sort();
      const fr = flatten(resources.fr[ns] as Tree).sort();
      expect({ ns, keys: fr }).toEqual({ ns, keys: en });
    }
  });

  it('has no empty translations', () => {
    for (const lang of Object.values(resources)) {
      for (const ns of Object.values(lang)) {
        flatten(ns as Tree).forEach((key) => expect(key).toBeTruthy());
        expect(JSON.stringify(ns)).not.toContain('""');
      }
    }
  });

  it('switches language instantly and pluralizes', async () => {
    await setLanguage('fr');
    expect(i18n.t('nav:home')).toBe('Accueil');
    expect(i18n.t('common:streakDays', { count: 1 })).toBe('1 jour');
    await setLanguage('en');
    expect(i18n.t('common:streakDays', { count: 7 })).toBe('7 days');
    expect(resolveLanguage('fr')).toBe('fr');
  });
});
