import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  ContinueBanner,
  QuickActions,
  SmallInsight,
  TodayStatusCard,
  Upcoming,
  WeeklySummary,
} from '@/components/home/HomeCards';
import { SearchSheet } from '@/components/home/SearchSheet';
import { Avatar, IconButton, MountainBackdrop, ScreenContainer, Text } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useProfile } from '@/hooks/data';
import { WeeklyInsightCard } from '@/components/ai/WeeklyInsightCard';
import { useAvatar } from '@/hooks/useAvatar';
import { currentLanguage } from '@/i18n';
import { makeStyles } from '@/theme';
import { withAlpha } from '@/theme/color';
import { now } from '@/utils/clock';
import { greetingKey } from '@/utils/dates';

/** Home: the daily command center (step 21, UI §2–§9). Strict priority order (UI §40). */
export default function HomeScreen() {
  const styles = useStyles();
  const { t } = useTranslation(['home', 'common']);
  const client = useQueryClient();
  const profile = useProfile();
  const avatar = useAvatar();
  const [search, setSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const greeting = t(`greeting.${greetingKey()}`);
  const name = profile.data?.name?.trim();
  const date = now().toLocaleDateString(currentLanguage(), {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  const refresh = () => {
    setRefreshing(true);
    client.invalidateQueries().finally(() => setRefreshing(false));
  };

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      <View style={styles.header}>
        <MountainBackdrop variant="header" />
        <View style={styles.greetingPanel}>
          <Text tone="muted">{greeting} 👋</Text>
          {name ? (
            <Text accessibilityRole="header" style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted">
            {date}
          </Text>
        </View>
        <View style={styles.flex} />
        <IconButton
          icon="search"
          accessibilityLabel={t('common:search')}
          variant="plain"
          onPress={() => setSearch(true)}
          testID="home-search"
        />
        <Avatar
          uri={avatar.uri}
          fallbackSource={avatar.fallback}
          onPress={() => router.push(routes.settings)}
        />
      </View>

      <TodayStatusCard />
      <ContinueBanner />
      <QuickActions />
      <WeeklySummary />
      <Upcoming />
      <WeeklyInsightCard />
      <SmallInsight />

      <SearchSheet visible={search} onClose={() => setSearch(false)} />
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    flexDirection: 'row',
    gap: t.spacing.sm,
    // Bleed to the screen edges so the mountains sit behind the greeting (template).
    marginHorizontal: -t.spacing.lg,
    marginTop: -t.spacing.lg,
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.xxxl + t.spacing.lg,
    // A tall mountain band under the greeting before the Today card (1.1.0: longer hero).
    paddingBottom: 150,
    marginBottom: -40,
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  // Soft translucent panel so the greeting reads over the mountains.
  greetingPanel: {
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 1,
    gap: 2,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radius.lg,
    backgroundColor: withAlpha(t.colors.bg, 0.45),
  },
  name: {
    fontFamily: t.typography.title.fontFamily,
    fontSize: 30,
    lineHeight: 36,
    color: t.colors.text,
  },
  dev: { gap: t.spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
}));
