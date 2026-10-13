// Pure helpers (no React, no Supabase) so they are easy to unit test.

export const DEFAULT_TITLE = 'Untitled Document';
export const MAX_TITLE_LENGTH = 120;
export const MAX_IMPORT_CHARS = 500_000;

export type Access = 'owner' | 'editor' | 'viewer';
export type ShareRole = 'editor' | 'viewer';

/* ---------- Text / HTML ---------- */

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Plain text -> editor HTML. Blank lines split paragraphs, single newlines become <br/>.
export const textToHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('') || '<p></p>';

/* ---------- Rename ---------- */

// Collapse whitespace, trim, cap the length, and fall back to the default title.
export function normalizeTitle(raw: string | null | undefined): string {
  const cleaned = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH).trim();
  return cleaned || DEFAULT_TITLE;
}

/* ---------- Permissions ---------- */

export const canEditDoc = (access: Access) => access === 'owner' || access === 'editor';

export const normalizeRole = (role: string): ShareRole =>
  String(role).toLowerCase() === 'editor' ? 'editor' : 'viewer';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ShareCheck =
  | { ok: true; email: string; role: ShareRole }
  | { ok: false; title: string; message: string };

export function validateShare(input: {
  email: string;
  role: string;
  currentUser: string | null;
  access: Access;
  knownUsers: string[];
}): ShareCheck {
  const { email, role, currentUser, access, knownUsers } = input;

  if (access !== 'owner') {
    return { ok: false, title: 'Only the owner can share', message: 'Ask the document owner to share it.' };
  }

  const clean = email.trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) {
    return { ok: false, title: 'Invalid email', message: 'Enter an address like name@ajaia.com.' };
  }
  if (clean === (currentUser ?? '').toLowerCase()) {
    return { ok: false, title: 'That is you', message: 'You already own this document.' };
  }
  if (!knownUsers.map((u) => u.toLowerCase()).includes(clean)) {
    return { ok: false, title: 'User not found', message: `Demo users: ${knownUsers.join(', ')}` };
  }

  return { ok: true, email: clean, role: normalizeRole(role) };
}

/* ---------- Import ---------- */

export type ImportCheck = { ok: true } | { ok: false; title: string; message: string };

export function validateImport(text: string | null | undefined): ImportCheck {
  if (!text || !text.trim()) {
    return { ok: false, title: 'File is empty', message: 'There is nothing to import.' };
  }
  if (text.length > MAX_IMPORT_CHARS) {
    return { ok: false, title: 'File is too large', message: 'The limit is about 500 KB of text.' };
  }
  return { ok: true };
}