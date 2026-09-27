import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { usePhotoStore } from '@/components/photos/usePhotoStore';
import {
  Button,
  Card,
  Divider,
  Header,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Text,
  Toggle,
} from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { invalidates } from '@/hooks/data';
import { photosSupported } from '@/services/photos/nativeFs';
import { useLockStore } from '@/store/lockStore';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';

/** Settings → Privacy (step 26, FS §28/§63): lock, previews, screenshots, deleted photos. */
export function PrivacySettings() {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const client = useQueryClient();
  const values = useSettingsStore((s) => s.values);
  const set = useSettingsStore((s) => s.set);
  const armed = useLockStore((s) => s.armed);
  const store = usePhotoStore();
  const toggle = (
    key: 'lock.hidePreviews' | 'privacy.blockScreenshots',
    label: string,
    hint: string,
  ) => (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      </View>
      <Toggle
        value={values[key]}
        onChange={(v) => void set(key, v)}
        accessibilityLabel={label}
        testID={`privacy-${key}`}
      />
    </View>
  );
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('items.privacy')} onBack={() => goBack(routes.settings)} large={false} />
      <Card style={styles.gap}>
        <ListRow
          title={t('privacy.lock')}
          trailing={<Text variant="bodyStrong">{armed ? t('privacy.on') : t('privacy.off')}</Text>}
          onPress={() => router.push(routes.appLock)}
        />
        <Divider />
        {toggle('lock.hidePreviews', t('privacy.previews'), t('privacy.previewsHint'))}
        <Divider />
        {toggle('privacy.blockScreenshots', t('privacy.screenshots'), t('privacy.screenshotsHint'))}
      </Card>
      {photosSupported ? (
        <Button
          size="md"
          variant="secondary"
          label={t('privacy.clearDeleted')}
          onPress={() =>
            void store.purgeAllDeleted().then(async (n) => {
              await Promise.all(
                invalidates.photos.map((queryKey) =>
                  client.invalidateQueries({ queryKey: [...queryKey] }),
                ),
              );
              toast.info(t('privacy.cleared', { count: n }));
            })
          }
          testID="privacy-clear-deleted"
        />
      ) : null}
      <SectionHeader title={t('privacy.stays')} />
      <Card style={styles.gap}>
        <Text>{t('privacy.staysBody')}</Text>
        <Text variant="bodyStrong">{t('privacy.backups')}</Text>
        <Text tone="muted">{t('privacy.backupsBody')}</Text>
        <Text variant="caption" tone="muted">
          {t('privacy.honest')}
        </Text>
      </Card>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: 44 },
  flex: { flex: 1 },
}));
