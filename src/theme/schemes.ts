import { type AccentName } from './brand';
import { darken, withAlpha } from './color';
import { accents, palette } from './tokens';

export type SchemeName = 'dark' | 'light';

export type ThemeColors = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderAccent: string;
  /** Faint accent wash for icon tiles and selected rows (keep backgrounds mostly neutral). */
  primarySoft: string;
  text: string;
  textMuted: string;
  /** Accent fill. Never use it for text on light surfaces: use `primaryInk`. */
  primary: string;
  /** Accent for text and icons, contrast-safe on the current background. */
  primaryInk: string;
  onPrimary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  /** Halo colour for the FAB, primary buttons and the logo. `transparent` in light mode. */
  glow: string;
  overlay: string;
  /** Activity tiles (template: running lime, gym green, abs orange). Derived from the accent. */
  activity: Record<'gym' | 'running' | 'home' | 'abs' | 'recovery' | 'rest' | 'other', string>;
};

export function buildColors(scheme: SchemeName, accentName: AccentName): ThemeColors {
  const accent = accents[accentName];
  if (scheme === 'dark') {
    return {
      bg: palette.ink950,
      surface: palette.ink900,
      surfaceRaised: palette.ink850,
      border: palette.ink700,
      borderAccent: withAlpha(accent.base, 0.22),
      primarySoft: withAlpha(accent.base, 0.07),
      text: palette.white,
      textMuted: palette.ink300,
      primary: accent.base,
      primaryInk: accent.base,
      onPrimary: accent.onBase,
      success: accent.base,
      warning: palette.warning,
      danger: palette.danger,
      info: palette.info,
      glow: withAlpha(accent.base, 0.3),
      overlay: withAlpha(palette.ink950, 0.72),
      activity: {
        running: accent.base,
        gym: darken(accent.base, 0.28),
        home: darken(accent.base, 0.15),
        abs: palette.warning,
        recovery: palette.info,
        rest: palette.ink600,
        other: palette.ink600,
      },
    };
  }
  return {
    bg: palette.paper50,
    surface: palette.white,
    surfaceRaised: palette.paper100,
    border: palette.paper200,
    borderAccent: withAlpha(accent.ink, 0.2),
    primarySoft: withAlpha(accent.ink, 0.07),
    text: palette.ink950,
    textMuted: palette.ink400,
    primary: accent.base,
    primaryInk: accent.ink,
    onPrimary: accent.onBase,
    success: accent.ink,
    warning: palette.warningInk,
    danger: palette.dangerInk,
    info: palette.infoInk,
    glow: 'transparent',
    overlay: withAlpha(palette.ink950, 0.45),
    activity: {
      running: accent.base,
      gym: darken(accent.base, 0.2),
      home: darken(accent.base, 0.1),
      abs: palette.warning,
      recovery: palette.info,
      rest: palette.paper200,
      other: palette.paper200,
    },
  };
}

/** Session statuses (AD-17). `missed` is derived for display, never stored. */
export type SessionStatus =
  'planned' | 'in_progress' | 'completed' | 'modified' | 'skipped' | 'cancelled' | 'missed';

export type StatusStyle = {
  color: string;
  /** Semantic icon name, resolved by the Icon component (step 04). */
  icon: string;
  /** i18n key for the label. Status is never shown by colour alone (FS §74). */
  labelKey: `status:${string}`;
  strikethrough?: boolean;
};

export function statusStyles(colors: ThemeColors): Record<SessionStatus, StatusStyle> {
  return {
    planned: { color: colors.textMuted, icon: 'status-pending', labelKey: 'status:planned' },
    in_progress: { color: colors.primaryInk, icon: 'status-next', labelKey: 'status:in_progress' },
    completed: { color: colors.primaryInk, icon: 'status-done', labelKey: 'status:completed' },
    modified: { color: colors.info, icon: 'status-modified', labelKey: 'status:modified' },
    skipped: { color: colors.warning, icon: 'status-skipped', labelKey: 'status:skipped' },
    cancelled: {
      color: colors.textMuted,
      icon: 'status-cancelled',
      labelKey: 'status:cancelled',
      strikethrough: true,
    },
    missed: { color: colors.danger, icon: 'status-missed', labelKey: 'status:missed' },
  };
}
