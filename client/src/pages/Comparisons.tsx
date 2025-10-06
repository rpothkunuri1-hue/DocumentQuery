import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { GitCompare, Loader } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  content: string;
}

interface DocumentComparison {
  id: string;
  documentId1: string;
  documentId2: string;
  differences: string[] | null;
  similarities: string[] | null;
  comparisonSummary: string | null;
  createdAt: string;
}

export default function Comparisons() {
  const [selectedDoc1, setSelectedDoc1] = useState<string>('');
  const [selectedDoc2, setSelectedDoc2] = useState<string>('');
  const [comparison, setComparison] = useState<DocumentComparison | null>(null);

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
  });

  const compareMutation = useMutation({
    mutationFn: async (data: { documentId1: string; documentId2: string }) => {
      return await apiRequest('/api/documents/compare', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      setComparison(data);
    },
  });

  const handleCompare = () => {
    if (selectedDoc1 && selectedDoc2) {
      compareMutation.mutate({
        documentId1: selectedDoc1,
        documentId2: selectedDoc2,
      });
    }
  };

  const doc1 = documents.find(d => d.id === selectedDoc1);
  const doc2 = documents.find(d => d.id === selectedDoc2);

  return (
    <div className="comparisons-page">
      <h1>Document Comparison</h1>
      <p className="subtitle">Compare two documents to find similarities and differences</p>

      <div className="comparison-selector">
        <div className="document-select">
          <label>First Document</label>
          <select
            value={selectedDoc1}
            onChange={(e) => setSelectedDoc1(e.target.value)}
            data-testid="select-document-1"
          >
            <option value="">Select document...</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id} disabled={doc.id === selectedDoc2}>
                {doc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="comparison-icon">
          <GitCompare size={24} />
        </div>

        <div className="document-select">
          <label>Second Document</label>
          <select
            value={selectedDoc2}
            onChange={(e) => setSelectedDoc2(e.target.value)}
            data-testid="select-document-2"
          >
            <option value="">Select document...</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id} disabled={doc.id === selectedDoc1}>
                {doc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleCompare}
        disabled={!selectedDoc1 || !selectedDoc2 || compareMutation.isPending}
        data-testid="button-compare"
      >
        {compareMutation.isPending ? (
          <>
            <Loader size={16} className="spinner" />
            <span>Comparing...</span>
          </>
        ) : (
          'Compare Documents'
        )}
      </button>

      {comparison && (
        <div className="comparison-results">
          <h2>Comparison Results</h2>

          {comparison.comparisonSummary && (
            <div className="comparison-section">
              <h3>Summary</h3>
              <p className="comparison-summary">{comparison.comparisonSummary}</p>
            </div>
          )}

          {comparison.similarities && comparison.similarities.length > 0 && (
            <div className="comparison-section similarities">
              <h3>Similarities</h3>
              <ul>
                {comparison.similarities.map((similarity, idx) => (
                  <li key={idx} data-testid={`similarity-${idx}`}>{similarity}</li>
                ))}
              </ul>
            </div>
          )}

          {comparison.differences && comparison.differences.length > 0 && (
            <div className="comparison-section differences">
              <h3>Differences</h3>
              <ul>
                {comparison.differences.map((difference, idx) => (
                  <li key={idx} data-testid={`difference-${idx}`}>{difference}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="document-previews">
            <div className="preview-column">
              <h4>{doc1?.name}</h4>
              <div className="document-preview">{doc1?.content.substring(0, 500)}...</div>
            </div>
            <div className="preview-column">
              <h4>{doc2?.name}</h4>
              <div className="document-preview">{doc2?.content.substring(0, 500)}...</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
