import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { IconTile, ListRow, Text, type IconName } from '@/components/ui';
import { bundledImage } from '@/constants/bundledImages';
import { useExerciseThumbs } from '@/hooks/data';
import { type CatalogExercise } from '@/hooks/useExerciseCatalog';
import { mediaUri } from '@/services/media/exerciseMedia';
import { makeStyles, useTheme } from '@/theme';

import { Icon } from '../ui/Icon';

export const CATEGORY_ICON: Record<CatalogExercise['category'], IconName> = {
  chest: 'gym',
  back: 'gym',
  shoulders: 'gym',
  arms: 'gym',
  legs: 'gym',
  core: 'abs',
  full_body: 'body',
  cardio: 'running',
  mobility: 'recovery',
};

/** Library row: name, primary muscle · equipment, and an icon + text "Unavailable" tag. */
export function ExerciseRow({
  item,
  onPress,
  trailing,
}: {
  item: CatalogExercise;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const { t } = useTranslation('exercises');
  const theme = useTheme();
  const styles = useStyles();
  // Exercise media: the first image/GIF replaces the category icon when it exists.
  const thumb = useExerciseThumbs().data?.[item.id];
  const source = thumb ? { uri: mediaUri(thumb) } : bundledImage('exercises', item.slug);
  const muscle = t(`muscles.${item.primaryMuscle}` as 'muscles.chest', {
    defaultValue: item.primaryMuscle,
  });
  return (
    <ListRow
      title={item.label}
      subtitle={`${muscle} · ${item.equipmentLabel}`}
      leading={
        source ? (
          <Image
            source={source}
            style={styles.thumb}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <IconTile
            icon={CATEGORY_ICON[item.category]}
            size={40}
            tone={item.available ? 'accent' : 'default'}
          />
        )
      }
      trailing={
        trailing ??
        (!item.available ? (
          <View style={styles.tag} accessible accessibilityLabel={t('unavailable')}>
            <Icon name="error" size={14} color={theme.colors.warning} />
            <Text variant="caption" style={{ color: theme.colors.warning }}>
              {t('unavailable')}
            </Text>
          </View>
        ) : undefined)
      }
      {...(onPress ? { onPress } : {})}
      testID={`exercise-${item.slug ?? item.id}`}
    />
  );
}

const useStyles = makeStyles((t) => ({
  tag: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  thumb: { width: 40, height: 40, borderRadius: 20 },
}));
