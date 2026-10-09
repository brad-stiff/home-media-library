export const CONTACT_NAME_MAX = 80;
export const CONTACT_EMAIL_MAX = 254;
export const CONTACT_PHONE_MAX = 40;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactDraft = {
  name: string;
  email: string;
  phone: string;
  smsReminders: boolean;
};

export type NormalizedContact = {
  name: string;
  email: string | null;
  phone: string | null;
  smsReminders: boolean;
};

/** Client-side mirror of save_contact. The database remains the source of truth. */
export function normalizeContactDraft(
  draft: ContactDraft,
): { value: NormalizedContact } | { error: string } {
  const name = draft.name.trim().replace(/\s+/g, ' ');
  const email = draft.email.trim().toLowerCase() || null;
  const phone = draft.phone.trim() || null;

  if (!name) return { error: 'Enter a contact name' };
  if (name.length > CONTACT_NAME_MAX) return { error: 'Contact name is too long' };
  if (email && !EMAIL_PATTERN.test(email)) {
    return { error: 'Enter a valid email or leave it blank' };
  }
  if (email && email.length > CONTACT_EMAIL_MAX) return { error: 'Email is too long' };
  if (phone && phone.length > CONTACT_PHONE_MAX) return { error: 'Phone number is too long' };

  return {
    value: {
      name,
      email,
      phone,
      smsReminders: Boolean(phone) && draft.smsReminders,
    },
  };
}

/** Share-sheet copy. This is an account invite, never a household join code. */
export function appInviteMessage(email: string): string {
  return `Create an Alcove account using ${email}. This does not add you to a household. Joining a home still uses that home's invite code.`;
}
