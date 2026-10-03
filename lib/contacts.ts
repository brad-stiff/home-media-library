import { ContactDraft, normalizeContactDraft } from './contactRules';
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

type ContactRow = {
  id: string;
  household_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  sms_reminders: boolean;
  linked_user_id: string | null;
  app_invited_at: string | null;
  created_at: string;
  updated_at: string;
};

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
  const { data, error } = await supabase.from('contacts').select('*').order('name', { ascending: true });
  if (error) throw error;
  return ((data as ContactRow[]) ?? []).map(rowToContact);
}

export async function getContact(id: string): Promise<Contact | null> {
  const { data, error } = await supabase.from('contacts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToContact(data as ContactRow) : null;
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
  return rowToContact(data as ContactRow);
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_contact', { p_contact_id: id });
  if (error) throw error;
}

export async function markContactAppInvite(id: string): Promise<Contact> {
  const { data, error } = await supabase.rpc('mark_contact_app_invite', { p_contact_id: id });
  if (error) throw error;
  return rowToContact(data as ContactRow);
}
