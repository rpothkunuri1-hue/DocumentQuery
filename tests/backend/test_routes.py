"""
Tests for API routes
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base, get_db
from main import app
import io


# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


# Override database dependency
app.dependency_overrides[get_db] = override_get_db

# Create test client
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    """Setup and teardown database for each test"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


class TestHealthEndpoint:
    """Test suite for health check endpoint"""
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


class TestDocumentEndpoints:
    """Test suite for document management endpoints"""
    
    def test_get_documents_empty(self):
        """Test getting documents when none exist"""
        response = client.get("/api/documents")
        assert response.status_code == 200
        assert response.json() == []
    
    def test_upload_document_txt(self):
        """Test uploading a text document"""
        file_content = b"This is a test document"
        files = {"file": ("test.txt", io.BytesIO(file_content), "text/plain")}
        response = client.post("/api/documents/upload", files=files)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "test.txt"
        assert "id" in data
        assert "content" in data
    
    def test_upload_document_no_file(self):
        """Test uploading without a file"""
        response = client.post("/api/documents/upload", files={})
        assert response.status_code == 422  # Validation error
    
    def test_upload_document_too_large(self):
        """Test uploading a file that exceeds size limit"""
        large_content = b"a" * (11 * 1024 * 1024)  # 11MB
        files = {"file": ("large.txt", io.BytesIO(large_content), "text/plain")}
        response = client.post("/api/documents/upload", files=files)
        assert response.status_code == 400
        assert "exceeds 10MB limit" in response.json()["detail"]
    
    def test_get_document_by_id(self):
        """Test getting a specific document by ID"""
        # First upload a document
        file_content = b"Test content"
        files = {"file": ("test.txt", io.BytesIO(file_content), "text/plain")}
        upload_response = client.post("/api/documents/upload", files=files)
        document_id = upload_response.json()["id"]
        
        # Then retrieve it
        response = client.get(f"/api/documents/{document_id}")
        assert response.status_code == 200
        assert response.json()["id"] == document_id
        assert response.json()["name"] == "test.txt"
    
    def test_get_document_not_found(self):
        """Test getting a non-existent document"""
        response = client.get("/api/documents/nonexistent-id")
        assert response.status_code == 404
        assert response.json()["detail"] == "Document not found"
    
    def test_delete_document(self):
        """Test deleting a document"""
        # First upload a document
        file_content = b"Test content"
        files = {"file": ("test.txt", io.BytesIO(file_content), "text/plain")}
        upload_response = client.post("/api/documents/upload", files=files)
        document_id = upload_response.json()["id"]
        
        # Then delete it
        response = client.delete(f"/api/documents/{document_id}")
        assert response.status_code == 200
        assert response.json()["success"] is True
        
        # Verify it's deleted
        get_response = client.get(f"/api/documents/{document_id}")
        assert get_response.status_code == 404
    
    def test_delete_document_not_found(self):
        """Test deleting a non-existent document"""
        response = client.delete("/api/documents/nonexistent-id")
        assert response.status_code == 404


class TestModelEndpoints:
    """Test suite for Ollama model endpoints"""
    
    def test_get_models(self):
        """Test getting available models (may return empty if Ollama not running)"""
        response = client.get("/api/models")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestConversationEndpoints:
    """Test suite for conversation endpoints"""
    
    def test_get_conversation_for_document(self):
        """Test getting or creating a conversation for a document"""
        # First upload a document
        file_content = b"Test content"
        files = {"file": ("test.txt", io.BytesIO(file_content), "text/plain")}
        upload_response = client.post("/api/documents/upload", files=files)
        document_id = upload_response.json()["id"]
        
        # Get conversation
        response = client.get(f"/api/conversations/{document_id}")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["documentId"] == document_id
    
    def test_get_conversation_document_not_found(self):
        """Test getting conversation for non-existent document"""
        response = client.get("/api/conversations/nonexistent-id")
        assert response.status_code == 404


class TestMessageEndpoints:
    """Test suite for message endpoints"""
    
    def test_get_messages_for_conversation(self):
        """Test getting messages for a conversation"""
        # Upload document and create conversation
        file_content = b"Test content"
        files = {"file": ("test.txt", io.BytesIO(file_content), "text/plain")}
        upload_response = client.post("/api/documents/upload", files=files)
        document_id = upload_response.json()["id"]
        
        conv_response = client.get(f"/api/conversations/{document_id}")
        conversation_id = conv_response.json()["id"]
        
        # Get messages (should be empty initially)
        response = client.get(f"/api/messages/{conversation_id}")
        assert response.status_code == 200
        assert response.json() == []
