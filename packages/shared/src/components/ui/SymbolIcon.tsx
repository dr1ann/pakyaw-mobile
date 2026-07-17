import React, { type ComponentProps } from 'react';
import { type StyleProp, type ViewStyle, type ColorValue } from 'react-native';
import { SymbolView } from 'expo-symbols';


export type SymbolIconProps = {
  readonly name: string;
  readonly size?: number;
  readonly tintColor?: ColorValue;
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
  'person.2.fill': { ios: 'person.2.fill', android: 'group', web: 'group' },
  'person.3.fill': { ios: 'person.3.fill', android: 'groups', web: 'groups' },
  'antenna.radiowaves.left.and.right': { ios: 'antenna.radiowaves.left.and.right', android: 'radar', web: 'radar' },
  'map.fill': { ios: 'map.fill', android: 'map', web: 'map' },
  'mappin.circle.fill': { ios: 'mappin.circle.fill', android: 'pin_drop', web: 'pin_drop' },
  'exclamationmark.triangle.fill': { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  clock: { ios: 'clock', android: 'history', web: 'history' },
  'clock.fill': { ios: 'clock.fill', android: 'history', web: 'history' },
  person: { ios: 'person', android: 'person', web: 'person' },
  'person.fill': { ios: 'person.fill', android: 'person', web: 'person' },
  'location.fill': { ios: 'location.fill', android: 'my_location', web: 'my_location' },
  'arrow.turn.up.left': { ios: 'arrow.turn.up.left', android: 'turn_left', web: 'turn_left' },
  'arrow.turn.up.right': { ios: 'arrow.turn.up.right', android: 'turn_right', web: 'turn_right' },
  'arrow.up.left': { ios: 'arrow.up.left', android: 'north_west', web: 'north_west' },
  'arrow.up.right': { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' },
  'arrow.up': { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  'arrow.uturn.left': { ios: 'arrow.uturn.left', android: 'uturn_left', web: 'uturn_left' },
  'arrow.uturn.right': { ios: 'arrow.uturn.right', android: 'uturn_right', web: 'uturn_right' },
  'arrow.triangle.2.circlepath': { ios: 'arrow.triangle.2.circlepath', android: 'cached', web: 'cached' },
  ferry: { ios: 'ferry', android: 'directions_boat', web: 'directions_boat' },
  navigation: { ios: 'navigation', android: 'navigation', web: 'navigation' },
  mappin: { ios: 'mappin', android: 'place', web: 'place' },
  safari: { ios: 'safari', android: 'explore', web: 'explore' },
};

export function SymbolIcon({ name, size = 24, tintColor, style }: SymbolIconProps) {
  const platformName = SYMBOL_MAP[name] || { ios: name, android: name, web: name };

  return (
    <SymbolView
      name={platformName as ComponentProps<typeof SymbolView>['name']}
      size={size}
      tintColor={tintColor}
      style={style}
    />
  );
}
