import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '../../../components/PrimaryButton';
import { useAuth } from '../../../lib/auth';
import {
  getMyHousehold,
  HouseholdMember,
  HouseholdMembership,
  listHouseholdMembers,
  regenerateInviteCode,
  updateHouseholdName,
} from '../../../lib/household';
import { radius, spacing, useTheme } from '../../../lib/theme';

export default function HouseholdScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const [household, setHousehold] = useState<HouseholdMembership | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [nameDraft, setNameDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [rotating, setRotating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, m] = await Promise.all([getMyHousehold(), listHouseholdMembers()]);
      setHousehold(h);
      setNameDraft(h.name);
      setMembers(m);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load household.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isAdmin = household?.role === 'admin';

  const handleCopyCode = async () => {
    if (!household) return;
    await Clipboard.setStringAsync(household.inviteCode);
    Alert.alert('Copied', 'Invite code copied to clipboard.');
  };

  const handleSaveName = async () => {
    if (!isAdmin) return;
    setSavingName(true);
    try {
      await updateHouseholdName(nameDraft);
      await load();
      Alert.alert('Saved', 'Household name updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not rename household.';
      Alert.alert('Error', message);
    } finally {
      setSavingName(false);
    }
  };

  const handleRegenerate = () => {
    if (!isAdmin) return;
    Alert.alert(
      'New invite code?',
      'The old code will stop working immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            setRotating(true);
            try {
              const code = await regenerateInviteCode();
              setHousehold((prev: HouseholdMembership | null) =>
                prev ? { ...prev, inviteCode: code } : prev,
              );
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Could not regenerate code.';
              Alert.alert('Error', message);
            } finally {
              setRotating(false);
            }
          },
        },
      ],
    );
  };

  if (loading || !household) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Household name</Text>
        {isAdmin ? (
          <>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            />
            <PrimaryButton
              label="Save name"
              onPress={handleSaveName}
              loading={savingName}
              disabled={nameDraft.trim() === household.name}
            />
          </>
        ) : (
          <Text style={[styles.value, { color: colors.text }]}>{household.name}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Your role</Text>
        <View style={[styles.badge, { backgroundColor: colors.accentMuted }]}>
          <Text style={[styles.badgeText, { color: colors.accent }]}>
            {household.role === 'admin' ? 'Admin' : 'Member'}
          </Text>
        </View>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {isAdmin
            ? 'Admins manage the invite code and can remove movies.'
            : 'Members can add and edit movies. Only admins can remove them.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Invite code</Text>
        <Pressable
          onPress={handleCopyCode}
          style={[styles.codeBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.code, { color: colors.text }]}>{household.inviteCode}</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>Tap to copy</Text>
        </Pressable>
        {isAdmin ? (
          <PrimaryButton
            label="Regenerate code"
            onPress={handleRegenerate}
            loading={rotating}
            variant="danger"
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Members</Text>
        {members.map((member) => {
          const isYou = member.userId === user?.id;
          return (
            <View
              key={member.userId}
              style={[styles.memberRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.memberMeta}>
                <Text style={[styles.memberName, { color: colors.text }]}>
                  {member.displayName || 'Member'}
                  {isYou ? ' (you)' : ''}
                </Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  {member.role === 'admin' ? 'Admin' : 'Member'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <PrimaryButton
          label="Join a different household"
          onPress={() => router.push('/household/join')}
        />
        <Pressable
          onPress={async () => {
            try {
              await signOut();
            } catch {
              Alert.alert('Error', 'Could not sign out.');
            }
          }}
          style={styles.signOut}
        >
          <Text style={[styles.signOutText, { color: colors.danger }]}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  section: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  codeBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  code: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 4,
  },
  memberRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  memberMeta: {
    gap: 2,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  signOut: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
