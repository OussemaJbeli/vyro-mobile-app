import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BottomSheet,
  Button,
  Card,
  ChipGroup,
  ConfirmDialog,
  CoverArt,
  Divider,
  EmptyState,
  Header,
  IconButton,
  IconTile,
  Input,
  ListRow,
  OptionCard,
  SectionHeader,
  Skeleton,
  Text,
  type IconName,
} from '@/components/ui';
import { useStartWorkout } from '@/components/execution/useStartWorkout';
import { coverType, templateSubtitle, useTemplateLabel } from '@/components/workout/templateInfo';
import { routes } from '@/constants/routes';
import { invalidates, useRepoMutation, useTemplates, useTemplateSummaries } from '@/hooks/data';
import { matchesQuery, useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { toast } from '@/store/uiStore';
import { makeStyles, useTheme } from '@/theme';
import { type WorkoutTemplate } from '@/types/domain';
import { type TemplateType } from '@/types/enums';

type Filter = 'all' | 'gym' | 'running' | 'abs' | 'other';
const FILTER_TYPES: Record<Filter, TemplateType[] | null> = {
  all: null,
  gym: ['gym'],
  running: ['running'],
  abs: ['abs', 'home'],
  other: ['recovery', 'other'],
};
const CREATE_TYPES: { type: TemplateType; icon: IconName }[] = [
  { type: 'gym', icon: 'gym' },
  { type: 'home', icon: 'home_workout' },
  { type: 'abs', icon: 'abs' },
  { type: 'running', icon: 'running' },
  { type: 'recovery', icon: 'recovery' },
  { type: 'other', icon: 'other' },
];

const openTemplate = (tpl: WorkoutTemplate) =>
  router.push(tpl.type === 'running' ? routes.running(tpl.id) : routes.workout(tpl.id));

export const createWorkout = (type: TemplateType) =>
  router.push(
    type === 'running' ? routes.runningNew : { pathname: '/workout/new', params: { type } },
  );

/** Train (UI §13, template screen 2): what workouts and exercises can I do? */
export default function TrainScreen() {
  const { t } = useTranslation(['train', 'common']);
  const { t: tTrain } = useTranslation('train');
  const templateLabel = useTemplateLabel();
  const theme = useTheme();
  const styles = useStyles();
  const templates = useTemplates();
  const archivedList = useTemplates({ includeArchived: true });
  const summaries = useTemplateSummaries().data;
  const catalog = useExerciseCatalog();
  const starter = useStartWorkout();
  const [filter, setFilter] = useState<Filter>('all');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuFor, setMenuFor] = useState<WorkoutTemplate | null>(null);
  const [deleting, setDeleting] = useState<WorkoutTemplate | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const duplicate = useRepoMutation((r, id: string) => r.templates.duplicate(id), {
    invalidate: invalidates.templates,
    successMessage: t('toast.duplicated'),
  });
  const archive = useRepoMutation(
    (r, v: { id: string; archived: boolean }) =>
      v.archived ? r.templates.archive(v.id) : r.templates.unarchive(v.id),
    {
      invalidate: invalidates.templates,
      onSuccess: (_, v) => toast.success(v.archived ? t('toast.archived') : t('toast.restored')),
    },
  );
  const remove = useRepoMutation((r, id: string) => r.templates.remove(id), {
    invalidate: invalidates.templates,
    onSuccess: (result) =>
      toast.info(result === 'archived' ? t('toast.archivedInstead') : t('toast.deleted')),
  });

  const list = useMemo(() => {
    const types = FILTER_TYPES[filter];
    return (templates.data ?? [])
      .map((tpl) => ({ tpl, label: templateLabel(tpl) }))
      .filter(
        ({ tpl, label }) =>
          (!types || types.includes(tpl.type)) && matchesQuery({ label, name: tpl.name }, query),
      );
  }, [templates.data, filter, query, templateLabel]);

  const archived = (archivedList.data ?? []).filter((x) => x.archivedAt);
  const exerciseIds = (id: string) => summaries?.exercises[id] ?? [];
  const unavailableCount = (id: string) =>
    exerciseIds(id).filter((eid) => catalog.byId.get(eid) && !catalog.byId.get(eid)!.available)
      .length;

  const menuAction = (
    action: 'start' | 'schedule' | 'duplicate' | 'edit' | 'archive' | 'delete',
  ) => {
    const tpl = menuFor;
    setMenuFor(null);
    if (!tpl) return;
    if (action === 'start') void starter.start({ templateId: tpl.id });
    if (action === 'schedule')
      router.push({ pathname: '/session/new', params: { templateId: tpl.id } });
    if (action === 'duplicate') duplicate.mutate(tpl.id);
    if (action === 'edit')
      router.push(
        tpl.type === 'running'
          ? { pathname: '/running/[id]/edit', params: { id: tpl.id } }
          : routes.workoutEdit(tpl.id),
      );
    if (action === 'archive') archive.mutate({ id: tpl.id, archived: true });
    if (action === 'delete') setDeleting(tpl);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Header
          title={t('title')}
          right={
            <IconButton
              icon={searching ? 'close' : 'search'}
              variant="plain"
              accessibilityLabel={t('search')}
              onPress={() => {
                setSearching((v) => !v);
                setQuery('');
              }}
            />
          }
        />
        {searching ? (
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={t('search')}
            leftIcon="search"
            autoFocus
            testID="train-search"
          />
        ) : null}
        <ChipGroup<Filter>
          scrollable
          options={(['all', 'gym', 'running', 'abs', 'other'] as const).map((f) => ({
            value: f,
            label: t(`filters.${f}`),
          }))}
          value={filter}
          onChange={setFilter}
          testID="train-filters"
        />

        <SectionHeader title={t('myWorkouts')} />
        {templates.isLoading ? (
          <Skeleton preset="card" />
        ) : list.length === 0 ? (
          <Card>
            <EmptyState
              icon="train"
              title={templates.data?.length ? t('empty.filterTitle') : t('empty.title')}
              body={templates.data?.length ? t('empty.filterBody') : t('empty.body')}
              actionLabel={t('empty.action')}
              onAction={() => setCreating(true)}
            />
          </Card>
        ) : (
          // Template: each workout is its own bordered card.
          <View style={styles.list}>
            {list.map(({ tpl, label }) => {
              const missing = unavailableCount(tpl.id);
              return (
                <View key={tpl.id} style={styles.rowCard}>
                  <ListRow
                    title={label}
                    subtitle={templateSubtitle(tpl, exerciseIds(tpl.id).length, tTrain)}
                    leading={
                      <CoverArt type={coverType(tpl.type)} coverKey={tpl.coverKey} size={48} />
                    }
                    trailing={
                      missing > 0 ? (
                        <View
                          style={styles.warn}
                          accessible
                          accessibilityLabel={t('unavailable', { count: missing })}
                        >
                          <Text variant="caption" style={{ color: theme.colors.warning }}>
                            ⚠ {missing}
                          </Text>
                        </View>
                      ) : undefined
                    }
                    onPress={() => openTemplate(tpl)}
                    onLongPress={() => setMenuFor(tpl)}
                    testID={`template-${tpl.id}`}
                  />
                </View>
              );
            })}
          </View>
        )}

        <SectionHeader title={t('library')} />
        <Card>
          <ListRow
            title={t('exerciseLibrary')}
            leading={<IconTile icon="train" size={36} />}
            onPress={() => router.push(routes.exercises)}
            testID="open-library"
          />
          <Divider />
          <ListRow
            title={t('equipment')}
            subtitle={t('equipmentHint')}
            leading={<IconTile icon="act_dumbbell" size={36} />}
            onPress={() => router.push(routes.equipment)}
          />
          <Divider />
          <ListRow
            title={t('archived')}
            {...(archived.length ? { subtitle: String(archived.length) } : {})}
            leading={<IconTile icon="duplicate" size={36} />}
            onPress={() => setShowArchived(true)}
          />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={t('create')}
          icon="add"
          size="lg"
          fullWidth
          onPress={() => setCreating(true)}
          testID="train-create"
        />
      </View>

      <BottomSheet visible={creating} onClose={() => setCreating(false)} title={t('chooseType')}>
        <View style={styles.sheet}>
          {CREATE_TYPES.map((c) => (
            <OptionCard
              key={c.type}
              icon={c.icon}
              title={t(`types.${c.type}`)}
              description={t(`typeDescriptions.${c.type}`)}
              selected={false}
              onPress={() => {
                setCreating(false);
                createWorkout(c.type);
              }}
              testID={`create-${c.type}`}
            />
          ))}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? templateLabel(menuFor) : ''}
      >
        <View style={styles.sheet}>
          {(['start', 'schedule', 'duplicate', 'edit', 'archive', 'delete'] as const).map((a) => (
            <ListRow
              key={a}
              title={t(`menu.${a}`)}
              onPress={() => menuAction(a)}
              showChevron={false}
            />
          ))}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={showArchived}
        onClose={() => setShowArchived(false)}
        title={t('archivedTitle')}
      >
        <View style={styles.sheet}>
          {archived.length === 0 ? <Text tone="muted">{t('archivedEmpty')}</Text> : null}
          {archived.map((tpl) => (
            <ListRow
              key={tpl.id}
              title={templateLabel(tpl)}
              leading={<CoverArt type={coverType(tpl.type)} coverKey={tpl.coverKey} size={40} />}
              trailing={
                <Button
                  label={t('menu.restore')}
                  size="sm"
                  variant="secondary"
                  onPress={() => archive.mutate({ id: tpl.id, archived: false })}
                />
              }
            />
          ))}
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={deleting !== null}
        title={t('confirmDelete.title')}
        message={t('confirmDelete.body')}
        confirmLabel={t('menu.delete')}
        cancelLabel={t('common:cancel')}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
          setDeleting(null);
        }}
      />
      {starter.element}
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  list: { gap: t.spacing.sm },
  rowCard: {
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    paddingHorizontal: t.spacing.md,
  },
  screen: { flex: 1, backgroundColor: t.colors.bg },
  content: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xxl, gap: t.spacing.md },
  footer: {
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.md,
    paddingTop: t.spacing.sm,
  },
  warn: { flexDirection: 'row', alignItems: 'center' },
  sheet: { gap: t.spacing.sm, paddingBottom: t.spacing.md },
}));
