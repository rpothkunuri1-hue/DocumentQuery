from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, Response
from app.file_storage import FileStorage
from app.document_parser import extract_text_from_pdf
from typing import List, Optional, AsyncIterator
from pydantic import BaseModel
import os
import httpx
import json
import re
from fpdf import FPDF
import asyncio

router = APIRouter()

# Ollama configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", None)

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
async def get_documents():
    """Get all documents"""
    documents = FileStorage.get_all_documents()
    return documents

@router.get("/api/documents/{document_id}")
async def get_document(document_id: str):
    """Get single document"""
    document = FileStorage.get_document(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@router.delete("/api/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete document"""
    success = FileStorage.delete_document(document_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True}

@router.get("/api/documents/{document_id}/summary-status")
async def stream_summary_status(document_id: str):
    """Stream summary status updates via SSE with progress tracking and keep-alive"""
    async def generate():
        import time
        max_duration = 300  # 5 minutes max duration for SSE stream
        keep_alive_interval = 15  # Send keep-alive every 15 seconds
        start_time = time.time()
        last_keepalive_time = start_time
        last_progress = -1
        last_status = None
        
        while True:
            try:
                current_time = time.time()
                elapsed = current_time - start_time
                time_since_keepalive = current_time - last_keepalive_time
                
                # Check max duration timeout
                if elapsed > max_duration:
                    yield f'data: {json.dumps({"type": "timeout", "message": "Maximum duration exceeded", "last_progress": last_progress})}\n\n'
                    break
                
                document = FileStorage.get_document(document_id)
                if not document:
                    yield f'data: {json.dumps({"type": "error", "message": "Document not found"})}\n\n'
                    break
                
                # Normalize status: None -> "none" for proper comparison
                current_status = document.get("summary_status") or "none"
                current_progress = document.get("summary_progress", 0)
                current_message = document.get("summary_message") or ""
                
                # Send update if status or progress changed
                if current_status != last_status or current_progress != last_progress:
                    progress_data = {
                        "type": "progress",
                        "status": current_status,
                        "progress": current_progress,
                        "message": current_message,
                        "summary": document.get("summary", "")
                    }
                    yield f'data: {json.dumps(progress_data)}\n\n'
                    last_status = current_status
                    last_progress = current_progress
                    last_keepalive_time = current_time  # Reset keep-alive timer on update
                # Send keep-alive heartbeat to prevent connection timeout
                elif time_since_keepalive >= keep_alive_interval:
                    yield f': keep-alive\n\n'
                    last_keepalive_time = current_time
                
                # Exit on terminal states
                if current_status in ["completed", "failed", "none"]:
                    yield f'data: {json.dumps({"type": "done"})}\n\n'
                    break
                
                await asyncio.sleep(0.5)  # Check every 0.5 seconds
                
            except Exception as e:
                print(f"[SSE ERROR] Summary status stream error: {e}")
                yield f'data: {json.dumps({"type": "error", "message": str(e)})}\n\n'
                break
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

async def generate_document_summary_streaming(content: str, model_name: str, document_id: str, max_retries: int = 3) -> str:
    """Generate a summary of the document using Ollama with streaming and progress updates"""
    
    # Limit content for summary (first 2000 characters to avoid token limits)
    truncated_content = content[:2000] if len(content) > 2000 else content
    
    prompt = f"""Please provide a concise summary of the following document in 2-3 sentences. Focus on the main topics, key points, and overall purpose of the document.

DOCUMENT CONTENT:
{truncated_content}

SUMMARY:"""

    for attempt in range(max_retries):
        try:
            print(f"[SUMMARY] Attempt {attempt + 1}/{max_retries} - Requesting summary for model '{model_name}' (content length: {len(truncated_content)} chars)")
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                summary = ""
                # Use streaming to provide real-time progress
                async with client.stream(
                    "POST",
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={"model": model_name, "prompt": prompt, "stream": True}
                ) as response:
                    
                    if response.status_code == 404:
                        print(f"[SUMMARY ERROR] Model '{model_name}' not found in Ollama")
                        return ""
                    elif response.status_code != 200:
                        error_text = await response.aread()
                        print(f"[SUMMARY ERROR] Ollama API returned status {response.status_code}: {error_text.decode()}")
                        if attempt < max_retries - 1:
                            await asyncio.sleep(2 ** attempt)
                            continue
                        return ""
                    
                    # Stream the response and update progress
                    token_count = 0
                    async for line in response.aiter_lines():
                        if line.strip():
                            try:
                                data = json.loads(line)
                                if "response" in data and data["response"]:
                                    summary += data["response"]
                                    token_count += 1
                                    
                                    # Update progress every 5 tokens (smoother updates)
                                    if token_count % 5 == 0:
                                        # Progress from 50% to 85% during generation
                                        progress = min(50 + (token_count * 35 // 100), 85)
                                        FileStorage.update_document(document_id, {
                                            "summary_progress": progress,
                                            "summary_message": f"Generating summary... ({token_count} tokens)"
                                        })
                            except json.JSONDecodeError:
                                continue
                    
                    print(f"[SUMMARY] Successfully generated summary ({len(summary)} chars)")
                    return summary.strip()
                    
        except httpx.ConnectError as e:
            print(f"[SUMMARY ERROR] Cannot connect to Ollama at {OLLAMA_BASE_URL}: {e}")
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"  Retrying in {wait_time} seconds...")
                await asyncio.sleep(wait_time)
                continue
            return ""
        except httpx.ReadTimeout as e:
            print(f"[SUMMARY ERROR] Ollama request timed out after 120s: {e}")
            if attempt < max_retries - 1:
                print(f"  Retrying...")
                await asyncio.sleep(2)
                continue
            return ""
        except Exception as e:
            print(f"[SUMMARY ERROR] Failed to generate summary: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
                continue
            return ""
    
    return ""

async def generate_summary_background(document_id: str, content: str, model: str):
    """Generate summary in the background and update document with progress"""
    try:
        print(f"[BACKGROUND] Starting summary generation for document {document_id}")
        
        # Step 1: Initialize (10%)
        FileStorage.update_document(document_id, {
            "summary_progress": 10,
            "summary_message": "Preparing document..."
        })
        await asyncio.sleep(0.1)
        
        # Step 2: Analyzing content (30%)
        FileStorage.update_document(document_id, {
            "summary_progress": 30,
            "summary_message": "Analyzing document content..."
        })
        await asyncio.sleep(0.1)
        
        # Step 3: Calling Ollama with streaming (50% - 85% handled in streaming function)
        FileStorage.update_document(document_id, {
            "summary_progress": 50,
            "summary_message": f"Generating summary with {model}..."
        })
        
        # Generate the actual summary with streaming progress updates
        summary = await generate_document_summary_streaming(content, model, document_id)
        
        if summary:
            # Step 4: Finalizing (90%)
            FileStorage.update_document(document_id, {
                "summary_progress": 90,
                "summary_message": "Finalizing summary..."
            })
            await asyncio.sleep(0.1)
            
            # Step 5: Complete (100%)
            print(f"[BACKGROUND] Summary completed for document {document_id}")
            FileStorage.update_document(document_id, {
                "summary": summary, 
                "summary_status": "completed",
                "summary_progress": 100,
                "summary_message": "Summary complete"
            })
        else:
            print(f"[BACKGROUND] Summary generation returned empty for document {document_id}")
            FileStorage.update_document(document_id, {
                "summary_status": "failed",
                "summary_progress": 0,
                "summary_message": "Failed to generate summary. Please check if Ollama is running and the model is available."
            })
    except Exception as e:
        print(f"[BACKGROUND ERROR] Summary generation failed for document {document_id}: {e}")
        import traceback
        traceback.print_exc()
        FileStorage.update_document(document_id, {
            "summary_status": "failed",
            "summary_progress": 0,
            "summary_message": f"Error: {str(e)}"
        })

@router.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...), model: Optional[str] = None):
    """Upload document with auto text extraction and background summary generation"""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Read file content in chunks to handle larger files
        content_bytes = bytearray()
        file_size = 0
        chunk_size = 1024 * 1024  # 1MB chunks
        
        while chunk := await file.read(chunk_size):
            file_size += len(chunk)
            # Check file size limit during reading
            if file_size > 10 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="File size exceeds 10MB limit")
            content_bytes.extend(chunk)
        
        content_bytes = bytes(content_bytes)
        
        # Get file extension
        extension = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        mimetype = file.content_type or ''
        
        # Only support PDF files
        if mimetype != "application/pdf" and extension != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF files are supported. Please upload a PDF document.")
        
        # Extract text from PDF
        content = await extract_text_from_pdf(content_bytes)
        
        # Create document in file storage
        document = FileStorage.create_document(
            name=file.filename,
            type=mimetype,
            size=file_size,
            content=content
        )
        
        # Mark summary as generating if model is provided
        if model and content and len(content.strip()) >= 50 and document:
            updated_doc = FileStorage.update_document(document["id"], {"summary_status": "generating"})
            if updated_doc:
                document = updated_doc
                # Generate summary in background using asyncio
                asyncio.create_task(generate_summary_background(document["id"], content, model))
        elif model and (not content or len(content.strip()) < 50):
            print(f"[UPLOAD] Document content too short for summary (length: {len(content.strip()) if content else 0})")
        
        return document
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

# ==================== CONVERSATION ENDPOINTS ====================

@router.get("/api/conversations/{document_id}")
async def get_or_create_conversation(document_id: str):
    """Get or create conversation for a document"""
    try:
        # Check if document exists
        document = FileStorage.get_document(document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Try to find existing conversation
        conversation = FileStorage.get_conversation_by_document(document_id)
        
        # Create new conversation if none exists
        if not conversation:
            conversation = FileStorage.create_conversation(document_id=document_id)
        
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get conversation: {str(e)}")

@router.post("/api/conversations/multi")
async def create_multi_doc_conversation(request: MultiDocConversationRequest):
    """Create multi-document conversation"""
    try:
        if not request.documentIds or len(request.documentIds) == 0:
            raise HTTPException(status_code=400, detail="Document IDs are required")
        
        # Verify documents exist
        for doc_id in request.documentIds:
            document = FileStorage.get_document(doc_id)
            if not document:
                raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
        
        # Create conversation with multiple documents
        conversation = FileStorage.create_conversation(document_ids=request.documentIds)
        
        return conversation
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create multi-document conversation: {str(e)}")

@router.get("/api/messages/{conversation_id}")
async def get_messages(conversation_id: str):
    """Get messages for a conversation"""
    try:
        # Verify conversation exists
        conversation = FileStorage.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Get messages
        messages = FileStorage.get_messages(conversation_id)
        
        return messages
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch messages: {str(e)}")

# ==================== CHAT ENDPOINTS WITH SSE STREAMING ====================

async def stream_chat_response(
    document: dict,
    conversation_id: str,
    question: str,
    model_name: str,
    context_messages: List[dict]
) -> AsyncIterator[str]:
    """Stream chat response using SSE format"""
    try:
        # Validate document content
        if not document.get("content") or document["content"].strip() == "" or len(document["content"].strip()) < 10:
            refusal_message = "I cannot answer questions about this document because it appears to be empty or contains insufficient content. Please upload a document with readable text."
            
            # Update assistant message
            FileStorage.update_last_message(conversation_id, refusal_message)
            
            yield f'data: {json.dumps({"type": "token", "content": refusal_message})}\n\n'
            yield f'data: {json.dumps({"type": "done"})}\n\n'
            return
        
        # Check for greetings
        greeting_patterns = ['hi', 'hey', 'hello', 'greetings', 'howdy', 'sup', 'hiya']
        question_lower = question.strip().lower()
        is_greeting = any(question_lower == pattern or question_lower == pattern + '!' for pattern in greeting_patterns)
        
        if is_greeting:
            greeting_response = "What can I tell you about the document?"
            FileStorage.update_last_message(conversation_id, greeting_response)
            yield f'data: {json.dumps({"type": "token", "content": greeting_response})}\n\n'
            yield f'data: {json.dumps({"type": "done"})}\n\n'
            return
        
        # Build the prompt with strict instructions
        context_history = "\n".join([f"{msg['role']}: {msg['content']}" for msg in context_messages])
        
        # Extract document name and create suggestions
        doc_name = document.get("name", "this document")
        doc_content_preview = document["content"][:200].strip()
        
        prompt = f"""SYSTEM INSTRUCTIONS:
You are a document analysis assistant. Your ONLY role is to answer questions based strictly on the content of the provided document.

STRICT RULES:
1. ONLY answer questions that can be answered using information found in the document below
2. If a question is out of scope (not related to document content), politely redirect the user to ask about the document and provide 2-3 relevant example questions based on the document content
3. ALWAYS cite specific passages or sections from the document when answering
4. DO NOT use external knowledge, general facts, or information not present in the document
5. If the question is unclear or ambiguous, ask the user to clarify
6. If multiple interpretations are possible based on the document, present all relevant perspectives found in the document

DOCUMENT NAME: {doc_name}

DOCUMENT CONTENT:
{document["content"]}

CONVERSATION HISTORY:
{context_history}

USER QUESTION: {question}

RESPONSE INSTRUCTIONS:
- If the question IS about the document: Answer using ONLY information from the document and cite specific passages
- If the question is NOT about the document or out of scope: Respond with "I can only answer questions about {doc_name}. Here are some questions you could ask:" followed by 2-3 relevant example questions based on the document's actual content
- Be precise, helpful, and stay within the document's scope"""

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
                    print(f"Warning: Response may be out of scope for document: {document['id']}")
                
                # Update assistant message
                FileStorage.update_last_message(conversation_id, full_response)
                
                yield f'data: {json.dumps({"type": "done"})}\n\n'
                
    except Exception as e:
        error_msg = f"Error during streaming: {str(e)}"
        print(error_msg)
        yield f'data: {json.dumps({"type": "error", "content": error_msg})}\n\n'
        yield f'data: {json.dumps({"type": "done"})}\n\n'

@router.post("/api/chat")
async def chat(request: ChatRequest):
    """Single document chat with SSE streaming"""
    try:
        if not request.question:
            raise HTTPException(status_code=400, detail="Question is required")
        
        # Get document
        document = FileStorage.get_document(request.documentId)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Get or create conversation
        conversation_id = request.conversationId
        if not conversation_id:
            conversation = FileStorage.create_conversation(document_id=request.documentId)
            conversation_id = conversation["id"]
        
        # Create user message
        user_message = FileStorage.add_message(
            conversation_id,
            role="user",
            content=request.question
        )
        
        # Get previous messages for context (last 6)
        all_messages = FileStorage.get_messages(conversation_id)
        context_messages = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in all_messages[-6:]
        ]
        
        # Create assistant message placeholder
        assistant_message = FileStorage.add_message(
            conversation_id,
            role="assistant",
            content=""
        )
        
        # Determine model to use
        if not request.model and not OLLAMA_MODEL:
            raise HTTPException(status_code=400, detail="No model specified. Please select a model from the dropdown.")
        model_name = request.model if request.model else OLLAMA_MODEL
        
        if not model_name:
            raise HTTPException(status_code=400, detail="No model specified. Please select a model from the dropdown.")
        
        async def generate():
            # Send message ID first
            if assistant_message and "id" in assistant_message:
                yield f'data: {json.dumps({"type": "message_id", "messageId": assistant_message["id"]})}\n\n'
            
            # Stream the response
            async for chunk in stream_chat_response(
                document, conversation_id, request.question, model_name, context_messages
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
    documents: List[dict],
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
            if doc.get("content") and doc["content"].strip() and len(doc["content"].strip()) >= 10
        ]
        
        excluded_docs = [
            doc for doc in documents
            if not doc.get("content") or not doc["content"].strip() or len(doc["content"].strip()) < 10
        ]
        
        if len(valid_content_documents) == 0:
            refusal_message = "I cannot answer questions about these documents because they appear to be empty or contain insufficient content. Please upload documents with readable text."
            
            # Update assistant message
            FileStorage.update_last_message(conversation_id, refusal_message)
            
            yield f'data: {json.dumps({"type": "token", "content": refusal_message})}\n\n'
            yield f'data: {json.dumps({"type": "done"})}\n\n'
            return
        
        # Check for greetings
        greeting_patterns = ['hi', 'hey', 'hello', 'greetings', 'howdy', 'sup', 'hiya']
        question_lower = question.strip().lower()
        is_greeting = any(question_lower == pattern or question_lower == pattern + '!' for pattern in greeting_patterns)
        
        if is_greeting:
            doc_names = ", ".join([f'"{doc["name"]}"' for doc in valid_content_documents])
            greeting_response = f"What can I tell you about these documents: {doc_names}?"
            FileStorage.update_last_message(conversation_id, greeting_response)
            yield f'data: {json.dumps({"type": "token", "content": greeting_response})}\n\n'
            yield f'data: {json.dumps({"type": "done"})}\n\n'
            return
        
        # Warn if some documents were excluded
        warning_prefix = ""
        if len(excluded_docs) > 0:
            excluded_names = ", ".join([f'"{doc["name"]}"' for doc in excluded_docs])
            warning_prefix = f"⚠️ Note: {len(excluded_docs)} document(s) were excluded due to insufficient content: {excluded_names}\n\nAnalyzing remaining {len(valid_content_documents)} document(s):\n\n"
            yield f'data: {json.dumps({"type": "token", "content": warning_prefix})}\n\n'
            print(f"Excluded {len(excluded_docs)} documents from multi-doc chat: {excluded_names}")
        
        # Build document list and combined content
        document_list = ", ".join([
            f'[Document {idx + 1}: "{doc["name"]}"]'
            for idx, doc in enumerate(valid_content_documents)
        ])
        
        combined_content = "\n\n".join([
            f'=== DOCUMENT {idx + 1}: "{doc["name"]}" ===\n{doc["content"]}\n=== END OF DOCUMENT {idx + 1} ==='
            for idx, doc in enumerate(valid_content_documents)
        ])
        
        # Build context history
        context_history = "\n".join([f"{msg['role']}: {msg['content']}" for msg in context_messages])
        
        prompt = f"""SYSTEM INSTRUCTIONS:
You are a multi-document analysis assistant. Your ONLY role is to answer questions based strictly on the content of the provided documents.

STRICT RULES:
1. ONLY answer questions using information found in the documents below
2. ALWAYS specify which document(s) you're referencing (use document numbers and names)
3. If a question is out of scope (not related to document content), politely redirect the user to ask about the documents and provide 2-3 relevant example questions based on the documents' actual content
4. When comparing documents, only compare information that is actually present in the documents
5. DO NOT make assumptions or use external knowledge not found in the documents
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
- If the question IS about the documents: Answer using ONLY information from the documents and cite which document you're referencing (e.g., "According to Document 1 (filename.pdf)...")
- If the question is NOT about the documents or out of scope: Respond with "I can only answer questions about these documents. Here are some questions you could ask:" followed by 2-3 relevant example questions based on the documents' actual content
- Be precise, helpful, and stay within the documents' scope"""

        # Call Ollama API with streaming
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": model_name, "prompt": prompt, "stream": True}
            ) as response:
                if response.status_code != 200:
                    raise Exception(f"Ollama API error: {response.status_code}")
                
                full_response = warning_prefix
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
                
                # Update assistant message
                FileStorage.update_last_message(conversation_id, full_response)
                
                yield f'data: {json.dumps({"type": "done"})}\n\n'
                
    except Exception as e:
        error_msg = f"Error during streaming: {str(e)}"
        print(error_msg)
        yield f'data: {json.dumps({"type": "error", "content": error_msg})}\n\n'
        yield f'data: {json.dumps({"type": "done"})}\n\n'

