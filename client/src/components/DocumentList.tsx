import type { MouseEvent } from 'react';

interface Document {
  id: string;
  name: string;
  uploadedAt: string;
}

interface Props {
  documents: Document[];
  activeDocumentId: string | null;
  selectedDocumentIds?: string[];
  multiDocMode?: boolean;
  onDocumentSelect: (id: string) => void;
  onDocumentDelete: (id: string) => void;
}

export default function DocumentList({ 
  documents, 
  activeDocumentId, 
  selectedDocumentIds = [],
  multiDocMode = false,
  onDocumentSelect, 
  onDocumentDelete 
}: Props) {
  if (documents.length === 0) {
    return (
      <div className="documents-list">
        <div className="empty-state">No documents yet. Upload one to get started!</div>
      </div>
    );
  }

  const handleDelete = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this document? This will also delete all associated conversations.')) {
      onDocumentDelete(id);
    }
  };

  return (
    <div className="documents-list">
      {documents.map(doc => {
        const isActive = multiDocMode 
          ? selectedDocumentIds.includes(doc.id)
          : doc.id === activeDocumentId;
        
        return (
          <div
            key={doc.id}
            className={`document-item ${isActive ? 'active' : ''}`}
            onClick={() => onDocumentSelect(doc.id)}
            data-testid={`document-item-${doc.id}`}
          >
            {multiDocMode && (
              <div className="document-checkbox">
                <input 
                  type="checkbox" 
                  checked={selectedDocumentIds.includes(doc.id)}
                  onChange={() => {}}
                  data-testid={`checkbox-document-${doc.id}`}
                />
              </div>
            )}
            <div className="document-info">
              <h3>{doc.name}</h3>
              <p>{new Date(doc.uploadedAt).toLocaleDateString()}</p>
            </div>
            <button
              className="btn-delete"
              onClick={(e) => handleDelete(e, doc.id)}
              title="Delete document"
              data-testid={`button-delete-${doc.id}`}
            >
              🗑️
            </button>
          </div>
        );
      })}
    </div>
  );
}
