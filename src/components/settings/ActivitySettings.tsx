import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  ACTIVITY_ICON_CHOICES,
  ACTIVITY_TYPES,
  ActivityIcon,
  BottomSheet,
  Button,
  Card,
  Header,
  Icon,
  ListRow,
  ScreenContainer,
  Text,
  useActivityIcon,
  type ActivityType,
} from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { useSettingsStore } from '@/store/settingsStore';
import { makeStyles, useTheme } from '@/theme';
import { activitySwatches } from '@/theme/tokens';

/** Settings → Activities: custom icon and tile colour per activity type (owner request). */
export function ActivitySettings() {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const theme = useTheme();
  const iconFor = useActivityIcon();
  const styleMap = useSettingsStore((s) => s.values['activity.styles']);
  const set = useSettingsStore((s) => s.set);
  const [editing, setEditing] = useState<ActivityType | null>(null);

  const update = (type: ActivityType, patch: { color?: string | null; icon?: string | null }) => {
    const current = styleMap[type] ?? { color: null, icon: null };
    const next = { ...current, ...patch };
    const all = { ...styleMap, [type]: next };
    if (!next.color && !next.icon) delete all[type];
    void set('activity.styles', all).catch(() => {});
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('activities.title')} onBack={() => goBack(routes.settings)} large={false} />
      <Text tone="muted">{t('activities.intro')}</Text>
      <Card>
        {ACTIVITY_TYPES.map((type) => (
          <ListRow
            key={type}
            title={t(`activities.types.${type}`)}
            leading={<ActivityIcon type={type} size={40} />}
            onPress={() => setEditing(type)}
            testID={`activity-${type}`}
          />
        ))}
      </Card>

      <BottomSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? t(`activities.types.${editing}`) : ''}
      >
        {editing ? (
          <View style={styles.gap}>
            <View style={styles.preview}>
              <ActivityIcon type={editing} size={64} />
            </View>
            <Text variant="bodyStrong">{t('activities.color')}</Text>
            <View style={styles.grid}>
              {activitySwatches.map((c, i) => {
                const selected = (styleMap[editing]?.color ?? theme.colors.activity[editing]) === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => update(editing, { color: c })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t('activities.colorA11y', { n: i + 1 })}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      selected && { borderColor: theme.colors.text },
                    ]}
                  >
                    {selected ? (
                      <Icon name="check" size={18} color={theme.colors.onPrimary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <Text variant="bodyStrong">{t('activities.icon')}</Text>
            <View style={styles.grid}>
              {ACTIVITY_ICON_CHOICES.map((name, i) => {
                const selected = iconFor(editing) === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => update(editing, { icon: name })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t('activities.iconA11y', { n: i + 1 })}
                    style={[
                      styles.iconCell,
                      selected && {
                        borderColor: theme.colors.primaryInk,
                        backgroundColor: theme.colors.surfaceRaised,
                      },
                    ]}
                  >
                    <Icon
                      name={name}
                      size={24}
                      color={selected ? theme.colors.primaryInk : theme.colors.text}
                    />
                  </Pressable>
                );
              })}
            </View>
            <Button
              size="md"
              variant="ghost"
              label={t('activities.reset')}
              onPress={() => update(editing, { color: null, icon: null })}
            />
          </View>
        ) : null}
      </BottomSheet>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  preview: { alignItems: 'center', paddingVertical: t.spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