@router.post("/api/chat/multi")
async def multi_chat(request: MultiChatRequest):
    """Multi-document chat with SSE streaming"""
    try:
        if not request.question:
            raise HTTPException(status_code=400, detail="Question is required")
        
        if not request.documentIds or len(request.documentIds) == 0:
            raise HTTPException(status_code=400, detail="Document IDs are required")
        
        # Get documents
        documents = []
        for doc_id in request.documentIds:
            document = FileStorage.get_document(doc_id)
            if not document:
                raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
            documents.append(document)
        
        # Get or create conversation
        conversation_id = request.conversationId
        if not conversation_id:
            conversation = FileStorage.create_conversation(document_ids=request.documentIds)
            conversation_id = conversation["id"]
        
        # Create user message
        user_message = FileStorage.add_message(
            conversation_id,
            role="user",
            content=request.question
        )
        
        # Get previous messages for context (last 6)
        all_messages = FileStorage.get_messages(conversation_id)
        context_messages = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in all_messages[-6:]
        ]
        
        # Create assistant message placeholder
        assistant_message = FileStorage.add_message(
            conversation_id,
            role="assistant",
            content=""
        )
        
        # Determine model to use
        if not request.model and not OLLAMA_MODEL:
            raise HTTPException(status_code=400, detail="No model specified. Please select a model from the dropdown.")
        model_name = request.model if request.model else OLLAMA_MODEL
        
        if not model_name:
            raise HTTPException(status_code=400, detail="No model specified. Please select a model from the dropdown.")
        
        async def generate():
            # Send message ID first
            if assistant_message and "id" in assistant_message:
                yield f'data: {json.dumps({"type": "message_id", "messageId": assistant_message["id"]})}\n\n'
            
            # Stream the response
            async for chunk in stream_multi_chat_response(
                documents, conversation_id, request.question, model_name, context_messages
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
        raise HTTPException(status_code=500, detail=f"Failed to process multi-chat: {str(e)}")

# ==================== EXPORT ENDPOINTS ====================

class ExportRequest(BaseModel):
    format: str

@router.post("/api/documents/{document_id}/export")
async def export_unified(document_id: str, request: ExportRequest):
    """Unified export endpoint for document summary and conversations"""
    try:
        document = FileStorage.get_document(document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found. The requested document may have been deleted.")
        
        conversation = FileStorage.get_conversation_by_document(document_id)
        messages = FileStorage.get_messages(conversation["id"]) if conversation else []
        
        format_type = request.format.lower()
        
        if format_type == "json":
            return await export_unified_json(document, conversation, messages)
        elif format_type == "markdown" or format_type == "md":
            return await export_unified_markdown(document, conversation, messages)
        elif format_type == "txt":
            return await export_unified_txt(document, conversation, messages)
        elif format_type == "pdf":
            return await export_unified_pdf(document, conversation, messages)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format_type}. Supported formats are: pdf, txt, md, json")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

async def export_unified_json(document: dict, conversation: dict | None, messages: list):
    """Export as JSON with summary and conversations"""
    export_data = {
        "document": {
            "id": document["id"],
            "name": document["name"],
            "type": document["type"],
            "size": document.get("size", 0),
            "uploaded_at": document.get("uploaded_at")
        },
        "summary": {
            "content": document.get("content", "No content available"),
            "word_count": len(document.get("content", "").split()) if document.get("content") else 0
        },
        "conversation": {
            "id": conversation["id"] if conversation else None,
            "created_at": conversation.get("created_at") if conversation else None,
            "message_count": len(messages)
        },
        "messages": messages
    }
    
    json_str = json.dumps(export_data, indent=2)
    safe_filename = document['name'].replace(' ', '_').replace('/', '_')
    return Response(
        content=json_str,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}_export.json"'}
    )

