import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';

import { Button, Chip, EmptyState, Header, ScreenContainer, Text } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useAllPhotos, usePhotoCategories } from '@/hooks/data';
import { categoryTree } from '@/services/photos/paths';
import { makeStyles } from '@/theme';
import { type ProgressPhoto } from '@/types/domain';

import { Thumb } from './PhotosSegment';
import { useCategoryLabel } from './usePhotoStore';

/** A category's photos by month (thumbnails only; originals load in the viewer, FS §62). */
export function PhotoGridScreen({ category }: { category: string }) {
  const { t, i18n } = useTranslation('progress');
  const styles = useStyles();
  const label = useCategoryLabel();
  const { width } = useWindowDimensions();
  const cats = usePhotoCategories();
  const photos = useAllPhotos();
  const [sub, setSub] = useState<string | null>(null);
  const [newest, setNewest] = useState(true);
  const children = categoryTree(cats.data ?? []).find((c) => c.slug === category)?.children ?? [];
  const list = (photos.data ?? [])
    .filter((p) => p.category === category && (!sub || p.subCategory === sub))
    .sort((a, b) =>
      newest ? b.capturedAt.localeCompare(a.capturedAt) : a.capturedAt.localeCompare(b.capturedAt),
    );
  const months: { key: string; title: string; items: ProgressPhoto[] }[] = [];
  for (const p of list) {
    const key = p.capturedAt.slice(0, 7);
    let m = months.at(-1);
    if (!m || m.key !== key) {
      m = {
        key,
        title: new Date(p.capturedAt).toLocaleDateString(i18n.language, {
          month: 'long',
          year: 'numeric',
        }),
        items: [],
      };
      months.push(m);
    }
    m.items.push(p);
  }
  const size = Math.floor((Math.min(width, 600) - 32 - 8 * 2) / 3);

  return (
    <ScreenContainer edges={['top', 'bottom']} scroll={false}>
      <Header title={label(category)} onBack={() => router.back()} large={false} />
      <View style={styles.chips}>
        <Chip label={t('photos.all')} selected={sub === null} onPress={() => setSub(null)} />
        {children.map((c) => (
          <Chip key={c} label={label(c)} selected={sub === c} onPress={() => setSub(c)} />
        ))}
        <Button
          size="sm"
          variant="ghost"
          label={newest ? t('photos.sortNewest') : t('photos.sortOldest')}
          onPress={() => setNewest((v) => !v)}
        />
      </View>
      <FlatList
        data={months}
        keyExtractor={(m) => m.key}
        initialNumToRender={4}
        windowSize={5}
        ListEmptyComponent={
          <EmptyState icon="gallery" title={t('photos.empty')} body={t('photos.emptyBody')} />
        }
        renderItem={({ item }) => (
          <View style={styles.month}>
            <Text variant="overline" tone="muted">
              {item.title}
            </Text>
            <View style={styles.grid}>
              {item.items.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(routes.photoViewer(p.id))}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`${label(p.subCategory ?? p.category)}, ${new Date(p.capturedAt).toLocaleDateString(i18n.language)}`}
                >
                  <Thumb photo={p} size={size} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs, alignItems: 'center' },
  month: { gap: t.spacing.xs, marginBottom: t.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
