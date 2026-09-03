export interface Document {
  id: string;
  title: string;
  content: string;
  owner_email: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentShare {
  id: string;
  document_id: string;
  shared_with_email: string;
  role: 'editor' | 'viewer';
  created_at: string;
}