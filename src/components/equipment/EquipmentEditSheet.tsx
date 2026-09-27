import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BottomSheet, Button, Icon, Text } from '@/components/ui';
import { invalidates, useRepoMutation } from '@/hooks/data';
import { mediaSupported, pickEquipmentImage } from '@/services/media/exerciseMedia';
import { makeStyles, useTheme } from '@/theme';
import { type Equipment } from '@/types/domain';

import { EQUIPMENT_ICON_CHOICES, EquipmentVisual } from './EquipmentVisual';

type Visual = { iconKey: string | null; imagePath: string | null };

/** Change an equipment's icon, or give it a picture (PNG keeps transparency). */
export function EquipmentEditSheet({
  item,
  title,
  onClose,
}: {
  item: Equipment | null;
  title: string;
  onClose: () => void;
}) {
  const { t } = useTranslation('equipment');
  const theme = useTheme();
  const styles = useStyles();
  const save = useRepoMutation(
    (r, v: { id: string } & Visual) =>
      r.equipment.setVisual(v.id, { iconKey: v.iconKey, imagePath: v.imagePath }),
    { invalidate: invalidates.equipment },
  );
  const id = item?.id ?? null;
  const set = (v: Visual) => {
    if (id) save.mutate({ id, ...v });
  };
  const pick = async () => {
    const path = await pickEquipmentImage();
    if (path) set({ iconKey: item?.iconKey ?? null, imagePath: path });
  };
  // Show the value being saved right away (the list refetches behind the sheet).
  const shown = item && save.variables?.id === item.id ? { ...item, ...save.variables } : item;

  return (
    <BottomSheet visible={item !== null} onClose={onClose} title={title}>
      {shown ? (
        <View style={styles.sheet}>
          <View style={styles.preview}>
            <EquipmentVisual item={shown} size={72} />
          </View>

          <Text variant="caption" tone="muted">
            {t('editor.picture')}
          </Text>
          {mediaSupported ? (
            <View style={styles.row}>
              <Button
                label={t('editor.pick')}
                icon="gallery"
                size="sm"
                onPress={() => void pick()}
              />
              {shown.imagePath ? (
                <Button
                  label={t('editor.removePicture')}
                  size="sm"
                  variant="ghost"
                  onPress={() => set({ iconKey: shown.iconKey, imagePath: null })}
                />
              ) : null}
            </View>
          ) : (
            <Text variant="caption" tone="muted">
              {t('editor.webHint')}
            </Text>
          )}

          <Text variant="caption" tone="muted">
            {t('editor.icon')}
          </Text>
          <View style={styles.grid}>
            {EQUIPMENT_ICON_CHOICES.map((icon) => {
              const on = shown.iconKey === icon && !shown.imagePath;
              return (
                <Pressable
                  key={icon}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={icon}
                  onPress={() => set({ iconKey: icon, imagePath: null })}
                  style={[
                    styles.cell,
                    on && {
                      borderColor: theme.colors.primary,
                      backgroundColor: theme.colors.primarySoft,
                    },
                  ]}
                >
                  <Icon
                    name={icon}
                    size={24}
                    color={on ? theme.colors.primaryInk : theme.colors.text}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.row}>
            <Button
              label={t('editor.reset')}
              size="sm"
              variant="ghost"
              onPress={() => set({ iconKey: null, imagePath: null })}
            />
            <Button label={t('editor.done')} size="sm" onPress={onClose} />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const useStyles = makeStyles((t) => ({
  sheet: { gap: t.spacing.md, paddingBottom: t.spacing.md },
  preview: { alignItems: 'center' },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
    justifyContent: 'space-between',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  cell: {
    width: 48,
    height: 48,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
