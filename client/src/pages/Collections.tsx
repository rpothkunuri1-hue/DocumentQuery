import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Plus, Folder, Trash2, Edit2, X } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  documents?: any[];
}

export default function Collections() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const { data: collections = [], isLoading } = useQuery<Collection[]>({
    queryKey: ['/api/collections'],
  });

  const { data: collectionDetails } = useQuery<Collection>({
    queryKey: ['/api/collections', selectedCollection?.id],
    enabled: !!selectedCollection?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return await apiRequest('/api/collections', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Collection> }) => {
      return await apiRequest(`/api/collections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
      setEditingCollection(null);
      setFormData({ name: '', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/collections/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
      setSelectedCollection(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCollection) {
      updateMutation.mutate({ id: editingCollection.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditModal = (collection: Collection) => {
    setEditingCollection(collection);
    setFormData({ name: collection.name, description: collection.description || '' });
    setShowCreateModal(true);
  };

  return (
    <div className="collections-page">
      <div className="collections-header">
        <h1>Document Collections</h1>
        <button
          className="btn btn-primary btn-icon-text"
          onClick={() => {
            setEditingCollection(null);
            setFormData({ name: '', description: '' });
            setShowCreateModal(true);
          }}
          data-testid="button-create-collection"
        >
          <Plus size={16} />
          <span>New Collection</span>
        </button>
      </div>

      {isLoading ? (
        <div className="loading-state">Loading collections...</div>
      ) : collections.length === 0 ? (
        <div className="empty-state">
          <Folder size={64} className="empty-icon" />
          <h3>No collections yet</h3>
          <p>Create a collection to organize your documents</p>
        </div>
      ) : (
        <div className="collections-grid">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className={`collection-card ${selectedCollection?.id === collection.id ? 'selected' : ''}`}
              onClick={() => setSelectedCollection(collection)}
              data-testid={`collection-card-${collection.id}`}
            >
              <div className="collection-icon">
                <Folder size={32} />
              </div>
              <div className="collection-info">
                <h3>{collection.name}</h3>
                {collection.description && <p>{collection.description}</p>}
              </div>
              <div className="collection-actions">
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(collection);
                  }}
                  data-testid={`button-edit-${collection.id}`}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete collection "${collection.name}"?`)) {
                      deleteMutation.mutate(collection.id);
                    }
                  }}
                  data-testid={`button-delete-${collection.id}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCollection && collectionDetails && (
        <div className="collection-details">
          <h2>Documents in {selectedCollection.name}</h2>
          {collectionDetails.documents && collectionDetails.documents.length > 0 ? (
            <div className="documents-list">
              {collectionDetails.documents.map((doc: any) => (
                <div key={doc.id} className="document-item" data-testid={`document-item-${doc.id}`}>
                  <span>{doc.name}</span>
                  <span className="document-size">{(doc.size / 1024).toFixed(2)} KB</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">No documents in this collection</p>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCollection ? 'Edit Collection' : 'Create Collection'}</h2>
              <button
                className="btn-icon"
                onClick={() => setShowCreateModal(false)}
                data-testid="button-close-modal"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Collection Name</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="input-collection-name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  data-testid="input-collection-description"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreateModal(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingCollection ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
