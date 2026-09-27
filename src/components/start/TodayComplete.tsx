import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { activityType } from '@/components/planner/activity';
import {
  ActivityIcon,
  Button,
  Card,
  Divider,
  IconTile,
  ListRow,
  ScreenContainer,
  Text,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { formatMinSec } from '@/domain/running/intervals';
import { useHistory } from '@/hooks/data';
import { makeStyles } from '@/theme';
import { fromDate } from '@/utils/dates';

import { useStartState } from './useStartState';

const hm = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

/** "Today complete" (UI §49): subtle, brief, motivating (FS §45). */
export function TodayComplete() {
  const { t } = useTranslation('execution');
  const styles = useStyles();
  const { day, state } = useStartState();
  const history = useHistory();
  const done = (history.data?.pages[0]?.items ?? []).filter(
    (x) => x.status === 'completed' && fromDate(new Date(x.startedAt)) === day,
  );
  const total = done.reduce((s, x) => s + (x.activeSeconds ?? 0), 0);
  const latest = done[0];

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.duration(350)}>
          <IconTile icon="trophy" tone="accent" size={88} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.center}>
          <Text variant="overline" tone="primary">
            {t('today.complete.title')} 🎉
          </Text>
          <Text variant="display" testID="today-complete-count">
            {t('today.complete.activities', { done: state.done, total: state.activities.length })}
          </Text>
          <Text tone="muted">{t('today.complete.total', { time: hm(total) })}</Text>
        </Animated.View>
      </View>
      <Card>
        {done.map((x, i) => (
          <View key={x.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={x.title}
              leading={<ActivityIcon type={activityType(x.type)} size={40} />}
              trailing={<Text variant="bodyStrong">{formatMinSec(x.activeSeconds ?? 0)}</Text>}
              onPress={() => router.push(routes.historyDetail(x.id))}
              showChevron={false}
            />
          </View>
        ))}
      </Card>
      <View style={styles.actions}>
        {latest ? (
          <Button
            size="lg"
            variant="secondary"
            label={t('today.complete.viewSummary')}
            fullWidth
            onPress={() => router.push(routes.executeComplete(latest.id))}
          />
        ) : null}
        <Button
          size="xl"
          label={t('today.complete.done')}
          fullWidth
          onPress={() => router.replace(routes.home)}
          testID="today-complete-done"
        />
      </View>
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({
  hero: { alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.xl },
  center: { alignItems: 'center', gap: t.spacing.xs },
  actions: { gap: t.spacing.sm, marginTop: t.spacing.md },
}));
