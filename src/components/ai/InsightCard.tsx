import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomSheet, Button, Card, Icon, Text } from '@/components/ui';
import { formatDay } from '@/components/planner/plannerUtils';
import { useAI } from '@/hooks/useAI';
import { humanError, type InsightResult, type SuggestionPreview } from '@/services/ai';
import { toast } from '@/store/uiStore';
import { makeStyles, useTheme } from '@/theme';

type Status = 'pending' | 'applied' | 'ignored' | 'expired';

/**
 * AI report (UI §28–29): summary, bullets, suggestion cards (Preview change → Apply with
 * Undo, or Ignore), disclaimers and "Based on your recorded data from …". Screen readers
 * read it top to bottom; every action button names its suggestion.
 */
export function InsightCard({
  result,
  onRefresh,
  onChanged,
}: {
  result: InsightResult;
  onRefresh?: () => void;
  onChanged?: () => void;
}) {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const theme = useTheme();
  const ai = useAI();
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<{ id: string; preview: SuggestionPreview } | null>(null);
  const { insight } = result;

  const review = async (id: string) => {
    const preview = await ai.previewSuggestion(id);
    if (!preview.canApply) {
      setStatus((s) => ({ ...s, [id]: 'expired' }));
      setNotes((n) => ({ ...n, [id]: preview.warnings[0] ?? preview.description }));
      return;
    }
    setOpen({ id, preview });
  };

  const apply = async (id: string) => {
    setOpen(null);
    const r = await ai.applySuggestion(id);
    if (!r.ok) {
      toast.error(humanError(r.error));
      return;
    }
    setStatus((s) => ({ ...s, [id]: 'applied' }));
    onChanged?.();
    toast.withAction(t('ai.insight.appliedToast'), t('ai.insight.undo'), () => {
      void r.value.undo().then(() => {
        setStatus((s) => ({ ...s, [id]: 'pending' }));
        onChanged?.();
        toast.info(t('ai.insight.undone'));
      });
    });
  };

  return (
    <Card style={styles.card} testID="ai-insight">
      <View style={styles.head}>
        <Icon name="ai" size={20} color={theme.colors.primaryInk} />
        <Text variant="heading" style={styles.flex} accessibilityRole="header">
          {insight.title}
        </Text>
      </View>
      <Text>{insight.summary}</Text>
      {insight.bullets.map((b, i) => (
        <Text key={i} tone="muted">
          • {b}
        </Text>
      ))}

      {insight.suggestions.map((s, i) => {
        const id = result.suggestionIds[i];
        const actionable = !!id && s.kind !== 'info' && s.kind !== 'adjust_template';
        const st = id ? (status[id] ?? 'pending') : 'pending';
        return (
          <View key={i} style={styles.suggestion}>
            <Text variant="overline" tone="primary">
              {t('ai.insight.suggestion')} · {t(`ai.kind.${s.kind}`)}
            </Text>
            <Text>
              <Text variant="bodyStrong">{t('ai.insight.why')} </Text>
              {s.rationale}
            </Text>
            {actionable && st === 'pending' ? (
              <View style={styles.row}>
                <Button
                  size="sm"
                  variant="secondary"
                  label={t('ai.insight.preview')}
                  accessibilityLabel={t('ai.insight.previewA11y', { what: s.rationale })}
                  onPress={() => void review(id)}
                />
                <Button
                  size="sm"
                  label={t('ai.insight.apply')}
                  accessibilityLabel={t('ai.insight.applyA11y', { what: s.rationale })}
                  onPress={() => void review(id)}
                  testID={`ai-apply-${i}`}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  label={t('ai.insight.ignore')}
                  accessibilityLabel={t('ai.insight.ignoreA11y', { what: s.rationale })}
                  onPress={() => {
                    void ai.ignoreSuggestion(id);
                    setStatus((x) => ({ ...x, [id]: 'ignored' }));
                  }}
                />
              </View>
            ) : actionable ? (
              <Text variant="caption" tone={st === 'applied' ? 'primary' : 'muted'}>
                {t(`ai.insight.${st}`)}
                {notes[id] ? ` · ${notes[id]}` : ''}
              </Text>
            ) : null}
          </View>
        );
      })}

      {insight.disclaimers.map((d, i) => (
        <Text key={i} variant="caption" tone="muted">
          {d}
        </Text>
      ))}
      {result.period ? (
        <Text variant="caption" tone="muted">
          {t('ai.insight.basedOn', {
            from: formatDay(result.period.start, { day: 'numeric', month: 'short' }),
            to: formatDay(result.period.end, { day: 'numeric', month: 'short' }),
          })}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Text variant="caption" tone="muted" style={styles.flex}>
          {t('ai.insight.by', { provider: result.provider, model: result.model })}
          {result.cached ? ` · ${t('ai.insight.cached')}` : ''} ·{' '}
          {t(`ai.confidence.${insight.confidence}`)}
          {result.usage?.inputTokens || result.usage?.outputTokens
            ? ` · ${t('ai.insight.tokens', {
                count: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
              })}`
            : ''}
        </Text>
        {onRefresh ? (
          <Button
            size="sm"
            variant="ghost"
            icon="repeat"
            label={t('ai.insight.refresh')}
            onPress={onRefresh}
          />
        ) : null}
      </View>

      <BottomSheet
        visible={open !== null}
        onClose={() => setOpen(null)}
        title={t('ai.insight.applyTitle')}
      >
        {open ? (
          <View style={styles.sheet}>
            <Text variant="bodyStrong">{open.preview.description}</Text>
            {open.preview.diff ? (
              <View style={styles.diff}>
                <View style={styles.flex}>
                  <Text variant="overline" tone="muted">
                    {t('ai.insight.before')}
                  </Text>
                  {open.preview.diff.before.map((l, i) => (
                    <Text key={i} variant="caption">
                      {l}
                    </Text>
                  ))}
                </View>
                <View style={styles.flex}>
                  <Text variant="overline" tone="primary">
                    {t('ai.insight.after')}
                  </Text>
                  {open.preview.diff.after.map((l, i) => (
                    <Text key={i} variant="caption">
                      {l}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
            {open.preview.warnings.map((w, i) => (
              <Text key={i} style={{ color: theme.colors.warning }}>
                ⚠ {w}
              </Text>
            ))}
            <Button
              label={t('ai.insight.apply')}
              fullWidth
              onPress={() => void apply(open.id)}
              testID="ai-apply-confirm"
            />
            <Button
              label={t('ai.insight.cancel')}
              variant="ghost"
              fullWidth
              onPress={() => setOpen(null)}
            />
          </View>
        ) : null}
      </BottomSheet>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' },
  suggestion: {
    gap: t.spacing.xs,
    padding: t.spacing.md,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.colors.borderAccent,
    backgroundColor: t.colors.surfaceRaised,
  },
  sheet: { gap: t.spacing.md, paddingBottom: t.spacing.md },
  diff: {
    flexDirection: 'row',
    gap: t.spacing.md,
    padding: t.spacing.md,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surfaceRaised,
  },
}));
