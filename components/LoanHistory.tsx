import { StyleSheet, Text, View } from 'react-native';

import { Checkout, checkoutStatus } from '../lib/checkouts';
import { radius, spacing, useTheme } from '../lib/theme';

type LoanHistoryProps = {
  loans: Checkout[];
};

function formatWhen(value: string): string {
  return new Date(value).toLocaleDateString();
}

export function LoanHistory({ loans }: LoanHistoryProps) {
  const { colors } = useTheme();
  const past = loans.filter((loan) => checkoutStatus(loan) !== 'active');

  if (past.length === 0) return null;

  return (
    <View style={styles.list}>
      <Text style={[styles.heading, { color: colors.text }]}>Past loans</Text>
      {past.map((loan) => {
        const status = checkoutStatus(loan);
        const closedAt = status === 'cancelled' ? loan.cancelledAt : loan.returnedAt;
        return (
          <View
            key={loan.id}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.name, { color: colors.text }]}>{loan.borrowerName}</Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {status === 'cancelled' ? 'Cancelled' : 'Returned'}
              {closedAt ? ` ${formatWhen(closedAt)}` : ''}
              {' · '}
              Lent {formatWhen(loan.checkedOutAt)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
});
