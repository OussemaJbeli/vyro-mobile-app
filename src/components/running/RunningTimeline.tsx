import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import {
  formatMinSec,
  maxSpeed,
  totalDuration,
  type RunInterval,
} from '@/domain/running/intervals';
import { makeStyles, useTheme } from '@/theme';
import { withAlpha } from '@/theme/color';

const INTENSITY: Record<RunInterval['kind'], number> = {
  warmup: 0.45,
  cooldown: 0.45,
  walk: 0.35,
  recovery: 0.4,
  run: 0.75,
  sprint: 1,
};

export type RunningTimelineProps = {
  intervals: readonly RunInterval[];
  height?: number;
  /** Highlights one interval (execution, step 19). */
  currentIndex?: number;
  /** 0–1 progress through the whole plan, drawn as a marker (execution). */
  progress?: number;
  onPressInterval?: (index: number) => void;
  testID?: string;
};

/** Speed profile: bar width = duration, height = speed, brightness = effort (step 15). */
export function RunningTimeline({
  intervals,
  height = 72,
  currentIndex,
  progress,
  testID,
}: RunningTimelineProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('running');
  const total = totalDuration(intervals);
  const top = Math.max(maxSpeed(intervals), 1);
  const gap = 2;
  // Start offset of each bar (precomputed: no reassignment during render).
  const offsets = intervals.map((_, i) =>
    intervals.slice(0, i).reduce((sum, iv) => sum + Math.max(1, iv.durationSeconds), 0),
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('timelineA11y', {
        count: intervals.length,
        total: formatMinSec(total),
      })}
      style={[styles.box, { height }]}
      {...(testID ? { testID } : {})}
    >
      {total > 0 ? (
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${total} ${height}`}
          preserveAspectRatio="none"
        >
          {intervals.map((iv, i) => {
            const w = Math.max(1, iv.durationSeconds);
            // Minimum height keeps no-speed intervals (walks with speed unset) visible.
            const h = Math.max(6, ((iv.speedKmh ?? 0) / top) * (height - 4));
            const x = offsets[i]!;
            return (
              <Rect
                key={i}
                x={x + (i > 0 ? gap : 0)}
                y={height - h}
                width={Math.max(1, w - (i > 0 ? gap : 0))}
                height={h}
                rx={2}
                fill={withAlpha(
                  theme.colors.primary,
                  currentIndex === undefined || currentIndex === i ? INTENSITY[iv.kind] : 0.18,
                )}
              />
            );
          })}
          {progress !== undefined ? (
            <Rect
              x={Math.min(total, Math.max(0, progress) * total) - 2}
              y={0}
              width={4}
              height={height}
              fill={theme.colors.text}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  box: {
    width: '100%',
    borderRadius: t.radius.md,
    overflow: 'hidden',
    backgroundColor: t.colors.surfaceRaised,
  },
}));
