import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  BottomSheet,
  Button,
  Card,
  ChipGroup,
  ConfirmDialog,
  Divider,
  Header,
  IconButton,
  Input,
  ListRow,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  Text,
  Toggle,
} from '@/components/ui';
import { EquipmentVisual } from '@/components/equipment/EquipmentVisual';
import { EquipmentEditSheet } from '@/components/equipment/EquipmentEditSheet';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { presetDiff, type EquipmentPreset } from '@/domain/onboarding/defaults';
import { invalidates, useEquipment, useEquipmentUsage, useRepoMutation } from '@/hooks/data';
import { makeStyles } from '@/theme';
import { type Equipment } from '@/types/domain';
import { EQUIPMENT_CATEGORIES } from '@/types/enums';

const PRESETS: EquipmentPreset[] = ['full_gym', 'home_dumbbells', 'bodyweight', 'travel'];
type Category = (typeof EQUIPMENT_CATEGORIES)[number];

/** Equipment availability (FS §10, UI §16). */
export default function EquipmentScreen() {
  const { t } = useTranslation(['equipment', 'seed', 'common']);
  const styles = useStyles();
  const equipment = useEquipment();
  const usage = useEquipmentUsage().data ?? {};
  const items = equipment.data ?? [];
  const [preset, setPreset] = useState<EquipmentPreset | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('other');
  const [deleting, setDeleting] = useState<Equipment | null>(null);
  const [editing, setEditing] = useState<Equipment | null>(null);

  const name = (e: Equipment) =>
    e.slug
      ? t(`seed:equipment.${e.slug}` as 'seed:equipment.dumbbells', { defaultValue: e.name })
      : e.name;

  const toggle = useRepoMutation(
    (r, v: { id: string; available: boolean }) => r.equipment.setAvailable(v.id, v.available),
    {
      invalidate: invalidates.equipment,
    },
  );
  const applyPreset = useRepoMutation((r, ids: string[]) => r.equipment.setAvailableOnly(ids), {
    invalidate: invalidates.equipment,
  });
  const create = useRepoMutation(
    (r, v: { name: string; category: Category }) =>
      r.equipment.create({
        slug: null,
        name: v.name,
        category: v.category,
        available: true,
        notes: null,
      }),
    { invalidate: invalidates.equipment },
  );
  const remove = useRepoMutation((r, id: string) => r.equipment.softDelete(id), {
    invalidate: invalidates.equipment,
  });

  const diff = preset ? presetDiff(items, preset) : null;
  const names = (ids: string[]) =>
    ids
      .map((id) => items.find((i) => i.id === id))
      .filter((e): e is Equipment => !!e)
      .map(name)
      .join(', ');

  const grouped = EQUIPMENT_CATEGORIES.map((c) => ({
    c,
    list: items.filter((i) => i.category === c),
  })).filter((g) => g.list.length > 0);

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('title')} onBack={() => goBack(routes.settings)} />
      <Text tone="muted">{t('subtitle')}</Text>

      <SectionHeader title={t('presets.title')} />
      <View style={styles.presets}>
        {PRESETS.map((p) => (
          <Button
            key={p}
            label={t(`presets.${p}`)}
            size="sm"
            variant="secondary"
            onPress={() => setPreset(p)}
            testID={`preset-${p}`}
          />
        ))}
      </View>

      {equipment.isLoading ? <Skeleton preset="card" /> : null}
      {grouped.map(({ c, list }) => (
        <View key={c} style={styles.section}>
          <SectionHeader title={t(`categories.${c}`)} />
          <Card>
            {list.map((e, i) => {
              const used = usage[e.id]?.exercises ?? 0;
              return (
                <View key={e.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={name(e)}
                    leading={<EquipmentVisual item={e} />}
                    subtitle={
                      !e.available && used > 0
                        ? t('impact', { count: used })
                        : e.available
                          ? t('available')
                          : t('unavailable')
                    }
                    trailing={
                      <View style={styles.trailing}>
                        <IconButton
                          icon="edit"
                          variant="plain"
                          size={36}
                          accessibilityLabel={`${t('edit')} ${name(e)}`}
                          onPress={() => setEditing(e)}
                          testID={`equipment-edit-${e.slug ?? e.id}`}
                        />
                        {e.isCustom ? (
                          <IconButton
                            icon="delete"
                            variant="plain"
                            size={36}
                            accessibilityLabel={`${t('delete')} ${name(e)}`}
                            onPress={() => setDeleting(e)}
                          />
                        ) : null}
                        <Toggle
                          value={e.available}
                          onChange={(v) => toggle.mutate({ id: e.id, available: v })}
                          accessibilityLabel={name(e)}
                          testID={`equipment-${e.slug ?? e.id}`}
                        />
                      </View>
                    }
                  />
                </View>
              );
            })}
          </Card>
        </View>
      ))}

      <Button
        label={t('add')}
        icon="add"
        variant="secondary"
        fullWidth
        onPress={() => setAdding(true)}
      />

      <ConfirmDialog
        visible={preset !== null}
        title={preset ? t('presetConfirm.title', { name: t(`presets.${preset}`) }) : ''}
        message={
          diff && (diff.turnOn.length || diff.turnOff.length)
            ? [
                diff.turnOn.length ? t('presetConfirm.on', { items: names(diff.turnOn) }) : '',
                diff.turnOff.length ? t('presetConfirm.off', { items: names(diff.turnOff) }) : '',
              ]
                .filter(Boolean)
                .join('\n\n')
            : t('presetConfirm.none')
        }
        confirmLabel={t('presetConfirm.apply')}
        cancelLabel={t('common:cancel')}
        onCancel={() => setPreset(null)}
        onConfirm={() => {
          if (diff) applyPreset.mutate(diff.ids);
          setPreset(null);
        }}
      />

      <BottomSheet visible={adding} onClose={() => setAdding(false)} title={t('addTitle')}>
        <View style={styles.sheet}>
          <Input
            label={t('name')}
            value={newName}
            onChangeText={setNewName}
            maxLength={40}
            autoFocus
          />
          <Text variant="caption" tone="muted">
            {t('category')}
          </Text>
          <ChipGroup
            options={EQUIPMENT_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))}
            value={newCategory}
            onChange={setNewCategory}
          />
          <Button
            label={t('add')}
            fullWidth
            disabled={!newName.trim()}
            onPress={() => {
              create.mutate({ name: newName.trim(), category: newCategory });
              setNewName('');
              setAdding(false);
            }}
          />
        </View>
      </BottomSheet>

      <EquipmentEditSheet
        item={editing}
        title={editing ? name(editing) : ''}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        visible={deleting !== null}
        title={deleting ? t('deleteConfirm', { name: name(deleting) }) : ''}
        confirmLabel={t('delete')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
          setDeleting(null);
        }}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  section: { gap: t.spacing.sm },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  sheet: { gap: t.spacing.md, paddingBottom: t.spacing.md },
}));
