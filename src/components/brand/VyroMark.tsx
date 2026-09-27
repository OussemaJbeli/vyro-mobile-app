import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { brand } from '@/theme/brand';
import { markShades } from '@/theme/color';

import { MARK_VIEWBOX, markPaths } from './markPaths';

export type VyroMarkProps = {
  /** Rendered width in dp. Height follows the mark's aspect ratio. */
  size?: number;
  /** Accent colour. Production code passes the theme accent (step 03). */
  color?: string;
  /** Soft halo behind the mark, like the supplied logo. Uses stroked copies, so it works on Android. */
  glow?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

// Extra room around the viewBox so the glow isn't clipped.
const GLOW_PAD = 40;
const HALO = [
  { width: 56, opacity: 0.05 },
  { width: 34, opacity: 0.08 },
  { width: 16, opacity: 0.14 },
];

export function VyroMark({
  size = 64,
  color = brand.primary,
  glow = false,
  accessibilityLabel = 'VYRO',
  testID,
}: VyroMarkProps) {
  // Gradient ids must be unique per instance, or several marks on one screen share one gradient.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (name: string) => `${name}${uid}`;
  const shades = markShades(color);
  const pad = glow ? GLOW_PAD : 0;
  const vbWidth = MARK_VIEWBOX.width + pad * 2;
  const vbHeight = MARK_VIEWBOX.height + pad * 2;

  const width = size;
  const height = (size * vbHeight) / vbWidth;

  // Accessibility lives on the wrapping View: react-native-svg forwards `accessible`
  // to the DOM on web, which React rejects as a non-boolean attribute.
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width, height }}
      {...(testID ? { testID } : {})}
    >
      <Svg width={width} height={height} viewBox={`${-pad} ${-pad} ${vbWidth} ${vbHeight}`}>
        <Defs>
          <LinearGradient id={id('bodyLeft')} x1="0.1" y1="0.1" x2="0.7" y2="1">
            <Stop offset="0" stopColor={shades.deep} />
            <Stop offset="0.55" stopColor={shades.mid} />
            <Stop offset="1" stopColor={shades.base} />
          </LinearGradient>
          <LinearGradient id={id('bodyRight')} x1="0.8" y1="0.1" x2="0.3" y2="1">
            <Stop offset="0" stopColor={shades.deep} />
            <Stop offset="0.5" stopColor={shades.mid} />
            <Stop offset="1" stopColor={shades.tip} />
          </LinearGradient>
          <LinearGradient id={id('face')} x1="0" y1="0" x2="1" y2="0.4">
            <Stop offset="0" stopColor={shades.faceStart} />
            <Stop offset="1" stopColor={shades.faceEnd} />
          </LinearGradient>
        </Defs>

        {glow ? (
          <G>
            {HALO.map((h) => (
              <G key={h.width} stroke={color} strokeOpacity={h.opacity} strokeWidth={h.width}>
                <Path d={markPaths.leafLeft} fill="none" strokeLinejoin="round" />
                <Path d={markPaths.leafRight} fill="none" strokeLinejoin="round" />
              </G>
            ))}
          </G>
        ) : null}

        <Path d={markPaths.leafLeft} fill={`url(#${id('bodyLeft')})`} />
        <Path d={markPaths.faceLeft} fill={`url(#${id('face')})`} />
        <Path
          d={markPaths.foldLeft}
          fill="none"
          stroke={shades.foldLine}
          strokeOpacity={0.85}
          strokeWidth={3}
        />
        <Path d={markPaths.leafRight} fill={`url(#${id('bodyRight')})`} />
        <Path d={markPaths.faceRight} fill={`url(#${id('face')})`} />
        <Path
          d={markPaths.foldRight}
          fill="none"
          stroke={shades.foldLine}
          strokeOpacity={0.85}
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
}
