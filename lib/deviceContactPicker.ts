import { Contact } from 'expo-contacts';

import { DeviceContactFields } from './deviceContact';

/** System picker only. Returns null when the person cancels. Does not write to the phone. */
export async function pickDeviceContactFields(): Promise<DeviceContactFields | null> {
  const contact = await Contact.presentPicker();
  if (!contact) return null;

  const [fullName, givenName, middleName, familyName, company, emails, phones] = await Promise.all([
    contact.getFullName(),
    contact.getGivenName(),
    contact.getMiddleName(),
    contact.getFamilyName(),
    contact.getCompany(),
    contact.getEmails(),
    contact.getPhones(),
  ]);

  return { fullName, givenName, middleName, familyName, company, emails, phones };
}
