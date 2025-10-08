export default function DocumentList({ 
  documents, 
  activeDocumentId, 
  onDocumentSelect, 
  onDocumentDelete 
}) {
  if (documents.length === 0) {
    return (
      <div className="documents-list">
        <div className="empty-state">No documents yet. Upload one to get started!</div>
      </div>
    );
  }

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this document? This will also delete all associated conversations.')) {
      onDocumentDelete(id);
    }
  };

  return (
    <div className="documents-list">
      {documents.map(doc => (
        <div
          key={doc.id}
          className={`document-item ${doc.id === activeDocumentId ? 'active' : ''}`}
          onClick={() => onDocumentSelect(doc.id)}
          data-testid={`document-item-${doc.id}`}
        >
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
      ))}
    </div>
  );
}
