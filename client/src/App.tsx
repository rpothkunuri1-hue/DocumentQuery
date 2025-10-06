import React, { useState, useEffect } from 'react';
import DocumentList from './components/DocumentList';
import ChatInterface from './components/ChatInterface';
import UploadModal from './components/UploadModal';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  uploadedAt: string;
}

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleDocumentSelect = (documentId: string) => {
    setActiveDocumentId(documentId);
  };

  const handleUploadComplete = (document: Document) => {
    setActiveDocumentId(document.id);
    setShowUpload(false);
    loadDocuments();
  };

  const activeDocument = documents.find(doc => doc.id === activeDocumentId);

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Documents</h2>
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
            + Upload
          </button>
        </div>
        <DocumentList
          documents={documents}
          activeDocumentId={activeDocumentId}
          onDocumentSelect={handleDocumentSelect}
        />
      </aside>

      <main className="main-content">
        <header className="header">
          <button className="btn-icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <h1>DocuChat</h1>
        </header>

        {activeDocument ? (
          <ChatInterface document={activeDocument} />
        ) : (
          <div className="welcome-screen">
            <div className="welcome-content">
              <div className="welcome-icon">💬</div>
              <h2>Welcome to DocuChat</h2>
              <p>Upload a document to start having intelligent conversations about its content.</p>
              <div className="features">
                <p>✓ Support for PDF, TXT, and DOCX files</p>
                <p>✓ Real-time streaming responses</p>
                <p>✓ Conversation history and memory</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {showUpload && (
        <UploadModal
          onUploadComplete={handleUploadComplete}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
