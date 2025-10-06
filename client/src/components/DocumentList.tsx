import React from 'react';

interface Document {
  id: string;
  name: string;
  uploadedAt: string;
}

interface Props {
  documents: Document[];
  activeDocumentId: string | null;
  onDocumentSelect: (id: string) => void;
}

export default function DocumentList({ documents, activeDocumentId, onDocumentSelect }: Props) {
  if (documents.length === 0) {
    return (
      <div className="documents-list">
        <div className="empty-state">No documents yet. Upload one to get started!</div>
      </div>
    );
  }

  return (
    <div className="documents-list">
      {documents.map(doc => (
        <div
          key={doc.id}
          className={`document-item ${doc.id === activeDocumentId ? 'active' : ''}`}
          onClick={() => onDocumentSelect(doc.id)}
        >
          <h3>{doc.name}</h3>
          <p>{new Date(doc.uploadedAt).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
