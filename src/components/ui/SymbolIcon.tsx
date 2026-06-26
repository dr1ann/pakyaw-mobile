import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';

export type SymbolIconProps = {
  readonly name: string;
  readonly size?: number;
  readonly tintColor?: string;
  readonly style?: StyleProp<ViewStyle>;
};

// Map iOS SF Symbols to Android/Web Material Symbols fallbacks
const SYMBOL_MAP: Record<string, { ios: string; android: string; web: string }> = {
  'chevron.left': { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  'chevron.up': { ios: 'chevron.up', android: 'keyboard_arrow_up', web: 'keyboard_arrow_up' },
  'chevron.down': { ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' },
  'info.circle': { ios: 'info.circle', android: 'info', web: 'info' },
  power: { ios: 'power', android: 'power_settings_new', web: 'power_settings_new' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  banknote: { ios: 'banknote', android: 'local_atm', web: 'local_atm' },
  magnifyingglass: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  xmark: { ios: 'xmark', android: 'close', web: 'close' },
  'house.fill': { ios: 'house.fill', android: 'home', web: 'home' },
  'briefcase.fill': { ios: 'briefcase.fill', android: 'work', web: 'work' },
  'star.fill': { ios: 'star.fill', android: 'star', web: 'star' },
  car: { ios: 'car', android: 'directions_car', web: 'directions_car' },
  'car.fill': { ios: 'car.fill', android: 'directions_car', web: 'directions_car' },
  clock: { ios: 'clock', android: 'history', web: 'history' },
  'clock.fill': { ios: 'clock.fill', android: 'history', web: 'history' },
  person: { ios: 'person', android: 'person', web: 'person' },
  'person.fill': { ios: 'person.fill', android: 'person', web: 'person' },
  'location.fill': { ios: 'location.fill', android: 'my_location', web: 'my_location' },
};

export function SymbolIcon({ name, size = 24, tintColor, style }: SymbolIconProps) {
  const platformName = SYMBOL_MAP[name] || { ios: name, android: name, web: name };

  return (
    <SymbolView
      name={platformName}
      size={size}
      tintColor={tintColor}
      style={style}
    />
  );
}
