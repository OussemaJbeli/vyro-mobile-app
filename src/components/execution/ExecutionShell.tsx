import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, View } from 'react-native';

import {
  BottomSheet,
  Button,
  ConfirmDialog,
  IconButton,
  ScreenContainer,
  Text,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { formatMinSec } from '@/domain/running/intervals';
import { makeStyles, useTheme } from '@/theme';

export type ExecutionShellProps = {
  title: string;
  /** Active (pause-excluding) time, shown next to the title. */
  elapsedMs?: number;
  paused?: boolean;
  onPauseToggle?: () => void;
  onFinish?: () => void;
  onDiscard?: () => Promise<void>;
  /** Whether anything was logged: decides the discard wording (deleted vs kept). */
  hasLogged?: boolean;
  /** Decorative background (ExecutionBackdrop). */
  backdrop?: ReactNode;
  children: ReactNode;
};

/** Leaves the execution screen without touching the workout (it stays active). */
export function leaveExecution() {
  if (router.canGoBack()) router.back();
  else router.replace(routes.home);
}

/**
 * Fullscreen execution frame. Hardware back and ✕ open the Pause/Exit sheet instead of
 * leaving, so a gesture can never abandon a workout (UI §12).
 */
export function ExecutionShell({
  title,
  elapsedMs,
  paused = false,
  onPauseToggle,
  onFinish,
  onDiscard,
  hasLogged = false,
  backdrop,
  children,
}: ExecutionShellProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['execution', 'common']);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirm, setConfirm] = useState<0 | 1 | 2>(0);
  const [discarding, setDiscarding] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setExitOpen(true);
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  const act = (fn: () => void) => () => {
    setExitOpen(false);
    fn();
  };

  return (
    <ScreenContainer edges={['top', 'bottom']} scroll={false} background={backdrop}>
      <View style={styles.bar}>
        <IconButton
          icon="close"
          variant="plain"
          size={theme.touch.execution}
          accessibilityLabel={t('common:exit')}
          onPress={() => setExitOpen(true)}
          testID="execution-exit"
        />
        <View style={styles.titleBox}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {title}
          </Text>
          {elapsedMs !== undefined ? (
            <Text
              variant="caption"
              tone={paused ? 'primary' : 'muted'}
              style={styles.tabular}
              accessibilityLabel={t('elapsed', { time: formatMinSec(elapsedMs / 1000) })}
            >
              {paused ? t('paused') : formatMinSec(elapsedMs / 1000)}
            </Text>
          ) : null}
        </View>
        {onPauseToggle ? (
          <IconButton
            icon={paused ? 'play' : 'pause'}
            variant="plain"
            size={theme.touch.execution}
            accessibilityLabel={paused ? t('exit.resume') : t('pause')}
            onPress={onPauseToggle}
            testID="execution-pause"
          />
        ) : (
          <View style={{ width: theme.touch.execution }} />
        )}
      </View>

      {children}

      <BottomSheet visible={exitOpen} onClose={() => setExitOpen(false)} title={t('pauseTitle')}>
        <View style={styles.sheet}>
          <Button size="xl" label={t('exit.resume')} fullWidth onPress={() => setExitOpen(false)} />
          {onFinish ? (
            <Button
              size="lg"
              variant="secondary"
              label={t('exit.finish')}
              fullWidth
              onPress={act(onFinish)}
              testID="exit-finish"
            />
          ) : null}
          <Button
            size="lg"
            variant="secondary"
            label={t('exit.saveExit')}
            fullWidth
            onPress={act(leaveExecution)}
            testID="exit-save"
          />
          <Text variant="caption" tone="muted" align="center">
            {t('exit.saveExitHint')}
          </Text>
          {onDiscard ? (
            <Button
              size="lg"
              variant="danger"
              label={t('exit.discard')}
              fullWidth
              onPress={act(() => setConfirm(1))}
              testID="exit-discard"
            />
          ) : null}
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={confirm === 1}
        title={t('exit.discardTitle')}
        message={hasLogged ? t('exit.discardKeep') : t('exit.discardNothing')}
        confirmLabel={t('exit.discardConfirm')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setConfirm(0)}
        onConfirm={() => setConfirm(2)}
        testID="discard-confirm-1"
      />
      <ConfirmDialog
        visible={confirm === 2}
        title={t('exit.discardAgainTitle')}
        message={t('exit.discardAgain')}
        confirmLabel={t('exit.discardConfirm')}
        cancelLabel={t('common:cancel')}
        destructive
        loading={discarding}
        onCancel={() => setConfirm(0)}
        onConfirm={() => {
          if (!onDiscard) return;
          setDiscarding(true);
          onDiscard().finally(() => {
            setDiscarding(false);
            setConfirm(0);
          });
        }}
        testID="discard-confirm-2"
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  bar: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  titleBox: { flex: 1, alignItems: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  sheet: { gap: t.spacing.sm },
}));
