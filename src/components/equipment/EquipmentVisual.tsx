import { Image } from 'expo-image';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { bundledImage } from '@/constants/bundledImages';
import { mediaUri } from '@/services/media/exerciseMedia';
import { useTheme } from '@/theme';
import { type Equipment } from '@/types/domain';

/** Icon choices for equipment (Train → Equipment → edit). */
export const EQUIPMENT_ICON_CHOICES: IconName[] = [
  'gym',
  'act_dumbbell',
  'act_kettlebell',
  'act_weightlifter',
  'act_arm',
  'weight',
  'act_bike',
  'act_rowing',
  'act_run',
  'act_jumprope',
  'act_stairs',
  'act_boxing',
  'act_ball',
  'act_yoga',
  'act_stretch',
  'recovery',
  'home_workout',
  'other',
];

const CATEGORY_ICON: Record<string, IconName> = {
  free_weights: 'act_dumbbell',
  machines: 'act_weightlifter',
  cardio: 'act_bike',
  bodyweight: 'act_arm',
  accessories: 'act_jumprope',
  other: 'other',
};

const known = new Set<string>(EQUIPMENT_ICON_CHOICES);

/**
 * Picture chosen in the app → custom icon → bundled `assets/images/equipment/<slug>` →
 * category icon, in a rounded tile.
 */
export function EquipmentVisual({
  item,
  size = 40,
}: {
  item: Pick<Equipment, 'iconKey' | 'imagePath' | 'category' | 'slug'>;
  size?: number;
}) {
  const t = useTheme();
  const box = {
    width: size,
    height: size,
    borderRadius: size * 0.28,
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: t.colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };
  // A custom icon choice beats the bundled picture; a chosen picture beats both.
  const bundled = item.iconKey ? null : bundledImage('equipment', item.slug);
  const source = item.imagePath ? { uri: mediaUri(item.imagePath) } : bundled;
  if (source) {
    return (
      <View style={box}>
        <Image
          source={source}
          style={{ width: size, height: size }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }
  const icon =
    item.iconKey && known.has(item.iconKey)
      ? (item.iconKey as IconName)
      : (CATEGORY_ICON[item.category] ?? 'other');
  return (
    <View style={box}>
      <Icon name={icon} size={size * 0.55} color={t.colors.primaryInk} />
    </View>
  );
}
