import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { Card, Divider, Header, Radio, ScreenContainer } from '@/components/ui';
import { useSettingsStore } from '@/store/settingsStore';

const OPTIONS = ['system', 'en', 'fr'] as const;

/** Language (step 12): applies instantly, no restart (UI §36). */
export default function LanguageScreen() {
  const { t } = useTranslation('settings');
  const language = useSettingsStore((s) => s.values.language);
  const set = useSettingsStore((s) => s.set);
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('language.title')} onBack={() => goBack(routes.settings)} large={false} />
      <Card>
        {OPTIONS.map((opt, i) => (
          <View key={opt}>
            {i > 0 ? <Divider /> : null}
            <Radio
              label={t(`language.${opt}`)}
              selected={language === opt}
              onSelect={() => set('language', opt).catch(() => {})}
              testID={`language-${opt}`}
            />
          </View>
        ))}
      </Card>
    </ScreenContainer>
  );
}
