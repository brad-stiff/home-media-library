import { useRouter } from 'expo-router';
import { ColorValue, Pressable, StyleSheet } from 'react-native';

import { ChevronIcon } from './icons';

type Props = {
  color: ColorValue;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function HeaderBackButton({ color, onPress, accessibilityLabel = 'Back' }: Props) {
  const router = useRouter();

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={styles.button}
    >
      <ChevronIcon color={color} size={22} direction="left" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
