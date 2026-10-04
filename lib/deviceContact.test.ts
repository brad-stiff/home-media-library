import { describe, expect, it } from 'vitest';

import {
  deviceContactFormParams,
  deviceValueLabel,
  isDuplicateContactEmailError,
  planDeviceImport,
  prepareDeviceContact,
} from './deviceContact';

const ada = {
  fullName: 'Ada Lovelace',
  givenName: 'Ada',
  middleName: null,
  familyName: 'Lovelace',
  company: null,
  emails: [{ label: 'home', address: 'ada@example.com' }],
  phones: [{ label: 'mobile', number: '555-0100' }],
};

describe('prepareDeviceContact', () => {
  it('uses the full name and keeps a single email and phone', () => {
    expect(prepareDeviceContact(ada)).toEqual({
      name: 'Ada Lovelace',
      emails: [{ label: 'home', value: 'ada@example.com' }],
      phones: [{ label: 'mobile', value: '555-0100' }],
      needsChoice: false,
    });
  });

  it('falls back to given, middle, and family, then company', () => {
    expect(
      prepareDeviceContact({
        ...ada,
        fullName: '  ',
        middleName: 'King',
      }).name,
    ).toBe('Ada King Lovelace');

    expect(
      prepareDeviceContact({
        ...ada,
        fullName: '',
        givenName: null,
        familyName: null,
        company: 'Analytical Engines',
      }).name,
    ).toBe('Analytical Engines');
  });

  it('drops blanks and duplicate emails, and asks for a choice when several remain', () => {
    const prepared = prepareDeviceContact({
      ...ada,
      emails: [
        { label: 'home', address: ' Ada@Example.com ' },
        { label: 'work', address: 'ada@example.com' },
        { label: 'other', address: '  ' },
        { label: 'work', address: 'ada.work@example.com' },
      ],
      phones: [
        { label: 'mobile', number: '555-0100' },
        { label: 'home', number: '555-0199' },
      ],
    });

    expect(prepared.emails).toEqual([
      { label: 'home', value: 'Ada@Example.com' },
      { label: 'work', value: 'ada.work@example.com' },
    ]);
    expect(prepared.phones).toHaveLength(2);
    expect(prepared.needsChoice).toBe(true);
  });
});

describe('planDeviceImport', () => {
  it('saves immediately when there is nothing to choose, with SMS off', () => {
    expect(planDeviceImport(prepareDeviceContact(ada))).toEqual({
      kind: 'save',
      draft: {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '555-0100',
        smsReminders: false,
      },
    });
  });

  it('waits for a choice, then saves the selected email and phone', () => {
    const prepared = prepareDeviceContact({
      ...ada,
      emails: [
        { label: 'home', address: 'ada@example.com' },
        { label: 'work', address: 'ada.work@example.com' },
      ],
      phones: [{ label: 'mobile', number: '555-0100' }],
    });

    expect(planDeviceImport(prepared)).toEqual({ kind: 'choose' });
    expect(
      planDeviceImport(prepared, { email: 'ada.work@example.com', phone: '555-0100' }),
    ).toMatchObject({
      kind: 'save',
      draft: { email: 'ada.work@example.com', phone: '555-0100', smsReminders: false },
    });
  });

  it('opens the form when the phone contact has no name or the email cannot be saved', () => {
    expect(
      planDeviceImport(
        prepareDeviceContact({
          ...ada,
          fullName: '',
          givenName: null,
          familyName: null,
          company: null,
        }),
      ),
    ).toMatchObject({ kind: 'form', held: 'name' });

    expect(
      planDeviceImport(
        prepareDeviceContact({
          ...ada,
          emails: [{ label: 'home', address: 'not-an-email' }],
        }),
      ),
    ).toMatchObject({ kind: 'form', held: 'invalid' });
  });
});

describe('device contact helpers', () => {
  it('labels a phone or email value', () => {
    expect(deviceValueLabel('mobile', '555-0100')).toBe('Mobile · 555-0100');
    expect(deviceValueLabel('', 'ada@example.com')).toBe('ada@example.com');
  });

  it('recognizes the duplicate-email error and builds form params', () => {
    expect(isDuplicateContactEmailError(new Error('A contact with that email already exists'))).toBe(true);
    expect(isDuplicateContactEmailError(new Error('Enter a contact name'))).toBe(false);
    expect(
      deviceContactFormParams(
        { name: 'Ada', email: 'ada@example.com', phone: '', smsReminders: false },
        'email',
      ),
    ).toEqual({
      draftName: 'Ada',
      draftEmail: 'ada@example.com',
      draftPhone: '',
      held: 'email',
    });
  });
});