async def export_unified_txt(document: dict, conversation: dict | None, messages: list):
    """Export as TXT with summary and conversations"""
    content = f"Document: {document['name']}\n"
    content += f"Type: {document['type']}\n"
    content += f"Size: {document.get('size', 0) / 1024:.2f} KB\n"
    content += f"Uploaded: {document.get('uploaded_at', 'Unknown')}\n"
    content += "=" * 80 + "\n\n"
    
    content += "DOCUMENT SUMMARY\n"
    content += "=" * 80 + "\n"
    doc_content = document.get('content', 'No content available')
    if not doc_content or doc_content.strip() == "":
        doc_content = "No extractable text content found in this document."
    content += doc_content + "\n\n"
    
    if messages and len(messages) > 0:
        content += "=" * 80 + "\n"
        content += "CONVERSATION HISTORY\n"
        content += "=" * 80 + "\n\n"
        
        for msg in messages:
            role_label = "YOU" if msg["role"] == "user" else "AI"
            content += f"{role_label}:\n{msg['content']}\n\n"
    
    safe_filename = document['name'].replace(' ', '_').replace('/', '_')
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}_export.txt"'}
    )

@router.get("/api/documents/{document_id}/export/json")
async def export_conversation_json(document_id: str):
    """Export conversation as JSON (deprecated - use unified export)"""
    try:
        document = FileStorage.get_document(document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        conversation = FileStorage.get_conversation_by_document(document_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="No conversation found for this document")
        
        messages = FileStorage.get_messages(conversation["id"])
        
        export_data = {
            "document": {
                "id": document["id"],
                "name": document["name"],
                "type": document["type"]
            },
            "conversation": {
                "id": conversation["id"],
                "created_at": conversation.get("created_at")
            },
            "messages": messages
        }
        
        json_str = json.dumps(export_data, indent=2)
        return Response(
            content=json_str,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{document["name"]}_conversation.json"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export as JSON: {str(e)}")

async def export_unified_markdown(document: dict, conversation: dict | None, messages: list):
    """Export as Markdown with summary and conversations"""
    markdown_content = f"# {document['name']}\n\n"
    markdown_content += f"**Type:** {document['type']}  \n"
    markdown_content += f"**Size:** {document.get('size', 0) / 1024:.2f} KB  \n"
    markdown_content += f"**Uploaded:** {document.get('uploaded_at', 'Unknown')}  \n\n"
    markdown_content += "---\n\n"
    
    markdown_content += "## Document Summary\n\n"
    doc_content = document.get('content', 'No content available')
    if not doc_content or doc_content.strip() == "":
        doc_content = "No extractable text content found in this document."
    markdown_content += doc_content + "\n\n"
    
    if messages and len(messages) > 0:
        markdown_content += "---\n\n"
        markdown_content += "## Conversation History\n\n"
        
        for msg in messages:
            role_label = "**You:**" if msg["role"] == "user" else "**AI:**"
            markdown_content += f"{role_label}\n\n{msg['content']}\n\n"
    
    safe_filename = document['name'].replace(' ', '_').replace('/', '_')
    return Response(
        content=markdown_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}_export.md"'}
    )

