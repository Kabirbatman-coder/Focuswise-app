/**
 * FocusWise uses a single dark visual system based on the design.json theme.
 * This hook keeps the same external API but always resolves to our dark tokens.
 */

import { Colors } from '@/constants/theme';

type ThemeColorName = 'background' | 'text';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: ThemeColorName
) {
  // Prefer an explicit override if provided.
  const colorFromProps = props.dark ?? props.light;

  if (colorFromProps) {
    return colorFromProps;
  }

  if (colorName === 'background') {
    return Colors.background.primary;
  }

  return Colors.text.primary;
}
