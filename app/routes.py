from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.document_parser import (
    extract_text_from_pdf, extract_text_from_docx, extract_text_from_txt,
    extract_text_from_csv, extract_text_from_excel, extract_text_from_markdown,
    extract_text_from_html, extract_text_from_rtf, extract_text_from_code,
    CODE_EXTENSIONS
)
from typing import List, Optional, AsyncIterator
from pydantic import BaseModel
import os
import httpx
import json
import re

router = APIRouter()

# Ollama configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama2")

# Pydantic models for request bodies
class MultiDocConversationRequest(BaseModel):
    documentIds: List[str]

class ChatRequest(BaseModel):
    documentId: str
    conversationId: Optional[str] = None
    question: str
    model: Optional[str] = None

class MultiChatRequest(BaseModel):
    documentIds: List[str]
    conversationId: Optional[str] = None
    question: str
    model: Optional[str] = None

@router.get("/api/models")
async def get_models():
    """Get available Ollama models"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = [
                    {
                        "name": model.get("name"),
                        "size": model.get("size"),
                        "modified": model.get("modified_at")
                    }
                    for model in data.get("models", [])
                ]
                return models
    except Exception as e:
        print(f"Failed to fetch Ollama models: {e}")
    return []

@router.get("/api/documents")
async def get_documents(db: Session = Depends(get_db)):
    """Get all documents"""
    documents = db.query(models.Document).all()
    return documents

@router.get("/api/documents/{document_id}")
async def get_document(document_id: str, db: Session = Depends(get_db)):
    """Get single document"""
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@router.delete("/api/documents/{document_id}")
async def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Delete document"""
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(document)
    db.commit()
    return {"success": True}

@router.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload document with auto text extraction"""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Read file content
        content_bytes = await file.read()
        file_size = len(content_bytes)
        
        # Check file size (10MB limit)
        if file_size > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
        # Get file extension
        extension = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        mimetype = file.content_type or ''
        
        # Extract text based on file type
        content = ""
        
        if mimetype == "application/pdf":
            content = await extract_text_from_pdf(content_bytes)
        elif mimetype == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            content = await extract_text_from_docx(content_bytes)
        elif mimetype == "text/plain" or extension == "txt":
            content = await extract_text_from_txt(content_bytes)
        elif mimetype == "text/csv" or extension == "csv":
            content = await extract_text_from_csv(content_bytes)
        elif mimetype in ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"] or extension in ["xlsx", "xls"]:
            content = await extract_text_from_excel(content_bytes)
        elif mimetype == "text/markdown" or extension == "md":
            content = await extract_text_from_markdown(content_bytes)
        elif mimetype == "text/html" or extension in ["html", "htm"]:
            content = await extract_text_from_html(content_bytes)
        elif mimetype == "application/rtf" or extension == "rtf":
            content = await extract_text_from_rtf(content_bytes)
        elif extension in CODE_EXTENSIONS:
            content = await extract_text_from_code(content_bytes, extension)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        # Create document in database
        document = models.Document(
            name=file.filename,
            type=mimetype,
            size=file_size,
            content=content
        )
        db.add(document)
        db.commit()
        db.refresh(document)
        
        # Auto-generate summary with Ollama (optional, async)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                summary_prompt = f"""Provide a detailed summary of this document. Include:
1. Main topic and purpose
2. Key points (3-5 bullet points)
3. Important conclusions or takeaways

Document:
{content[:3000]}

