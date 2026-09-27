import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { VyroLogo } from '@/components/brand';
import { Button, Card, Divider, Header, ListRow, ScreenContainer, Text } from '@/components/ui';
import { useDatabaseStatus } from '@/hooks/database';
import { exportDiagnostics } from '@/services/diagnostics';
import { useSettingsStore } from '@/store/settingsStore';
import { makeStyles, useTheme } from '@/theme';

/** About / diagnostics (step 12). */
export default function AboutScreen() {
  const { t } = useTranslation('settings');
  const theme = useTheme();
  const styles = useStyles();
  const status = useDatabaseStatus();
  const seedVersion = useSettingsStore((s) => s.values.seed_version);
  const rows: [string, string][] = [
    [
      t('about.version'),
      Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '—',
    ],
    [t('about.build'), Application.nativeBuildVersion ?? '—'],
    [t('about.schema'), status.state === 'ready' ? `v${status.report.schemaVersion}` : '—'],
    [t('about.seed'), `v${seedVersion}`],
  ];
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('about.title')} onBack={() => goBack(routes.settings)} large={false} />
      <View style={styles.logo}>
        <VyroLogo width={200} color={theme.colors.primary} />
      </View>
      <Text tone="muted" align="center">
        {t('about.privacy')}
      </Text>
      <Card>
        {rows.map(([label, value], i) => (
          <View key={label}>
            {i > 0 ? <Divider /> : null}
            <ListRow title={label} trailing={<Text tone="muted">{value}</Text>} />
          </View>
        ))}
      </Card>
      <Card style={styles.card}>
        <Text variant="bodyStrong">{t('about.licenses')}</Text>
        <Text variant="caption" tone="muted">
          {t('about.licensesBody')}
        </Text>
      </Card>
      <Button
        label={t('about.diagnostics')}
        variant="secondary"
        fullWidth
        onPress={() => exportDiagnostics()}
      />
      <Text variant="caption" tone="muted" align="center">
        {t('about.diagnosticsHint')}
      </Text>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  logo: { alignItems: 'center', paddingVertical: t.spacing.xl },
  card: { gap: t.spacing.xs },
}));
