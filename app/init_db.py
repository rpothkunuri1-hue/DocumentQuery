from app.database import engine, Base
from app.models import (
    Document, DocumentChunk, Conversation, Message,
    Cache, Job, Collection, DocumentComparison, ModelComparison
)

def init_database():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_database()
