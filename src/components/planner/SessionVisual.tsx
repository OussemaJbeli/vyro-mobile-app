import { ActivityIcon, CoverArt } from '@/components/ui';
import { bundledImage } from '@/constants/bundledImages';
import { coverPhotoUri } from '@/services/photos/covers';

import { activityType } from './activity';

/**
 * Plan/Home row visual: the workout's cover (photo picked in the app, or the bundled
 * assets/images/workouts/<cover_key>) when there is one, otherwise the activity tile.
 */
export function SessionVisual({
  type,
  coverKey,
  size,
  done = false,
}: {
  type: string;
  coverKey: string | null | undefined;
  size: number;
  done?: boolean;
}) {
  const hasCover =
    !!coverKey && (!!coverPhotoUri(coverKey) || !!bundledImage('workouts', coverKey));
  if (hasCover) {
    return <CoverArt type={activityType(type)} coverKey={coverKey} size={size} />;
  }
  return <ActivityIcon type={activityType(type)} size={size} state={done ? 'done' : 'default'} />;
}
