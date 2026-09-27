import { Image } from 'expo-image';

import { bundledImage, bundledVideo } from '@/constants/bundledImages';
import { brand } from '@/theme/brand';
import { makeStyles } from '@/theme';

import { ExerciseVideo } from './ExerciseVideo';

/**
 * Exercise screen header: bundled demo video (assets/videos/exercises/<slug>.mp4) if one
 * exists, else the bundled picture (assets/images/exercises/<slug>).
 */
export function ExerciseHero({ slug }: { slug: string | null }) {
  const styles = useStyles();
  const video = bundledVideo(slug);
  // The demo loops are shot on white: frame them on white, not the dark surface.
  if (video) return <ExerciseVideo source={video} style={[styles.hero, styles.light]} />;
  const source = bundledImage('exercises', slug);
  if (!source) return null;
  return (
    <Image
      source={source}
      style={styles.hero}
      contentFit="cover"
      transition={150}
      accessibilityIgnoresInvertColors
    />
  );
}

const useStyles = makeStyles((t) => ({
  light: { backgroundColor: brand.white },
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: t.radius.lg,
    overflow: 'hidden',
    backgroundColor: t.colors.surfaceRaised,
  },
}));
