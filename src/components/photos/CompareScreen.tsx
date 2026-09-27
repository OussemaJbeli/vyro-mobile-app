import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Chip, EmptyState, Header, ScreenContainer, SegmentedControl, Text } from '@/components/ui';
import { useAllPhotos, usePhotoCategories, useUnitPrefs, useWeights } from '@/hooks/data';
import { categoryTree } from '@/services/photos/paths';
import { makeStyles, useTheme } from '@/theme';
import { type ProgressPhoto } from '@/types/domain';
import { formatQuantity } from '@/utils/units';

import { Thumb } from './PhotosSegment';
import { photoUri, useCategoryLabel } from './usePhotoStore';

const DAY = 86_400_000;

/** Before/after comparison: side by side or slider. Captions: dates, days, weights only. */
export function CompareScreen() {
  const { t, i18n } = useTranslation('progress');
  const styles = useStyles();
  const label = useCategoryLabel();
  const prefs = useUnitPrefs();
  const cats = usePhotoCategories();
  const photos = useAllPhotos();
  const weights = useWeights();
  const { width } = useWindowDimensions();
  const tree = categoryTree(cats.data ?? []);
  const [sub, setSub] = useState('body.front');
  const [mode, setMode] = useState<'side' | 'slider'>('side');
  const [pick, setPick] = useState<{ before: string | null; after: string | null }>({
    before: null,
    after: null,
  });
  const list = (photos.data ?? [])
    .filter((p) => p.subCategory === sub)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const before = list.find((p) => p.id === pick.before) ?? list[0];
  const after = list.find((p) => p.id === pick.after) ?? list.at(-1);
  const w = Math.min(width, 600) - 32;
  const caption = (p: ProgressPhoto) => {
    const kg = p.weightEntryId
      ? (weights.data ?? []).find((x) => x.id === p.weightEntryId)?.valueKg
      : undefined;
    return [
      new Date(p.capturedAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' }),
      kg ? formatQuantity(kg, 'bodyWeight', prefs, i18n.language) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('photos.compare')} onBack={() => router.back()} large={false} />
      <View style={styles.chips}>
        {tree
          .flatMap((c) => c.children)
          .map((s) => (
            <Chip
              key={s}
              label={`${label(s.split('.')[0]!)} · ${label(s)}`}
              selected={sub === s}
              onPress={() => {
                setSub(s);
                setPick({ before: null, after: null });
              }}
            />
          ))}
      </View>
      {list.length < 2 || !before || !after ? (
        <EmptyState icon="gallery" title={t('photos.compareHint')} />
      ) : (
        <>
          <SegmentedControl
            segments={[
              { value: 'side', label: t('photos.sideBySide') },
              { value: 'slider', label: t('photos.slider') },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Text tone="muted" align="center">
            {t('photos.daysApart', {
              count: Math.round(
                Math.abs(Date.parse(after.capturedAt) - Date.parse(before.capturedAt)) / DAY,
              ),
            })}
          </Text>
          {mode === 'side' ? (
            <View style={styles.side}>
              {[before, after].map((p, i) => (
                <View key={p.id} style={styles.half}>
                  <Text variant="overline" tone="muted">
                    {i === 0 ? t('photos.before') : t('photos.after')}
                  </Text>
                  <Image
                    source={{ uri: photoUri(p.filePath) }}
                    style={{ width: (w - 8) / 2, height: ((w - 8) / 2) * 1.33 }}
                    contentFit="cover"
                    accessibilityIgnoresInvertColors
                  />
                  <Text variant="caption" tone="muted">
                    {caption(p)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <>
              <CompareSlider before={before} after={after} width={w} height={w * 1.33} />
              <View style={styles.side}>
                <Text
                  variant="caption"
                  tone="muted"
                >{`${t('photos.before')}: ${caption(before)}`}</Text>
                <Text
                  variant="caption"
                  tone="muted"
                >{`${t('photos.after')}: ${caption(after)}`}</Text>
              </View>
            </>
          )}
          <Picker
            title={t('photos.before')}
            photos={list}
            selected={before.id}
            onPick={(id) => setPick((s) => ({ ...s, before: id }))}
          />
          <Picker
            title={t('photos.after')}
            photos={list}
            selected={after.id}
            onPick={(id) => setPick((s) => ({ ...s, after: id }))}
          />
        </>
      )}
    </ScreenContainer>
  );
}

function Picker({
  title,
  photos,
  selected,
  onPick,
}: {
  title: string;
  photos: ProgressPhoto[];
  selected: string;
  onPick: (id: string) => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.picker}>
      <Text variant="overline" tone="muted">
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {photos.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onPick(p.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: p.id === selected }}
            style={[styles.pick, p.id === selected && { borderColor: theme.colors.primary }]}
          >
            <Thumb photo={p} size={56} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Draggable vertical divider revealing before (left) and after (right), on the UI thread. */
function CompareSlider({
  before,
  after,
  width,
  height,
}: {
  before: ProgressPhoto;
  after: ProgressPhoto;
  width: number;
  height: number;
}) {
  const { t } = useTranslation('progress');
  const theme = useTheme();
  const x = useSharedValue(width / 2);
  const pan = Gesture.Pan().onUpdate((e) => {
    x.set(Math.min(width, Math.max(0, e.x)));
  });
  const clip = useAnimatedStyle(() => ({ width: x.get() }));
  const handle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() - 1 }] }));
  return (
    <GestureDetector gesture={pan}>
      <View
        style={{ width, height, alignSelf: 'center' }}
        accessible
        accessibilityLabel={t('photos.sliderA11y')}
      >
        <Image
          source={{ uri: photoUri(after.filePath) }}
          style={{ width, height, position: 'absolute' }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        <Animated.View style={[{ height, overflow: 'hidden', position: 'absolute' }, clip]}>
          <Image
            source={{ uri: photoUri(before.filePath) }}
            style={{ width, height }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
        <Animated.View
          style={[
            { position: 'absolute', width: 2, height, backgroundColor: theme.colors.primary },
            handle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const useStyles = makeStyles((t) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs },
  side: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  half: { gap: t.spacing.xs, alignItems: 'center' },
  picker: { gap: t.spacing.xs },
  strip: { gap: t.spacing.xs },
  pick: { borderWidth: 2, borderColor: 'transparent', borderRadius: 10 },
}));