@router.get("/api/documents/{document_id}/export/markdown")
async def export_conversation_markdown(document_id: str):
    """Export conversation as Markdown (deprecated - use unified export)"""
    try:
        document = FileStorage.get_document(document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        conversation = FileStorage.get_conversation_by_document(document_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="No conversation found for this document")
        
        messages = FileStorage.get_messages(conversation["id"])
        
        markdown_content = f"# Conversation: {document['name']}\n\n"
        markdown_content += f"**Document:** {document['name']}\n"
        markdown_content += f"**Type:** {document['type']}\n\n"
        markdown_content += "---\n\n"
        
        for msg in messages:
            role_label = "**You:**" if msg["role"] == "user" else "**AI:**"
            markdown_content += f"{role_label}\n\n{msg['content']}\n\n"
        
        return Response(
            content=markdown_content,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{document["name"]}_conversation.md"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export as Markdown: {str(e)}")

async def export_unified_pdf(document: dict, conversation: dict | None, messages: list):
    """Export as PDF with summary and conversations"""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    safe_doc_name = document['name'].encode('latin-1', 'replace').decode('latin-1')
    
    # Title
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 10, safe_doc_name, ln=True)
    pdf.ln(5)
    
    # Document info
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, f"Type: {document['type']}", ln=True)
    pdf.cell(0, 5, f"Size: {document.get('size', 0) / 1024:.2f} KB", ln=True)
    pdf.cell(0, 5, f"Uploaded: {document.get('uploaded_at', 'Unknown')}", ln=True)
    pdf.ln(10)
    
    # Document Summary Section
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 8, "Document Summary", ln=True)
    pdf.ln(3)
    
    pdf.set_font("Helvetica", "", 10)
    content = document.get('content', 'No content available')
    if not content or content.strip() == "":
        content = "No extractable text content found in this document."
    safe_content = content.encode('latin-1', 'replace').decode('latin-1')
    pdf.multi_cell(0, 5, safe_content)
    pdf.ln(10)
    
    # Conversation History Section
    if messages and len(messages) > 0:
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 8, "Conversation History", ln=True)
        pdf.ln(5)
        
        for msg in messages:
            safe_msg_content = msg["content"].encode('latin-1', 'replace').decode('latin-1')
            
            if msg["role"] == "user":
                pdf.set_font("Helvetica", "B", 11)
                pdf.set_text_color(37, 99, 235)
                pdf.cell(0, 6, "You:", ln=True)
                pdf.set_font("Helvetica", "", 10)
                pdf.multi_cell(0, 5, safe_msg_content)
            else:
                pdf.set_font("Helvetica", "B", 11)
                pdf.set_text_color(0, 0, 0)
                pdf.cell(0, 6, "AI:", ln=True)
                pdf.set_font("Helvetica", "", 10)
                pdf.multi_cell(0, 5, safe_msg_content)
            pdf.ln(5)
    
    pdf_data = bytes(pdf.output())
    safe_filename = document['name'].replace(' ', '_').replace('/', '_')
    
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}_export.pdf"'}
    )

