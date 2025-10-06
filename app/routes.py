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
from typing import List, Optional
import os
import httpx
import json

router = APIRouter()

# Ollama configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama2")

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
