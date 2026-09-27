import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Avatar,
  Card,
  ConfirmDialog,
  Divider,
  Header,
  IconTile,
  ListRow,
  ScreenContainer,
  SectionHeader,
  type IconName,
} from '@/components/ui';
import { useAvatar } from '@/hooks/useAvatar';
import { goBack } from '@/constants/navigation';
import { featureFlags } from '@/constants/featureFlags';
import { routes } from '@/constants/routes';
import { useLatestWeights, useProfile } from '@/hooks/data';
import { exportDiagnostics } from '@/services/diagnostics';
import { useOnboardingStore } from '@/store/onboardingStore';
import { makeStyles } from '@/theme';

type ItemKey =
  | 'myInformation'
  | 'goals'
  | 'body'
  | 'equipment'
  | 'training'
  | 'notifications'
  | 'appearance'
  | 'language'
  | 'units'
  | 'privacy'
  | 'appLock'
  | 'backup'
  | 'aiProvider'
  | 'redoSetup'
  | 'diagnostics'
  | 'activities'
  | 'developer'
  | 'about';
type Item = { key: ItemKey; icon: IconName; href?: Href; action?: 'redo' | 'diagnostics' };
type SectionKey = 'profile' | 'app' | 'ai' | 'about';

const SECTIONS: { key: SectionKey; items: Item[]; hidden?: boolean }[] = [
  {
    key: 'profile',
    items: [
      { key: 'myInformation', icon: 'profile', href: '/settings/profile' },
      { key: 'goals', icon: 'trophy', href: routes.goals },
      { key: 'body', icon: 'body', href: routes.measurements },
      { key: 'equipment', icon: 'train', href: routes.equipment },
      { key: 'training', icon: 'timer', href: '/settings/training' },
    ],
  },
  {
    key: 'app',
    items: [
      { key: 'notifications', icon: 'bell', href: '/settings/notifications' },
      { key: 'appearance', icon: 'settings', href: '/settings/appearance' },
      { key: 'activities', icon: 'act_fire', href: '/settings/activities' },
      { key: 'language', icon: 'settings', href: '/settings/language' },
      { key: 'units', icon: 'measure', href: '/settings/units' },
      { key: 'privacy', icon: 'lock', href: '/settings/privacy' },
      { key: 'appLock', icon: 'lock', href: '/settings/app-lock' },
      { key: 'backup', icon: 'duplicate', href: '/settings/backup' },
    ],
  },
  {
    key: 'ai',
    hidden: !featureFlags.ai,
    items: [{ key: 'aiProvider', icon: 'ai', href: '/settings/ai' }],
  },
  {
    key: 'about',
    items: [
      { key: 'about', icon: 'info', href: '/settings/about' },
      { key: 'redoSetup', icon: 'repeat', action: 'redo' },
      { key: 'diagnostics', icon: 'error', action: 'diagnostics' },
      // Dev tools moved off Home (dev builds only).
      ...(__DEV__
        ? [{ key: 'developer' as const, icon: 'settings' as const, href: '/dev' as Href }]
        : []),
    ],
  },
];

/** Settings hub, pushed from the Home avatar (UI §31). */
export default function SettingsScreen() {
  const styles = useStyles();
  const { t } = useTranslation(['settings', 'common']);
  const profile = useProfile().data;
  const avatar = useAvatar();
  const latest = useLatestWeights(1).data?.[0];
  const [confirmRedo, setConfirmRedo] = useState(false);

  const redo = () => {
    setConfirmRedo(false);
    const draft = useOnboardingStore.getState().begin({
      mode: 'redo',
      name: profile?.name ?? null,
      heightCm: profile?.heightCm ?? null,
      weightKg: latest?.valueKg ?? null,
      acceptPlan: false,
      ...(profile
        ? {
            units: {
              weight: profile.weightUnit,
              length: profile.lengthUnit,
              distance: profile.distanceUnit,
              speed: profile.speedUnit,
            },
          }
        : {}),
    });
    router.push(routes.setupStep(draft.step));
  };

  const onItem = (item: Item) => {
    if (item.href) router.push(item.href);
    else if (item.action === 'redo') setConfirmRedo(true);
    else if (item.action === 'diagnostics') exportDiagnostics().catch(() => {});
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('title')} onBack={() => goBack(routes.home)} />
      <Card variant="accent">
        <ListRow
          title={profile?.name || t('guest')}
          subtitle={t('editProfile')}
          leading={
            <Avatar
              name={profile?.name ?? null}
              uri={avatar.uri}
              fallbackSource={avatar.fallback}
              size={48}
            />
          }
          onPress={() => router.push('/settings/profile')}
        />
      </Card>
      {SECTIONS.filter((s) => !s.hidden).map((section) => (
        <View key={section.key} style={styles.section}>
          <SectionHeader title={t(`sections.${section.key}`)} />
          <Card>
            {section.items.map((item, i) => (
              <View key={item.key}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={t(`items.${item.key}`)}
                  leading={<IconTile icon={item.icon} size={36} />}
                  onPress={() => onItem(item)}
                />
              </View>
            ))}
          </Card>
        </View>
      ))}
      <ConfirmDialog
        visible={confirmRedo}
        title={t('redo.title')}
        message={t('redo.body')}
        confirmLabel={t('redo.confirm')}
        cancelLabel={t('common:cancel')}
        onConfirm={redo}
        onCancel={() => setConfirmRedo(false)}
      />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({ section: { gap: t.spacing.sm } }));
