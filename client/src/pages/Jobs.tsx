import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle, XCircle, Loader, Upload } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Job {
  id: string;
  type: string;
  status: string;
  data: any;
  result: any;
  error: string | null;
  progress: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export default function Jobs() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: jobs = [], isLoading, refetch } = useQuery<Job[]>({
    queryKey: ['/api/jobs', statusFilter === 'all' ? undefined : statusFilter],
    refetchInterval: 3000,
  });

  const handleBulkUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(selectedFiles).forEach((file) => {
        formData.append('files', file);
      });

      await apiRequest('/api/documents/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      setSelectedFiles(null);
      refetch();
    } catch (error) {
      console.error('Bulk upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} className="status-icon success" />;
      case 'failed':
        return <XCircle size={20} className="status-icon error" />;
      case 'processing':
        return <Loader size={20} className="status-icon spinner" />;
      default:
        return <Clock size={20} className="status-icon pending" />;
    }
  };

  const filteredJobs = statusFilter === 'all' ? jobs : jobs.filter(job => job.status === statusFilter);

  return (
    <div className="jobs-page">
      <h1>Job Queue Manager</h1>
      <p className="subtitle">Monitor and manage background tasks</p>

      <div className="bulk-upload-section">
        <h2>Bulk Upload</h2>
        <div className="upload-controls">
          <input
            type="file"
            multiple
            onChange={(e) => setSelectedFiles(e.target.files)}
            data-testid="input-bulk-upload"
            id="bulk-upload-input"
          />
          <label htmlFor="bulk-upload-input" className="file-input-label">
            <Upload size={16} />
            <span>{selectedFiles ? `${selectedFiles.length} files selected` : 'Choose files'}</span>
          </label>
          <button
            className="btn btn-primary"
            onClick={handleBulkUpload}
            disabled={!selectedFiles || isUploading}
            data-testid="button-bulk-upload"
          >
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      </div>

      <div className="jobs-filters">
        <button
          className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
          data-testid="filter-all"
        >
          All
        </button>
        <button
          className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setStatusFilter('pending')}
          data-testid="filter-pending"
        >
          Pending
        </button>
        <button
          className={`filter-btn ${statusFilter === 'processing' ? 'active' : ''}`}
          onClick={() => setStatusFilter('processing')}
          data-testid="filter-processing"
        >
          Processing
        </button>
        <button
          className={`filter-btn ${statusFilter === 'completed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('completed')}
          data-testid="filter-completed"
        >
          Completed
        </button>
        <button
          className={`filter-btn ${statusFilter === 'failed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('failed')}
          data-testid="filter-failed"
        >
          Failed
        </button>
      </div>

      {isLoading ? (
        <div className="loading-state">Loading jobs...</div>
      ) : filteredJobs.length === 0 ? (
        <div className="empty-state">
          <Clock size={64} className="empty-icon" />
          <h3>No jobs found</h3>
          <p>Background tasks will appear here</p>
        </div>
      ) : (
        <div className="jobs-list">
          {filteredJobs.map((job) => (
            <div key={job.id} className="job-card" data-testid={`job-card-${job.id}`}>
              <div className="job-header">
                {getStatusIcon(job.status)}
                <div className="job-info">
                  <h3>{job.type.replace(/_/g, ' ').toUpperCase()}</h3>
                  <span className="job-date">
                    {new Date(job.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className={`job-status ${job.status}`}>{job.status}</span>
              </div>

              {job.progress > 0 && job.status === 'processing' && (
                <div className="job-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${job.progress}%` }} />
                  </div>
                  <span>{job.progress}%</span>
                </div>
              )}

              {job.error && (
                <div className="job-error" data-testid={`job-error-${job.id}`}>
                  <strong>Error:</strong> {job.error}
                </div>
              )}

              {job.data?.filename && (
                <div className="job-details">
                  <strong>File:</strong> {job.data.filename}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
