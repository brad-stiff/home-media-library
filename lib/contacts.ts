import { ContactDraft, normalizeContactDraft } from './contactRules';
import { Tables } from './database.types';
import { pageAll } from './pageAll';
import { supabase } from './supabase';

export type Contact = {
  id: string;
  householdId: string;
  name: string;
  email: string | null;
  phone: string | null;
  smsReminders: boolean;
  linkedUserId: string | null;
  appInvitedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ContactRow = Tables<'contacts'>;

function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    smsReminders: row.sms_reminders,
    linkedUserId: row.linked_user_id,
    appInvitedAt: row.app_invited_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listContacts(): Promise<Contact[]> {
  const rows = await pageAll((from, to) =>
    supabase
      .from('contacts')
      .select('*')
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  );
  return rows.map(rowToContact);
}

export async function getContact(id: string): Promise<Contact | null> {
  const { data, error } = await supabase.from('contacts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToContact(data) : null;
}

export async function saveContact(id: string | null, draft: ContactDraft): Promise<Contact> {
  const normalized = normalizeContactDraft(draft);
  if ('error' in normalized) throw new Error(normalized.error);

  const { data, error } = await supabase.rpc('save_contact', {
    p_contact_id: id,
    p_name: normalized.value.name,
    p_email: normalized.value.email,
    p_phone: normalized.value.phone,
    p_sms_reminders: normalized.value.smsReminders,
  });
  if (error) throw error;
  if (!data) throw new Error('Could not save this contact.');
  return rowToContact(data);
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_contact', { p_contact_id: id });
  if (error) throw error;
}

export async function markContactAppInvite(id: string): Promise<Contact> {
  const { data, error } = await supabase.rpc('mark_contact_app_invite', { p_contact_id: id });
  if (error) throw error;
  if (!data) throw new Error('Could not invite this contact.');
  return rowToContact(data);
}
