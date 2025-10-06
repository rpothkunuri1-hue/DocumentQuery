import { describe, it, expect, beforeEach } from "vitest";
import { MemStorage } from "./storage";
import type { InsertDocument, InsertConversation, InsertMessage } from "../shared/schema";

describe("MemStorage", () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  describe("Document operations", () => {
    it("should create a document with all required fields", async () => {
      const insertDoc: InsertDocument = {
        name: "test.pdf",
        type: "application/pdf",
        size: 1024,
        content: "Test document content",
      };

      const doc = await storage.createDocument(insertDoc);

      expect(doc.id).toBeDefined();
      expect(doc.name).toBe(insertDoc.name);
      expect(doc.type).toBe(insertDoc.type);
      expect(doc.size).toBe(insertDoc.size);
      expect(doc.content).toBe(insertDoc.content);
      expect(doc.uploadedAt).toBeInstanceOf(Date);
    });

    it("should get a document by id", async () => {
      const insertDoc: InsertDocument = {
        name: "test.pdf",
        type: "application/pdf",
        size: 1024,
        content: "Test content",
      };

      const created = await storage.createDocument(insertDoc);
      const retrieved = await storage.getDocument(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(created.name);
    });

    it("should return undefined for non-existent document", async () => {
      const doc = await storage.getDocument("non-existent-id");
      expect(doc).toBeUndefined();
    });

    it("should get all documents sorted by upload date", async () => {
      const doc1 = await storage.createDocument({
        name: "first.pdf",
        type: "application/pdf",
        size: 100,
        content: "First",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const doc2 = await storage.createDocument({
        name: "second.pdf",
        type: "application/pdf",
        size: 200,
        content: "Second",
      });

      const docs = await storage.getDocuments();

      expect(docs).toHaveLength(2);
      expect(docs[0].id).toBe(doc2.id);
      expect(docs[1].id).toBe(doc1.id);
    });
  });

  describe("Conversation operations", () => {
    it("should create a conversation for a document", async () => {
      const doc = await storage.createDocument({
        name: "test.pdf",
        type: "application/pdf",
        size: 1024,
        content: "Test",
      });

      const insertConv: InsertConversation = {
        documentId: doc.id,
      };

      const conv = await storage.createConversation(insertConv);

      expect(conv.id).toBeDefined();
      expect(conv.documentId).toBe(doc.id);
      expect(conv.createdAt).toBeInstanceOf(Date);
    });

    it("should get conversation by document id", async () => {
      const doc = await storage.createDocument({
        name: "test.pdf",
        type: "application/pdf",
        size: 1024,
        content: "Test",
      });

      const created = await storage.createConversation({
        documentId: doc.id,
      });

      const retrieved = await storage.getConversationByDocumentId(doc.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.documentId).toBe(doc.id);
    });

    it("should return undefined for non-existent conversation", async () => {
      const conv = await storage.getConversationByDocumentId("non-existent-doc");
      expect(conv).toBeUndefined();
    });
  });

  describe("Message operations", () => {
    let conversationId: string;

    beforeEach(async () => {
      const doc = await storage.createDocument({
        name: "test.pdf",
        type: "application/pdf",
        size: 1024,
        content: "Test",
      });

      const conv = await storage.createConversation({
        documentId: doc.id,
      });

      conversationId = conv.id;
    });

    it("should create a message", async () => {
      const insertMsg: InsertMessage = {
        conversationId,
        role: "user",
        content: "Hello",
      };

      const msg = await storage.createMessage(insertMsg);

      expect(msg.id).toBeDefined();
      expect(msg.conversationId).toBe(conversationId);
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("Hello");
      expect(msg.createdAt).toBeInstanceOf(Date);
    });

    it("should get messages for a conversation sorted by creation time", async () => {
      await storage.createMessage({
        conversationId,
        role: "user",
        content: "First message",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await storage.createMessage({
        conversationId,
        role: "assistant",
        content: "Second message",
      });

      const messages = await storage.getMessages(conversationId);

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("First message");
      expect(messages[1].content).toBe("Second message");
    });

    it("should update message content", async () => {
      const msg = await storage.createMessage({
        conversationId,
        role: "assistant",
        content: "",
      });

      const updated = await storage.updateMessage(msg.id, "Updated content");

      expect(updated).toBeDefined();
      expect(updated?.content).toBe("Updated content");
      expect(updated?.id).toBe(msg.id);
    });

    it("should return undefined when updating non-existent message", async () => {
      const updated = await storage.updateMessage("non-existent", "content");
      expect(updated).toBeUndefined();
    });

    it("should only return messages for specific conversation", async () => {
      const doc2 = await storage.createDocument({
        name: "test2.pdf",
        type: "application/pdf",
        size: 512,
        content: "Test 2",
      });

      const conv2 = await storage.createConversation({
        documentId: doc2.id,
      });

      await storage.createMessage({
        conversationId,
        role: "user",
        content: "Conv 1 message",
      });

      await storage.createMessage({
        conversationId: conv2.id,
        role: "user",
        content: "Conv 2 message",
      });

      const messages = await storage.getMessages(conversationId);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Conv 1 message");
    });
  });
});
