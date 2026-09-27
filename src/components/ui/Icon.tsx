import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme';

type GlyphName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Semantic icon names used across the app. Screens never import an icon set directly,
 * so the family can be swapped here in one place (roadmap step 04).
 */
export const iconMap = {
  // Navigation (template "Icons & Elements")
  home: 'home-variant-outline',
  train: 'dumbbell',
  start: 'play',
  progress: 'chart-bar',
  plan: 'calendar-month-outline',
  ai: 'creation-outline',
  body: 'human-handsup',
  gallery: 'image-multiple-outline',
  settings: 'cog-outline',
  // Activities
  gym: 'dumbbell',
  running: 'run',
  abs: 'fire',
  home_workout: 'home-heart',
  recovery: 'meditation',
  rest: 'coffee-outline',
  other: 'star-four-points-outline',
  // Body
  weight: 'scale-bathroom',
  measure: 'tape-measure',
  photo: 'camera-outline',
  // Status (AD-17)
  'status-pending': 'circle-outline',
  'status-next': 'play-circle-outline',
  'status-done': 'check-circle',
  'status-modified': 'circle-edit-outline',
  'status-skipped': 'skip-forward-outline',
  'status-cancelled': 'cancel',
  'status-missed': 'alert-circle-outline',
  // Actions
  add: 'plus',
  remove: 'minus',
  close: 'close',
  check: 'check',
  back: 'chevron-left',
  forward: 'chevron-right',
  down: 'chevron-down',
  up: 'chevron-up',
  search: 'magnify',
  edit: 'pencil-outline',
  delete: 'trash-can-outline',
  more: 'dots-vertical',
  swap: 'swap-horizontal',
  duplicate: 'content-copy',
  pause: 'pause',
  play: 'play',
  skip: 'skip-next',
  repeat: 'restart',
  timer: 'timer-outline',
  speed: 'speedometer',
  incline: 'slope-uphill',
  rewind: 'rewind',
  fast_forward: 'fast-forward',
  radio_on: 'radiobox-marked',
  radio_off: 'radiobox-blank',
  check_circle: 'check-circle',
  clock: 'clock-outline',
  bell: 'bell-outline',
  lock: 'lock-outline',
  streak: 'fire',
  trophy: 'trophy-outline',
  trend_up: 'trending-up',
  trend_down: 'trending-down',
  info: 'information-outline',
  error: 'alert-circle-outline',
  empty: 'inbox-outline',
  profile: 'account-circle-outline',
  // Activity icon choices (Settings → Activities).
  act_dumbbell: 'dumbbell',
  act_weightlifter: 'weight-lifter',
  act_kettlebell: 'kettlebell',
  act_arm: 'arm-flex',
  act_run: 'run-fast',
  act_walk: 'walk',
  act_hike: 'hiking',
  act_bike: 'bike',
  act_swim: 'swim',
  act_rowing: 'rowing',
  act_yoga: 'yoga',
  act_meditate: 'meditation',
  act_stretch: 'human-handsup',
  act_boxing: 'boxing-glove',
  act_jumprope: 'jump-rope',
  act_stairs: 'stairs',
  act_ball: 'basketball',
  act_soccer: 'soccer',
  act_tennis: 'tennis',
  act_heart: 'heart-pulse',
  act_fire: 'fire',
  act_lightning: 'lightning-bolt',
  act_sleep: 'sleep',
  act_coffee: 'coffee-outline',
} as const satisfies Record<string, GlyphName>;

export type IconName = keyof typeof iconMap;

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  /** Icons are decorative by default; pass a label when the icon alone carries meaning. */
  accessibilityLabel?: string;
  testID?: string;
};

export function Icon({ name, size, color, accessibilityLabel, testID }: IconProps) {
  const t = useTheme();
  return (
    <MaterialCommunityIcons
      name={iconMap[name]}
      size={size ?? t.iconSize.lg}
      color={color ?? t.colors.text}
      {...(accessibilityLabel
        ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
        : { accessibilityElementsHidden: true, importantForAccessibility: 'no' as const })}
      {...(testID ? { testID } : {})}
    />
  );
}
