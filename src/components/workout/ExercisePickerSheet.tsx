import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';

import { BottomSheet, Button, Icon, Input, ListRow, Text, Toggle } from '@/components/ui';
import { matchesQuery, useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { makeStyles, useTheme } from '@/theme';

import { ExerciseRow } from './ExerciseRow';

/** Multi-select exercise picker (step 14 builder). Defaults to exercises the user can do. */
export function ExercisePickerSheet({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (exerciseIds: string[]) => void;
}) {
  const { t } = useTranslation('train');
  const theme = useTheme();
  const styles = useStyles();
  const catalog = useExerciseCatalog();
  const [query, setQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);

  const items = useMemo(
    () =>
      catalog.items
        .filter((x) => !x.archivedAt && (!onlyAvailable || x.available) && matchesQuery(x, query))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [catalog.items, onlyAvailable, query],
  );

  const close = () => {
    setPicked([]);
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title={t('builder.pickerTitle')}>
      <View style={styles.body}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('search')}
          leftIcon="search"
          autoCorrect={false}
          testID="picker-search"
        />
        <ListRow
          title={t('builder.onlyAvailable')}
          trailing={
            <Toggle
              value={onlyAvailable}
              onChange={setOnlyAvailable}
              accessibilityLabel={t('builder.onlyAvailable')}
            />
          }
        />
        <FlatList
          style={styles.list}
          data={items}
          keyExtractor={(x) => x.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const on = picked.includes(item.id);
            return (
              <ExerciseRow
                item={item}
                onPress={() =>
                  setPicked((p) => (on ? p.filter((x) => x !== item.id) : [...p, item.id]))
                }
                trailing={
                  <Icon
                    name={on ? 'status-done' : 'status-pending'}
                    size={24}
                    color={on ? theme.colors.primaryInk : theme.colors.textMuted}
                    accessibilityLabel={on ? '✓' : ''}
                  />
                }
              />
            );
          }}
          ListEmptyComponent={<Text tone="muted">{t('empty.filterBody')}</Text>}
        />
        <Button
          label={t('builder.pickerDone', { count: picked.length })}
          fullWidth
          disabled={picked.length === 0}
          onPress={() => {
            onAdd(picked);
            close();
          }}
          testID="picker-add"
        />
      </View>
    </BottomSheet>
  );
}

const useStyles = makeStyles((t) => ({
  body: { gap: t.spacing.sm, paddingBottom: t.spacing.sm },
  list: { maxHeight: 380 },
}));