@router.get("/api/documents/{document_id}/export/pdf")
async def export_conversation_pdf(document_id: str):
    """Export conversation as PDF (deprecated - use unified export)"""
    try:
        document = FileStorage.get_document(document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        conversation = FileStorage.get_conversation_by_document(document_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="No conversation found for this document")
        
        messages = FileStorage.get_messages(conversation["id"])
        
        # Create PDF using fpdf2
        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)
        
        # Title
        pdf.set_font("Helvetica", "B", 20)
        # Handle encoding for document name
        safe_doc_name = document['name'].encode('latin-1', 'replace').decode('latin-1')
        pdf.cell(0, 10, f"Conversation: {safe_doc_name}", ln=True)
        pdf.ln(5)
        
        # Document info
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 6, f"Document: {safe_doc_name}", ln=True)
        pdf.cell(0, 6, f"Type: {document['type']}", ln=True)
        pdf.ln(10)
        
        # Messages
        for msg in messages:
            # Handle encoding for message content
            safe_content = msg["content"].encode('latin-1', 'replace').decode('latin-1')
            
            if msg["role"] == "user":
                pdf.set_font("Helvetica", "B", 11)
                pdf.set_text_color(37, 99, 235)  # Blue color for user
                pdf.cell(0, 6, "You:", ln=True)
                pdf.set_font("Helvetica", "", 11)
                pdf.multi_cell(0, 6, safe_content)
            else:
                pdf.set_font("Helvetica", "B", 11)
                pdf.set_text_color(0, 0, 0)  # Black color for AI
                pdf.cell(0, 6, "AI:", ln=True)
                pdf.set_font("Helvetica", "", 11)
                pdf.multi_cell(0, 6, safe_content)
            pdf.ln(5)
        
        # Get PDF data
        pdf_data = bytes(pdf.output())
        
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_doc_name}_conversation.pdf"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export as PDF: {str(e)}")

