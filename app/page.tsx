'use client';

import React, { useState, useEffect } from 'react';
import Editor from '@/components/Editor';
import FileUpload from '@/components/FileUpload';
import ShareModal from '@/components/ShareModal';
import { supabase } from '@/lib/supabase';
import { Share2, FileText, User, Save } from 'lucide-react';

export default function Home() {
  const [docId, setDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('Untitled Document');
  const [content, setContent] = useState('<h1>Welcome to Ajaia Docs</h1><p>Start typing or edit this text to test the formatting options above!</p>');
  const [isSaving, setIsSaving] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [sharedUsers, setSharedUsers] = useState<{ email: string; role: string }[]>([]);

  // Database Auto-Save Logic
  const saveToSupabase = async (newTitle: string, newContent: string) => {
    setIsSaving(true);
    try {
      if (!docId) {
        // Direct Insert
        const { data, error } = await supabase
          .from('documents')
          .insert([{ title: newTitle, content: newContent, owner_email: 'demo@ajaia.com' }])
          .select()
          .single();

        if (data && !error) setDocId(data.id);
      } else {
        // Update existing record
        await supabase
          .from('documents')
          .update({ title: newTitle, content: newContent, updated_at: new Date() })
          .eq('id', docId);
      }
    } catch (err) {
      console.error('Error saving to Supabase:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced Auto-save (1 second delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content || docTitle) {
        saveToSupabase(docTitle, content);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [content, docTitle]);

  const handleImport = (text: string, title: string) => {
    const formattedHtml = `<p>${text.replace(/\n/g, '<br/>')}</p>`;
    setContent(formattedHtml);
    setDocTitle(title);
  };

  const handleShare = async (email: string, role: string) => {
    setSharedUsers((prev) => [...prev, { email, role }]);
    if (docId) {
      await supabase
        .from('document_shares')
        .insert([{ document_id: docId, shared_with_email: email, role }]);
    }
    alert(`Access granted to ${email} as ${role}!`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Top Header Navbar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              className="font-semibold text-gray-800 text-base outline-none focus:border-b-2 focus:border-blue-500 bg-transparent"
              placeholder="Document Title"
            />
            <p className="text-xs text-gray-400 flex items-center gap-1">
              {isSaving ? <Save className="w-3 h-3 animate-spin text-blue-500" /> : null}
              {isSaving ? 'Saving changes...' : 'All changes saved to Supabase'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <FileUpload onContentImport={handleImport} />
          
          <button
            onClick={() => setIsShareOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-md transition shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>

          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6">
        <Editor
          content={content}
          onChange={(newHtml) => setContent(newHtml)}
        />
      </main>

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        documentTitle={docTitle}
        onShare={handleShare}
        sharedList={sharedUsers}
      />
    </div>
  );
}