import { View } from 'react-native';

import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { brand } from '@/theme/brand';
import { contrastRatio } from '@/theme/contrast';

import { Icon, type IconName } from './Icon';

export type ActivityType = 'gym' | 'running' | 'home' | 'abs' | 'recovery' | 'rest' | 'other';
export const ACTIVITY_TYPES: ActivityType[] = [
  'gym',
  'running',
  'home',
  'abs',
  'recovery',
  'rest',
  'other',
];

export const DEFAULT_ACTIVITY_ICON: Record<ActivityType, IconName> = {
  gym: 'gym',
  running: 'running',
  home: 'home_workout',
  abs: 'abs',
  recovery: 'recovery',
  rest: 'rest',
  other: 'other',
};

/** Icon choices offered in Settings → Activities. */
export const ACTIVITY_ICON_CHOICES: IconName[] = [
  'gym',
  'running',
  'home_workout',
  'abs',
  'recovery',
  'rest',
  'other',
  'act_dumbbell',
  'act_weightlifter',
  'act_kettlebell',
  'act_arm',
  'act_run',
  'act_walk',
  'act_hike',
  'act_bike',
  'act_swim',
  'act_rowing',
  'act_yoga',
  'act_meditate',
  'act_stretch',
  'act_boxing',
  'act_jumprope',
  'act_stairs',
  'act_ball',
  'act_soccer',
  'act_tennis',
  'act_heart',
  'act_fire',
  'act_lightning',
  'act_sleep',
  'act_coffee',
];

const known = new Set<string>(ACTIVITY_ICON_CHOICES);

/** Icon for an activity type, honouring the user's choice (Settings → Activities). */
export function useActivityIcon(): (type: string) => IconName {
  const overrides = useSettingsStore((s) => s.values['activity.styles']);
  return (type) => {
    const custom = overrides[type]?.icon;
    if (custom && known.has(custom)) return custom as IconName;
    return DEFAULT_ACTIVITY_ICON[(type in DEFAULT_ACTIVITY_ICON ? type : 'other') as ActivityType];
  };
}

/**
 * Filled rounded-square activity tile (template: lime running, green gym, orange abs).
 * `state="done"` shows a check; `state="muted"` is the grey not-yet tile (Start screen).
 */
export function ActivityIcon({
  type,
  size = 40,
  state = 'default',
}: {
  type: ActivityType;
  size?: number;
  state?: 'default' | 'done' | 'muted';
}) {
  const t = useTheme();
  const iconFor = useActivityIcon();
  const muted = state === 'muted' || type === 'rest' || type === 'other';
  const bg =
    state === 'done' ? t.colors.primary : muted ? t.colors.surfaceRaised : t.colors.activity[type];
  // Dark glyph on light colours, white on dark custom colours (contrast-safe).
  const onColor =
    contrastRatio(t.colors.onPrimary, bg) >= contrastRatio(brand.white, bg)
      ? t.colors.onPrimary
      : brand.white;
  const fg = muted && state !== 'done' ? t.colors.textMuted : onColor;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: muted ? 1 : 0,
        borderColor: t.colors.border,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Icon name={state === 'done' ? 'check' : iconFor(type)} size={size * 0.55} color={fg} />
    </View>
  );
}
