import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BottomSheet, Button, Text, Toggle } from '@/components/ui';
import { readAIConfig, useAI } from '@/hooks/useAI';
import {
  humanError,
  providerMeta,
  type AIMethod,
  type InsightResult,
  type Prepared,
} from '@/services/ai';
import { useSettingsStore } from '@/store/settingsStore';
import { makeStyles } from '@/theme';

type Extra = Parameters<ReturnType<typeof useAI>['prepare']>[1];

export type AIRequestState =
  | { status: 'idle' }
  | { status: 'preparing' }
  | { status: 'sending'; provider: string }
  | { status: 'done'; result: InsightResult }
  | { status: 'error'; message: string };

/**
 * One AI request with the privacy steps of FS §41/§44: consent (once per provider) →
 * payload preview ("What will be sent", can be skipped per type) → "Sending to …" with
 * Cancel → result. Nothing runs in the background; every call starts from a tap.
 */
export function useAIRequest() {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const ai = useAI();
  const client = useQueryClient();
  const values = useSettingsStore((s) => s.values);
  const setSetting = useSettingsStore((s) => s.set);
  const [state, setState] = useState<AIRequestState>({ status: 'idle' });
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [sheet, setSheet] = useState<'consent' | 'preview' | null>(null);
  const [skipNext, setSkipNext] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const pending = useRef<{ refresh: boolean } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const provider = values['ai.provider'];
  const label = providerMeta(provider)?.label ?? provider;

  const send = async (p: Prepared, refresh: boolean) => {
    setSheet(null);
    const controller = new AbortController();
    abort.current = controller;
    setState({ status: 'sending', provider: label });
    const res = await ai.run(p, { refresh, signal: controller.signal });
    abort.current = null;
    if (res.ok) void client.invalidateQueries({ queryKey: ['ai'] });
    setState(
      res.ok
        ? { status: 'done', result: res.value }
        : { status: 'error', message: humanError(res.error) },
    );
  };

  const next = (p: Prepared, refresh: boolean) => {
    const v = useSettingsStore.getState().values;
    if (!v['ai.consent'][provider]) {
      pending.current = { refresh };
      setSheet('consent');
      return;
    }
    if (!v['ai.skipPreview'][p.method]) {
      pending.current = { refresh };
      setSkipNext(false);
      setShowJson(false);
      setSheet('preview');
      return;
    }
    void send(p, refresh);
  };

  const start = async (method: AIMethod, opts: Extra = {}, refresh = false) => {
    if (!readAIConfig().enabled) {
      setState({ status: 'error', message: t('ai.offHint') });
      return;
    }
    setState({ status: 'preparing' });
    const p = await ai.prepare(method, opts);
    setPrepared(p);
    // A cached answer for the same data costs nothing and sends nothing.
    if (!refresh) {
      const res = await ai.run(p, { refresh: false });
      if (res.ok && res.value.cached) {
        setState({ status: 'done', result: res.value });
        return;
      }
    }
    next(p, refresh);
  };

  const element = (
    <>
      <BottomSheet
        visible={sheet === 'consent'}
        onClose={() => setSheet(null)}
        title={t('ai.consent.title', { provider: label })}
      >
        <View style={styles.sheet}>
          <Text>{t('ai.consent.body', { provider: label })}</Text>
          <Text variant="caption" tone="muted">
            {t('ai.consent.never')}
          </Text>
          <Button
            label={t('ai.consent.accept')}
            fullWidth
            onPress={() => {
              void setSetting('ai.consent', {
                ...values['ai.consent'],
                [provider]: new Date().toISOString(),
              });
              if (prepared) next(prepared, pending.current?.refresh ?? false);
            }}
            testID="ai-consent-accept"
          />
          <Button
            label={t('ai.consent.decline')}
            variant="ghost"
            fullWidth
            onPress={() => {
              setSheet(null);
              setState({ status: 'idle' });
            }}
          />
        </View>
      </BottomSheet>
      <BottomSheet
        visible={sheet === 'preview'}
        onClose={() => setSheet(null)}
        title={t('ai.preview.title')}
      >
        <View style={styles.sheet}>
          <Text tone="muted">{t('ai.preview.body', { provider: label })}</Text>
          <Button
            label={showJson ? t('ai.preview.hide') : t('ai.preview.show')}
            size="sm"
            variant="secondary"
            onPress={() => setShowJson((v) => !v)}
          />
          {showJson && prepared ? (
            <ScrollView style={styles.json} nestedScrollEnabled>
              <Text variant="caption" style={styles.mono} selectable>
                {prepared.preview}
              </Text>
            </ScrollView>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.flex}>{t('ai.preview.skip')}</Text>
            <Toggle
              value={skipNext}
              onChange={setSkipNext}
              accessibilityLabel={t('ai.preview.skip')}
            />
          </View>
          <Button
            label={t('ai.preview.send', { provider: label })}
            fullWidth
            onPress={() => {
              if (!prepared) return;
              if (skipNext)
                void setSetting('ai.skipPreview', {
                  ...values['ai.skipPreview'],
                  [prepared.method]: true,
                });
              void send(prepared, pending.current?.refresh ?? false);
            }}
            testID="ai-preview-send"
          />
        </View>
      </BottomSheet>
    </>
  );

  return {
    state,
    start,
    refresh: () => (prepared ? next(prepared, true) : undefined),
    cancel: () => abort.current?.abort(),
    element,
  };
}

const useStyles = makeStyles((t) => ({
  sheet: { gap: t.spacing.md, paddingBottom: t.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
  json: {
    maxHeight: 260,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceRaised,
    padding: t.spacing.sm,
  },
  mono: { fontFamily: 'monospace' },
}));
