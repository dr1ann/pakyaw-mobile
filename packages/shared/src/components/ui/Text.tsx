import { type ReactNode } from 'react';
import {
  StyleSheet,
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { colors, typography } from '@/constants/theme';

export type TextVariant =
  | 'hero'
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyMd'
  | 'bodySmall'
  | 'label'
  | 'caption'
  | 'button';

export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extraBold';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  weight?: TextWeight;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  uppercase?: boolean;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
};

const VARIANT_CONFIG: Record<
  TextVariant,
  {
    fontSize: number;
    lineHeight?: number;
    family: string;
    letterSpacing?: number;
  }
> = {
  hero: {
    fontSize: typography.size.hero,
    lineHeight: typography.lineHeight.hero,
    family: typography.family.extraBold,
  },
  display: {
    fontSize: typography.size.display,
    lineHeight: typography.lineHeight.display,
    family: typography.family.bold,
  },
  h1: {
    fontSize: typography.size.h1,
    lineHeight: typography.lineHeight.h1,
    family: typography.family.bold,
  },
  h2: {
    fontSize: typography.size.h2,
    lineHeight: typography.lineHeight.h2,
    family: typography.family.bold,
  },
  h3: {
    fontSize: typography.size.h3,
    lineHeight: typography.lineHeight.h3,
    family: typography.family.semibold,
  },
  body: {
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    family: typography.family.regular,
  },
  bodyMd: {
    fontSize: typography.size.bodyMd,
    lineHeight: typography.lineHeight.bodyMd,
    family: typography.family.medium,
  },
  bodySmall: {
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
    family: typography.family.regular,
  },
  label: {
    fontSize: typography.size.label,
    letterSpacing: typography.letterSpacing.label,
    family: typography.family.semibold,
  },
  caption: {
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    family: typography.family.regular,
  },
  button: {
    fontSize: typography.size.button,
    letterSpacing: typography.letterSpacing.wide,
    family: typography.family.semibold,
  },
};

export function Text({
  variant = 'body',
  weight,
  color = colors.ink[900],
  align,
  uppercase,
  style,
  children,
  ...rest
}: TextProps) {
  const config = VARIANT_CONFIG[variant];
  const fontFamily = weight ? typography.family[weight] : config.family;

  return (
    <RNText
      style={[
        styles.base,
        {
          fontSize: config.fontSize,
          lineHeight: config.lineHeight,
          fontFamily,
          color,
          textAlign: align,
          letterSpacing: config.letterSpacing,
          textTransform: uppercase ? 'uppercase' : undefined,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.ink[900],
  },
});