Provide the response in JSON format: {{"summary": "...", "briefSummary": "...", "keyPoints": ["...", "..."]}}"""
                
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={"model": OLLAMA_MODEL, "prompt": summary_prompt, "stream": False}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    try:
                        parsed_summary = json.loads(data.get("response", "{}"))
                        document.summary = parsed_summary.get("summary")
                        document.brief_summary = parsed_summary.get("briefSummary")
                        document.key_points = parsed_summary.get("keyPoints", [])
                        db.commit()
                        db.refresh(document)
                    except:
                        pass
        except Exception as e:
            print(f"Summary generation failed: {e}")
        
        return document
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

# ==================== CONVERSATION ENDPOINTS ====================

@router.get("/api/conversations/{document_id}")
async def get_or_create_conversation(document_id: str, db: Session = Depends(get_db)):
    """Get or create conversation for a document"""
    try:
        # Check if document exists
        document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Try to find existing conversation
        conversation = db.query(models.Conversation).filter(
            models.Conversation.document_id == document_id
        ).first()
        
        # Create new conversation if none exists
        if not conversation:
            conversation = models.Conversation(document_id=document_id)
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
        
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get conversation: {str(e)}")

@router.post("/api/conversations/multi")
async def create_multi_doc_conversation(
    request: MultiDocConversationRequest,
    db: Session = Depends(get_db)
):
    """Create multi-document conversation"""
    try:
        if not request.documentIds or len(request.documentIds) == 0:
            raise HTTPException(status_code=400, detail="Document IDs are required")
        
        # Verify documents exist
        for doc_id in request.documentIds:
            document = db.query(models.Document).filter(models.Document.id == doc_id).first()
            if not document:
                raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
        
        # Create conversation with multiple documents
        conversation = models.Conversation(document_ids=request.documentIds)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create multi-document conversation: {str(e)}")

@router.get("/api/messages/{conversation_id}")
async def get_messages(conversation_id: str, db: Session = Depends(get_db)):
    """Get messages for a conversation"""
    try:
        # Verify conversation exists
        conversation = db.query(models.Conversation).filter(
            models.Conversation.id == conversation_id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Get messages ordered by creation time
        messages = db.query(models.Message).filter(
            models.Message.conversation_id == conversation_id
        ).order_by(models.Message.created_at).all()
        
        return messages
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch messages: {str(e)}")

# ==================== CHAT ENDPOINTS WITH SSE STREAMING ====================

async def stream_chat_response(
    db: Session,
    document: models.Document,
    conversation_id: str,
    question: str,
    model_name: str,
    context_messages: List[dict]
) -> AsyncIterator[str]:
    """Stream chat response using SSE format"""
    try:
        # Validate document content
        if not document.content or document.content.strip() == "" or len(document.content.strip()) < 10:
            refusal_message = "I cannot answer questions about this document because it appears to be empty or contains insufficient content. Please upload a document with readable text."
            
            # Update assistant message in DB
            assistant_msg = db.query(models.Message).filter(
                models.Message.conversation_id == conversation_id,
                models.Message.role == "assistant"
            ).order_by(models.Message.created_at.desc()).first()
            
            if assistant_msg:
                assistant_msg.content = refusal_message
                db.commit()
            
            yield f'data: {json.dumps({"type": "token", "content": refusal_message})}\n\n'
            yield f'data: {json.dumps({"type": "done"})}\n\n'
            return
        
        # Build the prompt with strict instructions
        context_history = "\n".join([f"{msg['role']}: {msg['content']}" for msg in context_messages])
        
        prompt = f"""SYSTEM INSTRUCTIONS:
You are a document analysis assistant. Your ONLY role is to answer questions based strictly on the content of the provided document.

STRICT RULES:
1. ONLY answer questions that can be answered using information found in the document below
2. If a question cannot be answered from the document, politely decline and explain that the information is not in the document
3. ALWAYS cite specific passages or sections from the document when answering
4. DO NOT use external knowledge, general facts, or information not present in the document
5. If the question is unclear or ambiguous, ask the user to clarify before attempting to answer
6. If multiple interpretations are possible based on the document, present all relevant perspectives found in the document

DOCUMENT CONTENT:
{document.content}

CONVERSATION HISTORY:
{context_history}

USER QUESTION: {question}

