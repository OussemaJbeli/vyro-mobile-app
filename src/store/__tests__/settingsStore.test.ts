import { defaultSettings } from '@/types/settings';

import { bindSettingsPersistence, useSettingsStore } from '../settingsStore';

afterEach(() => {
  bindSettingsPersistence(null);
  useSettingsStore.setState({ values: defaultSettings, hydrated: false });
});

describe('settings store', () => {
  it('hydrates and writes changes through', async () => {
    const persist = jest.fn(async () => {});
    bindSettingsPersistence(persist);
    useSettingsStore.getState().hydrate({ ...defaultSettings, accent: 'teal' });
    expect(useSettingsStore.getState()).toMatchObject({
      hydrated: true,
      values: { accent: 'teal' },
    });
    await useSettingsStore.getState().set('accent', 'blue');
    expect(persist).toHaveBeenCalledWith('accent', 'blue');
    expect(useSettingsStore.getState().values.accent).toBe('blue');
  });

  it('rolls back when saving fails', async () => {
    bindSettingsPersistence(async () => {
      throw new Error('disk full');
    });
    await expect(useSettingsStore.getState().set('theme', 'light')).rejects.toThrow('disk full');
    expect(useSettingsStore.getState().values.theme).toBe('dark');
  });
});
