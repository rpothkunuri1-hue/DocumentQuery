import { useState, useEffect, useRef } from 'react';

export default function UploadModal({ onUploadComplete, onClose, onUploadingChange, selectedModel }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const abortControllerRef = useRef(null);
  const progressTimersRef = useRef([]);

  useEffect(() => {
    onUploadingChange(uploading);
  }, [uploading, onUploadingChange]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      progressTimersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const handleFileSelect = async (selectedFile) => {
    const extension = selectedFile.name.split('.').pop()?.toLowerCase() || '';
    
    if (selectedFile.type !== 'application/pdf' && extension !== 'pdf') {
      alert('Only PDF files are supported. Please upload a PDF document.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      alert('Maximum file size is 10MB');
      return;
    }

    setFile(selectedFile);
    await handleUpload(selectedFile);
  };

  const handleUpload = async (fileToUpload) => {
    const uploadFile = fileToUpload || file;
    if (!uploadFile) return;

    setUploading(true);
    setProgress(30);

    abortControllerRef.current = new AbortController();
    progressTimersRef.current.forEach(timer => clearTimeout(timer));
    progressTimersRef.current = [];

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const timer1 = setTimeout(() => setProgress(60), 300);
      const timer2 = setTimeout(() => setProgress(90), 600);
      progressTimersRef.current = [timer1, timer2];

      const url = selectedModel 
        ? `/api/documents/upload?model=${encodeURIComponent(selectedModel)}`
        : '/api/documents/upload';

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || 'Upload failed';
        
        if (response.status === 413) {
          throw new Error('File size exceeds 10MB limit. Please upload a smaller file.');
        }
        throw new Error(errorMessage);
      }

      const document = await response.json();
      setProgress(100);
      onUploadComplete(document);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Upload canceled by user');
        return;
      }
      console.error('Upload error:', error);
      alert(error.message || 'Upload failed. Please try again');
      setUploading(false);
      setProgress(0);
      setFile(null);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    progressTimersRef.current.forEach(timer => clearTimeout(timer));
    progressTimersRef.current = [];
    setUploading(false);
    setProgress(0);
    setFile(null);
    onClose();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Upload PDF Document</h2>
          <button className="btn-icon" onClick={uploading ? handleCancel : onClose}>✕</button>
        </div>

        {!uploading ? (
          <div
            className={`dropzone ${isDragging ? 'dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div className="upload-icon">📄</div>
            <p className="dropzone-text">Drop your PDF here</p>
            <p className="dropzone-subtext">or click to browse</p>
            <p className="dropzone-info">PDF files only (max 10MB)</p>
            <input
              id="file-input"
              type="file"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div className="upload-progress">
            <div className="file-info">
              <div className="file-icon">📄</div>
              <p className="file-name">{file?.name}</p>
              <p className="file-size">{file ? (file.size / 1024).toFixed(1) : '0'} KB</p>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="upload-status">Processing PDF and generating summary...</p>
            <button className="btn btn-outline" onClick={handleCancel}>
              Cancel Upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
