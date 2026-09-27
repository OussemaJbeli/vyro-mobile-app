import { router } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AvatarEditor } from '@/components/settings/AvatarEditor';
import { goBack } from '@/constants/navigation';
import { routes } from '@/constants/routes';
import { useUnsavedGuard } from '@/components/system/useUnsavedGuard';
import {
  Button,
  Card,
  Header,
  IconTile,
  Input,
  ListRow,
  ScreenContainer,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import { invalidates, useProfile, useRepoMutation, useUnitPrefs } from '@/hooks/data';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { profileFormSchema, type ProfileForm, type ProfileInput } from '@/types/forms';
import { fromCanonical, roundToStep, toCanonical } from '@/utils/units';

/** My information (step 12): name, unit-aware height, optional date of birth, week start. */
export default function ProfileScreen() {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const profile = useProfile();
  const units = useUnitPrefs();
  const inches = units.length === 'in';

  const { control, handleSubmit, reset, formState } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: '', height: '', dateOfBirth: '', weekStartsOn: 1 },
  });

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    reset({
      name: p.name ?? '',
      height:
        p.heightCm == null
          ? ''
          : String(inches ? roundToStep(fromCanonical(p.heightCm, 'in'), 0.25) : p.heightCm),
      dateOfBirth: p.dateOfBirth ?? '',
      weekStartsOn: p.weekStartsOn === 0 ? 0 : 1,
    });
  }, [profile.data, inches, reset]);

  const guard = useUnsavedGuard(formState.isDirty);
  const save = useRepoMutation((r, input: ProfileInput) => r.profile.upsert(input), {
    invalidate: invalidates.profile,
    onSuccess: () => {
      toast.success(t('saved'));
      guard.leave(() => goBack(routes.settings));
    },
  });

  const onSubmit = handleSubmit((v) => {
    const raw = v.height.trim() ? Number(v.height.replace(',', '.')) : null;
    const heightCm =
      raw === null ? null : Math.round((inches ? toCanonical(raw, 'in') : raw) * 10) / 10;
    if (heightCm !== null && (heightCm < 100 || heightCm > 250)) {
      toast.error(t('profile.invalidHeight'));
      return;
    }
    save.mutate({
      name: v.name.trim() || null,
      heightCm,
      dateOfBirth: v.dateOfBirth.trim() || null,
      weekStartsOn: v.weekStartsOn,
    });
  });

  const error = (key: keyof ProfileForm) => {
    const msg = formState.errors[key]?.message;
    return msg ? t(`profile.${msg}` as 'profile.invalidDate') : undefined;
  };

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title={t('profile.title')} onBack={() => goBack(routes.settings)} large={false} />
      <AvatarEditor name={profile.data?.name ?? null} />
      <Card>
        <ListRow
          title={t('ai.title')}
          subtitle={t('ai.provider')}
          leading={<IconTile icon="ai" size={36} />}
          onPress={() => router.push('/settings/ai')}
          testID="profile-ai"
        />
      </Card>
      {profile.isLoading ? (
        <Skeleton preset="card" />
      ) : (
        <Card style={styles.card}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input
                label={t('profile.name')}
                placeholder={t('profile.namePlaceholder')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                maxLength={60}
                testID="profile-name"
              />
            )}
          />
          <Controller
            control={control}
            name="height"
            render={({ field }) => (
              <Input
                label={`${t('profile.height')} (${units.length})`}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                numeric
                {...(error('height') ? { error: error('height')! } : {})}
                testID="profile-height"
              />
            )}
          />
          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field }) => (
              <Input
                label={t('profile.dob')}
                helper={t('profile.dobHint')}
                placeholder="1990-05-14"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                {...(error('dateOfBirth') ? { error: error('dateOfBirth')! } : {})}
                testID="profile-dob"
              />
            )}
          />
          <Text variant="caption" tone="muted">
            {t('profile.weekStart')}
          </Text>
          <Controller
            control={control}
            name="weekStartsOn"
            render={({ field }) => (
              <SegmentedControl
                segments={[
                  { value: '1', label: t('profile.monday') },
                  { value: '0', label: t('profile.sunday') },
                ]}
                value={String(field.value)}
                onChange={(v) => field.onChange(Number(v) as 0 | 1)}
              />
            )}
          />
        </Card>
      )}
      <Button
        label={t('save')}
        size="lg"
        fullWidth
        onPress={onSubmit}
        loading={save.isPending}
        disabled={!formState.isDirty}
        testID="profile-save"
      />
      {guard.dialog}
    </ScreenContainer>
  );
}

const useStyles = makeStyles((t) => ({ card: { gap: t.spacing.lg } }));
