'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from 'lucide-react';
import type { ReactNode } from 'react';

interface EditorProps {
  content: string;
  onChange: (newContent: string) => void;
  editable?: boolean;
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`h-8 w-8 flex items-center justify-center rounded-md transition disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <div className="w-px h-5 bg-gray-200 mx-1" />;

export default function Editor({ content, onChange, editable = true }: EditorProps) {
  // Note: StarterKit in Tiptap v3 already includes Underline.
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return <div className="p-4 text-gray-400">Loading editor...</div>;
  }

  return (
    <div className="w-full">
      {editable && (
        <div className="sticky top-0 z-10 mb-4 flex items-center gap-0.5 flex-wrap px-2 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm w-fit mx-auto">
          <ToolbarButton
            title="Undo (Ctrl+Z)"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Redo (Ctrl+Y)"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo2 className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            title="Bold (Ctrl+B)"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic (Ctrl+I)"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Underline (Ctrl+U)"
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            title="Heading 1"
            active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 2"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            title="Bulleted list"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
        </div>
      )}

      {/* The "paper" */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-12 py-10 min-h-[480px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}