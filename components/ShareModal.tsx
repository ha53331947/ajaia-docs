'use client';

import React, { useState } from 'react';
import { Share2, X, Users } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  onShare: (email: string, role: string) => void;
  sharedList?: { email: string; role: string }[];
}

export default function ShareModal({
  isOpen,
  onClose,
  documentTitle,
  onShare,
  sharedList = [],
}: ShareModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    onShare(email.trim(), role);
    setEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Share2 className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Share "{documentTitle}"
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Add user by email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                placeholder="colleague@ajaia.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="px-2 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 outline-none"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md text-sm transition shadow-sm"
          >
            Grant Access
          </button>
        </form>

        {sharedList.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
              <Users className="w-3.5 h-3.5" />
              <span>People with access</span>
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {sharedList.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded bg-gray-50"
                >
                  <span className="text-gray-700 font-medium">{item.email}</span>
                  <span className="capitalize text-gray-500 bg-gray-200 px-2 py-0.5 rounded text-[10px]">
                    {item.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}