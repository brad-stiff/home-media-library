import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '../../components/EmptyState';
import { HeaderMenu, useAppMenu } from '../../components/HeaderMenu';
import { LibraryDock } from '../../components/LibraryDock';
import { useHousehold } from '../../lib/householdContext';
import { visibleDockTabs } from '../../lib/libraryView';
import { queueLibraryTab } from '../../lib/pendingLibraryTab';
import { isTypeVisible, useProfile } from '../../lib/profile';
import { useToastLift } from '../../lib/toast';
import {
  CheckoutStatus,
  HouseholdLoan,
  cancelCheckout,
  checkoutStatus,
  listHouseholdLoans,
  returnCheckout,
} from '../../lib/checkouts';
import { isWriter } from '../../lib/roles';
import { radius, spacing, useTheme } from '../../lib/theme';

const FILTERS: { value: CheckoutStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
];

function closedLabel(loan: HouseholdLoan): string {
  const status = checkoutStatus(loan);
  if (status === 'returned' && loan.returnedAt) {
    return `Returned ${new Date(loan.returnedAt).toLocaleDateString()}`;
  }
  if (status === 'cancelled' && loan.cancelledAt) {
    return `Cancelled ${new Date(loan.cancelledAt).toLocaleDateString()}`;
  }
  return `Since ${new Date(loan.checkedOutAt).toLocaleDateString()}`;
}

export default function LoansScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const menu = useAppMenu();
  const { household } = useHousehold();
  const { profile } = useProfile();
  const [dockHeight, setDockHeight] = useState(64);
  useToastLift('loans', dockHeight + spacing.md);
  const writer = household ? isWriter(household.role) : false;
  const lendingOn = household?.lendingEnabled !== false;
  const [filter, setFilter] = useState<CheckoutStatus>('active');
  const [loans, setLoans] = useState<HouseholdLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLoans(await listHouseholdLoans());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load loans.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!lendingOn) {
        setLoans([]);
        setLoading(false);
        return;
      }
      void load();
    }, [load, lendingOn]),
  );

  const tabs = useMemo(
    () =>
      visibleDockTabs(profile.libraryView.dockOrder, (type) => {
        if (type === 'games' || type === 'pokemon') return false;
        if (!household) return true;
        return isTypeVisible(household, profile, type);
      }),
    [household, profile],
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <HeaderMenu groups={menu} /> });
  }, [navigation, menu]);

  const openLibraryTab = (next: (typeof tabs)[number]) => {
    queueLibraryTab(next);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const visible = useMemo(
    () => loans.filter((loan) => checkoutStatus(loan) === filter),
    [loans, filter],
  );

  const openItem = (loan: HouseholdLoan) => {
    if (loan.title === 'Removed item') return;
    router.push(loan.itemType === 'movie' ? `/movie/${loan.itemId}` : `/book/${loan.itemId}`);
  };

  const runAction = (loan: HouseholdLoan, action: 'return' | 'cancel') => {
    const title = action === 'return' ? 'Mark as returned?' : 'Cancel this loan?';
    const body =
      action === 'return'
        ? `Confirm ${loan.borrowerName} returned ${loan.title}.`
        : `${loan.title} becomes available. The loan stays in history as cancelled.`;
    Alert.alert(title, body, [
      { text: 'Back', style: 'cancel' },
      {
        text: action === 'return' ? 'Returned' : 'Cancel loan',
        style: action === 'cancel' ? 'destructive' : 'default',
        onPress: async () => {
          setBusyId(loan.id);
          try {
            if (action === 'return') await returnCheckout(loan.id);
            else await cancelCheckout(loan.id);
            await load();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not update this loan.';
            Alert.alert('Error', message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const tabBar = (
    <View onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}>
      <LibraryDock
        tabs={tabs}
        activeTab="loans"
        onTab={openLibraryTab}
        showLoans={lendingOn}
        onLoans={() => undefined}
      />
    </View>
  );

  if (!lendingOn) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Checkout is hidden"
          message="An admin turned off checkout for this household. Open a title that is still checked out to return or cancel that loan."
        />
        {tabBar}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {FILTERS.map(({ value, label }) => {
          const active = filter === value;
          return (
            <Pressable
              key={value}
              onPress={() => setFilter(value)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.surfaceElevated : 'transparent',
                  borderColor: active ? colors.textSecondary : colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? colors.text : colors.textSecondary, fontWeight: '700' }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : visible.length === 0 ? (
        <EmptyState
          title={filter === 'active' ? 'No active loans' : `No ${filter} loans`}
          message="Movies and books lent by this household show up here."
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          style={styles.listFlex}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const active = checkoutStatus(item) === 'active';
            return (
              <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable onPress={() => openItem(item)} style={styles.meta}>
                  <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                  <Text style={{ color: colors.textSecondary }}>
                    {item.itemType === 'movie' ? 'Movie' : 'Book'} · {item.borrowerName}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{closedLabel(item)}</Text>
                </Pressable>
                {writer && active ? (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => runAction(item, 'return')}
                      disabled={busyId === item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Return ${item.title}`}
                      style={styles.action}
                    >
                      <Text style={{ color: colors.accent, fontWeight: '700' }}>Return</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => runAction(item, 'cancel')}
                      disabled={busyId === item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel loan for ${item.title}`}
                      style={styles.action}
                    >
                      <Text style={{ color: colors.danger, fontWeight: '700' }}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
      {tabBar}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listFlex: { flex: 1 },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  actions: {
    alignItems: 'flex-end',
  },
  action: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
});
