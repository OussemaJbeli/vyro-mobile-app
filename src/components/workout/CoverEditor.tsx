import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button, CoverArt, Icon, Text, type CoverType } from '@/components/ui';
import { invalidates, useRepoMutation } from '@/hooks/data';
import { canPickCoverPhoto, pickCoverPhoto } from '@/services/photos/covers';
import { brand } from '@/theme/brand';
import { withAlpha } from '@/theme/color';
import { makeStyles } from '@/theme';

/**
 * Workout cover on the detail screen (assets/images/ASSETS.md): a wide preview as used by
 * the Start hero card, and "Choose photo" / "Remove photo" for any workout, seeded or custom.
 */
export function CoverEditor({
  templateId,
  type,
  coverKey,
}: {
  templateId: string;
  type: CoverType;
  coverKey: string | null;
}) {
  const { t } = useTranslation('train');
  const styles = useStyles();
  const save = useRepoMutation(
    (r, key: string | null) => r.templates.update(templateId, { coverKey: key }),
    {
      invalidate: invalidates.templates,
    },
  );
  const photo = coverKey?.startsWith('photo:') ?? false;
  const pick = () =>
    void pickCoverPhoto()
      .then((key) => key && save.mutate(key))
      .catch(() => {});
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={canPickCoverPhoto ? pick : undefined}
        accessibilityRole="button"
        accessibilityLabel={t('builder.coverChange')}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <CoverArt type={type} coverKey={coverKey} iconSize={48} style={styles.wide} />
        {canPickCoverPhoto ? (
          <View style={styles.badge}>
            <Icon name="photo" size={16} color={brand.white} />
            <Text variant="caption" style={styles.badgeText}>
              {t('builder.coverChange')}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {canPickCoverPhoto ? (
        <View style={styles.row}>
          <Button
            size="sm"
            variant="secondary"
            icon="photo"
            label={t('builder.coverPhoto')}
            loading={save.isPending}
            onPress={pick}
            testID="cover-pick"
          />
          {photo ? (
            <Button
              size="sm"
              variant="ghost"
              label={t('builder.coverRemove')}
              onPress={() => save.mutate(null)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: t.spacing.sm },
  wide: { width: '100%', height: 180, borderRadius: t.radius.lg },
  row: { flexDirection: 'row', gap: t.spacing.sm },
  pressed: { opacity: 0.85 },
  badge: {
    position: 'absolute',
    right: t.spacing.sm,
    bottom: t.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    borderRadius: t.radius.pill,
    backgroundColor: withAlpha(brand.black, 0.55),
  },
  badgeText: { color: brand.white },
}));
