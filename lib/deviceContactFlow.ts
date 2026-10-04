import { Alert } from 'react-native';

import { ContactDraft } from './contactRules';
import {
  DeviceContactHold,
  deviceContactFormParams,
  isDuplicateContactEmailError,
} from './deviceContact';
import { errorMessage } from './householdRules';
import { saveContact } from './contacts';

type ImportRouter = {
  push: (href: { pathname: '/contacts/edit'; params: ReturnType<typeof deviceContactFormParams> }) => void;
  replace: (href: { pathname: '/contacts/edit'; params: ReturnType<typeof deviceContactFormParams> }) => void;
};

export async function finishDeviceContactImport(
  draft: ContactDraft,
  router: ImportRouter,
  showToast: (message: string) => void,
  options?: { replaceForm?: boolean },
): Promise<'saved' | 'form' | 'failed'> {
  try {
    const saved = await saveContact(null, draft);
    showToast(saved.linkedUserId ? 'Contact saved and linked to an account' : 'Contact saved');
    return 'saved';
  } catch (error) {
    if (isDuplicateContactEmailError(error)) {
      openDeviceContactForm(router, draft, 'email', options?.replaceForm);
      return 'form';
    }
    Alert.alert('Could not save contact', errorMessage(error, 'Try again.'));
    return 'failed';
  }
}

export function openDeviceContactForm(
  router: ImportRouter,
  draft: ContactDraft,
  held: DeviceContactHold,
  replace = false,
): void {
  const href = { pathname: '/contacts/edit' as const, params: deviceContactFormParams(draft, held) };
  if (replace) router.replace(href);
  else router.push(href);
}
