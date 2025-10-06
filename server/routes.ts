import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import mammoth from "mammoth";
import { insertDocumentSchema } from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule as any).default || pdfParseModule;
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all documents
  app.get("/api/documents", async (_req, res) => {
    try {
      const documents = await storage.getDocuments();
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Get document by ID
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

  // Upload document
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

      if (!ollamaResponse.ok) {
        throw new Error(`Ollama error: ${ollamaResponse.statusText}`);
      }

      const reader = ollamaResponse.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullResponse += parsed.response;
              res.write(`data: ${JSON.stringify({ type: "token", content: parsed.response })}\n\n`);
            }
          } catch (e) {
            console.error("Parse error:", e);
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

  const httpServer = createServer(app);
  return httpServer;
}
