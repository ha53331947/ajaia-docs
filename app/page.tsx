'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@/components/Editor';
import FileUpload from '@/components/FileUpload';
import ShareModal from '@/components/ShareModal';
import { ToastProvider, useToast } from '@/components/Toast';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_TITLE,
  MAX_TITLE_LENGTH,
  canEditDoc,
  normalizeRole,
  normalizeTitle,
  textToHtml,
  validateImport,
  validateShare,
  type Access,
} from '@/lib/docUtils';
import { Share2, FileText, Plus, Users, Pencil } from 'lucide-react';

// Seeded demo users (mocked auth). Reviewers switch between them from the header.
const USERS = ['alice@ajaia.com', 'bob@ajaia.com'];

type DocRow = {
  id: string;
  title: string;
  content: string;
  owner_email: string;
  updated_at: string;
};
type DocItem = DocRow & { access: Access };
type SaveState = 'saved' | 'saving' | 'error';

const errText = (err: any) => String(err?.message || err || 'Unknown error');

function Home() {
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>('owner');
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [content, setContent] = useState('<p></p>');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [sharedUsers, setSharedUsers] = useState<{ email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // true only after the user actually edits (so opening a doc never triggers a save)
  const dirty = useRef(false);
  // rename helpers
  const titleBeforeEdit = useRef(DEFAULT_TITLE);
  const cancelRename = useRef(false);
  // so a failing autosave shows one toast, not one per keystroke
  const lastSaveFailed = useRef(false);

  const canEdit = canEditDoc(access);

  // ---------- Data helpers ----------

  const fetchDocs = useCallback(async (user: string): Promise<DocItem[]> => {
    const { data: owned, error: e1 } = await supabase
      .from('documents')
      .select('*')
      .eq('owner_email', user);
    if (e1) throw e1;

    const { data: shares, error: e2 } = await supabase
      .from('document_shares')
      .select('document_id, role')
      .eq('shared_with_email', user);
    if (e2) throw e2;

    let shared: DocItem[] = [];
    if (shares && shares.length > 0) {
      const roleById = new Map<string, Access>(
        shares.map((s: any) => [s.document_id, normalizeRole(s.role)])
      );
      const { data: sharedDocs, error: e3 } = await supabase
        .from('documents')
        .select('*')
        .in('id', Array.from(roleById.keys()));
      if (e3) throw e3;
      shared = (sharedDocs || []).map((d: DocRow) => ({
        ...d,
        access: roleById.get(d.id) || 'viewer',
      }));
    }

    const all: DocItem[] = [
      ...(owned || []).map((d: DocRow) => ({ ...d, access: 'owner' as Access })),
      ...shared,
    ];
    return all.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }, []);

  const loadShares = useCallback(
    async (docId: string) => {
      const { data, error } = await supabase
        .from('document_shares')
        .select('shared_with_email, role')
        .eq('document_id', docId);
      if (error) {
        toast.error('Could not load sharing info', error.message);
        return;
      }
      setSharedUsers(
        (data || []).map((s: any) => ({ email: s.shared_with_email, role: s.role }))
      );
    },
    [toast]
  );

  const saveNow = async (id: string, t: string, c: string) => {
    setSaveState('saving');
    const cleanTitle = normalizeTitle(t);
    const { error } = await supabase
      .from('documents')
      .update({ title: cleanTitle, content: c, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('Save failed:', error);
      setSaveState('error');
      if (!lastSaveFailed.current) {
        toast.error('Changes not saved', 'Check your connection and try again.');
      }
      lastSaveFailed.current = true;
      return false;
    }
    lastSaveFailed.current = false;
    dirty.current = false;
    setSaveState('saved');
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title: cleanTitle, content: c } : d))
    );
    return true;
  };

  const openDoc = useCallback(
    async (id: string, accessLevel: Access) => {
      // always read the freshest version from the DB
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) {
        toast.error('Could not open document', error?.message || 'Document not found.');
        return;
      }
      dirty.current = false;
      lastSaveFailed.current = false;
      setActiveId(id);
      setAccess(accessLevel);
      setTitle(data.title || DEFAULT_TITLE);
      setContent(data.content || '<p></p>');
      setSaveState('saved');
      setSharedUsers([]);
      if (accessLevel === 'owner') loadShares(id);
    },
    [loadShares, toast]
  );

  // ---------- Effects ----------

  // restore the chosen user
  useEffect(() => {
    let user = USERS[0];
    try {
      const saved = localStorage.getItem('ajaia_user');
      if (saved && USERS.includes(saved)) user = saved;
    } catch {}
    setCurrentUser(user);
  }, []);

  // (re)load documents whenever the user changes
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setActiveId(null);
      dirty.current = false;
      try {
        const list = await fetchDocs(currentUser);
        if (cancelled) return;
        setDocs(list);
        if (list.length > 0) await openDoc(list[0].id, list[0].access);
      } catch (err: any) {
        if (!cancelled) toast.error('Could not load documents', errText(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, fetchDocs, openDoc, toast]);

  // debounced autosave
  useEffect(() => {
    if (!activeId || !canEdit || !dirty.current) return;
    setSaveState('saving');
    const timer = setTimeout(() => {
      saveNow(activeId, title, content);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, activeId, canEdit]);

  // ---------- Handlers ----------

  const flushPending = async () => {
    if (activeId && canEdit && dirty.current) {
      await saveNow(activeId, title, content);
    }
  };

  const switchUser = async (user: string) => {
    await flushPending();
    try {
      localStorage.setItem('ajaia_user', user);
    } catch {}
    setCurrentUser(user);
  };

  const selectDoc = async (d: DocItem) => {
    if (d.id === activeId) return;
    await flushPending();
    await openDoc(d.id, d.access);
  };

  const createDoc = async (newTitle: string, html: string): Promise<boolean> => {
    if (!currentUser) return false;
    await flushPending();
    const { data, error } = await supabase
      .from('documents')
      .insert([{ title: normalizeTitle(newTitle), content: html, owner_email: currentUser }])
      .select()
      .single();
    if (error || !data) {
      toast.error('Could not create document', error?.message || 'Unknown error.');
      return false;
    }
    try {
      setDocs(await fetchDocs(currentUser));
    } catch {}
    await openDoc(data.id, 'owner');
    return true;
  };

  const handleNew = () => {
    createDoc(DEFAULT_TITLE, '<p></p>');
  };

  // Import always creates a NEW document (never overwrites) and escapes the file text.
  const handleImport = async (text: string, fileTitle: string) => {
    const check = validateImport(text);
    if (!check.ok) {
      toast.error(check.title, check.message);
      return;
    }
    const name = normalizeTitle(fileTitle?.trim() || 'Imported Document');
    const ok = await createDoc(name, textToHtml(text));
    if (ok) toast.success('File imported', `Created “${name}” as a new document.`);
  };

  // ----- Rename -----

  const syncSidebarTitle = (id: string, t: string) =>
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, title: t } : d)));

  const handleTitleChange = (v: string) => {
    if (!canEdit || !activeId) return;
    dirty.current = true;
    setTitle(v);
    syncSidebarTitle(activeId, v || DEFAULT_TITLE); // sidebar updates while typing
  };

  const handleTitleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    titleBeforeEdit.current = title;
    cancelRename.current = false;
    e.currentTarget.select();
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      cancelRename.current = true;
      setTitle(titleBeforeEdit.current);
      if (activeId) syncSidebarTitle(activeId, titleBeforeEdit.current);
      e.currentTarget.blur();
    }
  };

  const commitTitle = async () => {
    if (cancelRename.current) {
      cancelRename.current = false;
      return;
    }
    if (!activeId || !canEdit) return;
    const clean = normalizeTitle(title);
    if (clean !== title) setTitle(clean); // trims spaces / empty -> "Untitled Document"
    syncSidebarTitle(activeId, clean);
    if (clean === normalizeTitle(titleBeforeEdit.current)) return; // nothing changed
    const ok = await saveNow(activeId, clean, content);
    if (ok) toast.success('Document renamed', `Now called “${clean}”.`);
  };

  const handleContentChange = (html: string) => {
    if (!canEdit || html === content) return;
    dirty.current = true;
    setContent(html);
  };

  const handleShare = async (email: string, role: string) => {
    if (!activeId) return;

    const check = validateShare({
      email,
      role,
      currentUser,
      access,
      knownUsers: USERS,
    });
    if (!check.ok) {
      toast.error(check.title, check.message);
      return;
    }

    // make sure the latest content exists in the DB before sharing
    await flushPending();

    const exists = sharedUsers.some((u) => u.email.toLowerCase() === check.email);
    const { error } = exists
      ? await supabase
          .from('document_shares')
          .update({ role: check.role })
          .eq('document_id', activeId)
          .eq('shared_with_email', check.email)
      : await supabase
          .from('document_shares')
          .insert([{ document_id: activeId, shared_with_email: check.email, role: check.role }]);

    if (error) {
      toast.error('Could not share', error.message);
      return;
    }
    await loadShares(activeId);
    toast.success(
      exists ? 'Access updated' : 'Document shared',
      `${check.email} can now ${check.role === 'editor' ? 'edit' : 'view'} this document.`
    );
  };

  // ---------- UI ----------

  const owned = docs.filter((d) => d.access === 'owner');
  const sharedWithMe = docs.filter((d) => d.access !== 'owner');

  const statusText =
    saveState === 'saving'
      ? 'Saving changes...'
      : saveState === 'error'
      ? 'Save failed - check your connection'
      : !canEdit
      ? 'View only'
      : 'All changes saved to Supabase';

  const DocButton = ({ d }: { d: DocItem }) => (
    <button
      onClick={() => selectDoc(d)}
      className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 transition ${
        d.id === activeId ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
      }`}
    >
      <span className="truncate">{d.title || DEFAULT_TITLE}</span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
          d.access === 'owner'
            ? 'bg-green-100 text-green-700'
            : 'bg-amber-100 text-amber-700'
        }`}
      >
        {d.access === 'owner' ? 'Owned' : `Shared · ${d.access}`}
      </span>
    </button>
  );

  const renameEnabled = !!activeId && canEdit;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="group flex items-center gap-1.5">
              <input
                type="text"
                value={title}
                disabled={!renameEnabled}
                maxLength={MAX_TITLE_LENGTH}
                onChange={(e) => handleTitleChange(e.target.value)}
                onFocus={handleTitleFocus}
                onBlur={commitTitle}
                onKeyDown={handleTitleKeyDown}
                aria-label="Document title (click to rename)"
                title={renameEnabled ? 'Click to rename. Enter to save, Esc to cancel.' : undefined}
                className="-mx-1.5 w-56 max-w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-base font-semibold text-gray-800 outline-none transition enabled:hover:border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-70"
                placeholder="Document Title"
              />
              {renameEnabled && (
                <Pencil
                  className="h-3.5 w-3.5 text-gray-300 transition group-hover:text-gray-500"
                  aria-hidden="true"
                />
              )}
            </div>
            <p
              className={`text-xs ${
                saveState === 'error' ? 'text-red-500' : 'text-gray-400'
              }`}
            >
              {activeId ? statusText : 'No document open'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <FileUpload onContentImport={handleImport} />

          {activeId && access === 'owner' && (
            <button
              onClick={() => setIsShareOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-md transition shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          )}

          <div className="flex items-center gap-2 border border-gray-200 rounded-full pl-2 pr-1 py-0.5 bg-white">
            <Users className="w-4 h-4 text-blue-600" />
            <select
              value={currentUser || ''}
              onChange={(e) => switchUser(e.target.value)}
              className="text-xs text-gray-700 bg-transparent outline-none py-1"
              aria-label="Switch user"
            >
              {USERS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        <aside className="w-64 bg-white border-r border-gray-200 p-4 space-y-4 hidden md:block">
          <button
            onClick={handleNew}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-md transition"
          >
            <Plus className="w-4 h-4" /> New Document
          </button>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">My Documents</p>
            {owned.length === 0 && (
              <p className="text-xs text-gray-400 px-1">No documents yet.</p>
            )}
            {owned.map((d) => (
              <DocButton key={d.id} d={d} />
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Shared with me</p>
            {sharedWithMe.length === 0 && (
              <p className="text-xs text-gray-400 px-1">Nothing shared with you.</p>
            )}
            {sharedWithMe.map((d) => (
              <DocButton key={d.id} d={d} />
            ))}
          </div>
        </aside>

        <main className="flex-1 max-w-5xl w-full mx-auto p-6">
          {loading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : activeId ? (
            <>
              {!canEdit && (
                <div className="mb-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-md">
                  You have view-only access to this document (owner: {docs.find((d) => d.id === activeId)?.owner_email}).
                </div>
              )}
              <div className={canEdit ? '' : 'pointer-events-none select-text opacity-90'}>
                <Editor key={activeId} content={content} onChange={handleContentChange} />
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 mt-24">
              <p className="mb-4">You have no open document.</p>
              <button
                onClick={handleNew}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md"
              >
                Create your first document
              </button>
            </div>
          )}
        </main>
      </div>

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        documentTitle={title}
        onShare={handleShare}
        sharedList={sharedUsers}
      />
    </div>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <Home />
    </ToastProvider>
  );
}