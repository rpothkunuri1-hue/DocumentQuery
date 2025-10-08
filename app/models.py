from sqlalchemy import Column, String, Integer, Text, TIMESTAMP, Boolean, ARRAY, JSON, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False)
    type = Column(Text, nullable=False)
    size = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    summary = Column(Text)
    brief_summary = Column("brief_summary", Text)
    key_points = Column("key_points", ARRAY(Text))
    tags = Column(ARRAY(Text), server_default='{}')
    category = Column(Text)
    version = Column(Integer, default=1, nullable=False)
    parent_version_id = Column("parent_version_id", String)
    collection_id = Column("collection_id", String)
    uploaded_at = Column("uploaded_at", TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", TIMESTAMP, server_default=func.now(), nullable=False)

class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    
    id = Column(String, primary_key=True, server_default=func.gen_random_uuid())
    document_id = Column("document_id", String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    chunk_index = Column("chunk_index", Integer, nullable=False)
    embedding = Column(Text)
    chunk_metadata = Column("metadata", JSON)
    created_at = Column("created_at", TIMESTAMP, server_default=func.now(), nullable=False)

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(String, primary_key=True, server_default=func.gen_random_uuid())
    document_id = Column("document_id", String, ForeignKey("documents.id", ondelete="CASCADE"))
    document_ids = Column("document_ids", ARRAY(Text))
    created_at = Column("created_at", TIMESTAMP, server_default=func.now(), nullable=False)

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(String, primary_key=True, server_default=func.gen_random_uuid())
    conversation_id = Column("conversation_id", String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    rating = Column(Integer)
    edited = Column(Boolean, default=False)
    original_content = Column("original_content", Text)
    model_used = Column("model_used", Text)
    created_at = Column("created_at", TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", TIMESTAMP, server_default=func.now(), nullable=False)

class Cache(Base):
    __tablename__ = "cache"
    
    id = Column(String, primary_key=True, server_default=func.gen_random_uuid())
    key = Column(Text, nullable=False, unique=True)
    value = Column(Text, nullable=False)
    expires_at = Column("expires_at", TIMESTAMP)
    created_at = Column("created_at", TIMESTAMP, server_default=func.now(), nullable=False)

class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(String, primary_key=True, server_default=func.gen_random_uuid())
    type = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="pending")
    data = Column(JSON)
    result = Column(JSON)
    error = Column(Text)
    progress = Column(Integer, default=0)
    created_at = Column("created_at", TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", TIMESTAMP, server_default=func.now(), nullable=False)
    completed_at = Column("completed_at", TIMESTAMP)

class Collection(Base):
    __tablename__ = "collections"
    
    id = Column(String, primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False)
    description = Column(Text)
    created_at = Column("created_at", TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", TIMESTAMP, server_default=func.now(), nullable=False)

class DocumentComparison(Base):
    __tablename__ = "document_comparisons"
    
    id = Column(String, primary_key=True, server_default=func.gen_random_uuid())
    document_id_1 = Column("document_id_1", String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    document_id_2 = Column("document_id_2", String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    differences = Column(JSON)
    similarities = Column(JSON)
    comparison_summary = Column("comparison_summary", Text)
    created_at = Column("created_at", TIMESTAMP, server_default=func.now(), nullable=False)

class ModelComparison(Base):
    __tablename__ = "model_comparisons"
    
    id = Column(String, primary_key=True, server_default=func.gen_random_uuid())
    conversation_id = Column("conversation_id", String, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    model_1 = Column("model_1", Text, nullable=False)
    model_2 = Column("model_2", Text, nullable=False)
    response_1 = Column("response_1", Text, nullable=False)
    response_2 = Column("response_2", Text, nullable=False)
    created_at = Column("created_at", TIMESTAMP, server_default=func.now(), nullable=False)
