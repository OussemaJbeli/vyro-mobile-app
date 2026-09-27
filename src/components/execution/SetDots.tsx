import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { type ExecSet } from '@/domain/execution';
import { makeStyles } from '@/theme';

/** ● done · ◉ current · ○ to do · ✕-ish skipped. Tap a logged set to edit it. */
export function SetDots({
  sets,
  current,
  onEdit,
}: {
  sets: ExecSet[];
  current: number | null;
  onEdit: (setId: string) => void;
}) {
  const styles = useStyles();
  const { t } = useTranslation('execution');
  return (
    <View style={styles.row}>
      {sets.map((s, i) => {
        const isCurrent = i === current;
        const status = isCurrent ? 'current' : s.status;
        return (
          <Pressable
            key={s.id}
            disabled={s.status !== 'done'}
            onPress={() => onEdit(s.id)}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityState={{ disabled: s.status !== 'done' }}
            accessibilityLabel={t('set.dot', { n: i + 1, status: t(`set.${status}`) })}
            style={[
              styles.dot,
              s.status === 'done' && styles.done,
              s.status === 'skipped' && styles.skipped,
              isCurrent && styles.current,
            ]}
            testID={`set-dot-${i}`}
          >
            {s.status === 'done' ? (
              // Completion: a short spring pop (disabled under Reduce Motion by Reanimated).
              <Animated.View
                key={`${s.id}-done`}
                entering={ZoomIn.springify().damping(14)}
                style={styles.fill}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', gap: t.spacing.md, justifyContent: 'center', flexWrap: 'wrap' },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.colors.border,
  },
  done: { borderColor: t.colors.primary },
  fill: { flex: 1, borderRadius: 12, backgroundColor: t.colors.primary },
  skipped: { borderStyle: 'dashed', borderColor: t.colors.textMuted },
  current: { borderColor: t.colors.primary, borderWidth: 3 },
}));
