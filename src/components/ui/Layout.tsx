import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
  /** Pull-to-refresh (scroll mode only). */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Horizontal padding; set false for edge-to-edge lists. */
  padded?: boolean;
  /** Tab screens leave the bottom edge to the tab bar. */
  edges?: ('top' | 'bottom')[];
  contentStyle?: StyleProp<ViewStyle>;
  /** Decorative layer drawn behind the content (edge to edge). */
  background?: ReactNode;
  testID?: string;
};

/** Safe areas, optional scroll, keyboard avoidance and pull-to-refresh for every screen. */
export function ScreenContainer({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  padded = true,
  edges = ['top'],
  contentStyle,
  background,
  testID,
}: ScreenContainerProps) {
  const t = useTheme();
  const styles = useStyles();
  const inner = [padded && styles.padded, contentStyle];
  return (
    <SafeAreaView style={styles.screen} edges={edges} {...(testID ? { testID } : {})}>
      {background}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, inner]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={t.colors.primary}
                  colors={[t.colors.primary]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, inner]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export type HeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  /** Large title (tab roots) vs compact (pushed screens). */
  large?: boolean;
};

export function Header({ title, subtitle, onBack, right, large = true }: HeaderProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton icon="back" accessibilityLabel={t('back')} variant="plain" onPress={onBack} />
      ) : null}
      <View style={styles.flex}>
        <Text variant={large ? 'title' : 'heading'} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

export type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Accent icon before the title (template: ⚡ Quick Actions, 📊 This Week). */
  icon?: IconName;
};

/** "Quick Actions", "This Week", "Upcoming" … with an optional "See all". */
export function SectionHeader({ title, actionLabel, onAction, icon }: SectionHeaderProps) {
  const styles = useStyles();
  const t = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        {icon ? <Icon name={icon} size={24} color={t.colors.primary} /> : null}
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={12}
          style={styles.sectionAction}
        >
          <Text variant="caption" tone="primary">
            {actionLabel}
          </Text>
          <Icon name="forward" size={16} color={t.colors.primaryInk} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider() {
  const styles = useStyles();
  return <View style={styles.divider} />;
}

export function Spacer({
  size = 'lg',
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';
}) {
  const t = useTheme();
  return <View style={{ height: t.spacing[size] }} />;
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  flex: { flex: 1 },
  padded: { paddingHorizontal: t.spacing.lg },
  scrollContent: { paddingBottom: 120, gap: t.spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 56,
    paddingTop: t.spacing.sm,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: t.spacing.sm,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  divider: { height: 1, backgroundColor: t.colors.border },
}));
