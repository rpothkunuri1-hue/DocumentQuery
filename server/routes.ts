import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import mammoth from "mammoth";
import PDFDocument from "pdfkit";
import { insertDocumentSchema, insertMessageSchema } from "@shared/schema";
import { createRequire } from "module";
import csvParser from "csv-parser";
import { Readable } from "stream";
import * as XLSX from "xlsx";
import { marked } from "marked";
import * as cheerio from "cheerio";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractTextFromTXT(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8");
}

async function extractTextFromCSV(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from(buffer);
    
    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        const text = results.map(row => 
          Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(', ')
        ).join('\n');
        resolve(text);
      })
      .on('error', reject);
  });
}

async function extractTextFromExcel(buffer: Buffer): Promise<string> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let text = '';
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    text += `Sheet: ${sheetName}\n`;
    text += XLSX.utils.sheet_to_csv(sheet);
    text += '\n\n';
  });
  
  return text;
}

async function extractTextFromMarkdown(buffer: Buffer): Promise<string> {
  const markdown = buffer.toString('utf-8');
  return markdown;
}

async function extractTextFromHTML(buffer: Buffer): Promise<string> {
  const html = buffer.toString('utf-8');
  const $ = cheerio.load(html);
  $('script, style').remove();
  return $('body').text().trim() || $.text().trim();
}

async function extractTextFromRTF(buffer: Buffer): Promise<string> {
  let rtf = buffer.toString('utf-8');
  rtf = rtf.replace(/\\par[d]?/g, '\n');
  rtf = rtf.replace(/\{\*?\\[^{}]+}|[{}]|\\\n?[A-Za-z]+\n?(?:-?\d+)?[ ]?/g, '');
  return rtf.trim();
}

async function extractTextFromCode(buffer: Buffer, extension: string): Promise<string> {
  const code = buffer.toString('utf-8');
  return `File Type: ${extension}\n\n${code}`;
}

