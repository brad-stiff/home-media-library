import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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

import { ChevronIcon } from '../../../components/icons';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { useAuth } from '../../../lib/auth';
import {
  errorMessage,
  getMyHousehold,
  HouseholdMember,
  HouseholdMembership,
  listHouseholdMembers,
  regenerateInviteCode,
  removeHouseholdMember,
  setMemberRole,
  updateHouseholdName,
} from '../../../lib/household';
import { useHousehold } from '../../../lib/householdContext';
import { roleHint, roleLabel } from '../../../lib/roles';
import { radius, spacing, useTheme } from '../../../lib/theme';
import { useToast } from '../../../lib/toast';
import { HouseholdRole } from '../../../lib/types';

export default function HouseholdScreen() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { user, signOut } = useAuth();
  const { refresh } = useHousehold();
  const [household, setHousehold] = useState<HouseholdMembership | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [nameDraft, setNameDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [rotating, setRotating] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inviteOffset = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextHousehold, nextMembers] = await Promise.all([
        getMyHousehold(),
        listHouseholdMembers(),
      ]);
      setHousehold(nextHousehold);
      setNameDraft(nextHousehold.name);
      setMembers(nextMembers);
      await refresh();
    } catch (error) {
      Alert.alert('Error', errorMessage(error, 'Could not load household.'));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (focus !== 'invite' || loading) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, inviteOffset.current - spacing.md), animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [focus, loading]);

  const isAdmin = household?.role === 'admin';

  const handleCopyCode = async () => {
    if (!household?.inviteCode) return;
    await Clipboard.setStringAsync(household.inviteCode);
    showToast('Invite code copied');
  };

  const handleSaveName = async () => {
    if (!isAdmin) return;
    setSavingName(true);
    try {
      await updateHouseholdName(nameDraft);
      await load();
      showToast('Household name saved');
    } catch (error) {
      Alert.alert('Error', errorMessage(error, 'Could not rename household.'));
    } finally {
      setSavingName(false);
    }
  };

  const handleRegenerate = () => {
    if (!isAdmin) return;
    Alert.alert('New invite code?', 'The old code stops working immediately. There is no expiry until you regenerate.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Regenerate',
        style: 'destructive',
        onPress: async () => {
          setRotating(true);
          try {
            const code = await regenerateInviteCode();
            setHousehold((prev) => (prev ? { ...prev, inviteCode: code } : prev));
          } catch (error) {
            Alert.alert('Error', errorMessage(error, 'Could not regenerate code.'));
          } finally {
            setRotating(false);
          }
        },
      },
    ]);
  };

  const handleSetRole = (member: HouseholdMember, role: HouseholdRole) => {
    void (async () => {
      try {
        await setMemberRole(member.userId, role);
        await load();
      } catch (error) {
        Alert.alert('Could not change role', errorMessage(error, 'Try again.'));
      }
    })();
  };

  const handleChangeRole = (member: HouseholdMember) => {
    const name = member.displayName || 'this member';
    Alert.alert(`Role for ${name}`, 'Admins can set viewer, member, or admin.', [
      { text: 'Viewer', onPress: () => handleSetRole(member, 'viewer') },
      { text: 'Member', onPress: () => handleSetRole(member, 'member') },
      { text: 'Admin', onPress: () => handleSetRole(member, 'admin') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemove = (member: HouseholdMember) => {
    const name = member.displayName || 'This member';
    Alert.alert(
      'Remove member?',
      `${name} will need to create or join a household. Items they added stay in the library and show Former member until they rejoin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeHouseholdMember(member.userId);
              await load();
            } catch (error) {
              Alert.alert('Could not remove member', errorMessage(error, 'Try again.'));
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
    <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
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
          <Text style={[styles.badgeText, { color: colors.accent }]}>{roleLabel(household.role)}</Text>
        </View>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>{roleHint(household.role)}</Text>
      </View>

      {isAdmin && household.inviteCode ? (
        <View
          style={styles.section}
          onLayout={(event) => {
            inviteOffset.current = event.nativeEvent.layout.y;
          }}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>Invite code</Text>
          <Pressable
            onPress={handleCopyCode}
            style={[styles.codeBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.code, { color: colors.text }]}>{household.inviteCode}</Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Tap to copy</Text>
          </Pressable>
          <Pressable
            onPress={handleRegenerate}
            disabled={rotating}
            accessibilityRole="button"
            accessibilityLabel="Regenerate code"
            style={styles.textAction}
          >
            {rotating ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Regenerate code</Text>
            )}
          </Pressable>
        </View>
      ) : null}

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
                  {roleLabel(member.role)}
                </Text>
              </View>
              {isAdmin && !isYou ? (
                <View style={styles.memberActions}>
                  <Pressable onPress={() => handleChangeRole(member)} hitSlop={8}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>Role</Text>
                  </Pressable>
                  <Pressable onPress={() => handleRemove(member)} hitSlop={8}>
                    <Text style={{ color: colors.danger, fontWeight: '700' }}>Remove</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <LinkRow label="Settings" onPress={() => router.push('/settings')} />
        <LinkRow label="Contacts" onPress={() => router.push('/contacts')} />
        {household.lendingEnabled ? <LinkRow label="Loan history" onPress={() => router.push('/loans')} /> : null}
        <LinkRow label="Join a different household" onPress={() => router.push('/household/join')} />
        <PrimaryButton
          label="Leave household"
          onPress={() => router.push('/household/confirm-departure?intent=leave')}
          variant="danger"
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

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.memberRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.memberName, { color: colors.text, flex: 1 }]}>{label}</Text>
      <ChevronIcon color={colors.textTertiary} />
    </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberMeta: {
    flex: 1,
    gap: 2,
  },
  memberActions: {
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  textAction: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
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