RESPONSE INSTRUCTIONS:
- Answer ONLY using information from the document above
- Quote or reference specific parts of the document in your response
- If the answer is not in the document, respond with: "I cannot answer this question because the information is not present in the provided document. Please ask a question about the document's content."
- Be helpful and thorough, but stay within the document's scope"""

        # Call Ollama API with streaming
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": model_name, "prompt": prompt, "stream": True}
            ) as response:
                if response.status_code != 200:
                    raise Exception(f"Ollama API error: {response.status_code}")
                
                full_response = ""
                async for line in response.aiter_lines():
                    if line.strip():
                        try:
                            data = json.loads(line)
                            if "response" in data and data["response"]:
                                token = data["response"]
                                full_response += token
                                yield f'data: {json.dumps({"type": "token", "content": token})}\n\n'
                        except json.JSONDecodeError:
                            continue
                
                # Post-response verification
                has_document_reference = len(full_response) > 50 and (
                    "document" in full_response.lower() or
                    "according to" in full_response.lower() or
                    "the text" in full_response.lower() or
                    "states that" in full_response.lower() or
                    "mentions" in full_response.lower() or
                    bool(re.search(r'["\'].*["\']', full_response))
                )
                
                is_refusal = (
                    "cannot answer" in full_response.lower() or
                    "not present in" in full_response.lower() or
                    "not found in" in full_response.lower() or
                    "information is not" in full_response.lower()
                )
                
                # Add warning if response doesn't reference document
                if not has_document_reference and not is_refusal and len(full_response) > 20:
                    warning_message = "\n\n⚠️ Note: This response may not be based solely on the document content. Please verify the information against the source document."
                    full_response += warning_message
                    yield f'data: {json.dumps({"type": "token", "content": warning_message})}\n\n'
                    print(f"Warning: Response may be out of scope for document: {document.id}")
                
                # Update assistant message in DB
                assistant_msg = db.query(models.Message).filter(
                    models.Message.conversation_id == conversation_id,
                    models.Message.role == "assistant"
                ).order_by(models.Message.created_at.desc()).first()
                
                if assistant_msg:
                    assistant_msg.content = full_response
                    db.commit()
                
                yield f'data: {json.dumps({"type": "done"})}\n\n'
                
    except Exception as e:
        error_msg = f"Error during streaming: {str(e)}"
        print(error_msg)
        yield f'data: {json.dumps({"type": "error", "content": error_msg})}\n\n'
        yield f'data: {json.dumps({"type": "done"})}\n\n'

