import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { errorMessage } from '../lib/household';
import { useHousehold } from '../lib/householdContext';
import { shareLibraryBackup } from '../lib/shareBackup';
import { radius, spacing, typeScale, useTheme } from '../lib/theme';
import { useToast } from '../lib/toast';
import { MenuIcon } from './icons';

export type HeaderMenuItem = {
  label: string;
  onPress: () => void;
};

export type HeaderMenuGroup = {
  title: string;
  items: HeaderMenuItem[];
};

export function useAppMenu(): HeaderMenuGroup[] {
  const router = useRouter();
  const { showToast } = useToast();
  const { household } = useHousehold();
  const exporting = useRef(false);

  const exportLibrary = () => {
    if (exporting.current) return;
    exporting.current = true;
    void (async () => {
      try {
        const shared = await shareLibraryBackup();
        if (Platform.OS === 'ios') {
          if (shared) showToast('Library backup shared');
        } else {
          showToast('Library backup ready');
        }
      } catch (error) {
        Alert.alert('Could not export', errorMessage(error, 'Try again.'));
      } finally {
        exporting.current = false;
      }
    })();
  };

  return useMemo(() => {
    const you: HeaderMenuItem[] = [
      { label: 'Appearance', onPress: () => router.push('/settings') },
      { label: 'Account', onPress: () => router.push('/account') },
    ];
    if (household) you.push({ label: 'Export', onPress: exportLibrary });
    you.push({ label: 'About', onPress: () => router.push('/about') });

    return [
      {
        title: 'Household',
        items: [
          { label: 'Members', onPress: () => router.push('/household') },
          { label: 'Invite', onPress: () => router.push({ pathname: '/household', params: { focus: 'invite' } }) },
          { label: 'Contacts', onPress: () => router.push('/contacts') },
        ],
      },
      { title: 'You', items: you },
    ];
    // exportLibrary closes over a ref and does not need to change the menu identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, router, showToast]);
}

export function HeaderMenu({ groups }: { groups: HeaderMenuGroup[] }) {
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
          <MenuIcon color={colors.text} />
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
          {groups.map((group, groupIndex) => (
            <View
              key={group.title}
              style={
                groupIndex > 0
                  ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }
                  : null
              }
            >
              <Text style={[typeScale.caption, styles.groupTitle, { color: colors.textTertiary }]}>
                {group.title}
              </Text>
              {group.items.map((item) => (
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
                    { backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
                  ]}
                >
                  <Text style={[typeScale.body, { color: colors.text, fontWeight: '600' }]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
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
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  menu: {
    position: 'absolute',
    minWidth: 200,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.28)',
  },
  groupTitle: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  item: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
});
