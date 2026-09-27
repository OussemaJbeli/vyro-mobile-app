import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useStartWorkout } from '@/components/execution/useStartWorkout';
import { TemplateStats } from '@/components/progress/TemplateStats';
import { CoachEntry } from '@/components/ai/CoachEntry';
import { CoverEditor } from '@/components/workout/CoverEditor';
import { intervalTitle } from '@/components/running/intervalTitle';
import { RunningTimeline } from '@/components/running/RunningTimeline';
import {
  Button,
  Card,
  ConfirmDialog,
  Divider,
  EmptyState,
  Header,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useTemplateLabel } from '@/components/workout/templateInfo';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import {
  averageSpeed,
  estimatedDistanceKm,
  formatMinSec,
  totalDuration,
} from '@/domain/running/intervals';
import { invalidates, useRepoMutation, useTemplate, useUnitPrefs } from '@/hooks/data';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { formatQuantity } from '@/utils/units';

/** Running plan detail (step 15). */
export default function RunningDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const starter = useStartWorkout();
  const { t } = useTranslation(['running', 'train', 'common']);
  const { t: tRun } = useTranslation('running');
  const { t: tAi } = useTranslation('settings');
  const styles = useStyles();
  const template = useTemplate(id);
  const units = useUnitPrefs();
  const label = useTemplateLabel();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const duplicate = useRepoMutation((r, tid: string) => r.templates.duplicate(tid), {
    invalidate: invalidates.templates,
    onSuccess: (copy) => {
      toast.success(t('train:toast.duplicated'));
      router.replace({ pathname: '/running/[id]/edit', params: { id: copy.id } });
    },
  });
  const remove = useRepoMutation((r, tid: string) => r.templates.remove(tid), {
    invalidate: invalidates.templates,
    onSuccess: (result) => {
      toast.info(
        result === 'archived' ? t('train:toast.archivedInstead') : t('train:toast.deleted'),
      );
      goBack(routes.train);
    },
  });

  const tpl = template.data;
  if (template.isLoading) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Skeleton preset="card" />
      </ScreenContainer>
    );
  }
  if (!tpl) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Header title={t('train:title')} onBack={() => goBack(routes.train)} large={false} />
        <EmptyState title={t('train:empty.filterTitle')} />
      </ScreenContainer>
    );
  }

  const intervals = tpl.intervals;
  const total = totalDuration(intervals);
  const speed = (kmh: number | null) => (kmh == null ? '—' : formatQuantity(kmh, 'speed', units));

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={label(tpl)} onBack={() => goBack(routes.train)} large={false} />
      <Card variant="accent" style={styles.card}>
        <RunningTimeline intervals={intervals} height={96} testID="run-detail-timeline" />
        <View style={styles.totals}>
          <Stat value={formatMinSec(total)} label={t('total')} />
          <Stat
            value={formatQuantity(estimatedDistanceKm(intervals), 'distance', units)}
            label={t('distance')}
          />
          <Stat value={speed(total ? averageSpeed(intervals) : null)} label={t('avgSpeed')} />
        </View>
        {tpl.distanceTargetKm ? (
          <Text variant="caption" tone="muted" align="center">
            {t('detail.target', {
              distance: formatQuantity(tpl.distanceTargetKm, 'distance', units),
            })}
          </Text>
        ) : null}
      </Card>
      {tpl.description ? <Text tone="muted">{tpl.description}</Text> : null}
      <TemplateStats templateId={tpl.id} />
      <CoverEditor templateId={tpl.id} type={'running'} coverKey={tpl.coverKey} />

      <Button
        label={t('detail.start')}
        icon="play"
        size="lg"
        fullWidth
        onPress={() => void starter.start({ templateId: tpl.id })}
        loading={starter.busy}
      />
      <CoachEntry method="analyzeRunning" label={tAi('ai.coach.actions.running')} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={t('detail.schedule')}
            icon="plan"
            variant="secondary"
            fullWidth
            onPress={() =>
              router.push({ pathname: '/session/new', params: { templateId: tpl.id } })
            }
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t('detail.edit')}
            icon="edit"
            variant="secondary"
            fullWidth
            onPress={() => router.push({ pathname: '/running/[id]/edit', params: { id: tpl.id } })}
            testID="run-edit"
          />
        </View>
      </View>

      <SectionHeader title={t('intervals')} />
      <Card>
        {intervals.map((iv, i) => (
          <View key={iv.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={intervalTitle(iv, i, tRun)}
              subtitle={`${speed(iv.speedKmh)} · ${iv.inclinePercent ?? 0} %`}
              trailing={<Text style={styles.nums}>{formatMinSec(iv.durationSeconds)}</Text>}
            />
          </View>
        ))}
      </Card>

      <Card>
        <Text tone="muted">{t('detail.historySoon')}</Text>
      </Card>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={t('detail.duplicate')}
            icon="duplicate"
            variant="ghost"
            fullWidth
            onPress={() => duplicate.mutate(tpl.id)}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t('detail.delete')}
            icon="delete"
            variant="danger"
            fullWidth
            onPress={() => setConfirmDelete(true)}
          />
        </View>
      </View>
      <ConfirmDialog
        visible={confirmDelete}
        title={t('train:confirmDelete.title')}
        message={t('train:confirmDelete.body')}
        confirmLabel={t('detail.delete')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          remove.mutate(tpl.id);
        }}
      />
      {starter.element}
    </ScreenContainer>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text variant="heading" style={styles.nums}>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.md },
  totals: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  nums: { fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: t.spacing.sm },
  flex: { flex: 1 },
}));
