import {
  type Document,
  type InsertDocument,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type DocumentChunk,
  type InsertDocumentChunk,
  type Cache,
  type InsertCache,
  type Job,
  type InsertJob,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Document methods
  getDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  getDocumentsByTag(tag: string): Promise<Document[]>;
  getDocumentsByCategory(category: string): Promise<Document[]>;
  getDocumentVersions(parentVersionId: string): Promise<Document[]>;
  
  // Document Chunk methods
  getDocumentChunks(documentId: string): Promise<DocumentChunk[]>;
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
  deleteDocumentChunks(documentId: string): Promise<boolean>;
  
  // Conversation methods
  getConversationByDocumentId(documentId: string): Promise<Conversation | undefined>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conv: InsertConversation): Promise<Conversation>;
  createMultiDocConversation(data: { documentIds: string[] }): Promise<Conversation>;
  
  // Message methods
  getMessages(conversationId: string): Promise<Message[]>;
  createMessage(msg: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined>;
  deleteMessage(id: string): Promise<boolean>;
  rateMessage(id: string, rating: number): Promise<Message | undefined>;
  
  // Cache methods
  getCache(key: string): Promise<Cache | undefined>;
  setCache(cache: InsertCache): Promise<Cache>;
  deleteCache(key: string): Promise<boolean>;
  cleanExpiredCache(): Promise<number>;
  
  // Job methods
  getJob(id: string): Promise<Job | undefined>;
  getJobs(status?: string): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined>;
}

export class MemStorage implements IStorage {
  private documents: Map<string, Document>;
  private documentChunks: Map<string, DocumentChunk>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private cache: Map<string, Cache>;
  private jobs: Map<string, Job>;

  constructor() {
    this.documents = new Map();
    this.documentChunks = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.cache = new Map();
    this.jobs = new Map();
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
    const now = new Date();
    const doc: Document = {
      id,
      name: insertDoc.name,
      type: insertDoc.type,
      size: insertDoc.size,
      content: insertDoc.content,
      summary: insertDoc.summary ?? null,
      briefSummary: insertDoc.briefSummary ?? null,
      keyPoints: insertDoc.keyPoints ?? null,
      tags: insertDoc.tags ?? null,
      category: insertDoc.category ?? null,
      version: insertDoc.version ?? 1,
      parentVersionId: insertDoc.parentVersionId ?? null,
      uploadedAt: now,
      updatedAt: now,
    };
    this.documents.set(id, doc);
    return doc;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const doc = this.documents.get(id);
    if (!doc) return undefined;
    
    const updated = { ...doc, ...updates, updatedAt: new Date() };
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

      Array.from(this.documentChunks.values())
        .filter(chunk => chunk.documentId === id)
        .forEach(chunk => this.documentChunks.delete(chunk.id));
    }
    return deleted;
  }

  async getDocumentsByTag(tag: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      doc => doc.tags && doc.tags.includes(tag)
    );
  }

  async getDocumentsByCategory(category: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      doc => doc.category === category
    );
  }

  async getDocumentVersions(parentVersionId: string): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.parentVersionId === parentVersionId)
      .sort((a, b) => a.version - b.version);
  }

  // Document Chunk methods
  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    return Array.from(this.documentChunks.values())
      .filter(chunk => chunk.documentId === documentId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  async createDocumentChunk(insertChunk: InsertDocumentChunk): Promise<DocumentChunk> {
    const id = randomUUID();
    const chunk: DocumentChunk = {
      ...insertChunk,
      id,
      embedding: insertChunk.embedding ?? null,
      metadata: insertChunk.metadata ?? null,
      createdAt: new Date(),
    };
    this.documentChunks.set(id, chunk);
    return chunk;
  }

  async deleteDocumentChunks(documentId: string): Promise<boolean> {
    const chunks = Array.from(this.documentChunks.values())
      .filter(chunk => chunk.documentId === documentId);
    
    chunks.forEach(chunk => this.documentChunks.delete(chunk.id));
    return chunks.length > 0;
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
    const now = new Date();
    const msg: Message = {
      ...insertMsg,
      id,
      rating: insertMsg.rating ?? null,
      edited: insertMsg.edited ?? false,
      originalContent: insertMsg.originalContent ?? null,
      modelUsed: insertMsg.modelUsed ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.messages.set(id, msg);
    return msg;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const msg = this.messages.get(id);
    if (!msg) return undefined;
    
    const updated = { ...msg, ...updates, updatedAt: new Date() };
    this.messages.set(id, updated);
    return updated;
  }

  async deleteMessage(id: string): Promise<boolean> {
    return this.messages.delete(id);
  }

  async rateMessage(id: string, rating: number): Promise<Message | undefined> {
    return this.updateMessage(id, { rating });
  }

  // Cache methods
  async getCache(key: string): Promise<Cache | undefined> {
    const cached = Array.from(this.cache.values()).find(c => c.key === key);
    if (cached && cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      this.cache.delete(cached.id);
      return undefined;
    }
    return cached;
  }

  async setCache(insertCache: InsertCache): Promise<Cache> {
    const existing = await this.getCache(insertCache.key);
    if (existing) {
      this.cache.delete(existing.id);
    }
    
    const id = randomUUID();
    const cache: Cache = {
      ...insertCache,
      id,
      expiresAt: insertCache.expiresAt ?? null,
      createdAt: new Date(),
    };
    this.cache.set(id, cache);
    return cache;
  }

  async deleteCache(key: string): Promise<boolean> {
    const cached = await this.getCache(key);
    if (cached) {
      return this.cache.delete(cached.id);
    }
    return false;
  }

  async cleanExpiredCache(): Promise<number> {
    const now = new Date();
    const expired = Array.from(this.cache.values())
      .filter(c => c.expiresAt && new Date(c.expiresAt) < now);
    
    expired.forEach(c => this.cache.delete(c.id));
    return expired.length;
  }

  // Job methods
  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async getJobs(status?: string): Promise<Job[]> {
    const jobs = Array.from(this.jobs.values());
    if (status) {
      return jobs.filter(job => job.status === status);
    }
    return jobs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const now = new Date();
    const job: Job = {
      ...insertJob,
      id,
      status: insertJob.status ?? "pending",
      data: insertJob.data ?? null,
      result: insertJob.result ?? null,
      error: insertJob.error ?? null,
      progress: insertJob.progress ?? 0,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.jobs.set(id, job);
    return job;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    
    const updated = { ...job, ...updates, updatedAt: new Date() };
    if (updates.status === 'completed' || updates.status === 'failed') {
      updated.completedAt = new Date();
    }
    this.jobs.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