@router.post("/api/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """Single document chat with SSE streaming"""
    try:
        if not request.question:
            raise HTTPException(status_code=400, detail="Question is required")
        
        # Get document
        document = db.query(models.Document).filter(
            models.Document.id == request.documentId
        ).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Get or create conversation
        conversation_id = request.conversationId
        if not conversation_id:
            conversation = models.Conversation(document_id=request.documentId)
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            conversation_id = conversation.id
        
        # Create user message
        user_message = models.Message(
            conversation_id=conversation_id,
            role="user",
            content=request.question
        )
        db.add(user_message)
        db.commit()
        
        # Get previous messages for context (last 6)
        previous_messages = db.query(models.Message).filter(
            models.Message.conversation_id == conversation_id
        ).order_by(models.Message.created_at).all()
        
        context_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in previous_messages[-6:]
        ]
        
        # Create assistant message placeholder
        assistant_message = models.Message(
            conversation_id=conversation_id,
            role="assistant",
            content=""
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)
        
        # Determine model to use
        model_name = request.model or OLLAMA_MODEL
        
        async def generate():
            # Send message ID first
            yield f'data: {json.dumps({"type": "message_id", "messageId": assistant_message.id})}\n\n'
            
            # Stream the response
            async for chunk in stream_chat_response(
                db, document, conversation_id, request.question, model_name, context_messages
            ):
                yield chunk
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")

async def stream_multi_chat_response(
    db: Session,
    documents: List[models.Document],
    conversation_id: str,
    question: str,
    model_name: str,
    context_messages: List[dict]
) -> AsyncIterator[str]:
    """Stream multi-document chat response using SSE format"""
    try:
        # Validate document content and filter
        valid_content_documents = [
            doc for doc in documents
            if doc.content and doc.content.strip() and len(doc.content.strip()) >= 10
        ]
        
        excluded_docs = [
            doc for doc in documents
            if not doc.content or not doc.content.strip() or len(doc.content.strip()) < 10
        ]
        
        if len(valid_content_documents) == 0:
            refusal_message = "I cannot answer questions about these documents because they appear to be empty or contain insufficient content. Please upload documents with readable text."
            
            # Update assistant message in DB
            assistant_msg = db.query(models.Message).filter(
                models.Message.conversation_id == conversation_id,
                models.Message.role == "assistant"
            ).order_by(models.Message.created_at.desc()).first()
            
            if assistant_msg:
                assistant_msg.content = refusal_message
                db.commit()
            
            yield f'data: {json.dumps({"type": "token", "content": refusal_message})}\n\n'
            yield f'data: {json.dumps({"type": "done"})}\n\n'
            return
        
        # Warn if some documents were excluded
        warning_prefix = ""
        if len(excluded_docs) > 0:
            excluded_names = ", ".join([f'"{doc.name}"' for doc in excluded_docs])
            warning_prefix = f"⚠️ Note: {len(excluded_docs)} document(s) were excluded due to insufficient content: {excluded_names}\n\nAnalyzing remaining {len(valid_content_documents)} document(s):\n\n"
            yield f'data: {json.dumps({"type": "token", "content": warning_prefix})}\n\n'
            print(f"Excluded {len(excluded_docs)} documents from multi-doc chat: {excluded_names}")
        
        # Build document list and combined content
        document_list = ", ".join([
            f'[Document {idx + 1}: "{doc.name}"]'
            for idx, doc in enumerate(valid_content_documents)
        ])
        
        combined_content = "\n\n".join([
            f'=== DOCUMENT {idx + 1}: "{doc.name}" ===\n{doc.content}\n=== END OF DOCUMENT {idx + 1} ==='
            for idx, doc in enumerate(valid_content_documents)
        ])
        
        # Build context history
        context_history = "\n".join([f"{msg['role']}: {msg['content']}" for msg in context_messages])
        
        prompt = f"""SYSTEM INSTRUCTIONS:
You are a multi-document analysis assistant. Your ONLY role is to answer questions based strictly on the content of the provided documents.

STRICT RULES:
1. ONLY answer questions using information found in the documents below
2. ALWAYS specify which document(s) you're referencing (use document numbers and names)
3. When comparing documents, only compare information that is actually present in the documents
4. DO NOT make assumptions or use external knowledge not found in the documents
5. If a question cannot be answered from the documents, politely decline and explain what's missing
6. If documents contradict each other, acknowledge both perspectives and cite the specific documents
7. When information spans multiple documents, clearly attribute each piece of information to its source

AVAILABLE DOCUMENTS:
{document_list}

DOCUMENT CONTENTS:
{combined_content}

CONVERSATION HISTORY:
{context_history}

USER QUESTION: {question}

RESPONSE INSTRUCTIONS:
- Answer ONLY using information from the documents above
- Always cite which document you're referencing (e.g., "According to Document 1 (filename.pdf)...")
- If comparing documents, only compare information that exists in both
- If the answer is not in any document, respond with: "I cannot answer this question because the information is not present in the provided documents. Please ask a question about the documents' content."
- Be thorough but stay within the documents' scope"""

        # Call Ollama API with streaming
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": model_name, "prompt": prompt, "stream": True}
            ) as response:
                if response.status_code != 200:
                    raise Exception(f"Ollama API error: {response.status_code}")
                
                full_response = ""
                async for line in response.aiter_lines():
                    if line.strip():
                        try:
                            data = json.loads(line)
                            if "response" in data and data["response"]:
                                token = data["response"]
                                full_response += token
                                yield f'data: {json.dumps({"type": "token", "content": token})}\n\n'
                        except json.JSONDecodeError:
                            continue
                
                # Post-response verification
                has_document_reference = len(full_response) > 50 and (
                    "document" in full_response.lower() or
                    bool(re.search(r'document\s+\d+', full_response.lower())) or
                    "according to" in full_response.lower() or
                    "the text" in full_response.lower() or
                    "states that" in full_response.lower() or
                    "mentions" in full_response.lower() or
                    any(doc.name.lower()[:15] in full_response.lower() for doc in valid_content_documents) or
                    bool(re.search(r'["\'].*["\']', full_response))
                )
                
                is_refusal = (
                    "cannot answer" in full_response.lower() or
                    "not present in" in full_response.lower() or
                    "not found in" in full_response.lower() or
                    "information is not" in full_response.lower()
                )
                
                # Add warning if response doesn't reference documents
                if not has_document_reference and not is_refusal and len(full_response) > 20:
                    warning_message = "\n\n⚠️ Note: This response may not be based solely on the provided documents. Please verify the information against the source documents."
                    full_response += warning_message
                    yield f'data: {json.dumps({"type": "token", "content": warning_message})}\n\n'
                    doc_ids = [doc.id for doc in documents]
                    print(f"Warning: Response may be out of scope for multi-document chat: {doc_ids}")
                
                # Prepend any document exclusion warnings to final stored message
                final_message = warning_prefix + full_response
                
                # Update assistant message in DB
                assistant_msg = db.query(models.Message).filter(
                    models.Message.conversation_id == conversation_id,
                    models.Message.role == "assistant"
                ).order_by(models.Message.created_at.desc()).first()
                
                if assistant_msg:
                    assistant_msg.content = final_message
                    db.commit()
                
                yield f'data: {json.dumps({"type": "done"})}\n\n'
                
    except Exception as e:
        error_msg = f"Error during streaming: {str(e)}"
        print(error_msg)
        yield f'data: {json.dumps({"type": "error", "content": error_msg})}\n\n'
        yield f'data: {json.dumps({"type": "done"})}\n\n'

