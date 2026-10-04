import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../../../components/PrimaryButton';
import {
  DeviceLabeledValue,
  clearDeviceContact,
  deviceValueLabel,
  peekDeviceContact,
  planDeviceImport,
} from '../../../lib/deviceContact';
import { finishDeviceContactImport, openDeviceContactForm } from '../../../lib/deviceContactFlow';
import { radius, spacing, useTheme } from '../../../lib/theme';
import { useToast } from '../../../lib/toast';

function ChoiceGroup({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: DeviceLabeledValue[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const { colors } = useTheme();
  if (options.length < 2) return null;

  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.text }]}>{title}</Text>
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={`${option.label}-${option.value}`}
            onPress={() => onSelect(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={deviceValueLabel(option.label, option.value)}
            style={[
              styles.choice,
              {
                backgroundColor: colors.surface,
                borderColor: isSelected ? colors.accent : colors.border,
              },
            ]}
          >
            <Text style={{ color: colors.text }}>{deviceValueLabel(option.label, option.value)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ContactFromPhoneScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [prepared] = useState(() => peekDeviceContact());
  const [email, setEmail] = useState(prepared?.emails[0]?.value ?? '');
  const [phone, setPhone] = useState(prepared?.phones[0]?.value ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!prepared) router.back();
  }, [prepared, router]);

  if (!prepared) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>Choose a contact from your phone again.</Text>
      </View>
    );
  }

  const save = async () => {
    const plan = planDeviceImport(prepared, { email, phone });
    if (plan.kind === 'choose') return;
    if (plan.kind === 'form') {
      clearDeviceContact();
      openDeviceContactForm(router, plan.draft, plan.held, true);
      return;
    }
    setSaving(true);
    const outcome = await finishDeviceContactImport(plan.draft, router, showToast, { replaceForm: true });
    setSaving(false);
    if (outcome === 'saved' || outcome === 'form') clearDeviceContact();
    if (outcome === 'saved') router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        {prepared.name
          ? `${prepared.name} will be saved with the email and phone you pick. SMS reminders stay off.`
          : 'This phone contact has no name. Pick an email and phone, then enter the name.'}
      </Text>
      <ChoiceGroup title="Email" options={prepared.emails} selected={email} onSelect={setEmail} />
      <ChoiceGroup title="Phone" options={prepared.phones} selected={phone} onSelect={setPhone} />
      <PrimaryButton label="Add contact" onPress={() => void save()} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  hint: { fontSize: 14, lineHeight: 20 },
  group: { gap: spacing.sm },
  groupTitle: { fontSize: 16, fontWeight: '700' },
  choice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
});
