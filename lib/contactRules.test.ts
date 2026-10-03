import { describe, expect, it } from 'vitest';

import { appInviteMessage, normalizeContactDraft } from './contactRules';

describe('normalizeContactDraft', () => {
  it('requires a name and keeps email and phone optional', () => {
    expect(
      normalizeContactDraft({ name: '  ', email: '', phone: '', smsReminders: false }),
    ).toEqual({ error: 'Enter a contact name' });

    expect(
      normalizeContactDraft({ name: '  Ada   Lovelace ', email: '  ', phone: '  ', smsReminders: true }),
    ).toEqual({
      value: { name: 'Ada Lovelace', email: null, phone: null, smsReminders: false },
    });
  });

  it('lowercases email and turns SMS off unless a phone is saved', () => {
    expect(
      normalizeContactDraft({
        name: 'Ada',
        email: ' Ada@Example.com ',
        phone: '',
        smsReminders: true,
      }),
    ).toEqual({
      value: { name: 'Ada', email: 'ada@example.com', phone: null, smsReminders: false },
    });

    expect(
      normalizeContactDraft({
        name: 'Ada',
        email: '',
        phone: ' 555-0100 ',
        smsReminders: true,
      }),
    ).toEqual({
      value: { name: 'Ada', email: null, phone: '555-0100', smsReminders: true },
    });
  });

  it('rejects an email that cannot be matched exactly', () => {
    expect(
      normalizeContactDraft({ name: 'Ada', email: 'not-an-email', phone: '', smsReminders: false }),
    ).toEqual({ error: 'Enter a valid email or leave it blank' });
  });
});

describe('appInviteMessage', () => {
  it('invites the email to create an account and does not carry a household code', () => {
    const message = appInviteMessage('ada@example.com');
    expect(message).toContain('ada@example.com');
    expect(message).toContain('does not add you to a household');
    expect(message).not.toMatch(/[A-Z0-9]{6}/);
  });
});