@router.post("/api/chat/multi")
async def multi_chat(request: MultiChatRequest, db: Session = Depends(get_db)):
    """Multi-document chat with SSE streaming"""
    try:
        if not request.question:
            raise HTTPException(status_code=400, detail="Question is required")
        
        if not request.documentIds or len(request.documentIds) == 0:
            raise HTTPException(status_code=400, detail="Document IDs are required")
        
        # Get documents
        documents = []
        for doc_id in request.documentIds:
            doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
            if doc:
                documents.append(doc)
        
        if len(documents) == 0:
            raise HTTPException(status_code=404, detail="No valid documents found")
        
        # Get or create conversation
        conversation_id = request.conversationId
        if not conversation_id:
            conversation = models.Conversation(document_ids=request.documentIds)
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            conversation_id = conversation.id
        
        # Create user message
        user_message = models.Message(
            conversation_id=conversation_id,
            role="user",
            content=request.question
        )
        db.add(user_message)
        db.commit()
        
        # Get previous messages for context (last 6)
        previous_messages = db.query(models.Message).filter(
            models.Message.conversation_id == conversation_id
        ).order_by(models.Message.created_at).all()
        
        context_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in previous_messages[-6:]
        ]
        
        # Create assistant message placeholder
        assistant_message = models.Message(
            conversation_id=conversation_id,
            role="assistant",
            content=""
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)
        
        # Determine model to use
        model_name = request.model or OLLAMA_MODEL
        
        async def generate():
            # Send message ID first
            yield f'data: {json.dumps({"type": "message_id", "messageId": assistant_message.id})}\n\n'
            
            # Stream the response
            async for chunk in stream_multi_chat_response(
                db, documents, conversation_id, request.question, model_name, context_messages
            ):
                yield chunk
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Multi-chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process multi-document chat: {str(e)}")
