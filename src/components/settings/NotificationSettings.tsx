import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { TimeField } from '@/components/planner/Pickers';
import {
  Button,
  Card,
  Chip,
  Divider,
  Header,
  ScreenContainer,
  SectionHeader,
  Text,
  Toggle,
} from '@/components/ui';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { notificationsGranted, scheduleOs } from '@/services/notifications/native';
import { requestNotificationPermission } from '@/services/notifications/permissions';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { type SettingKey, type SettingValue } from '@/types/settings';
import { today } from '@/utils/dates';

const OFFSETS = [5, 10, 15, 30, 60];

/** Notification settings (step 25, UI §37): every category is user-controlled. */
export function NotificationSettings() {
  const { t, i18n } = useTranslation('settings');
  const styles = useStyles();
  const values = useSettingsStore((s) => s.values);
  const set = useSettingsStore((s) => s.set);
  const [granted, setGranted] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void notificationsGranted().then((g) => alive && setGranted(g));
      return () => {
        alive = false;
      };
    }, []),
  );
  const put = <K extends SettingKey>(key: K, value: SettingValue<K>) =>
    void set(key, value).catch(() => {});
  const on = values['notifications.enabled'];
  const weekday = (d: number) =>
    new Date(2026, 8, 20 + d).toLocaleDateString(i18n.language, { weekday: 'short' }); // 2026-09-20 is a Sunday

  const enable = async (value: boolean) => {
    if (!value) return put('notifications.enabled', false);
    const ok = await requestNotificationPermission();
    setGranted(ok);
    put('notifications.enabled', ok);
  };

  const row = (label: string, key: SettingKey, hint?: string, extra?: ReactNode) => (
    <View style={styles.block}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{label}</Text>
          {hint ? (
            <Text variant="caption" tone="muted">
              {hint}
            </Text>
          ) : null}
        </View>
        <Toggle
          value={values[key] as boolean}
          onChange={(v) => {
            put(key, v as never);
            if (key === 'notifications.photo' && v && !values['notifications.photoAnchor'])
              put('notifications.photoAnchor', today());
          }}
          disabled={!on}
          accessibilityLabel={label}
          testID={`notify-${key}`}
        />
      </View>
      {values[key] && on ? extra : null}
    </View>
  );
  const time = (
    key:
      | 'notifications.nudgeTime'
      | 'notifications.weightTime'
      | 'notifications.measurementTime'
      | 'notifications.photoTime'
      | 'notifications.quietStart'
      | 'notifications.quietEnd',
    label: string,
  ) => (
    <View style={styles.row}>
      <Text style={styles.flex}>{label}</Text>
      <TimeField value={values[key]} onChange={(v) => v && put(key, v)} />
    </View>
  );

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header
        title={t('items.notifications')}
        onBack={() => goBack(routes.settings)}
        large={false}
      />
      <Card style={styles.gap}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('notify.screen.master')}</Text>
            <Text variant="caption" tone="muted">
              {t('notify.screen.masterHint')}
            </Text>
          </View>
          <Toggle
            value={on}
            onChange={(v) => void enable(v)}
            accessibilityLabel={t('notify.screen.master')}
            testID="notify-master"
          />
        </View>
        {granted === false ? (
          <View style={styles.gap} testID="notify-denied">
            <Text tone="danger">{t('notify.screen.denied')}</Text>
            <Button
              size="sm"
              variant="secondary"
              label={t('notify.screen.openSettings')}
              onPress={() => void Linking.openSettings()}
            />
          </View>
        ) : null}
      </Card>

      <Card style={styles.gap}>
        {row(
          t('notify.screen.sessions'),
          'notifications.sessions',
          undefined,
          <View style={styles.chips}>
            <Text variant="caption" tone="muted">
              {t('notify.screen.offset')}
            </Text>
            {OFFSETS.map((m) => (
              <Chip
                key={m}
                label={`${m}`}
                selected={values['notifications.sessionOffset'] === m}
                onPress={() => put('notifications.sessionOffset', m)}
              />
            ))}
          </View>,
        )}
        <Divider />
        {row(t('notify.screen.running'), 'notifications.running')}
        <Divider />
        {row(
          t('notify.screen.nudge'),
          'notifications.nudge',
          t('notify.screen.nudgeHint'),
          time('notifications.nudgeTime', t('notify.screen.time')),
        )}
        <Divider />
        {row(t('notify.screen.missed'), 'notifications.missed')}
      </Card>

      <Card style={styles.gap}>
        {row(
          t('notify.screen.weight'),
          'notifications.weight',
          undefined,
          <>
            {time('notifications.weightTime', t('notify.screen.time'))}
            <View style={styles.chips}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const days = values['notifications.weightDays'];
                return (
                  <Chip
                    key={d}
                    label={weekday(d)}
                    selected={days.includes(d)}
                    onPress={() =>
                      put(
                        'notifications.weightDays',
                        days.includes(d) ? days.filter((x) => x !== d) : [...days, d],
                      )
                    }
                  />
                );
              })}
            </View>
          </>,
        )}
        <Divider />
        {row(
          t('notify.screen.measurement'),
          'notifications.measurement',
          undefined,
          <>
            {time('notifications.measurementTime', t('notify.screen.time'))}
            <View style={styles.chips}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <Chip
                  key={d}
                  label={weekday(d)}
                  selected={values['notifications.measurementDay'] === d}
                  onPress={() => put('notifications.measurementDay', d)}
                />
              ))}
            </View>
          </>,
        )}
        <Divider />
        {row(
          t('notify.screen.photo'),
          'notifications.photo',
          t('notify.screen.photoHint'),
          time('notifications.photoTime', t('notify.screen.time')),
        )}
        <Divider />
        {row(t('notify.screen.weekly'), 'notifications.weekly', t('notify.screen.weeklyHint'))}
      </Card>

      <SectionHeader title={t('notify.screen.quiet')} />
      <Card style={styles.gap}>
        <Text variant="caption" tone="muted">
          {t('notify.screen.quietHint')}
        </Text>
        {time('notifications.quietStart', t('notify.screen.from'))}
        {time('notifications.quietEnd', t('notify.screen.to'))}
      </Card>
      <Text variant="caption" tone="muted">
        {t('notify.screen.timers')}
      </Text>
      <Button
        size="md"
        variant="secondary"
        icon="bell"
        label={t('notify.screen.test')}
        disabled={!on || granted === false}
        onPress={() =>
          void scheduleOs({
            title: t('notify.texts.test'),
            body: t('notify.texts.testBody'),
            url: '/settings/notifications',
            channel: 'reminders',
            fireAt: Date.now() + 3000,
            targetId: null,
          })
            .then(() => toast.success(t('notify.screen.testSent')))
            .catch(() => toast.error(t('notify.screen.denied')))
        }
        testID="notify-test"
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  gap: { gap: t.spacing.sm },
  block: { gap: t.spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: 44 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs, alignItems: 'center' },
}));
