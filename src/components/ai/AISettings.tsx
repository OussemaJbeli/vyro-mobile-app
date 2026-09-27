import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import {
  Button,
  Card,
  ChipGroup,
  ConfirmDialog,
  Input,
  SectionHeader,
  Text,
  Toggle,
} from '@/components/ui';
import { useAI } from '@/hooks/useAI';
import {
  PROVIDERS,
  deleteKey,
  getKey,
  humanError,
  maskKey,
  providerMeta,
  setKey,
  type ProviderId,
} from '@/services/ai';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from '@/store/uiStore';
import { makeStyles } from '@/theme';
import { logger } from '@/utils/logger';

import { CoachEntry } from './CoachEntry';
import { InsightCard } from './InsightCard';
import { useAIRequest } from './useAIRequest';

type Provider = Exclude<ProviderId, 'mock'>;

/**
 * Settings → AI assistant (UI §34): master switch, provider, API key (SecureStore, masked),
 * model, test connection, preferences, and a first "Summarise my week" to try it.
 */
export function AISettings() {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const ai = useAI();
  const values = useSettingsStore((s) => s.values);
  const set = useSettingsStore((s) => s.set);
  const provider = values['ai.provider'];
  const meta = providerMeta(provider)!;
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const request = useAIRequest();

  // Only the last 4 characters of the saved key ever reach the UI.
  useEffect(() => {
    let alive = true;
    getKey(provider)
      .then((k) => alive && setSaved(k ? maskKey(k) : null))
      .catch((error: unknown) => logger.warn('AI key read failed', { error }));
    return () => {
      alive = false;
    };
  }, [provider]);

  const saveKey = async () => {
    const key = draft.trim();
    if (!key) return;
    await setKey(provider, key);
    setSaved(maskKey(key));
    setDraft('');
    setEditing(false);
    toast.success(t('ai.keyStored'));
  };

  const test = async () => {
    setTesting(true);
    const r = await ai.testConnection();
    setTesting(false);
    if (r.ok) toast.success(t('ai.testOk', { provider: meta.label }));
    else toast.error(humanError(r.error));
  };

  const busy = request.state.status === 'preparing' || request.state.status === 'sending';

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text variant="bodyStrong" style={styles.flex}>
            {t('ai.enable')}
          </Text>
          <Toggle
            value={values['ai.enabled']}
            onChange={(v) => void set('ai.enabled', v)}
            accessibilityLabel={t('ai.enable')}
            testID="ai-enabled"
          />
        </View>
        <Text variant="caption" tone="muted">
          {t('ai.enableHint')}
        </Text>
      </Card>

      <CoachEntry label={t('ai.coach.title')} variant="row" testID="settings-open-coach" />

      <SectionHeader title={t('ai.provider')} />
      <Card style={styles.card}>
        <ChipGroup
          options={PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
          value={provider}
          onChange={(v: Provider) => {
            setEditing(false);
            setDraft('');
            void set('ai.provider', v);
          }}
        />
        <Text variant="caption" tone="muted">
          {meta.keyHelp}
        </Text>

        <Text variant="caption" tone="muted">
          {t('ai.key')}
        </Text>
        {saved && !editing ? (
          <View style={styles.row}>
            <Text variant="bodyStrong" style={styles.flex} testID="ai-key-saved">
              {t('ai.keySaved', { masked: saved })}
            </Text>
            <Button
              size="sm"
              variant="secondary"
              label={t('ai.replaceKey')}
              onPress={() => setEditing(true)}
            />
            <Button
              size="sm"
              variant="ghost"
              label={t('ai.deleteKey')}
              onPress={() =>
                void deleteKey(provider).then(() => {
                  setSaved(null);
                  toast.success(t('ai.keyDeleted'));
                })
              }
              testID="ai-key-delete"
            />
          </View>
        ) : (
          <View style={styles.gap}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder={t('ai.keyPlaceholder')}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              testID="ai-key-input"
            />
            <Button
              label={t('ai.saveKey')}
              disabled={!draft.trim()}
              onPress={() => void saveKey()}
              testID="ai-key-save"
            />
          </View>
        )}
        <Text variant="caption" tone="muted">
          {Platform.OS === 'web' ? t('ai.webKeyNote') : t('ai.keyNote')}
        </Text>

        <Input
          label={t('ai.model')}
          value={values['ai.models'][provider] ?? ''}
          onChangeText={(v) =>
            void set('ai.models', { ...values['ai.models'], [provider]: v.trim() })
          }
          placeholder={meta.defaultModel}
          helper={t('ai.modelHint', { model: meta.defaultModel })}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button
          label={testing ? t('ai.testing') : t('ai.test')}
          variant="secondary"
          loading={testing}
          disabled={!saved || !values['ai.enabled']}
          onPress={() => void test()}
          testID="ai-test"
        />
      </Card>

      <SectionHeader title={t('ai.prefs')} />
      <Card style={styles.card}>
        <Text variant="caption" tone="muted">
          {t('ai.tone')}
        </Text>
        <ChipGroup
          options={[
            { value: 'concise', label: t('ai.toneConcise') },
            { value: 'detailed', label: t('ai.toneDetailed') },
          ]}
          value={values['ai.tone']}
          onChange={(v: 'concise' | 'detailed') => void set('ai.tone', v)}
        />
        <View style={styles.row}>
          <Text style={styles.flex}>{t('ai.includeNotes')}</Text>
          <Toggle
            value={values['ai.includeNotes']}
            onChange={(v) => void set('ai.includeNotes', v)}
            accessibilityLabel={t('ai.includeNotes')}
          />
        </View>
        <Text variant="caption" tone="muted">
          {t('ai.includeNotesHint')}
        </Text>
        <Text variant="caption" tone="muted">
          {t('ai.privacy')}
        </Text>
        <Text variant="caption" tone="muted">
          {t('ai.usage')}
        </Text>
      </Card>

      <SectionHeader title={t('ai.try')} />
      <Button
        label={t('ai.tryWeek')}
        icon="ai"
        fullWidth
        disabled={!values['ai.enabled'] || !saved || busy}
        onPress={() => void request.start('summarizeWeek')}
        testID="ai-try-week"
      />
      {request.state.status === 'preparing' || request.state.status === 'sending' ? (
        <View style={styles.row}>
          <Text tone="muted" style={styles.flex}>
            {request.state.status === 'sending'
              ? t('ai.sending', { provider: request.state.provider })
              : t('ai.preparing')}
          </Text>
          {request.state.status === 'sending' ? (
            <Button size="sm" variant="ghost" label={t('ai.cancel')} onPress={request.cancel} />
          ) : null}
        </View>
      ) : null}
      {request.state.status === 'error' ? <Text tone="danger">{request.state.message}</Text> : null}
      {request.state.status === 'done' ? (
        <InsightCard result={request.state.result} onRefresh={request.refresh} />
      ) : null}

      <Button label={t('ai.clear')} variant="danger" onPress={() => setConfirmClear(true)} />
      <ConfirmDialog
        visible={confirmClear}
        title={t('ai.clear')}
        confirmLabel={t('ai.clear')}
        cancelLabel={t('ai.cancel')}
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          void ai.clearHistory().then(() => toast.success(t('ai.cleared')));
        }}
      />
      {request.element}
    </>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' },
  flex: { flex: 1 },
  gap: { gap: t.spacing.sm },
}));
