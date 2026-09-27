import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Button, ConfirmDialog, Header, ScreenContainer, Text } from '@/components/ui';
import { invalidates, useAllPhotos, useRepoMutation, useUnitPrefs, useWeights } from '@/hooks/data';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { type ProgressPhoto } from '@/types/domain';
import { formatQuantity } from '@/utils/units';

import { photoUri, useCategoryLabel } from './usePhotoStore';

function ZoomableImage({
  photo,
  width,
  height,
}: {
  photo: ProgressPhoto;
  width: number;
  height: number;
}) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.set(Math.min(5, Math.max(1, saved.get() * e.scale)));
    })
    .onEnd(() => {
      saved.set(scale.get());
    });
  const reset = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.set(withTiming(1));
      saved.set(1);
    });
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, reset)}>
      <Animated.View style={[{ width, height }, style]}>
        <Image
          source={{ uri: photoUri(photo.filePath) }}
          style={{ width, height }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </GestureDetector>
  );
}

/** Fullscreen viewer: pinch-zoom, swipe within the sub-category, info, delete, export. */
export function PhotoViewer({ id }: { id: string }) {
  const { t, i18n } = useTranslation(['progress', 'common']);
  const styles = useStyles();
  const label = useCategoryLabel();
  const prefs = useUnitPrefs();
  const { width, height } = useWindowDimensions();
  const photos = useAllPhotos();
  const weights = useWeights();
  const start = (photos.data ?? []).find((p) => p.id === id);
  const siblings = (photos.data ?? [])
    .filter((p) => start && p.category === start.category && p.subCategory === start.subCategory)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const [index, setIndex] = useState<number | null>(null);
  const current =
    siblings[
      index ??
        Math.max(
          0,
          siblings.findIndex((p) => p.id === id),
        )
    ];
  const [confirm, setConfirm] = useState<null | 'delete' | 'export'>(null);
  const remove = useRepoMutation((r, photoId: string) => r.photos.softDelete(photoId), {
    invalidate: invalidates.photos,
    onSuccess: () => {
      toast.info(t('photos.recentlyDeleted'));
      router.back();
    },
  });
  if (!start || !current) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Header title={t('photos.title')} onBack={() => router.back()} large={false} />
      </ScreenContainer>
    );
  }
  const weight = current.weightEntryId
    ? (weights.data ?? []).find((w) => w.id === current.weightEntryId)
    : undefined;
  const imageHeight = Math.round(height * 0.62);
  return (
    <ScreenContainer edges={['top', 'bottom']} scroll={false} padded={false}>
      <View style={styles.pad}>
        <Header
          title={label(current.subCategory ?? current.category)}
          onBack={() => router.back()}
          large={false}
        />
      </View>
      <FlatList
        data={siblings}
        horizontal
        pagingEnabled
        keyExtractor={(p) => p.id}
        initialScrollIndex={Math.max(
          0,
          siblings.findIndex((p) => p.id === id),
        )}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => <ZoomableImage photo={item} width={width} height={imageHeight} />}
        showsHorizontalScrollIndicator={false}
      />
      <View style={[styles.pad, styles.info]}>
        <Text variant="bodyStrong">
          {t('photos.taken', {
            date: new Date(current.capturedAt).toLocaleDateString(i18n.language, {
              dateStyle: 'long',
            }),
          })}
        </Text>
        {weight ? (
          <Text tone="muted">
            {t('photos.weightAt', {
              value: formatQuantity(weight.valueKg, 'bodyWeight', prefs, i18n.language),
            })}
          </Text>
        ) : null}
        {current.notes ? <Text>{current.notes}</Text> : null}
        <View style={styles.row}>
          <Button
            size="md"
            variant="secondary"
            label={t('photos.export')}
            onPress={() => setConfirm('export')}
          />
          <Button
            size="md"
            variant="danger"
            label={t('photos.delete')}
            onPress={() => setConfirm('delete')}
            testID="photo-delete"
          />
        </View>
      </View>
      <ConfirmDialog
        visible={confirm === 'delete'}
        title={t('photos.deleteTitle')}
        message={t('photos.recentlyDeleted')}
        confirmLabel={t('photos.delete')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          remove.mutate(current.id);
        }}
      />
      <ConfirmDialog
        visible={confirm === 'export'}
        title={t('photos.exportTitle')}
        message={t('photos.exportBody')}
        confirmLabel={t('photos.export')}
        cancelLabel={t('common:cancel')}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          Sharing.shareAsync(photoUri(current.filePath), { mimeType: 'image/jpeg' }).catch(
            () => {},
          );
        }}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  pad: { paddingHorizontal: t.spacing.md },
  info: { gap: t.spacing.xs, paddingVertical: t.spacing.md },
  row: { flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.sm },
}));
