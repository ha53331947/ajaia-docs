'use client';

import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onContentImport: (importedText: string, fileName: string) => void;
}

export default function FileUpload({ onContentImport }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file extension (.txt or .md)
    const validExtensions = ['text/plain', 'text/markdown', ''];
    const isTxtOrMd = file.name.endsWith('.txt') || file.name.endsWith('.md');

    if (!isTxtOrMd && !validExtensions.includes(file.type)) {
      alert('Please upload a .txt or .md file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        // Strip extension for clean title
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        onContentImport(text, cleanName);
      }
    };
    reader.readAsText(file);

    // Reset input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".txt,.md"
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition shadow-sm"
      >
        <Upload className="w-4 h-4 text-gray-500" />
        <span>Import File (.txt / .md)</span>
      </button>
    </div>
  );
}