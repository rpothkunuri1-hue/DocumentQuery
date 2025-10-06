import { useState, useEffect } from 'react';
import { Route, Link, useLocation } from 'wouter';
import { Menu, Upload, Sun, Moon, Users, X, Folder, GitCompare, Clock, MessageSquare } from 'lucide-react';
import DocumentList from './components/DocumentList';
import ChatInterface from './components/ChatInterface';
import UploadModal from './components/UploadModal';
import Collections from './pages/Collections';
import Comparisons from './pages/Comparisons';
import Jobs from './pages/Jobs';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  uploadedAt: string;
}

export default function App() {
  const [location] = useLocation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [multiDocMode, setMultiDocMode] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth > 768 : false
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return (saved as 'light' | 'dark') || 'light';
    }
    return 'light';
  });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ollama-model') || 'llama2';
    }
    return 'llama2';
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
    loadModels();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ollama-model', selectedModel);
    }
  }, [selectedModel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showUpload && !isUploading) {
          setShowUpload(false);
        }
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showUpload, isUploading]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();
      setDocuments(data);
      setError(null);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setError('Failed to load documents. Please refresh the page.');
    }
  };

  const loadModels = async () => {
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      const modelNames = data.map((model: any) => model.name);
      setAvailableModels(modelNames);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const handleDocumentSelect = (documentId: string) => {
    if (multiDocMode) {
      setSelectedDocumentIds(prev => 
        prev.includes(documentId)
          ? prev.filter(id => id !== documentId)
          : [...prev, documentId]
      );
    } else {
      setActiveDocumentId(documentId);
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
    }
  };

  const toggleMultiDocMode = () => {
    setMultiDocMode(prev => {
      const newMode = !prev;
      if (newMode) {
        if (activeDocumentId) {
          setSelectedDocumentIds([activeDocumentId]);
        }
      } else {
        if (selectedDocumentIds.length > 0) {
          setActiveDocumentId(selectedDocumentIds[0]);
        }
        setSelectedDocumentIds([]);
      }
      return newMode;
    });
  };

  const removeFromMultiDoc = (documentId: string) => {
    setSelectedDocumentIds(prev => prev.filter(id => id !== documentId));
  };

  const handleUploadComplete = (document: Document) => {
    setActiveDocumentId(document.id);
    setShowUpload(false);
    loadDocuments();
  };

  const handleDocumentDelete = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        if (activeDocumentId === documentId) {
          setActiveDocumentId(null);
        }
        if (selectedDocumentIds.includes(documentId)) {
          setSelectedDocumentIds(prev => prev.filter(id => id !== documentId));
        }
        loadDocuments();
        setError(null);
      } else {
        setError('Failed to delete document.');
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
      setError('Failed to delete document. Please try again.');
    }
  };

  const activeDocument = documents.find(doc => doc.id === activeDocumentId);
  const selectedDocuments = documents.filter(doc => selectedDocumentIds.includes(doc.id));

  const isDocumentPage = location === '/';

  return (
    <div className="app">
      {sidebarOpen && typeof window !== 'undefined' && window.innerWidth <= 768 && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}
      
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>DocuChat</h2>
        </div>
        
        <nav className="sidebar-nav">
          <Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} data-testid="link-documents">
            <MessageSquare size={18} />
            <span>Documents & Chat</span>
          </Link>
          <Link href="/collections" className={`nav-link ${location === '/collections' ? 'active' : ''}`} data-testid="link-collections">
            <Folder size={18} />
            <span>Collections</span>
          </Link>
          <Link href="/comparisons" className={`nav-link ${location === '/comparisons' ? 'active' : ''}`} data-testid="link-comparisons">
            <GitCompare size={18} />
            <span>Compare Docs</span>
          </Link>
          <Link href="/jobs" className={`nav-link ${location === '/jobs' ? 'active' : ''}`} data-testid="link-jobs">
            <Clock size={18} />
            <span>Job Queue</span>
          </Link>
        </nav>

        {isDocumentPage && (
          <>
            <div className="sidebar-section-header">
              <h3>Documents</h3>
              <div className="sidebar-header-actions">
                <button 
                  className={`btn btn-icon-text ${multiDocMode ? 'btn-secondary active' : 'btn-ghost'}`}
                  onClick={toggleMultiDocMode}
                  data-testid="button-multi-doc"
                  title={multiDocMode ? 'Exit multi-document mode' : 'Enable multi-document mode'}
                >
                  <Users className="icon" size={16} />
                  <span>{multiDocMode ? 'Multi' : 'Multi'}</span>
                  {multiDocMode && selectedDocumentIds.length > 0 && (
                    <span className="badge">{selectedDocumentIds.length}</span>
                  )}
                </button>
                <button 
                  className="btn btn-primary btn-icon-text" 
                  onClick={() => setShowUpload(true)}
                  data-testid="button-upload"
                >
                  <Upload size={16} className="icon" />
                  <span>Upload</span>
                </button>
              </div>
            </div>
            <DocumentList
              documents={documents}
              activeDocumentId={activeDocumentId}
              selectedDocumentIds={multiDocMode ? selectedDocumentIds : []}
              multiDocMode={multiDocMode}
              onDocumentSelect={handleDocumentSelect}
              onDocumentDelete={handleDocumentDelete}
            />
          </>
        )}
      </aside>

      <main className="main-content">
        <header className="header">
          <button 
            className="btn-icon hamburger-btn" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-menu"
            title="Toggle sidebar"
          >
            <Menu size={24} />
          </button>
          <h1>DocuChat</h1>
          <div className="header-actions">
            <select 
              value={selectedModel} 
              onChange={(e) => setSelectedModel(e.target.value)}
              className="model-selector-header"
              title="Select Ollama model"
              data-testid="select-model"
            >
              {availableModels.length > 0 ? (
                availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))
              ) : (
                <>
                  <option value="llama2">Llama 2</option>
                  <option value="llama3">Llama 3</option>
                  <option value="llama3.1">Llama 3.1</option>
                  <option value="mistral">Mistral</option>
                  <option value="mixtral">Mixtral</option>
                  <option value="codellama">Code Llama</option>
                  <option value="gemma">Gemma</option>
                  <option value="phi">Phi</option>
                </>
              )}
            </select>
            <button 
              className="btn-icon" 
              onClick={toggleTheme} 
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              data-testid="button-theme"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner" data-testid="error-banner">
            <span>{error}</span>
            <button 
              className="error-close" 
              onClick={() => setError(null)}
              data-testid="button-error-close"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <Route path="/">
          {multiDocMode && selectedDocuments.length > 0 ? (
            <ChatInterface 
              documents={selectedDocuments} 
              selectedModel={selectedModel}
              onRemoveDocument={removeFromMultiDoc}
            />
          ) : activeDocument ? (
            <ChatInterface documents={[activeDocument]} selectedModel={selectedModel} />
          ) : (
            <div className="welcome-screen">
              <div className="welcome-content">
                <div className="welcome-icon">💬</div>
                <h2>Welcome to DocuChat</h2>
                <p>Upload a document to start having intelligent conversations about its content.</p>
                <div className="features">
                  <p>✓ Support for PDF, TXT, DOCX, CSV, MD, HTML, and more</p>
                  <p>✓ Real-time streaming responses</p>
                  <p>✓ Conversation history and memory</p>
                  <p>✓ Multi-document chat mode</p>
                  <p>✓ Document collections and organization</p>
                  <p>✓ Bulk upload and queue management</p>
                  <p>✓ Document comparison tools</p>
                  <p>✓ OCR support for images</p>
                </div>
              </div>
            </div>
          )}
        </Route>

        <Route path="/collections">
          <Collections />
        </Route>

        <Route path="/comparisons">
          <Comparisons />
        </Route>

        <Route path="/jobs">
          <Jobs />
        </Route>
      </main>

      {showUpload && (
        <UploadModal
          onUploadComplete={handleUploadComplete}
          onClose={() => setShowUpload(false)}
          onUploadingChange={setIsUploading}
        />
      )}
    </div>
  );
}
