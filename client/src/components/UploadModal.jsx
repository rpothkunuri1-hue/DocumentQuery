import { useState, useEffect } from 'react';

export default function UploadModal({ onUploadComplete, onClose, onUploadingChange }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    onUploadingChange(uploading);
  }, [uploading, onUploadingChange]);

  const handleFileSelect = async (selectedFile) => {
    const extension = selectedFile.name.split('.').pop()?.toLowerCase() || '';
    
    const validTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/markdown',
      'text/html',
      'application/rtf',
    ];
    
    const validExtensions = [
      'pdf', 'txt', 'docx', 'csv', 'xlsx', 'xls', 'md', 'html', 'htm', 'rtf',
      'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 
      'rb', 'php', 'swift', 'kt', 'r', 'sql', 'sh', 'bash', 'json', 'xml', 
      'yaml', 'yml', 'css', 'scss', 'sass', 'less'
    ];

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(extension)) {
      alert('Unsupported file type. Please upload PDF, DOCX, TXT, CSV, MD, HTML, RTF, Excel, or source code files.');
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

    const formData = new FormData();
    formData.append('file', uploadFile);

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
      setFile(null);
    }
  };

  const handleCancel = () => {
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
          <h2>Upload Document</h2>
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
            <div className="upload-icon">⬆</div>
            <p className="dropzone-text">Drop your document here</p>
            <p className="dropzone-subtext">or click to browse</p>
            <p className="dropzone-info">Supports PDF, TXT, DOCX, and more (max 10MB)</p>
            <input
              id="file-input"
              type="file"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              accept=".pdf,.txt,.docx,.csv,.xlsx,.md,.html,.js,.jsx,.ts,.tsx,.py,.java"
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
            <p className="upload-status">Processing document...</p>
            <button className="btn btn-outline" onClick={handleCancel}>
              Cancel Upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
