import {
  type Document,
  type InsertDocument,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Document methods
  getDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  
  // Conversation methods
  getConversationByDocumentId(documentId: string): Promise<Conversation | undefined>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conv: InsertConversation): Promise<Conversation>;
  createMultiDocConversation(data: { documentIds: string[] }): Promise<Conversation>;
  
  // Message methods
  getMessages(conversationId: string): Promise<Message[]>;
  createMessage(msg: InsertMessage): Promise<Message>;
  updateMessage(id: string, content: string): Promise<Message | undefined>;
}

export class MemStorage implements IStorage {
  private documents: Map<string, Document>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;

  constructor() {
    this.documents = new Map();
    this.conversations = new Map();
    this.messages = new Map();
  }

  // Document methods
  async getDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values()).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async createDocument(insertDoc: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const doc: Document = {
      id,
      name: insertDoc.name,
      type: insertDoc.type,
      size: insertDoc.size,
      content: insertDoc.content,
      summary: insertDoc.summary ?? null,
      briefSummary: insertDoc.briefSummary ?? null,
      keyPoints: insertDoc.keyPoints ?? null,
      uploadedAt: new Date(),
    };
    this.documents.set(id, doc);
    return doc;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const doc = this.documents.get(id);
    if (!doc) return undefined;
    
    const updated = { ...doc, ...updates };
    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const deleted = this.documents.delete(id);
    if (deleted) {
      const conversations = Array.from(this.conversations.values())
        .filter(conv => conv.documentId === id || (conv.documentIds && conv.documentIds.includes(id)));
      
      for (const conv of conversations) {
        const messages = Array.from(this.messages.values())
          .filter(msg => msg.conversationId === conv.id);
        
        for (const msg of messages) {
          this.messages.delete(msg.id);
        }
        
        this.conversations.delete(conv.id);
      }
    }
    return deleted;
  }

  // Conversation methods
  async getConversationByDocumentId(documentId: string): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(
      (conv) => conv.documentId === documentId
    );
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async createConversation(insertConv: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conv: Conversation = {
      id,
      documentId: insertConv.documentId ?? null,
      documentIds: insertConv.documentId ? [insertConv.documentId] : insertConv.documentIds ?? null,
      createdAt: new Date(),
    };
    this.conversations.set(id, conv);
    return conv;
  }

  async createMultiDocConversation(data: { documentIds: string[] }): Promise<Conversation> {
    const id = randomUUID();
    const conv: Conversation = {
      id,
      documentId: null,
      documentIds: data.documentIds,
      createdAt: new Date(),
    };
    this.conversations.set(id, conv);
    return conv;
  }

  // Message methods
  async getMessages(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((msg) => msg.conversationId === conversationId)
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }

  async createMessage(insertMsg: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const msg: Message = {
      ...insertMsg,
      id,
      createdAt: new Date(),
    };
    this.messages.set(id, msg);
    return msg;
  }

  async updateMessage(id: string, content: string): Promise<Message | undefined> {
    const msg = this.messages.get(id);
    if (!msg) return undefined;
    
    const updated = { ...msg, content };
    this.messages.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
