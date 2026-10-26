import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Card, ConfirmDialog, SectionHeader, Text } from '@/components/ui';
import { useSetupFile } from '@/hooks/useSetupFile';
import { SetupError, type SetupFile } from '@/services/setup/format';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { logger } from '@/utils/logger';

/**
 * Settings → Backup "Setup file": an editable JSON of profile, goals, equipment, exercises,
 * workouts and the cycle. Import changes live setup only, never history or statistics.
 */
export function SetupFileCard() {
  const { t } = useTranslation(['settings', 'common']);
  const styles = useStyles();
  const setup = useSetupFile();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [pending, setPending] = useState<SetupFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doExport = async () => {
    setBusy('export');
    try {
      await setup.exportFile();
    } catch (e) {
      logger.error('Setup export failed', { error: e });
      toast.error(t('setup.exportFailed'));
    } finally {
      setBusy(null);
    }
  };

  const pick = async () => {
    setError(null);
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/json', '*/*'],
      copyToCacheDirectory: true,
    });
    const asset = r.canceled ? null : r.assets[0];
    if (!asset) return;
    try {
      setPending(await setup.read(asset.uri));
    } catch (e) {
      setError(e instanceof SetupError ? e.message : t('setup.unreadable'));
    }
  };

  const apply = async () => {
    if (!pending) return;
    setBusy('import');
    try {
      const r = await setup.apply(pending);
      toast.success(
        t('setup.imported', { workouts: r.workouts, exercises: r.exercises, days: r.cycleDays }),
      );
    } catch (e) {
      logger.error('Setup import failed', { error: e });
      setError(e instanceof Error ? e.message : t('setup.unreadable'));
    } finally {
      setBusy(null);
      setPending(null);
    }
  };

  return (
    <>
      <SectionHeader title={t('setup.title')} />
      <Card style={styles.card}>
        <Text tone="muted">{t('setup.intro')}</Text>
        <View style={styles.row}>
          <Button
            size="sm"
            icon="duplicate"
            label={t('setup.export')}
            loading={busy === 'export'}
            onPress={() => void doExport()}
            testID="setup-export"
          />
          <Button
            size="sm"
            variant="secondary"
            label={t('setup.import')}
            loading={busy === 'import'}
            onPress={() => void pick()}
            testID="setup-import"
          />
        </View>
        {error ? <Text tone="danger">{error}</Text> : null}
      </Card>
      <ConfirmDialog
        visible={pending !== null}
        title={t('setup.confirmTitle')}
        message={
          pending
            ? t('setup.confirmBody', {
                workouts: pending.workouts?.length ?? 0,
                exercises: pending.exercises?.length ?? 0,
                days: pending.cycle?.days.length ?? 0,
              })
            : ''
        }
        confirmLabel={t('setup.apply')}
        cancelLabel={t('common:cancel')}
        onCancel={() => setPending(null)}
        onConfirm={() => void apply()}
      />
    </>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.sm },
  row: { flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' },
}));
