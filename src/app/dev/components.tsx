import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  ChipGroup,
  ConfirmDialog,
  CoverArt,
  Divider,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  IconTile,
  Input,
  ListRow,
  NumberStepper,
  ProgressBar,
  ProgressRing,
  Radio,
  ScreenContainer,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  StatTile,
  StatusTag,
  StreakChip,
  Text,
  Toggle,
} from '@/components/ui';
import { toast } from '@/store/uiStore';
import {
  accentNames,
  accentPresets,
  makeStyles,
  useThemeControls,
  type SessionStatus,
} from '@/theme';

const STATUSES: SessionStatus[] = [
  'completed',
  'in_progress',
  'planned',
  'modified',
  'skipped',
  'cancelled',
  'missed',
];

type Filter = 'all' | 'gym' | 'running' | 'abs' | 'other';

/** Dev-only component gallery: the visual contract against template.png (roadmap step 04). */
export default function ComponentGallery() {
  const styles = useStyles();
  const { preference, setPreference, accent, setAccent } = useThemeControls();
  const [filter, setFilter] = useState<Filter>('all');
  const [days, setDays] = useState<string[]>(['mon', 'wed']);
  const [segment, setSegment] = useState<'overview' | 'body' | 'photos' | 'history'>('overview');
  const [weight, setWeight] = useState(60);
  const [reps, setReps] = useState(10);
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState<'a' | 'b'>('a');
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);

  return (
    <ScreenContainer>
      <Header title="Components" subtitle="Dev gallery · step 04" />

      <Group title="Theme">
        <SegmentedControl
          segments={[
            { value: 'system', label: 'System' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
          value={preference}
          onChange={setPreference}
        />
        <View style={styles.row}>
          {accentNames.map((a) => (
            <Button
              key={a}
              size="sm"
              label={a}
              variant={a === accent ? 'primary' : 'ghost'}
              onPress={() => setAccent(a)}
              accessibilityLabel={`Use ${a} accent (${accentPresets[a]})`}
            />
          ))}
        </View>
      </Group>

      <Group title="Buttons">
        <Button label="Start Workout" icon="play" size="lg" fullWidth />
        <View style={styles.row}>
          <Button label="Secondary" variant="secondary" />
          <Button label="Ghost" variant="ghost" />
          <Button label="Delete" variant="danger" icon="delete" />
        </View>
        <View style={styles.row}>
          <Button label="Loading" loading />
          <Button label="Disabled" disabled />
          <Button label="Small" size="sm" />
        </View>
        <View style={styles.row}>
          <IconButton icon="search" accessibilityLabel="Search" />
          <IconButton icon="add" accessibilityLabel="Add" variant="filled" />
          <IconButton icon="more" accessibilityLabel="More" variant="plain" />
          <Avatar name="Alex Martin" onPress={() => {}} />
          <Avatar />
        </View>
      </Group>

      <Group title="Status & tags">
        <View style={styles.row}>
          {STATUSES.map((s) => (
            <StatusTag key={s} status={s} />
          ))}
        </View>
        <StreakChip days={7} />
      </Group>

      <Group title="Filters">
        <ChipGroup<Filter>
          scrollable
          options={[
            { value: 'all', label: 'All' },
            { value: 'gym', label: 'Gym' },
            { value: 'running', label: 'Running' },
            { value: 'abs', label: 'Six Pack' },
            { value: 'other', label: 'Other' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <ChipGroup
          multiple
          options={['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => ({
            value: d,
            label: d.toUpperCase(),
          }))}
          value={days}
          onChange={setDays}
        />
        <SegmentedControl
          segments={[
            { value: 'overview', label: 'Overview' },
            { value: 'body', label: 'Body' },
            { value: 'photos', label: 'Photos' },
            { value: 'history', label: 'History' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </Group>

      <Group title="Cards & rows">
        <Card variant="accent">
          <Text variant="heading">Today</Text>
          <Text tone="muted">3 activities</Text>
          <ListRow
            title="Running"
            subtitle="30 min · Intervals"
            leading={<IconTile icon="running" size={40} tone="accent" />}
            trailing={<StatusTag status="completed" />}
          />
          <ListRow
            title="Gym"
            subtitle="Upper Body · 55 min"
            leading={<IconTile icon="gym" size={40} tone="accent" />}
            trailing={<StatusTag status="in_progress" />}
          />
          <ProgressBar value={1 / 3} label="1 / 3 completed" showPercent />
        </Card>
        <Card>
          <ListRow
            title="Upper Body"
            subtitle="Gym · 55 min · 6 exercises"
            leading={<CoverArt type="gym" />}
            onPress={() => {}}
          />
          <Divider />
          <ListRow
            title="30min Run"
            subtitle="Running · 30 min · Intervals"
            leading={<CoverArt type="running" />}
            onPress={() => {}}
          />
        </Card>
      </Group>

      <Group title="Quick actions & stats">
        <View style={styles.spread}>
          <IconTile icon="add" label="Workout" onPress={() => {}} />
          <IconTile icon="running" label="Running" onPress={() => {}} />
          <IconTile icon="weight" label="Weight" onPress={() => {}} />
          <IconTile icon="measure" label="Measure" onPress={() => {}} />
          <IconTile icon="photo" label="Photo" onPress={() => {}} />
        </View>
        <View style={styles.row}>
          <StatTile value="4" label="Gym" />
          <StatTile value="2" label="Runs" />
          <StatTile value="3" label="Abs" />
          <StatTile value="4h 18m" label="Training" />
        </View>
      </Group>

      <Group title="Inputs">
        <Input label="Workout name" placeholder="Enter text…" rightIcon="edit" />
        <Input label="Weight" numeric error="Enter a value between 25 and 300 kg." />
        <NumberStepper
          label="Weight"
          value={weight}
          onChange={setWeight}
          step={2.5}
          min={0}
          unit="kg"
          size="xl"
        />
        <NumberStepper label="Reps" value={reps} onChange={setReps} min={0} max={100} />
        <View style={styles.row}>
          <Toggle value={on} onChange={setOn} accessibilityLabel="Rest timer" />
          <Checkbox label="Monday" checked={checked} onChange={setChecked} />
        </View>
        <Radio label="Weekly" selected={radio === 'a'} onSelect={() => setRadio('a')} />
        <Radio label="Monthly" selected={radio === 'b'} onSelect={() => setRadio('b')} />
      </Group>

      <Group title="Progress">
        <View style={styles.row}>
          <ProgressRing value={0.66} accessibilityLabel="Rest 66 percent">
            <Text variant="heading">01:32</Text>
          </ProgressRing>
          <ProgressRing value={0.25} size={72} stroke={8} />
        </View>
      </Group>

      <Group title="Overlays">
        <View style={styles.row}>
          <Button label="Bottom sheet" variant="secondary" onPress={() => setSheet(true)} />
          <Button label="Dialog" variant="secondary" onPress={() => setDialog(true)} />
          <Button
            label="Toast"
            variant="secondary"
            onPress={() => toast.success('Workout saved.')}
          />
          <Button
            label="Error toast"
            variant="ghost"
            onPress={() => toast.error("We couldn't save this workout.")}
          />
        </View>
      </Group>

      <Group title="States">
        <Card>
          <EmptyState
            icon="train"
            title="No workouts yet"
            body="Create your first workout plan and start tracking your progress."
            actionLabel="Create Workout"
            onAction={() => {}}
          />
        </Card>
        <Card>
          <ErrorState
            title="We couldn't load your history."
            body="Your data is safe. Try again."
            retryLabel="Retry"
            onRetry={() => {}}
          />
        </Card>
        <Skeleton preset="row" />
        <Skeleton preset="card" />
      </Group>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Quick add">
        <ListRow
          title="Log weight"
          leading={<IconTile icon="weight" size={40} />}
          onPress={() => setSheet(false)}
        />
        <ListRow
          title="Take photo"
          leading={<IconTile icon="photo" size={40} />}
          onPress={() => setSheet(false)}
        />
      </BottomSheet>
      <ConfirmDialog
        visible={dialog}
        title="Replace local data?"
        message="This will add/replace local data."
        confirmLabel="Continue"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => setDialog(false)}
        onCancel={() => setDialog(false)}
      />
    </ScreenContainer>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  group: { gap: t.spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, alignItems: 'center' },
  spread: { flexDirection: 'row', justifyContent: 'space-between' },
}));
