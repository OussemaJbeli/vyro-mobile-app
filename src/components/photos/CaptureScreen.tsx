import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Chip, Header, Input, ScreenContainer, Text, Toggle } from '@/components/ui';
import { useQueryClient } from '@tanstack/react-query';
import { invalidates, useLatestWeights, usePhotoCategories, useRepositories } from '@/hooks/data';
import { categoryTree } from '@/services/photos/paths';
import { toast } from '@/store/uiStore';
import { makeStyles, useTheme } from '@/theme';
import { type ProgressPhoto } from '@/types/domain';
import { today, toLocalDate } from '@/utils/dates';
import { logger } from '@/utils/logger';

import { photoUri, useCategoryLabel, usePhotoStore } from './usePhotoStore';

const TIMERS = [0, 3, 5, 10] as const;
const OPACITIES = [0, 0.25, 0.4, 0.6] as const;

/**
 * Private capture (step 23): category → camera with self-timer, grid and a ghost of the
 * previous photo of the same view; or import from the library. Preview → save.
 */
export function CaptureScreen({
  initialSub = null,
  startWithLibrary = false,
}: {
  initialSub?: string | null;
  startWithLibrary?: boolean;
}) {
  const { t } = useTranslation(['progress', 'common']);
  const styles = useStyles();
  const theme = useTheme();
  const label = useCategoryLabel();
  const repos = useRepositories();
  const client = useQueryClient();
  const store = usePhotoStore();
  const cats = usePhotoCategories();
  const latestWeight = useLatestWeights(1);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const tree = categoryTree(cats.data ?? []);
  const parentOf = (s: string) =>
    tree.find((c) => c.slug === s || c.children.includes(s))?.slug ?? s.split('.')[0] ?? s;
  const [sub, setSub] = useState(initialSub ?? 'body.front');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [timer, setTimer] = useState<(typeof TIMERS)[number]>(0);
  const [grid, setGrid] = useState(true);
  const [opacity, setOpacity] = useState<(typeof OPACITIES)[number]>(0.25);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ uri: string; imported: boolean } | null>(null);
  const [notes, setNotes] = useState('');
  const [linkWeight, setLinkWeight] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ghost, setGhost] = useState<ProgressPhoto | null>(null);

  useEffect(() => {
    let alive = true;
    repos.photos
      .latestIn(sub)
      .then((p) => alive && setGhost(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [repos, sub]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      camera.current
        ?.takePictureAsync({ quality: 1, skipProcessing: false })
        .then((pic) => setPreview({ uri: pic.uri, imported: false }))
        .catch((error: unknown) => logger.warn('Capture failed', { error }))
        .finally(() => setCountdown(null));
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const importPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setPreview({ uri: asset.uri, imported: true });
  };

  // "Upload from library" on the Photos tab opens the picker straight away.
  const libraryOpened = useRef(false);
  useEffect(() => {
    if (!startWithLibrary || libraryOpened.current) return;
    libraryOpened.current = true;
    void importPhoto();
  }, [startWithLibrary]);

  const save = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const weight = latestWeight.data?.[0];
      await store.savePhoto(preview.uri, {
        // Custom groups have no views: the group itself is the category.
        category: parentOf(sub),
        subCategory: sub.includes('.') ? sub : null,
        weightEntryId:
          linkWeight && weight && toLocalDate(weight.recordedAt) === today() ? weight.id : null,
        notes: notes.trim() || null,
      });
      await Promise.all(
        invalidates.photos.map((queryKey) => client.invalidateQueries({ queryKey: [...queryKey] })),
      );
      toast.success(t('photos.saved'));
      router.back();
    } catch (error) {
      logger.error('Photo save failed', { error });
      toast.error(t('photos.failed'));
      setSaving(false);
    }
  };

  if (preview) {
    const weight = latestWeight.data?.[0];
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <Header title={label(sub)} onBack={() => setPreview(null)} large={false} />
        <Image
          source={{ uri: preview.uri }}
          style={styles.preview}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
        {preview.imported ? (
          <Text variant="caption" tone="muted">
            {t('photos.importReminder')}
          </Text>
        ) : null}
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder={t('photos.note')}
          maxLength={300}
        />
        {weight && toLocalDate(weight.recordedAt) === today() ? (
          <View style={styles.row}>
            <Text style={styles.flex}>{t('photos.linkWeight')}</Text>
            <Toggle
              value={linkWeight}
              onChange={setLinkWeight}
              accessibilityLabel={t('photos.linkWeight')}
            />
          </View>
        ) : null}
        <View style={styles.row}>
          <Button
            size="lg"
            variant="secondary"
            label={t('photos.retake')}
            onPress={() => setPreview(null)}
          />
          <View style={styles.flex}>
            <Button
              size="lg"
              label={t('photos.save')}
              fullWidth
              loading={saving}
              onPress={() => void save()}
              testID="photo-save"
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const granted = permission?.granted ?? false;
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header
        title={t('photos.add')}
        subtitle={t('photos.private')}
        onBack={() => router.back()}
        large={false}
      />
      <Text variant="caption" tone="muted">
        {t('photos.pickSub')}
      </Text>
      <View style={styles.chips}>
        {tree.flatMap((c) =>
          c.children.length === 0 ? (
            <Chip
              key={c.slug}
              label={label(c.slug)}
              selected={sub === c.slug}
              onPress={() => setSub(c.slug)}
            />
          ) : (
            c.children.map((s) => (
              <Chip
                key={s}
                label={`${label(c.slug)} · ${label(s)}`}
                selected={sub === s}
                onPress={() => setSub(s)}
              />
            ))
          ),
        )}
      </View>
      {granted ? (
        <View style={styles.cameraBox}>
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mirror={facing === 'front'}
          />
          {ghost && opacity > 0 ? (
            <View style={[StyleSheet.absoluteFill, { opacity, pointerEvents: 'none' }]}>
              <Image
                source={{ uri: photoUri(ghost.filePath) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
            </View>
          ) : null}
          {grid ? (
            <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
              {[1, 2].map((i) => (
                <View
                  key={`v${i}`}
                  style={[
                    styles.gridV,
                    { left: `${(i * 100) / 3}%`, backgroundColor: theme.colors.overlay },
                  ]}
                />
              ))}
              {[1, 2].map((i) => (
                <View
                  key={`h${i}`}
                  style={[
                    styles.gridH,
                    { top: `${(i * 100) / 3}%`, backgroundColor: theme.colors.overlay },
                  ]}
                />
              ))}
            </View>
          ) : null}
          {countdown !== null && countdown > 0 ? (
            <View style={[StyleSheet.absoluteFill, styles.center, { pointerEvents: 'none' }]}>
              <Text variant="timer" tone="onPrimary" accessibilityLiveRegion="polite">
                {countdown}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.center}>
          <Text tone="muted" align="center">
            {t('photos.permission')}
          </Text>
          {permission && !permission.canAskAgain ? (
            <Button
              size="md"
              variant="secondary"
              label={t('photos.openSettings')}
              onPress={() => void Linking.openSettings()}
            />
          ) : (
            <Button
              size="md"
              label={t('photos.allowCamera')}
              onPress={() => void requestPermission()}
            />
          )}
        </View>
      )}
      {granted ? (
        <>
          <View style={styles.chips}>
            <Text variant="caption" tone="muted">
              {t('photos.timer')}
            </Text>
            {TIMERS.map((s) => (
              <Chip
                key={s}
                label={s === 0 ? t('photos.timerOff') : `${s} s`}
                selected={timer === s}
                onPress={() => setTimer(s)}
              />
            ))}
          </View>
          {ghost ? (
            <View style={styles.chips}>
              <Text variant="caption" tone="muted">
                {t('photos.opacity')}
              </Text>
              {OPACITIES.map((o) => (
                <Chip
                  key={o}
                  label={`${Math.round(o * 100)} %`}
                  selected={opacity === o}
                  onPress={() => setOpacity(o)}
                />
              ))}
            </View>
          ) : null}
          <View style={styles.row}>
            <Button
              size="md"
              variant="secondary"
              label={t('photos.flip')}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            />
            <Button
              size="md"
              variant={grid ? 'primary' : 'secondary'}
              label={t('photos.grid')}
              onPress={() => setGrid((g) => !g)}
            />
          </View>
          <Button
            size="xl"
            icon="photo"
            label={t('photos.shutter')}
            fullWidth
            disabled={countdown !== null}
            onPress={() => setCountdown(timer)}
            testID="photo-shutter"
          />
        </>
      ) : null}
      <Button
        size="lg"
        variant="secondary"
        label={t('photos.library')}
        fullWidth
        onPress={() => void importPhoto()}
        testID="photo-import"
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
  cameraBox: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: t.radius.lg,
    overflow: 'hidden',
    backgroundColor: t.colors.surface,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    padding: t.spacing.lg,
  },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1 },
  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: t.radius.lg },
}));
