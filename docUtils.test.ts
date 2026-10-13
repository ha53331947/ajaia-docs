import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TITLE,
  MAX_IMPORT_CHARS,
  MAX_TITLE_LENGTH,
  canEditDoc,
  escapeHtml,
  normalizeRole,
  normalizeTitle,
  textToHtml,
  validateImport,
  validateShare,
} from './lib/docUtils';
const USERS = ['alice@ajaia.com', 'bob@ajaia.com'];

const share = (over: Partial<Parameters<typeof validateShare>[0]> = {}) =>
  validateShare({
    email: 'bob@ajaia.com',
    role: 'viewer',
    currentUser: 'alice@ajaia.com',
    access: 'owner',
    knownUsers: USERS,
    ...over,
  });

describe('permissions', () => {
  it('lets owners and editors edit, but not viewers', () => {
    expect(canEditDoc('owner')).toBe(true);
    expect(canEditDoc('editor')).toBe(true);
    expect(canEditDoc('viewer')).toBe(false);
  });

  it('treats any unknown role as viewer (least privilege)', () => {
    expect(normalizeRole('Editor')).toBe('editor');
    expect(normalizeRole('admin')).toBe('viewer');
    expect(normalizeRole('')).toBe('viewer');
  });
});

describe('validateShare', () => {
  it('accepts a valid share and normalizes the email', () => {
    const r = share({ email: '  BOB@ajaia.com ', role: 'Editor' });
    expect(r).toEqual({ ok: true, email: 'bob@ajaia.com', role: 'editor' });
  });

  it('defaults to viewer for an unexpected role', () => {
    const r = share({ role: 'superuser' });
    expect(r.ok && r.role).toBe('viewer');
  });

  it('blocks non-owners from sharing', () => {
    expect(share({ access: 'viewer' }).ok).toBe(false);
    expect(share({ access: 'editor' }).ok).toBe(false);
  });

  it('rejects malformed emails', () => {
    expect(share({ email: 'not-an-email' }).ok).toBe(false);
    expect(share({ email: '' }).ok).toBe(false);
  });

  it('rejects sharing with yourself', () => {
    const r = share({ email: 'alice@ajaia.com' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.title).toBe('That is you');
  });

  it('rejects users that are not in the demo list', () => {
    const r = share({ email: 'eve@ajaia.com' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('alice@ajaia.com');
  });
});

describe('normalizeTitle (rename)', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeTitle('   Q3   plan  ')).toBe('Q3 plan');
  });

  it('falls back to the default for empty input', () => {
    expect(normalizeTitle('')).toBe(DEFAULT_TITLE);
    expect(normalizeTitle('    ')).toBe(DEFAULT_TITLE);
    expect(normalizeTitle(null)).toBe(DEFAULT_TITLE);
  });

  it('caps very long titles', () => {
    expect(normalizeTitle('a'.repeat(500)).length).toBe(MAX_TITLE_LENGTH);
  });
});

describe('import', () => {
  it('escapes HTML so imported text cannot inject markup', () => {
    expect(escapeHtml('<script>alert("x")</script>')).not.toContain('<script>');
    expect(textToHtml('<img src=x onerror=alert(1)>')).not.toContain('<img');
  });

  it('turns blank lines into paragraphs and single newlines into <br/>', () => {
    expect(textToHtml('one\ntwo\n\nthree')).toBe('<p>one<br/>two</p><p>three</p>');
  });

  it('returns an empty paragraph for blank text', () => {
    expect(textToHtml('\n\n\n')).toBe('<p></p>');
  });

  it('rejects empty and oversized files', () => {
    expect(validateImport('   ').ok).toBe(false);
    expect(validateImport(undefined).ok).toBe(false);
    expect(validateImport('x'.repeat(MAX_IMPORT_CHARS + 1)).ok).toBe(false);
    expect(validateImport('hello').ok).toBe(true);
  });
});