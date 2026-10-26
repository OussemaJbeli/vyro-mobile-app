import * as DocumentPicker from 'expo-document-picker';

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Button,
  Card,
  ConfirmDialog,
  Header,
  Input,
  OptionCard,
  ProgressBar,
  ScreenContainer,
  SectionHeader,
  Text,
  Toggle,
} from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { useBackup, type PreparedImport } from '@/hooks/useBackup';
import { estimateBytes } from '@/services/backup/files';
import { BackupError } from '@/services/backup/format';
import { photosSupported } from '@/services/photos/nativeFs';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { logger } from '@/utils/logger';
import { SetupFileCard } from './SetupFileCard';

const size = (bytes: number) =>
  bytes > 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} kB`;

type Strategy = 'merge' | 'replace';

/** Settings → Backup (step 27, FS §59–§60): export, validated import with preview. */
export function BackupSettings() {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const styles = useStyles();
  const backup = useBackup();
  const lastAt = useSettingsStore((s) => s.values['backup.lastAt']);
  const reminder = useSettingsStore((s) => s.values['notifications.backup']);
  const set = useSettingsStore((s) => s.set);
  const [photos, setPhotos] = useState(false);
  const [stats, setStats] = useState<{ counts: Record<string, number>; photoBytes: number } | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const [file, setFile] = useState<{ uri: string; name: string } | null>(null);
  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [strategy, setStrategy] = useState<Strategy>('merge');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void backup.stats().then((s) => alive && setStats(s));
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const explain = (e: unknown) => {
    if (e instanceof BackupError) return t(`backup.errors.${e.code}`, { detail: e.detail ?? '' });
    logger.warn('Import failed', { error: e });
    return t('backup.errors.UNKNOWN');
  };

  const validate = async (f: { uri: string; name: string }, s: Strategy) => {
    setError(null);
    setPrepared(null);
    try {
      setPrepared(await backup.prepareImport(f.uri, f.name, s));
    } catch (e) {
      setError(explain(e));
    }
  };

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'application/zip', '*/*'],
      copyToCacheDirectory: true,
    });
    const asset = r.canceled ? null : r.assets[0];
    if (!asset) return;
    const f = { uri: asset.uri, name: asset.name };
    setFile(f);
    setTyped('');
    await validate(f, strategy);
  };

  const run = async () => {
    if (!prepared) return;
    setConfirm(false);
    setProgress({ done: 0, total: 1 });
    try {
      const res = await backup.runImport(prepared, strategy, (done, total) =>
        setProgress({ done, total }),
      );
      toast.success(t('backup.done', { inserted: res.inserted, updated: res.updated }));
      setPrepared(null);
      setFile(null);
    } catch (e) {
      setError(explain(e));
    } finally {
      setProgress(null);
    }
  };

  const counts = prepared?.backup.counts;
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { dateStyle: 'medium' });

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('backup.title')} onBack={() => goBack(routes.settings)} large={false} />
      <Text tone="muted">{t('backup.intro')}</Text>

      <SetupFileCard />

      <SectionHeader title={t('backup.export')} />
      <OptionCard
        title={t('backup.dataOnly')}
        description={`${t('backup.dataOnlyHint')}${stats ? ` · ${t('backup.size', { size: size(estimateBytes(stats.counts, stats.photoBytes, false)) })}` : ''}`}
        selected={!photos}
        onPress={() => setPhotos(false)}
      />
      {photosSupported ? (
        <OptionCard
          title={t('backup.withPhotos')}
          description={`${t('backup.withPhotosHint')}${stats ? ` · ${t('backup.size', { size: size(estimateBytes(stats.counts, stats.photoBytes, true)) })}` : ''}`}
          selected={photos}
          onPress={() => setPhotos(true)}
        />
      ) : null}
      <Text variant="caption" tone="muted">
        {t('backup.encryption')}
      </Text>
      <Button
        size="lg"
        icon="forward"
        label={t('backup.exportNow')}
        fullWidth
        loading={exporting}
        onPress={() => {
          setExporting(true);
          backup
            .exportBackup(photos)
            .then(() => toast.success(t('backup.exported')))
            .catch((e: unknown) => {
              logger.warn('Export failed', { error: e });
              toast.error(t('backup.errors.UNKNOWN'));
            })
            .finally(() => setExporting(false));
        }}
        testID="backup-export"
      />
      <Card style={styles.gap}>
        <Text tone="muted">
          {lastAt ? t('backup.last', { date: date(lastAt) }) : t('backup.never')}
        </Text>
        <View style={styles.row}>
          <Text style={styles.flex}>{t('backup.reminder')}</Text>
          <Toggle
            value={reminder}
            onChange={(v) => void set('notifications.backup', v)}
            accessibilityLabel={t('backup.reminder')}
          />
        </View>
      </Card>

      <SectionHeader title={t('backup.import')} />
      <Button
        size="lg"
        variant="secondary"
        label={t('backup.pick')}
        fullWidth
        onPress={() => void pick()}
        testID="backup-pick"
      />
      {error ? (
        <Card>
          <Text tone="danger" testID="backup-error">
            {error}
          </Text>
        </Card>
      ) : null}
      {prepared && counts ? (
        <Card style={styles.gap} testID="backup-preview">
          <Text variant="bodyStrong">
            {t('backup.preview', {
              date: date(prepared.backup.exportedAt),
              workouts: counts.session_executions ?? 0,
              weights: counts.weight_entries ?? 0,
              photos: counts.progress_photos ?? 0,
            })}
          </Text>
          {Object.keys(prepared.photos).length ? (
            <Text tone="muted">{t('backup.withFiles')}</Text>
          ) : null}
          <OptionCard
            title={t('backup.merge')}
            description={t('backup.mergeHint')}
            selected={strategy === 'merge'}
            onPress={() => {
              setStrategy('merge');
              if (file) void validate(file, 'merge');
            }}
          />
          <OptionCard
            title={t('backup.replace')}
            description={t('backup.replaceHint')}
            selected={strategy === 'replace'}
            onPress={() => {
              setStrategy('replace');
              if (file) void validate(file, 'replace');
            }}
          />
          {strategy === 'replace' ? (
            <Input
              value={typed}
              onChangeText={setTyped}
              placeholder="REPLACE"
              autoCapitalize="characters"
              label={t('backup.typeReplace')}
              testID="backup-type"
            />
          ) : null}
          {progress ? (
            <ProgressBar
              value={progress.done / Math.max(1, progress.total)}
              label={t('backup.importing', progress)}
            />
          ) : (
            <Button
              size="lg"
              label={t('backup.continue')}
              fullWidth
              disabled={strategy === 'replace' && typed.trim() !== 'REPLACE'}
              onPress={() => setConfirm(true)}
              testID="backup-import"
            />
          )}
        </Card>
      ) : null}
      <ConfirmDialog
        visible={confirm}
        title={t('backup.confirmTitle')}
        message={strategy === 'replace' ? t('backup.confirmReplace') : t('backup.confirmMerge')}
        confirmLabel={t('backup.continue')}
        cancelLabel={t('common:cancel')}
        destructive={strategy === 'replace'}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void run()}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
}));
