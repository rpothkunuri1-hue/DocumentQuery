import React, { useState } from 'react';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  uploadedAt: string;
}

interface Props {
  onUploadComplete: (document: Document) => void;
  onClose: () => void;
}

export default function UploadModal({ onUploadComplete, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!validTypes.includes(selectedFile.type)) {
      alert('Please upload PDF, TXT, or DOCX files');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      alert('Maximum file size is 10MB');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(30);

    const formData = new FormData();
    formData.append('file', file);

    try {
      setTimeout(() => setProgress(60), 300);
      setTimeout(() => setProgress(90), 600);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const document = await response.json();
      setProgress(100);
      onUploadComplete(document);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again');
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Upload Document</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div
          className={`dropzone ${isDragging ? 'dragover' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          {file ? (
            <div className="file-info">
              <div className="file-icon">📄</div>
              <p className="file-name">{file.name}</p>
              <p className="file-size">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <>
              <div className="upload-icon">⬆</div>
              <p className="dropzone-text">Drop your document here</p>
              <p className="dropzone-subtext">or click to browse</p>
              <p className="dropzone-info">Supports PDF, TXT, DOCX (max 10MB)</p>
            </>
          )}
          <input
            id="file-input"
            type="file"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            accept=".pdf,.txt,.docx"
            style={{ display: 'none' }}
          />
        </div>

        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p>Processing document...</p>
          </div>
        )}

        {file && !uploading && (
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setFile(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleUpload}>
              Upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
