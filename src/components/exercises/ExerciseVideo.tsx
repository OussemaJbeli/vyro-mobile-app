import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { AppState, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Short exercise demo (assets/videos/exercises/<slug>.mp4): muted, looping, no controls,
 * like a GIF. Decorative for screen readers (the exercise name is next to it).
 */
export function ExerciseVideo({
  source,
  style,
  fit = 'contain',
}: {
  source: number;
  style?: StyleProp<ViewStyle>;
  fit?: 'contain' | 'cover';
}) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // Keep looping for the whole workout: the OS pauses video when the app goes to the
  // background (screen lock, notification), so resume when it comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') player.play();
    });
    // Start as soon as the file is loaded (the setup call can run before that), and
    // restart if anything stops it mid-workout.
    // Self-healing load (1.2.0): a demo sometimes failed to load and stayed blank until the
    // exercise was reopened. Reload the same file on error, or if it isn't ready in time.
    let tries = 0;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      if (tries >= 3) return;
      tries += 1;
      void player.replaceAsync(source).then(() => {
        player.loop = true;
        player.muted = true;
        player.play();
      });
      arm();
    };
    const arm = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        if (player.status !== 'readyToPlay') reload();
      }, 2500);
    };
    arm();
    const ready = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        if (watchdog) clearTimeout(watchdog);
        player.play();
      } else if (status === 'error') {
        setTimeout(reload, 300);
      }
    });
    const playing = player.addListener('playingChange', ({ isPlaying }) => {
      if (!isPlaying && AppState.currentState === 'active' && player.status === 'readyToPlay') {
        player.play();
      }
    });
    return () => {
      if (watchdog) clearTimeout(watchdog);
      sub.remove();
      ready.remove();
      playing.remove();
    };
  }, [player, source]);
  return (
    <VideoView
      player={player}
      style={style}
      contentFit={fit}
      nativeControls={false}
      // Android: the default SurfaceView doesn't render inside rounded/clipped cards with
      // overlays (a blank box); TextureView composes like a normal view.
      surfaceType="textureView"
      allowsPictureInPicture={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
