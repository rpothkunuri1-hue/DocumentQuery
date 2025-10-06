import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import mammoth from "mammoth";
import PDFDocument from "pdfkit";
import { insertDocumentSchema } from "@shared/schema";
import { createRequire } from "module";

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

      if (file.mimetype === "application/pdf") {
        content = await extractTextFromPDF(file.buffer);
      } else if (
        file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        content = await extractTextFromDOCX(file.buffer);
      } else if (file.mimetype === "text/plain") {
        content = await extractTextFromTXT(file.buffer);
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

      const prompt = `You are a helpful assistant answering questions about a document. Here is the document content:

${document.content}

Previous conversation:
${contextMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}

User question: ${question}

Please provide a helpful and accurate answer based on the document content.`;

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

      await storage.updateMessage(assistantMessage.id, fullResponse);

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

      const combinedContent = validDocuments
        .map((doc: any, idx: number) => `Document ${idx + 1} (${doc.name}):\n${doc.content}`)
        .join("\n\n");

      const prompt = `You are a helpful assistant answering questions about multiple documents. Here are the documents:

${combinedContent}

Previous conversation:
${contextMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}

User question: ${question}

Please provide a helpful answer based on the documents. When referencing information, mention which document it came from.`;

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

      await storage.updateMessage(assistantMessage.id, fullResponse);

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
        
        if (documents.length > 0 && documents.some(d => d)) {
          markdown += `## Document Summaries\n\n`;
          documents.filter(d => d).forEach((doc, idx) => {
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
            
            if (idx < documents.filter(d => d).length - 1) {
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
          
          documents.filter(d => d).forEach((document, idx) => {
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
            
            if (idx < documents.filter(d => d).length - 1) {
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

  const httpServer = createServer(app);
  return httpServer;
}
