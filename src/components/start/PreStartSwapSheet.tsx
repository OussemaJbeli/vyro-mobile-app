import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet, Button, Chip, Divider, Text } from '@/components/ui';
import { type StartSwaps } from '@/components/execution/useStartWorkout';
import { suggestAlternatives } from '@/domain/workouts/alternatives';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { makeStyles } from '@/theme';

/** Before starting: replace exercises whose equipment is missing today (UI §16). */
export function PreStartSwapSheet({
  visible,
  exerciseIds,
  onClose,
  onStart,
}: {
  visible: boolean;
  /** Unavailable planned exercises. */
  exerciseIds: string[];
  onClose: () => void;
  onStart: (swaps: StartSwaps) => void;
}) {
  const { t } = useTranslation('execution');
  const styles = useStyles();
  const catalog = useExerciseCatalog();
  const [picked, setPicked] = useState<Record<string, string | null>>({});

  const choice = (id: string, options: string[]) =>
    picked[id] === undefined ? (options[0] ?? null) : picked[id];

  const rows = exerciseIds.map((id) => {
    const item = catalog.byId.get(id);
    const options = item
      ? suggestAlternatives(item, catalog.engine, 6)
          .map((s) => s.exerciseId)
          .filter((x) => catalog.byId.get(x)?.available)
          .slice(0, 3)
      : [];
    return { id, item, options };
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('today.swapsTitle')}>
      <View style={styles.gap}>
        <Text tone="muted">{t('today.swapsBody')}</Text>
        {rows.map((r, i) => (
          <View key={r.id} style={styles.gap}>
            {i > 0 ? <Divider /> : null}
            <Text variant="bodyStrong">{r.item?.label ?? '…'}</Text>
            <View style={styles.chips}>
              {r.options.map((o) => (
                <Chip
                  key={o}
                  label={catalog.byId.get(o)?.label ?? o}
                  selected={choice(r.id, r.options) === o}
                  onPress={() => setPicked((p) => ({ ...p, [r.id]: o }))}
                />
              ))}
              <Chip
                label={t('today.keep')}
                selected={choice(r.id, r.options) === null}
                onPress={() => setPicked((p) => ({ ...p, [r.id]: null }))}
              />
            </View>
          </View>
        ))}
        <Button
          size="xl"
          icon="play"
          label={t('today.startWithSwaps')}
          fullWidth
          onPress={() => {
            const swaps: StartSwaps = {};
            for (const r of rows) {
              const alt = choice(r.id, r.options);
              const item = alt ? catalog.byId.get(alt) : undefined;
              if (item) swaps[r.id] = { exerciseId: item.id, tracking: item.tracking };
            }
            onStart(swaps);
          }}
          testID="prestart-start"
        />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
}));
