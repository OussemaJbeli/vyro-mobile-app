import * as Sharing from 'expo-sharing';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { DevSettings, View } from 'react-native';

import {
  Button,
  Card,
  ConfirmDialog,
  Divider,
  Header,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Text,
} from '@/components/ui';
import {
  DATABASE_NAME,
  inspectDatabase,
  loadDemoDataset,
  loadTemplateScenarioData,
  resetDatabase,
  useDatabase,
  type DbInfo,
} from '@/hooks/database';
import { makeStyles } from '@/theme';
import { logger } from '@/utils/logger';

/** Dev-only database inspector (step 07). */
export default function DevDatabaseScreen() {
  const db = useDatabase();
  const client = useQueryClient();
  const styles = useStyles();
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const load = useCallback(() => {
    inspectDatabase(db).then(setInfo, (e: unknown) => logger.error('Inspect failed', { error: e }));
  }, [db]);
  useEffect(load, [load]);

  const logs = logger.entries().slice(-30).reverse();

  return (
    <ScreenContainer edges={['top', 'bottom']} onRefresh={load} refreshing={false}>
      <Header
        title="Database"
        subtitle={DATABASE_NAME}
        onBack={() => router.back()}
        large={false}
      />

      <SectionHeader title="Migrations" />
      <Card>
        {info?.migrations.length ? (
          info.migrations.map((m) => (
            <ListRow key={m.id} title={`${m.id} · ${m.name}`} subtitle={m.applied_at} />
          ))
        ) : (
          <Text tone="muted">None applied</Text>
        )}
      </Card>

      <SectionHeader title="Tables" />
      <Card>
        {info?.tables.map((tb, i) => (
          <View key={tb.name}>
            {i > 0 ? <Divider /> : null}
            <ListRow title={tb.name} trailing={<Text style={styles.nums}>{tb.rows}</Text>} />
          </View>
        ))}
        <Text variant="caption" tone="muted">
          File size: {info?.fileBytes != null ? `${(info.fileBytes / 1024).toFixed(1)} KB` : '—'}
        </Text>
      </Card>

      <SectionHeader title="Actions" />
      <View style={styles.actions}>
        <Button
          label="Export DB file"
          variant="secondary"
          onPress={() => info && Sharing.shareAsync(`file://${info.path}`)}
        />
        <Button
          label="Load demo data (2 years)"
          variant="secondary"
          loading={loadingDemo}
          onPress={() => {
            setLoadingDemo(true);
            loadDemoDataset(db)
              .then((counts) => {
                logger.info('Demo data loaded', counts);
                load();
              })
              .catch((e: unknown) => logger.error('Demo data failed', { error: e }))
              .finally(() => setLoadingDemo(false));
          }}
        />
        <Button
          label="Load template scenario"
          variant="secondary"
          onPress={() => {
            loadTemplateScenarioData(db)
              .then(async () => {
                await client.invalidateQueries();
                load();
              })
              .catch((e: unknown) => logger.error('Scenario failed', { error: e }));
          }}
          testID="dev-template-scenario"
        />
        <Button label="Reset DB" variant="danger" onPress={() => setConfirmReset(true)} />
      </View>

      <SectionHeader title="Recent logs" />
      <Card>
        {logs.length === 0 ? <Text tone="muted">No log entries</Text> : null}
        {logs.map((l, i) => (
          <Text
            key={`${l.at}-${i}`}
            variant="caption"
            tone={l.level === 'error' ? 'danger' : 'muted'}
          >
            {l.at.slice(11, 19)} {l.level.toUpperCase()} {l.message}
          </Text>
        ))}
      </Card>

      <ConfirmDialog
        visible={confirmReset}
        title="Reset database?"
        message="Deletes every local record on this device. Dev only."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false);
          await resetDatabase(db, DATABASE_NAME);
          DevSettings.reload();
        }}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  nums: { fontVariant: ['tabular-nums'], color: t.colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
}));