export function registerRoutes(app: Express): Server {
  // Get available Ollama models
  app.get("/api/models", async (_req, res) => {
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const response = await fetch(`${ollamaUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch models from Ollama");
      }
      
      const data = await response.json();
      const models = data.models?.map((model: any) => ({
        name: model.name,
        size: model.size,
        modified: model.modified_at,
      })) || [];
      
      res.json(models);
    } catch (error) {
      console.error("Failed to fetch Ollama models:", error);
      res.json([]);
    }
  });

  // Get all documents
  app.get("/api/documents", async (_req, res) => {
    try {
      const documents = await storage.getDocuments();
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Get single document
  app.get("/api/documents/:id", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      await storage.deleteDocument(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Upload document with auto-summarization
  app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      let content = "";
      const extension = file.originalname.split('.').pop()?.toLowerCase() || '';

      if (file.mimetype === "application/pdf") {
        content = await extractTextFromPDF(file.buffer);
      } else if (
        file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        content = await extractTextFromDOCX(file.buffer);
      } else if (file.mimetype === "text/plain" || extension === 'txt') {
        content = await extractTextFromTXT(file.buffer);
      } else if (file.mimetype === "text/csv" || extension === 'csv') {
        content = await extractTextFromCSV(file.buffer);
      } else if (
        file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.mimetype === "application/vnd.ms-excel" ||
        extension === 'xlsx' || extension === 'xls'
      ) {
        content = await extractTextFromExcel(file.buffer);
      } else if (file.mimetype === "text/markdown" || extension === 'md') {
        content = await extractTextFromMarkdown(file.buffer);
      } else if (file.mimetype === "text/html" || extension === 'html' || extension === 'htm') {
        content = await extractTextFromHTML(file.buffer);
      } else if (file.mimetype === "application/rtf" || extension === 'rtf') {
        content = await extractTextFromRTF(file.buffer);
      } else if (
        ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'r', 'sql', 'sh', 'bash', 'json', 'xml', 'yaml', 'yml', 'css', 'scss', 'sass', 'less'].includes(extension)
      ) {
        content = await extractTextFromCode(file.buffer, extension);
      } else {
        return res.status(400).json({ error: "Unsupported file type" });
      }

      const insertData = insertDocumentSchema.parse({
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
        content,
      });

      const document = await storage.createDocument(insertData);

      // Auto-generate summary
      const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const model = process.env.OLLAMA_MODEL || "llama2";

      try {
        const summaryPrompt = `Provide a detailed summary of this document. Include:
1. Main topic and purpose
2. Key points (3-5 bullet points)
3. Important conclusions or takeaways

Document:
${content}

Provide the response in JSON format: { "summary": "...", "briefSummary": "...", "keyPoints": ["...", "..."] }`;

        const summaryResponse = await fetch(`${ollamaUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt: summaryPrompt,
            stream: false,
          }),
        });

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          try {
            const parsedSummary = JSON.parse(summaryData.response);
            await storage.updateDocument(document.id, {
              summary: parsedSummary.summary,
              briefSummary: parsedSummary.briefSummary,
              keyPoints: parsedSummary.keyPoints,
            });
            
            const updated = await storage.getDocument(document.id);
            return res.json(updated || document);
          } catch (parseError) {
            console.error("Failed to parse summary JSON, using raw response");
          }
        }
      } catch (summaryError) {
        console.error("Summary generation failed:", summaryError);
      }

      res.json(document);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Get or create conversation for document
  app.get("/api/conversations/:documentId", async (req, res) => {
    try {
      const { documentId } = req.params;
      
      let conversation = await storage.getConversationByDocumentId(documentId);
      
      if (!conversation) {
        conversation = await storage.createConversation({ documentId });
      }
      
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to get conversation" });
    }
  });

  // Get or create multi-document conversation
  app.post("/api/conversations/multi", async (req, res) => {
    try {
      const { documentIds } = req.body;
      
      if (!documentIds || documentIds.length === 0) {
        return res.status(400).json({ error: "Document IDs are required" });
      }
      
      const conversation = await storage.createMultiDocConversation({ documentIds });
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to create multi-document conversation" });
    }
  });

  // Get messages for conversation
  app.get("/api/messages/:conversationId", async (req, res) => {
    try {
      const messages = await storage.getMessages(req.params.conversationId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Chat endpoint with streaming
  app.post("/api/chat", async (req, res) => {
    try {
      const { documentId, conversationId, question, model: requestModel } = req.body;

      if (!question) {
        return res.status(400).json({ error: "Question is required" });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const conv = await storage.createConversation({ documentId });
        activeConversationId = conv.id;
      }

      const userMessage = await storage.createMessage({
        conversationId: activeConversationId,
        role: "user",
        content: question,
      });

      const previousMessages = await storage.getMessages(activeConversationId);
      const contextMessages = previousMessages
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const assistantMessage = await storage.createMessage({
        conversationId: activeConversationId,
        role: "assistant",
        content: "",
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "message_id", messageId: assistantMessage.id })}\n\n`);

      const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const model = requestModel || process.env.OLLAMA_MODEL || "llama2";

      // Validate document content
      if (!document.content || document.content.trim().length < 10) {
        const refusalMessage = "I cannot answer questions about this document because it appears to be empty or contains insufficient content. Please upload a document with readable text.";
        await storage.updateMessage(assistantMessage.id, { content: refusalMessage });
        res.write(`data: ${JSON.stringify({ type: "token", content: refusalMessage })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
        return;
      }

      const prompt = `SYSTEM INSTRUCTIONS:
You are a document analysis assistant. Your ONLY role is to answer questions based strictly on the content of the provided document.

STRICT RULES:
1. ONLY answer questions that can be answered using information found in the document below
2. If a question cannot be answered from the document, politely decline and explain that the information is not in the document
3. ALWAYS cite specific passages or sections from the document when answering
4. DO NOT use external knowledge, general facts, or information not present in the document
5. If the question is unclear or ambiguous, ask the user to clarify before attempting to answer
6. If multiple interpretations are possible based on the document, present all relevant perspectives found in the document

DOCUMENT CONTENT:
${document.content}

CONVERSATION HISTORY:
${contextMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}

USER QUESTION: ${question}

RESPONSE INSTRUCTIONS:
- Answer ONLY using information from the document above
- Quote or reference specific parts of the document in your response
- If the answer is not in the document, respond with: "I cannot answer this question because the information is not present in the provided document. Please ask a question about the document's content."
- Be helpful and thorough, but stay within the document's scope`;

      const ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: true,
        }),
      });

      if (!ollamaResponse.ok || !ollamaResponse.body) {
        throw new Error("Ollama API request failed");
      }

      const reader = ollamaResponse.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.response) {
              fullResponse += json.response;
              res.write(`data: ${JSON.stringify({ type: "token", content: json.response })}\n\n`);
            }
          } catch (e) {
            console.error("Failed to parse Ollama response line:", line);
          }
        }
      }

      // Post-response verification: Check if response references the document
      const hasDocumentReference = fullResponse.length > 50 && (
        fullResponse.toLowerCase().includes("document") ||
        fullResponse.toLowerCase().includes("according to") ||
        fullResponse.toLowerCase().includes("the text") ||
        fullResponse.toLowerCase().includes("states that") ||
        fullResponse.toLowerCase().includes("mentions") ||
        /["'].*["']/.test(fullResponse) // Contains quoted text
      );

      const isRefusal = fullResponse.toLowerCase().includes("cannot answer") ||
        fullResponse.toLowerCase().includes("not present in") ||
        fullResponse.toLowerCase().includes("not found in") ||
        fullResponse.toLowerCase().includes("information is not");

      // If response doesn't reference document and isn't a refusal, add warning
      if (!hasDocumentReference && !isRefusal && fullResponse.length > 20) {
        const warningMessage = "\n\n⚠️ Note: This response may not be based solely on the document content. Please verify the information against the source document.";
        fullResponse += warningMessage;
        res.write(`data: ${JSON.stringify({ type: "token", content: warningMessage })}\n\n`);
        console.warn(`Response may be out of scope for document: ${document.id}`);
      }

      await storage.updateMessage(assistantMessage.id, { content: fullResponse });

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Failed to process chat" });
    }
  });

  // Multi-document chat endpoint
  app.post("/api/chat/multi", async (req, res) => {
    try {
      const { documentIds, conversationId, question, model: requestModel } = req.body;

      if (!question || !documentIds || documentIds.length === 0) {
        return res.status(400).json({ error: "Question and document IDs are required" });
      }

      const documents = await Promise.all(
        documentIds.map((id: string) => storage.getDocument(id))
      );

      const validDocuments = documents.filter(Boolean);
      if (validDocuments.length === 0) {
        return res.status(404).json({ error: "No valid documents found" });
      }

      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const conv = await storage.createMultiDocConversation({ documentIds });
        activeConversationId = conv.id;
      }

      const userMessage = await storage.createMessage({
        conversationId: activeConversationId,
        role: "user",
        content: question,
      });

      const previousMessages = await storage.getMessages(activeConversationId);
      const contextMessages = previousMessages
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const assistantMessage = await storage.createMessage({
        conversationId: activeConversationId,
        role: "assistant",
        content: "",
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "message_id", messageId: assistantMessage.id })}\n\n`);

      const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const model = requestModel || process.env.OLLAMA_MODEL || "llama2";

      // Validate document content and warn about excluded documents
      const validContentDocuments = validDocuments.filter((doc: any) => 
        doc.content && doc.content.trim().length >= 10
      );
      
      const excludedDocs = validDocuments.filter((doc: any) => 
        !doc.content || doc.content.trim().length < 10
      );
      
      if (validContentDocuments.length === 0) {
        const refusalMessage = "I cannot answer questions about these documents because they appear to be empty or contain insufficient content. Please upload documents with readable text.";
        await storage.updateMessage(assistantMessage.id, { content: refusalMessage });
        res.write(`data: ${JSON.stringify({ type: "token", content: refusalMessage })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
        return;
      }
      
      // Warn if some documents were excluded
      let warningPrefix = "";
      if (excludedDocs.length > 0) {
        const excludedNames = excludedDocs.map((doc: any) => `"${doc.name}"`).join(", ");
        warningPrefix = `⚠️ Note: ${excludedDocs.length} document(s) were excluded due to insufficient content: ${excludedNames}\n\nAnalyzing remaining ${validContentDocuments.length} document(s):\n\n`;
        res.write(`data: ${JSON.stringify({ type: "token", content: warningPrefix })}\n\n`);
        console.warn(`Excluded ${excludedDocs.length} documents from multi-doc chat:`, excludedNames);
      }

      const documentList = validContentDocuments
        .map((doc: any, idx: number) => `[Document ${idx + 1}: "${doc.name}"]`)
        .join(", ");

      const combinedContent = validContentDocuments
        .map((doc: any, idx: number) => `=== DOCUMENT ${idx + 1}: "${doc.name}" ===
${doc.content}
=== END OF DOCUMENT ${idx + 1} ===`)
        .join("\n\n");

      const prompt = `SYSTEM INSTRUCTIONS:
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
${documentList}

DOCUMENT CONTENTS:
${combinedContent}

CONVERSATION HISTORY:
${contextMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}

USER QUESTION: ${question}

RESPONSE INSTRUCTIONS:
- Answer ONLY using information from the documents above
- Always cite which document you're referencing (e.g., "According to Document 1 (filename.pdf)...")
- If comparing documents, only compare information that exists in both
- If the answer is not in any document, respond with: "I cannot answer this question because the information is not present in the provided documents. Please ask a question about the documents' content."
- Be thorough but stay within the documents' scope`;


      const ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: true,
        }),
      });

      if (!ollamaResponse.ok || !ollamaResponse.body) {
        throw new Error("Ollama API request failed");
      }

      const reader = ollamaResponse.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.response) {
              fullResponse += json.response;
              res.write(`data: ${JSON.stringify({ type: "token", content: json.response })}\n\n`);
            }
          } catch (e) {
            console.error("Failed to parse Ollama response line:", line);
          }
        }
      }

      // Post-response verification: Check if response references the documents
      const hasDocumentReference = fullResponse.length > 50 && (
        fullResponse.toLowerCase().includes("document") ||
        /document\s+\d+/.test(fullResponse.toLowerCase()) || // "document 1", etc.
        fullResponse.toLowerCase().includes("according to") ||
        fullResponse.toLowerCase().includes("the text") ||
        fullResponse.toLowerCase().includes("states that") ||
        fullResponse.toLowerCase().includes("mentions") ||
        validContentDocuments.some((doc: any) => 
          fullResponse.toLowerCase().includes(doc.name.toLowerCase().substring(0, 15))
        ) ||
        /["'].*["']/.test(fullResponse) // Contains quoted text
      );

      const isRefusal = fullResponse.toLowerCase().includes("cannot answer") ||
        fullResponse.toLowerCase().includes("not present in") ||
        fullResponse.toLowerCase().includes("not found in") ||
        fullResponse.toLowerCase().includes("information is not");

      // If response doesn't reference documents and isn't a refusal, add warning
      if (!hasDocumentReference && !isRefusal && fullResponse.length > 20) {
        const warningMessage = "\n\n⚠️ Note: This response may not be based solely on the provided documents. Please verify the information against the source documents.";
        fullResponse += warningMessage;
        res.write(`data: ${JSON.stringify({ type: "token", content: warningMessage })}\n\n`);
        console.warn(`Response may be out of scope for multi-document chat:`, documentIds);
      }

      // Prepend any document exclusion warnings to the final stored message
      const finalMessage = warningPrefix + fullResponse;
      await storage.updateMessage(assistantMessage.id, { content: finalMessage });

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Multi-doc chat error:", error);
      res.status(500).json({ error: "Failed to process chat" });
    }
  });

  // Export conversation
  app.get("/api/conversations/:id/export", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await storage.getMessages(conversation.id);
      const documents = await Promise.all(
        (conversation.documentIds || []).map(id => storage.getDocument(id))
      );

      const format = (req.query.format as string) || "json";
      
      const userMessages = messages.filter(m => m.role === "user");
      const assistantMessages = messages.filter(m => m.role === "assistant");
      const totalWords = messages.reduce((acc, m) => acc + m.content.split(/\s+/).length, 0);
      
      if (format === "json") {
        res.json({
          conversation,
          messages,
          documents,
          exportedAt: new Date().toISOString(),
        });
      } else if (format === "markdown") {
        let markdown = `# Conversation Export\n\n`;
        markdown += `## Summary\n\n`;
        markdown += `- **Date:** ${new Date(conversation.createdAt).toLocaleString()}\n`;
        markdown += `- **Documents Discussed:** ${documents.map(d => d?.name).filter(Boolean).join(", ") || "None"}\n`;
        markdown += `- **Total Messages:** ${messages.length}\n`;
        markdown += `- **Questions Asked:** ${userMessages.length}\n`;
        markdown += `- **Total Words:** ${totalWords}\n\n`;
        
        const validDocuments = documents.filter((d): d is NonNullable<typeof d> => !!d);
        if (validDocuments.length > 0) {
          markdown += `## Document Summaries\n\n`;
          validDocuments.forEach((doc, idx) => {
            markdown += `### ${idx + 1}. ${doc.name}\n\n`;
            
            if (doc.briefSummary) {
              markdown += `**Brief Summary:** ${doc.briefSummary}\n\n`;
            }
            
            if (doc.summary) {
              markdown += `**Full Summary:**\n\n${doc.summary}\n\n`;
            }
            
            if (doc.keyPoints && doc.keyPoints.length > 0) {
              markdown += `**Key Points:**\n\n`;
              doc.keyPoints.forEach((point, i) => {
                markdown += `${i + 1}. ${point}\n`;
              });
              markdown += `\n`;
            }
            
            markdown += `**Content Preview:**\n\n`;
            const preview = doc.content.substring(0, 300).trim();
            markdown += `${preview}${doc.content.length > 300 ? "..." : ""}\n\n`;
            
            if (idx < validDocuments.length - 1) {
              markdown += `---\n\n`;
            }
          });
        }
        
        markdown += `## Conversation\n\n`;
        markdown += `---\n\n`;
        
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const timestamp = new Date(msg.createdAt).toLocaleTimeString();
          markdown += `### ${msg.role === "user" ? "👤 User" : "🤖 Assistant"} • ${timestamp}\n\n`;
          markdown += `${msg.content}\n\n`;
          
          if (i < messages.length - 1) {
            markdown += `---\n\n`;
          }
        }
        
        markdown += `\n---\n\n`;
        markdown += `*Exported on ${new Date().toLocaleString()}*\n`;

        res.setHeader("Content-Type", "text/markdown");
        res.setHeader("Content-Disposition", `attachment; filename="conversation-${conversation.id}.md"`);
        res.send(markdown);
      } else if (format === "pdf") {
        const doc = new PDFDocument({ margins: { top: 50, bottom: 50, left: 50, right: 50 } });
        
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="conversation-${conversation.id}.pdf"`);
        
        doc.pipe(res);
        
        doc.fontSize(26).font("Helvetica-Bold").text("Conversation Export", { align: "center" });
        doc.moveDown(1);
        
        doc.fontSize(10).font("Helvetica").fillColor("#666666")
           .text(`Exported on ${new Date().toLocaleString()}`, { align: "center" });
        doc.moveDown(2);
        
        doc.fontSize(16).font("Helvetica-Bold").fillColor("black").text("Summary");
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica");
        doc.text(`Date: ${new Date(conversation.createdAt).toLocaleString()}`);
        doc.text(`Documents: ${documents.map(d => d?.name).filter(Boolean).join(", ") || "None"}`);
        doc.text(`Total Messages: ${messages.length}`);
        doc.text(`Questions Asked: ${userMessages.length}`);
        doc.text(`Total Words: ${totalWords}`);
        doc.moveDown(2);
        
        if (documents.length > 0 && documents.some(d => d)) {
          doc.fontSize(16).font("Helvetica-Bold").fillColor("black").text("Document Summaries");
          doc.moveDown(1);
          
          const validDocsForPdf = documents.filter((d): d is NonNullable<typeof d> => !!d);
          validDocsForPdf.forEach((document, idx) => {
            if (doc.y > 650) {
              doc.addPage();
            }
            
            doc.fontSize(13).font("Helvetica-Bold").fillColor("#2563eb")
               .text(`${idx + 1}. ${document.name}`);
            doc.moveDown(0.5);
            
            if (document.briefSummary) {
              doc.fontSize(10).font("Helvetica-Bold").fillColor("black")
                 .text("Brief Summary:");
              doc.fontSize(10).font("Helvetica").fillColor("#374151")
                 .text(document.briefSummary, { width: 500 });
              doc.moveDown(0.5);
            }
            
            if (document.summary) {
              doc.fontSize(10).font("Helvetica-Bold").fillColor("black")
                 .text("Full Summary:");
              doc.fontSize(10).font("Helvetica").fillColor("#374151")
                 .text(document.summary, { width: 500, lineGap: 1 });
              doc.moveDown(0.5);
            }
            
            if (document.keyPoints && document.keyPoints.length > 0) {
              doc.fontSize(10).font("Helvetica-Bold").fillColor("black")
                 .text("Key Points:");
              doc.fontSize(10).font("Helvetica").fillColor("#374151");
              document.keyPoints.forEach((point, i) => {
                doc.text(`${i + 1}. ${point}`, { 
                  width: 480,
                  indent: 20
                });
              });
              doc.moveDown(0.5);
            }
            
            doc.fontSize(10).font("Helvetica-Bold").fillColor("black")
               .text("Content Preview:");
            doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
            const preview = document.content.substring(0, 200).trim();
            doc.text(`${preview}${document.content.length > 200 ? "..." : ""}`, {
              width: 500
            });
            doc.moveDown(1);
            
            if (idx < validDocsForPdf.length - 1) {
              doc.strokeColor("#e5e7eb").lineWidth(0.5)
                 .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
              doc.moveDown(1);
            }
          });
          doc.moveDown(1.5);
        }
        
        doc.fontSize(16).font("Helvetica-Bold").fillColor("black").text("Conversation");
        doc.moveDown(1);
        
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const timestamp = new Date(msg.createdAt).toLocaleTimeString();
          
          const roleColor = msg.role === "user" ? "#2563eb" : "#10b981";
          const roleLabel = msg.role === "user" ? "User" : "Assistant";
          
          if (doc.y > 700) {
            doc.addPage();
          }
          
          doc.fontSize(13).font("Helvetica-Bold").fillColor(roleColor)
             .text(`${roleLabel} • ${timestamp}`);
          doc.moveDown(0.3);
          
          doc.fontSize(11).font("Helvetica").fillColor("black")
             .text(msg.content, {
               width: 500,
               align: "left",
               lineGap: 2
             });
          
          doc.moveDown(1.5);
          
          if (i < messages.length - 1) {
            doc.strokeColor("#e5e7eb").lineWidth(0.5)
               .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
            doc.moveDown(1);
          }
        }
        
        doc.fontSize(8).font("Helvetica").fillColor("#9ca3af")
           .text(`Generated by DocuChat on ${new Date().toLocaleString()}`, {
             align: "center"
           });
        
        doc.end();
      } else {
        res.status(400).json({ error: "Invalid format. Use 'json', 'markdown', or 'pdf'" });
      }
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export conversation" });
    }
  });

  // Collections Routes
  app.get("/api/collections", async (_req, res) => {
    try {
      const collections = await storage.getCollections();
      res.json(collections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collections" });
    }
  });

  app.post("/api/collections", async (req, res) => {
    try {
      const collection = await storage.createCollection(req.body);
      res.json(collection);
    } catch (error) {
      res.status(500).json({ error: "Failed to create collection" });
    }
  });

  app.get("/api/collections/:id", async (req, res) => {
    try {
      const collection = await storage.getCollection(req.params.id);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      const documents = await storage.getDocumentsByCollection(req.params.id);
      res.json({ ...collection, documents });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch collection" });
    }
  });

  app.patch("/api/collections/:id", async (req, res) => {
    try {
      const updated = await storage.updateCollection(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Collection not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update collection" });
    }
  });

  app.delete("/api/collections/:id", async (req, res) => {
    try {
      await storage.deleteCollection(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete collection" });
    }
  });

  // Bulk Upload Routes
  app.post("/api/documents/bulk-upload", upload.array("files", 10), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files)) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const jobs = await Promise.all(
        req.files.map(async (file) => {
          return await storage.createJob({
            type: "document_upload",
            status: "pending",
            data: {
              filename: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              buffer: file.buffer.toString('base64'),
              collectionId: req.body.collectionId
            },
          });
        })
      );

      res.json({ jobs, message: "Bulk upload queued" });
    } catch (error) {
      console.error("Bulk upload error:", error);
      res.status(500).json({ error: "Failed to queue bulk upload" });
    }
  });

  // Jobs Routes
  app.get("/api/jobs", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const jobs = await storage.getJobs(status);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // Document Comparison Routes
  app.post("/api/documents/compare", async (req, res) => {
    try {
      const { documentId1, documentId2 } = req.body;
      
      if (!documentId1 || !documentId2) {
        return res.status(400).json({ error: "Two document IDs are required" });
      }

      const existing = await storage.getDocumentComparison(documentId1, documentId2);
      if (existing) {
        return res.json(existing);
      }

      const doc1 = await storage.getDocument(documentId1);
      const doc2 = await storage.getDocument(documentId2);

      if (!doc1 || !doc2) {
        return res.status(404).json({ error: "One or both documents not found" });
      }

      const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const model = process.env.OLLAMA_MODEL || "llama2";

      const prompt = `Compare these two documents and provide a detailed analysis:

Document 1 (${doc1.name}):
${doc1.content.substring(0, 3000)}

Document 2 (${doc2.name}):
${doc2.content.substring(0, 3000)}

Provide the response in JSON format: { "differences": ["..."], "similarities": ["..."], "comparisonSummary": "..." }`;

      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error("Ollama API request failed");
      }

      const data = await response.json();
      let comparison;
      
      try {
        const parsed = JSON.parse(data.response);
        comparison = await storage.createDocumentComparison({
          documentId1,
          documentId2,
          differences: parsed.differences,
          similarities: parsed.similarities,
          comparisonSummary: parsed.comparisonSummary,
        });
      } catch {
        comparison = await storage.createDocumentComparison({
          documentId1,
          documentId2,
          comparisonSummary: data.response,
        });
      }

      res.json(comparison);
    } catch (error) {
      console.error("Document comparison error:", error);
      res.status(500).json({ error: "Failed to compare documents" });
    }
  });

  // Model Comparison Route
  app.post("/api/chat/compare-models", async (req, res) => {
    try {
      const { documentId, conversationId, question, model1, model2 } = req.body;

      if (!question || !model1 || !model2) {
        return res.status(400).json({ error: "Question and two models are required" });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const conv = await storage.createConversation({ documentId });
        activeConversationId = conv.id;
      }

      const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const prompt = `You are a helpful assistant answering questions about a document. Here is the document content:

${document.content}

User question: ${question}

Please provide a helpful and accurate answer based on the document content.`;

      const [response1, response2] = await Promise.all([
        fetch(`${ollamaUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model1,
            prompt,
            stream: false,
          }),
        }),
        fetch(`${ollamaUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model2,
            prompt,
            stream: false,
          }),
        }),
      ]);

      if (!response1.ok || !response2.ok) {
        throw new Error("Ollama API request failed");
      }

      const data1 = await response1.json();
      const data2 = await response2.json();

      const comparison = await storage.createModelComparison({
        conversationId: activeConversationId,
        question,
        model1,
        model2,
        response1: data1.response,
        response2: data2.response,
      });

      res.json(comparison);
    } catch (error) {
      console.error("Model comparison error:", error);
      res.status(500).json({ error: "Failed to compare models" });
    }
  });

  // OCR Route for images
  app.post("/api/documents/ocr", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp'];
      
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: "Only image files are supported for OCR" });
      }

      const job = await storage.createJob({
        type: "ocr_processing",
        status: "pending",
        data: {
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer.toString('base64'),
          collectionId: req.body.collectionId
        },
      });

      res.json({ job, message: "OCR processing queued" });
    } catch (error) {
      console.error("OCR error:", error);
      res.status(500).json({ error: "Failed to queue OCR processing" });
    }
  });

  // Enhanced Document Chunking
  app.post("/api/documents/:id/chunk", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      await storage.deleteDocumentChunks(req.params.id);

      const chunkSize = 500;
      const words = document.content.split(/\s+/);
      const chunks = [];

      for (let i = 0; i < words.length; i += chunkSize) {
        const chunkWords = words.slice(i, i + chunkSize);
        const chunkContent = chunkWords.join(' ');
        
        chunks.push(await storage.createDocumentChunk({
          documentId: req.params.id,
          content: chunkContent,
          chunkIndex: Math.floor(i / chunkSize),
          metadata: {
            wordCount: chunkWords.length,
            startWord: i,
            endWord: i + chunkWords.length,
          },
        }));
      }

      res.json({ chunks, count: chunks.length });
    } catch (error) {
      console.error("Chunking error:", error);
      res.status(500).json({ error: "Failed to chunk document" });
    }
  });

  app.get("/api/documents/:id/chunks", async (req, res) => {
    try {
      const chunks = await storage.getDocumentChunks(req.params.id);
      res.json(chunks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document chunks" });
    }
  });

  // Document History/Versions
  app.get("/api/documents/:id/versions", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      const versions = await storage.getDocumentVersions(document.parentVersionId || req.params.id);
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document versions" });
    }
  });

  app.post("/api/documents/:id/create-version", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      const newVersion = await storage.createDocument({
        ...req.body,
        name: document.name,
        type: document.type,
        size: req.body.size || document.size,
        content: req.body.content || document.content,
        version: document.version + 1,
        parentVersionId: document.parentVersionId || document.id,
      });

      res.json(newVersion);
    } catch (error) {
      res.status(500).json({ error: "Failed to create document version" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
