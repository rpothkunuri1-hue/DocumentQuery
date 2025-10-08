import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

export default function DocumentList({ 
  documents, 
  activeDocumentId, 
  onDocumentSelect, 
  onDocumentDelete 
}) {
  const [swipeState, setSwipeState] = useState({});
  const [touchStart, setTouchStart] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (documents.length === 0) {
    return (
      <div className="documents-list">
        <div className="empty-state">No documents yet. Upload one to get started!</div>
      </div>
    );
  }

  const handleDelete = (e, id) => {
    if (e) e.stopPropagation();
    if (confirm('Are you sure you want to delete this document? This will also delete all associated conversations.')) {
      onDocumentDelete(id);
      setSwipeState({});
    }
  };

  const handleTouchStart = (e, id) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY, id });
  };

  const handleTouchMove = (e, id) => {
    if (!touchStart || touchStart.id !== id) return;

    const touch = e.touches[0];
    const deltaX = touchStart.x - touch.clientX;
    const deltaY = Math.abs(touchStart.y - touch.clientY);

    if (deltaY > 30) return;

    if (deltaX > 10) {
      setSwipeState(prev => ({ ...prev, [id]: Math.min(deltaX, 100) }));
    } else {
      setSwipeState(prev => ({ ...prev, [id]: 0 }));
    }
  };

  const handleTouchEnd = (e, id) => {
    if (!touchStart || touchStart.id !== id) return;

    const swipeDistance = swipeState[id] || 0;
    
    if (swipeDistance > 60) {
      handleDelete(null, id);
    } else {
      setSwipeState(prev => ({ ...prev, [id]: 0 }));
    }
    
    setTouchStart(null);
  };

  return (
    <div className="documents-list">
      {documents.map(doc => {
        const swipeOffset = swipeState[doc.id] || 0;
        
        return (
          <div
            key={doc.id}
            className={`document-item-wrapper ${doc.id === activeDocumentId ? 'active' : ''}`}
            data-testid={`document-item-${doc.id}`}
          >
            <div
              className="document-item"
              style={{
                transform: `translateX(-${swipeOffset}px)`,
                transition: touchStart?.id === doc.id ? 'none' : 'transform 0.3s ease'
              }}
              onClick={() => !swipeOffset && onDocumentSelect(doc.id)}
              onTouchStart={isMobile ? (e) => handleTouchStart(e, doc.id) : undefined}
              onTouchMove={isMobile ? (e) => handleTouchMove(e, doc.id) : undefined}
              onTouchEnd={isMobile ? (e) => handleTouchEnd(e, doc.id) : undefined}
            >
              <div className="document-info">
                <h3>{doc.name}</h3>
                <p>{new Date(doc.uploadedAt).toLocaleDateString()}</p>
              </div>
              {!isMobile && (
                <button
                  className="btn-delete-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(e, doc.id);
                  }}
                  title="Delete document"
                  data-testid={`button-delete-${doc.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {isMobile && (
              <div className="delete-reveal" style={{ width: `${Math.min(swipeOffset, 100)}px` }}>
                <span className="delete-text">Delete</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