@router.get("/api/documents/{document_id}/summary/pdf")
async def download_document_summary_pdf(document_id: str):
    """Download document summary (extracted content) as PDF"""
    try:
        document = FileStorage.get_document(document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Create PDF using fpdf2
        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)
        
        # Handle encoding for document name
        safe_doc_name = document['name'].encode('latin-1', 'replace').decode('latin-1')
        
        # Title
        pdf.set_font("Helvetica", "B", 20)
        pdf.cell(0, 10, f"Document Summary", ln=True)
        pdf.ln(5)
        
        # Document info
        pdf.set_font("Helvetica", "", 11)
        pdf.cell(0, 6, f"Document: {safe_doc_name}", ln=True)
        pdf.cell(0, 6, f"Type: {document['type']}", ln=True)
        pdf.cell(0, 6, f"Size: {document.get('size', 0) / 1024:.2f} KB", ln=True)
        pdf.ln(10)
        
        # Document content
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 8, "Extracted Content:", ln=True)
        pdf.ln(3)
        
        pdf.set_font("Helvetica", "", 11)
        content = document.get('content', 'No content available')
        if not content or content.strip() == "":
            content = "No extractable text content found in this document."
        
        # Handle encoding for content
        safe_content = content.encode('latin-1', 'replace').decode('latin-1')
        pdf.multi_cell(0, 6, safe_content)
        
        # Get PDF data
        pdf_data = bytes(pdf.output())
        
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_doc_name}_summary.pdf"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate document summary PDF: {str(e)}")
