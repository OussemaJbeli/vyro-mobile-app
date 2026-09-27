import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Input,
  ListRow,
  SectionHeader,
  Text,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { categoryTree } from '@/services/photos/paths';
import {
  invalidates,
  useAllPhotos,
  useDeletedPhotos,
  usePhotoCategories,
  useRepoMutation,
} from '@/hooks/data';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { type ProgressPhoto } from '@/types/domain';
import { toLocalDate } from '@/utils/dates';

import { photoUri, useCategoryLabel } from './usePhotoStore';

/** Progress → Photos (step 23): category cards, compare, recently deleted. Private only. */
export function PhotosSegment() {
  const { t } = useTranslation('progress');
  const styles = useStyles();
  const label = useCategoryLabel();
  const cats = usePhotoCategories();
  const photos = useAllPhotos();
  const deleted = useDeletedPhotos();
  const restore = useRepoMutation((r, id: string) => r.photos.restore(id), {
    invalidate: invalidates.photos,
  });
  const [naming, setNaming] = useState(false);
  const [groupName, setGroupName] = useState('');
  const createGroup = useRepoMutation((r, name: string) => r.photos.createGroup(name), {
    invalidate: invalidates.photos,
    onSuccess: () => toast.success(t('photos.groupCreated')),
  });
  const tree = categoryTree(cats.data ?? []);
  const all = photos.data ?? [];

  return (
    <>
      <Text variant="caption" tone="muted">
        🔒 {t('photos.private')}
      </Text>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            size="lg"
            icon="photo"
            label={t('photos.camera')}
            fullWidth
            onPress={() => router.push(routes.photoCaptureIn('camera', ''))}
            testID="photos-add"
          />
        </View>
        <View style={styles.flex}>
          <Button
            size="lg"
            variant="secondary"
            icon="gallery"
            label={t('photos.upload')}
            fullWidth
            onPress={() => router.push(routes.photoCaptureIn('library', ''))}
            testID="photos-upload"
          />
        </View>
      </View>
      <View style={styles.row}>
        <Button
          size="sm"
          variant="secondary"
          icon="add"
          label={t('photos.newGroup')}
          onPress={() => setNaming(true)}
          testID="photos-new-group"
        />
        <Button
          size="sm"
          variant="secondary"
          label={t('photos.compare')}
          onPress={() => router.push(routes.photoCompare)}
          disabled={all.length < 2}
        />
      </View>
      {all.length === 0 ? (
        <EmptyState icon="gallery" title={t('photos.empty')} body={t('photos.emptyBody')} />
      ) : null}
      {tree.map((c) => {
        const inCat = all.filter((p) => p.category === c.slug);
        const latest = inCat[0];
        return (
          <Card key={c.slug} style={styles.card}>
            <ListRow
              title={label(c.slug)}
              subtitle={
                latest
                  ? `${t('photos.count', { count: inCat.length })} · ${toLocalDate(latest.capturedAt)}`
                  : t('photos.count', { count: 0 })
              }
              leading={latest ? <Thumb photo={latest} size={56} /> : undefined}
              trailing={
                <Button
                  size="sm"
                  variant="ghost"
                  icon="add"
                  label={t('photos.addTo')}
                  accessibilityLabel={`${t('photos.addTo')} · ${label(c.slug)}`}
                  onPress={() =>
                    router.push(routes.photoCaptureIn('camera', c.children[0] ?? c.slug))
                  }
                />
              }
              onPress={() => router.push(routes.photoCategory(c.slug))}
              testID={`photos-cat-${c.slug}`}
            />
          </Card>
        );
      })}
      <LatestComparisonCard />
      <BottomSheet visible={naming} onClose={() => setNaming(false)} title={t('photos.newGroup')}>
        <View style={styles.sheet}>
          <Input
            label={t('photos.groupName')}
            placeholder={t('photos.groupHint')}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={40}
            autoFocus
          />
          <Button
            label={t('photos.createGroup')}
            fullWidth
            disabled={!groupName.trim()}
            onPress={() => {
              createGroup.mutate(groupName.trim());
              setGroupName('');
              setNaming(false);
            }}
            testID="photos-create-group"
          />
        </View>
      </BottomSheet>
      {(deleted.data ?? []).length ? (
        <>
          <SectionHeader title={t('photos.recentlyDeleted')} />
          <Card>
            {(deleted.data ?? []).map((p) => (
              <ListRow
                key={p.id}
                title={label(p.subCategory ?? p.category)}
                subtitle={toLocalDate(p.capturedAt)}
                leading={<Thumb photo={p} size={40} />}
                trailing={
                  <Button
                    size="sm"
                    variant="ghost"
                    label={t('photos.restore')}
                    onPress={() => restore.mutate(p.id)}
                  />
                }
                showChevron={false}
              />
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}

export function Thumb({ photo, size }: { photo: ProgressPhoto; size: number }) {
  return (
    <Image
      source={{ uri: photoUri(photo.thumbPath) }}
      style={{ width: size, height: size, borderRadius: 8 }}
      contentFit="cover"
      cachePolicy="memory-disk"
      accessibilityIgnoresInvertColors
    />
  );
}

/** Overview card: first vs latest Body · Front, dates only (no judgement text). */
export function LatestComparisonCard() {
  const { t } = useTranslation('progress');
  const styles = useStyles();
  const photos = useAllPhotos();
  const front = (photos.data ?? []).filter((p) => p.subCategory === 'body.front');
  if (front.length < 2) return null;
  const after = front[0]!;
  const before = front.at(-1)!;
  return (
    <Card style={styles.card} testID="latest-comparison">
      <ListRow title={t('photos.compare')} onPress={() => router.push(routes.photoCompare)} />
      <View style={styles.row}>
        <View style={styles.half}>
          <Thumb photo={before} size={140} />
          <Text variant="caption" tone="muted">
            {toLocalDate(before.capturedAt)}
          </Text>
        </View>
        <View style={styles.half}>
          <Thumb photo={after} size={140} />
          <Text variant="caption" tone="muted">
            {toLocalDate(after.capturedAt)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: t.spacing.sm },
  flex: { flex: 1 },
  sheet: { gap: t.spacing.md, paddingBottom: t.spacing.md },
  card: { gap: t.spacing.sm },
  half: { flex: 1, alignItems: 'center', gap: t.spacing.xs },
}));
