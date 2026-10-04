import { errorMessage } from './householdRules';
import { ContactDraft, normalizeContactDraft } from './contactRules';

export type DeviceLabeledValue = {
  label: string;
  value: string;
};

export type DeviceContactFields = {
  fullName: string | null;
  givenName: string | null;
  middleName: string | null;
  familyName: string | null;
  company: string | null;
  emails: { label?: string | null; address?: string | null }[];
  phones: { label?: string | null; number?: string | null }[];
};

export type PreparedDeviceContact = {
  name: string;
  emails: DeviceLabeledValue[];
  phones: DeviceLabeledValue[];
  needsChoice: boolean;
};

export type DeviceContactHold = 'email' | 'name' | 'invalid';

export type DeviceImportPlan =
  | { kind: 'choose' }
  | { kind: 'save'; draft: ContactDraft }
  | { kind: 'form'; draft: ContactDraft; held: DeviceContactHold };

function clean(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

/** Full name, then given + middle + family, then company. */
export function deviceContactName(fields: DeviceContactFields): string {
  const full = clean(fields.fullName);
  if (full) return full;
  const structured = [fields.givenName, fields.middleName, fields.familyName]
    .map((part) => clean(part))
    .filter(Boolean)
    .join(' ');
  if (structured) return structured;
  return clean(fields.company);
}

function uniqueLabeled(
  items: { label?: string | null; value: string }[],
  key: (value: string) => string,
): DeviceLabeledValue[] {
  const seen = new Set<string>();
  const result: DeviceLabeledValue[] = [];
  for (const item of items) {
    const value = item.value.trim();
    if (!value) continue;
    const id = key(value);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ label: clean(item.label), value });
  }
  return result;
}

export function prepareDeviceContact(fields: DeviceContactFields): PreparedDeviceContact {
  const emails = uniqueLabeled(
    fields.emails.map((email) => ({ label: email.label, value: email.address ?? '' })),
    (value) => value.toLowerCase(),
  );
  const phones = uniqueLabeled(
    fields.phones.map((phone) => ({ label: phone.label, value: phone.number ?? '' })),
    (value) => value,
  );
  return {
    name: deviceContactName(fields),
    emails,
    phones,
    needsChoice: emails.length > 1 || phones.length > 1,
  };
}

export function deviceValueLabel(label: string, value: string): string {
  if (!label) return value;
  const pretty = label.charAt(0).toUpperCase() + label.slice(1);
  return `${pretty} · ${value}`;
}

/** SMS stays off. The member can opt in later on the contact. */
export function deviceContactDraft(input: { name: string; email: string; phone: string }): ContactDraft {
  return {
    name: input.name,
    email: input.email,
    phone: input.phone,
    smsReminders: false,
  };
}

export function planDeviceImport(
  prepared: PreparedDeviceContact,
  selection?: { email: string; phone: string },
): DeviceImportPlan {
  if (prepared.needsChoice && !selection) return { kind: 'choose' };
  const draft = deviceContactDraft({
    name: prepared.name,
    email: selection?.email ?? prepared.emails[0]?.value ?? '',
    phone: selection?.phone ?? prepared.phones[0]?.value ?? '',
  });
  const normalized = normalizeContactDraft(draft);
  if ('error' in normalized) {
    return {
      kind: 'form',
      draft,
      held: normalized.error === 'Enter a contact name' ? 'name' : 'invalid',
    };
  }
  return { kind: 'save', draft };
}

export function isDuplicateContactEmailError(error: unknown): boolean {
  return errorMessage(error, '').toLowerCase().includes('email already exists');
}

export function deviceContactFormParams(
  draft: ContactDraft,
  held: DeviceContactHold,
): { draftName: string; draftEmail: string; draftPhone: string; held: DeviceContactHold } {
  return {
    draftName: draft.name,
    draftEmail: draft.email,
    draftPhone: draft.phone,
    held,
  };
}

let stagedDeviceContact: PreparedDeviceContact | null = null;

export function stageDeviceContact(value: PreparedDeviceContact): void {
  stagedDeviceContact = value;
}

export function peekDeviceContact(): PreparedDeviceContact | null {
  return stagedDeviceContact;
}

export function clearDeviceContact(): void {
  stagedDeviceContact = null;
}
