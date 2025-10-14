import os
import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

UPLOADS_DIR = Path("uploads")
DOCUMENTS_DIR = UPLOADS_DIR / "documents"
CONVERSATIONS_DIR = UPLOADS_DIR / "conversations"

# Ensure directories exist
DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
CONVERSATIONS_DIR.mkdir(parents=True, exist_ok=True)


class FileStorage:
    """Simple file-based storage system"""
    
    @staticmethod
    def _get_document_path(doc_id: str) -> Path:
        """Get path to document JSON file"""
        return DOCUMENTS_DIR / f"{doc_id}.json"
    
    @staticmethod
    def _get_conversation_path(conv_id: str) -> Path:
        """Get path to conversation JSON file"""
        return CONVERSATIONS_DIR / f"{conv_id}.json"
    
    @staticmethod
    def create_document(name: str, type: str, size: int, content: str) -> Dict[str, Any]:
        """Create and save a new document"""
        doc_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        document = {
            "id": doc_id,
            "name": name,
            "type": type,
            "size": size,
            "content": content,
            "summary": None,
            "summary_status": None,
            "summary_progress": 0,
            "summary_message": None,
            "brief_summary": None,
            "key_points": [],
            "tags": [],
            "category": None,
            "version": 1,
            "parent_version_id": None,
            "collection_id": None,
            "uploaded_at": timestamp,
            "updated_at": timestamp
        }
        
        doc_path = FileStorage._get_document_path(doc_id)
        with open(doc_path, 'w', encoding='utf-8') as f:
            json.dump(document, f, ensure_ascii=False, indent=2)
        
        return document
    
    @staticmethod
    def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
        """Get a document by ID"""
        doc_path = FileStorage._get_document_path(doc_id)
        if not doc_path.exists():
            return None
        
        with open(doc_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def get_all_documents() -> List[Dict[str, Any]]:
        """Get all documents"""
        documents = []
        for doc_file in DOCUMENTS_DIR.glob("*.json"):
            with open(doc_file, 'r', encoding='utf-8') as f:
                documents.append(json.load(f))
        
        # Sort by uploaded_at descending
        documents.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
        return documents
    
    @staticmethod
    def update_document(doc_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a document"""
        document = FileStorage.get_document(doc_id)
        if not document:
            return None
        
        document.update(updates)
        document["updated_at"] = datetime.now().isoformat()
        
        doc_path = FileStorage._get_document_path(doc_id)
        with open(doc_path, 'w', encoding='utf-8') as f:
            json.dump(document, f, ensure_ascii=False, indent=2)
        
        return document
    
    @staticmethod
    def delete_document(doc_id: str) -> bool:
        """Delete a document"""
        doc_path = FileStorage._get_document_path(doc_id)
        if not doc_path.exists():
            return False
        
        # Also delete associated conversations
        for conv_file in CONVERSATIONS_DIR.glob("*.json"):
            with open(conv_file, 'r', encoding='utf-8') as f:
                conv = json.load(f)
                if conv.get("document_id") == doc_id or doc_id in conv.get("document_ids", []):
                    conv_file.unlink()
        
        doc_path.unlink()
        return True
    
    @staticmethod
    def create_conversation(document_id: Optional[str] = None, document_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """Create a new conversation"""
        conv_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        conversation = {
            "id": conv_id,
            "document_id": document_id,
            "document_ids": document_ids or [],
            "messages": [],
            "created_at": timestamp
        }
        
        conv_path = FileStorage._get_conversation_path(conv_id)
        with open(conv_path, 'w', encoding='utf-8') as f:
            json.dump(conversation, f, ensure_ascii=False, indent=2)
        
        return conversation
    
    @staticmethod
    def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
        """Get a conversation by ID"""
        conv_path = FileStorage._get_conversation_path(conv_id)
        if not conv_path.exists():
            return None
        
        with open(conv_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def get_conversation_by_document(doc_id: str) -> Optional[Dict[str, Any]]:
        """Find conversation for a specific document"""
        for conv_file in CONVERSATIONS_DIR.glob("*.json"):
            with open(conv_file, 'r', encoding='utf-8') as f:
                conv = json.load(f)
                if conv.get("document_id") == doc_id:
                    return conv
        return None
    
    @staticmethod
    def add_message(conv_id: str, role: str, content: str, model_used: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Add a message to a conversation"""
        conversation = FileStorage.get_conversation(conv_id)
        if not conversation:
            return None
        
        message_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        message = {
            "id": message_id,
            "conversation_id": conv_id,
            "role": role,
            "content": content,
            "rating": None,
            "edited": False,
            "original_content": None,
            "model_used": model_used,
            "created_at": timestamp
        }
        
        conversation["messages"].append(message)
        
        conv_path = FileStorage._get_conversation_path(conv_id)
        with open(conv_path, 'w', encoding='utf-8') as f:
            json.dump(conversation, f, ensure_ascii=False, indent=2)
        
        return message
    
    @staticmethod
    def get_messages(conv_id: str) -> List[Dict[str, Any]]:
        """Get all messages for a conversation"""
        conversation = FileStorage.get_conversation(conv_id)
        if not conversation:
            return []
        return conversation.get("messages", [])
    
    @staticmethod
    def update_last_message(conv_id: str, content: str) -> Optional[Dict[str, Any]]:
        """Update the last message in a conversation"""
        conversation = FileStorage.get_conversation(conv_id)
        if not conversation or not conversation.get("messages"):
            return None
        
        conversation["messages"][-1]["content"] = content
        
        conv_path = FileStorage._get_conversation_path(conv_id)
        with open(conv_path, 'w', encoding='utf-8') as f:
            json.dump(conversation, f, ensure_ascii=False, indent=2)
        
        return conversation["messages"][-1]
    
    @staticmethod
    def delete_message(conv_id: str, message_id: str) -> bool:
        """Delete a message from a conversation"""
        conversation = FileStorage.get_conversation(conv_id)
        if not conversation:
            return False
        
        # Find and remove the message
        original_length = len(conversation["messages"])
        conversation["messages"] = [m for m in conversation["messages"] if m["id"] != message_id]
        
        # Check if message was actually deleted
        if len(conversation["messages"]) == original_length:
            return False
        
        conv_path = FileStorage._get_conversation_path(conv_id)
        with open(conv_path, 'w', encoding='utf-8') as f:
            json.dump(conversation, f, ensure_ascii=False, indent=2)
        
        return True
    
    @staticmethod
    def update_message(conv_id: str, message_id: str, content: str) -> Optional[Dict[str, Any]]:
        """Update a message's content"""
        conversation = FileStorage.get_conversation(conv_id)
        if not conversation:
            return None
        
        # Find and update the message
        for message in conversation["messages"]:
            if message["id"] == message_id:
                # Store original content if not already edited
                if not message.get("edited"):
                    message["original_content"] = message["content"]
                message["content"] = content
                message["edited"] = True
                
                conv_path = FileStorage._get_conversation_path(conv_id)
                with open(conv_path, 'w', encoding='utf-8') as f:
                    json.dump(conversation, f, ensure_ascii=False, indent=2)
                
                return message
        
        return None
