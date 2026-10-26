import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  IconButton,
  Input,
  ListRow,
  Skeleton,
  Text,
} from '@/components/ui';
import { type CycleGroup, type CyclePlan } from '@/domain/scheduling/cycle';
import { useTemplates } from '@/hooks/data';
import { useCyclePlan, useRestartCycle, useSaveCyclePlan } from '@/hooks/useCycle';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { newId } from '@/utils/id';

import { SessionVisual } from './SessionVisual';

type Slot = 'runTemplateId' | 'gymTemplateId';

/**
 * VYRO cycle editor (1.4.0): day groups in order (each a run, then a gym workout), rest after
 * the last group. Rename, swap the run or the gym workout, reorder, add or remove a group.
 * Saving keeps your place in the cycle and redraws the plan ahead.
 */
export function CycleEditor() {
  const { t } = useTranslation(['plan', 'common']);
  const styles = useStyles();
  const current = useCyclePlan();
  const save = useSaveCyclePlan();
  const restart = useRestartCycle();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const templates = useTemplates();
  // Edits live here until saved; until then the saved plan is shown.
  const [draft, setPlan] = useState<CyclePlan | null>(null);
  const [picking, setPicking] = useState<{ group: string; slot: Slot } | null>(null);

  const saved = current.data?.plan ?? null;
  const plan = draft ?? saved;
  if (!plan) return <Skeleton preset="card" />;
  const all = (templates.data ?? []).filter((x) => !x.archivedAt);
  const byId = new Map(all.map((x) => [x.id, x]));
  const stateIndex = current.data?.state?.index ?? null;
  const currentId =
    stateIndex !== null ? ([...plan.groups.map((g) => g.id), 'rest'][stateIndex] ?? null) : null;

  const update = (id: string, patch: Partial<CycleGroup>) =>
    setPlan((p) => {
      const base = p ?? plan;
      return { groups: base.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) };
    });
  const move = (i: number, dir: -1 | 1) =>
    setPlan((prev) => {
      const p = prev ?? plan;
      const j = i + dir;
      if (j < 0 || j >= p.groups.length) return p;
      const groups = [...p.groups];
      [groups[i], groups[j]] = [groups[j]!, groups[i]!];
      return { groups };
    });
  const dirty = JSON.stringify(plan) !== JSON.stringify(saved);

  const pickerOptions = picking
    ? all.filter((x) =>
        picking.slot === 'runTemplateId' ? x.type === 'running' : x.type !== 'running',
      )
    : [];

  return (
    <View style={styles.wrap}>
      <Text tone="muted">{t('cycle.hint')}</Text>
      {plan.groups.map((g, i) => (
        <Card key={g.id} style={styles.card} testID={`cycle-group-${i}`}>
          <View style={styles.head}>
            <Text variant="overline" tone="muted" style={styles.flex}>
              {t('cycle.dayN', { n: i + 1 })}
              {g.id === currentId ? ` · ${t('cycle.current')}` : ''}
            </Text>
            <IconButton
              icon="up"
              variant="plain"
              size={36}
              accessibilityLabel={t('cycle.moveUp')}
              disabled={i === 0}
              onPress={() => move(i, -1)}
            />
            <IconButton
              icon="down"
              variant="plain"
              size={36}
              accessibilityLabel={t('cycle.moveDown')}
              disabled={i === plan.groups.length - 1}
              onPress={() => move(i, 1)}
            />
            <IconButton
              icon="delete"
              variant="plain"
              size={36}
              accessibilityLabel={t('cycle.remove')}
              disabled={plan.groups.length <= 1}
              onPress={() => setPlan({ groups: plan.groups.filter((x) => x.id !== g.id) })}
            />
          </View>
          <Input
            value={g.name}
            onChangeText={(name) => update(g.id, { name })}
            placeholder={t('cycle.namePlaceholder')}
            maxLength={30}
          />
          {(['runTemplateId', 'gymTemplateId'] as const).map((slot) => {
            const tpl = g[slot] ? byId.get(g[slot]!) : undefined;
            return (
              <ListRow
                key={slot}
                title={tpl?.name ?? t('cycle.none')}
                subtitle={slot === 'runTemplateId' ? t('cycle.run') : t('cycle.gym')}
                leading={
                  <SessionVisual
                    type={tpl?.type ?? (slot === 'runTemplateId' ? 'running' : 'gym')}
                    coverKey={tpl?.coverKey}
                    size={40}
                  />
                }
                onPress={() => setPicking({ group: g.id, slot })}
              />
            );
          })}
        </Card>
      ))}
      <Card style={styles.rest}>
        <Text variant="overline" tone="muted">
          {t('cycle.dayN', { n: plan.groups.length + 1 })}
        </Text>
        <Text variant="bodyStrong">{t('restDay')}</Text>
      </Card>
      <Button
        label={t('cycle.add')}
        icon="add"
        variant="secondary"
        size="sm"
        onPress={() =>
          setPlan({
            groups: [
              ...plan.groups,
              { id: newId(), name: '', runTemplateId: null, gymTemplateId: null },
            ],
          })
        }
      />
      <Button
        label={t('cycle.save')}
        fullWidth
        disabled={!dirty || plan.groups.some((g) => !g.runTemplateId && !g.gymTemplateId)}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { groups: plan.groups.map((g) => ({ ...g, name: g.name.trim() })) },
            {
              onSuccess: () => {
                setPlan(null);
                toast.success(t('cycle.saved'));
              },
            },
          )
        }
        testID="cycle-save"
      />

      <Button
        label={t('cycle.restart')}
        variant="ghost"
        size="sm"
        disabled={dirty}
        loading={restart.isPending}
        onPress={() => setConfirmRestart(true)}
        testID="cycle-restart"
      />
      <ConfirmDialog
        visible={confirmRestart}
        title={t('cycle.restartTitle')}
        message={t('cycle.restartBody')}
        confirmLabel={t('cycle.restart')}
        cancelLabel={t('common:cancel')}
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          setConfirmRestart(false);
          restart.mutate(undefined, { onSuccess: () => toast.success(t('cycle.restarted')) });
        }}
      />

      <BottomSheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking?.slot === 'runTemplateId' ? t('cycle.pickRun') : t('cycle.pickGym')}
      >
        <ListRow
          title={t('cycle.none')}
          onPress={() => {
            if (picking) update(picking.group, { [picking.slot]: null });
            setPicking(null);
          }}
        />
        {pickerOptions.map((x) => (
          <ListRow
            key={x.id}
            title={x.name}
            {...(x.durationMinutes ? { subtitle: `${x.durationMinutes} min` } : {})}
            leading={<SessionVisual type={x.type} coverKey={x.coverKey} size={40} />}
            onPress={() => {
              if (picking) update(picking.group, { [picking.slot]: x.id });
              setPicking(null);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: t.spacing.md },
  card: { gap: t.spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  flex: { flex: 1 },
  rest: { gap: 2, opacity: 0.8 },
}));
