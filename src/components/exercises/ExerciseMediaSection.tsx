import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  Icon,
  IconButton,
  Input,
  ListRow,
  SectionHeader,
  Text,
} from '@/components/ui';
import { invalidates, useExerciseMedia, useRepoMutation } from '@/hooks/data';
import {
  deleteMediaFile,
  mediaSupported,
  mediaUri,
  pickExerciseMedia,
} from '@/services/media/exerciseMedia';
import { makeStyles, useTheme } from '@/theme';
import { type ExerciseMedia } from '@/types/domain';
import { logger } from '@/utils/logger';
import { parseVideoUrl } from '@/utils/video';

const TILE = 150;

/**
 * Exercise media (images, GIFs, video links) on the exercise detail and during workouts.
 * `editable` adds "Add image/GIF", "Add video link", and long-press → thumbnail / remove.
 */
export function ExerciseMediaSection({
  exerciseId,
  editable = false,
  title = true,
}: {
  exerciseId: string;
  editable?: boolean;
  title?: boolean;
}) {
  const { t } = useTranslation(['exercises', 'common']);
  const styles = useStyles();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const media = useExerciseMedia(exerciseId);
  const [viewer, setViewer] = useState<ExerciseMedia | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [menu, setMenu] = useState<ExerciseMedia | null>(null);
  const [confirm, setConfirm] = useState<ExerciseMedia | null>(null);

  const add = useRepoMutation(
    (r, v: { kind: ExerciseMedia['kind']; filePath: string | null; url: string | null }) =>
      r.exerciseMedia.add({ exerciseId, ...v }),
    { invalidate: invalidates.exercises },
  );
  const remove = useRepoMutation(
    async (r, m: ExerciseMedia) => {
      await r.exerciseMedia.remove(m.id);
      if (m.filePath) deleteMediaFile(m.filePath);
    },
    { invalidate: invalidates.exercises },
  );
  const first = useRepoMutation((r, id: string) => r.exerciseMedia.makeFirst(exerciseId, id), {
    invalidate: invalidates.exercises,
  });

  const items = media.data ?? [];
  if (!editable && items.length === 0) return null;

  const open = (m: ExerciseMedia) => {
    if (m.kind === 'video' && m.url) void Linking.openURL(m.url);
    else setViewer(m);
  };

  return (
    <>
      {title ? <SectionHeader title={t('media.title')} /> : null}
      {items.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {items.map((m) => {
            const video = m.kind === 'video' && m.url ? parseVideoUrl(m.url) : null;
            const label =
              m.kind === 'video'
                ? video?.kind === 'youtube'
                  ? t('media.youtube')
                  : t('media.video', { host: video?.kind === 'link' ? video.host : '' })
                : t(`media.${m.kind}`);
            return (
              <Pressable
                key={m.id}
                onPress={() => open(m)}
                onLongPress={editable ? () => setMenu(m) : undefined}
                accessibilityRole={m.kind === 'video' ? 'link' : 'imagebutton'}
                accessibilityLabel={label}
                accessibilityHint={editable ? t('media.options') : undefined}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                testID={`media-${m.kind}`}
              >
                {m.filePath ? (
                  <Image
                    source={{ uri: mediaUri(m.filePath) }}
                    style={styles.fill}
                    contentFit="cover"
                    autoplay
                    accessibilityIgnoresInvertColors
                  />
                ) : video?.kind === 'youtube' ? (
                  <Image
                    source={{ uri: video.thumbnail }}
                    style={styles.fill}
                    contentFit="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={[styles.fill, styles.linkTile]}>
                    <Text variant="caption" tone="muted" numberOfLines={2}>
                      {video?.kind === 'link' ? video.host : m.url}
                    </Text>
                  </View>
                )}
                {m.kind === 'video' ? (
                  <View style={styles.play}>
                    <Icon name="play" size={28} color={theme.colors.onPrimary} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Card>
          <Text tone="muted">{t('media.empty')}</Text>
        </Card>
      )}
      {editable ? (
        <View style={styles.row}>
          {mediaSupported ? (
            <Button
              size="sm"
              variant="secondary"
              icon="photo"
              label={t('media.addImage')}
              loading={add.isPending}
              onPress={() =>
                void pickExerciseMedia()
                  .then((m) => m && add.mutate({ kind: m.kind, filePath: m.filePath, url: null }))
                  .catch((error: unknown) => logger.warn('Media pick failed', { error }))
              }
              testID="media-add-image"
            />
          ) : (
            <Text variant="caption" tone="muted">
              {t('media.webHint')}
            </Text>
          )}
          <Button
            size="sm"
            variant="secondary"
            icon="play"
            label={t('media.addVideo')}
            onPress={() => setLinkOpen(true)}
            testID="media-add-video"
          />
        </View>
      ) : null}

      <BottomSheet
        visible={linkOpen}
        onClose={() => setLinkOpen(false)}
        title={t('media.addVideo')}
      >
        <View style={styles.gap}>
          <Input
            label={t('media.videoUrl')}
            helper={t('media.videoHint')}
            value={link}
            onChangeText={(v) => {
              setLink(v);
              setLinkError(null);
            }}
            autoCapitalize="none"
            keyboardType="url"
            {...(linkError ? { error: linkError } : {})}
            testID="media-url"
          />
          <Button
            size="lg"
            label={t('media.save')}
            fullWidth
            onPress={() => {
              const v = parseVideoUrl(link);
              if (!v) return setLinkError(t('media.invalidUrl'));
              add.mutate({ kind: 'video', filePath: null, url: v.url });
              setLink('');
              setLinkOpen(false);
            }}
            testID="media-url-save"
          />
        </View>
      </BottomSheet>

      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)} title={t('media.options')}>
        <ListRow
          title={t('media.makeThumb')}
          onPress={() => {
            if (menu) first.mutate(menu.id);
            setMenu(null);
          }}
          showChevron={false}
        />
        <ListRow
          title={t('media.remove')}
          onPress={() => {
            setConfirm(menu);
            setMenu(null);
          }}
          showChevron={false}
        />
      </BottomSheet>
      <ConfirmDialog
        visible={confirm !== null}
        title={t('media.removeTitle')}
        confirmLabel={t('media.remove')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) remove.mutate(confirm);
          setConfirm(null);
        }}
      />

      <Modal
        visible={viewer !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(null)}
      >
        <View style={[styles.viewer, { backgroundColor: theme.colors.overlay }]}>
          {viewer?.filePath ? (
            <Image
              source={{ uri: mediaUri(viewer.filePath) }}
              style={{ width, height: height * 0.7 }}
              contentFit="contain"
              autoplay
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <IconButton
            icon="close"
            variant="filled"
            accessibilityLabel={t('common:close')}
            onPress={() => setViewer(null)}
          />
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((t) => ({
  strip: { gap: t.spacing.sm },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: t.radius.lg,
    overflow: 'hidden',
    backgroundColor: t.colors.surfaceRaised,
  },
  fill: { width: '100%', height: '100%' },
  linkTile: { alignItems: 'center', justifyContent: 'center', padding: t.spacing.sm },
  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: TILE / 2 - 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
  },
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, alignItems: 'center' },
  gap: { gap: t.spacing.sm },
  viewer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.lg },
}));
