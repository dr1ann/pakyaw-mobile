import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/theme';

export type RouteConnectorProps = {
  originColor?: string;
  destinationColor?: string;
  lineColor?: string;
  dotSize?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function RouteConnector({
  originColor = colors.blue.primary,
  destinationColor = colors.amber.primary,
  lineColor = colors.border.subtle,
  dotSize = 10,
  height = 48,
  style,
}: RouteConnectorProps) {
  return (
    <View style={[styles.container, { height }, style]}>
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: originColor,
          },
        ]}
      />
      <View style={[styles.line, { backgroundColor: lineColor }]} />
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: destinationColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 2,
  },
  dot: {},
});
