import { StyleSheet, View } from 'react-native';

type IconProps = {
  color: string;
  size?: number;
};

export function SearchIcon({ color, size = 18 }: IconProps) {
  const ring = size - 6;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: 2,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 7,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          right: 0,
          bottom: 2,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

export function PlusIcon({ color, size = 22 }: IconProps) {
  const thickness = 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: thickness, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: 'absolute', width: thickness, height: size, borderRadius: 1, backgroundColor: color }} />
    </View>
  );
}

export function MenuIcon({ color, size = 18 }: IconProps) {
  return (
    <View style={{ width: size, height: 12, justifyContent: 'space-between' }}>
      {[0, 1, 2].map((bar) => (
        <View key={bar} style={[styles.menuBar, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

export function ChevronIcon({ color, size = 12 }: IconProps) {
  return (
    <View
      style={{
        width: size * 0.55,
        height: size * 0.55,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        transform: [{ rotate: '-45deg' }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  menuBar: {
    height: 2,
    borderRadius: 1,
  },
});
