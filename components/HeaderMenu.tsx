import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { radius, spacing, typeScale, useTheme } from '../lib/theme';

export type HeaderMenuItem = {
  label: string;
  onPress: () => void;
};

export function HeaderMenu({ items }: { items: HeaderMenuItem[] }) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const anchorRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const openMenu = () => {
    const node = anchorRef.current;
    if (!node) {
      setOpen(true);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const close = () => setOpen(false);

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel="Menu"
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          style={styles.trigger}
        >
          <View style={styles.icon}>
            {[0, 1, 2].map((bar) => (
              <View key={bar} style={[styles.bar, { backgroundColor: colors.text }]} />
            ))}
          </View>
        </Pressable>
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          style={styles.backdrop}
        />
        <View
          accessibilityRole="menu"
          style={[
            styles.menu,
            {
              top: anchor.y + anchor.height + spacing.xs,
              right: Math.max(spacing.sm, windowWidth - (anchor.x + anchor.width)),
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {items.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => {
                close();
                item.onPress();
              }}
              accessibilityRole="menuitem"
              accessibilityLabel={item.label}
              style={({ pressed }) => [
                styles.item,
                index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
                { backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
              ]}
            >
              <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 18,
    height: 12,
    justifyContent: 'space-between',
  },
  bar: {
    height: 2,
    borderRadius: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  menu: {
    position: 'absolute',
    minWidth: 180,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.28)',
  },
  item: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
});
