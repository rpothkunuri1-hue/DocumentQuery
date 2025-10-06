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
  type Collection,
  type InsertCollection,
  type DocumentComparison,
  type InsertDocumentComparison,
  type ModelComparison,
  type InsertModelComparison,
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
  
  // Collection methods
  getCollections(): Promise<Collection[]>;
  getCollection(id: string): Promise<Collection | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  updateCollection(id: string, updates: Partial<Collection>): Promise<Collection | undefined>;
  deleteCollection(id: string): Promise<boolean>;
  getDocumentsByCollection(collectionId: string): Promise<Document[]>;
  
  // Document Comparison methods
  getDocumentComparison(documentId1: string, documentId2: string): Promise<DocumentComparison | undefined>;
  createDocumentComparison(comparison: InsertDocumentComparison): Promise<DocumentComparison>;
  getDocumentComparisons(): Promise<DocumentComparison[]>;
  
  // Model Comparison methods
  getModelComparison(id: string): Promise<ModelComparison | undefined>;
  createModelComparison(comparison: InsertModelComparison): Promise<ModelComparison>;
  getModelComparisonsByConversation(conversationId: string): Promise<ModelComparison[]>;
}

export class MemStorage implements IStorage {
  private documents: Map<string, Document>;
  private documentChunks: Map<string, DocumentChunk>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private cache: Map<string, Cache>;
  private jobs: Map<string, Job>;
  private collections: Map<string, Collection>;
  private documentComparisons: Map<string, DocumentComparison>;
  private modelComparisons: Map<string, ModelComparison>;

  constructor() {
    this.documents = new Map();
    this.documentChunks = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.cache = new Map();
    this.jobs = new Map();
    this.collections = new Map();
    this.documentComparisons = new Map();
    this.modelComparisons = new Map();
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
      collectionId: insertDoc.collectionId ?? null,
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

  // Collection methods
  async getCollections(): Promise<Collection[]> {
    return Array.from(this.collections.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getCollection(id: string): Promise<Collection | undefined> {
    return this.collections.get(id);
  }

  async createCollection(insertCollection: InsertCollection): Promise<Collection> {
    const id = randomUUID();
    const now = new Date();
    const collection: Collection = {
      id,
      name: insertCollection.name,
      description: insertCollection.description ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.collections.set(id, collection);
    return collection;
  }

  async updateCollection(id: string, updates: Partial<Collection>): Promise<Collection | undefined> {
    const collection = this.collections.get(id);
    if (!collection) return undefined;
    
    const updated = { ...collection, ...updates, updatedAt: new Date() };
    this.collections.set(id, updated);
    return updated;
  }

  async deleteCollection(id: string): Promise<boolean> {
    const deleted = this.collections.delete(id);
    if (deleted) {
      Array.from(this.documents.values())
        .filter(doc => doc.collectionId === id)
        .forEach(doc => {
          const updated = { ...doc, collectionId: null };
          this.documents.set(doc.id, updated);
        });
    }
    return deleted;
  }

  async getDocumentsByCollection(collectionId: string): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.collectionId === collectionId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  // Document Comparison methods
  async getDocumentComparison(documentId1: string, documentId2: string): Promise<DocumentComparison | undefined> {
    return Array.from(this.documentComparisons.values()).find(
      comp => 
        (comp.documentId1 === documentId1 && comp.documentId2 === documentId2) ||
        (comp.documentId1 === documentId2 && comp.documentId2 === documentId1)
    );
  }

  async createDocumentComparison(insertComparison: InsertDocumentComparison): Promise<DocumentComparison> {
    const id = randomUUID();
    const comparison: DocumentComparison = {
      ...insertComparison,
      id,
      differences: insertComparison.differences ?? null,
      similarities: insertComparison.similarities ?? null,
      comparisonSummary: insertComparison.comparisonSummary ?? null,
      createdAt: new Date(),
    };
    this.documentComparisons.set(id, comparison);
    return comparison;
  }

  async getDocumentComparisons(): Promise<DocumentComparison[]> {
    return Array.from(this.documentComparisons.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Model Comparison methods
  async getModelComparison(id: string): Promise<ModelComparison | undefined> {
    return this.modelComparisons.get(id);
  }

  async createModelComparison(insertComparison: InsertModelComparison): Promise<ModelComparison> {
    const id = randomUUID();
    const comparison: ModelComparison = {
      ...insertComparison,
      id,
      createdAt: new Date(),
    };
    this.modelComparisons.set(id, comparison);
    return comparison;
  }

  async getModelComparisonsByConversation(conversationId: string): Promise<ModelComparison[]> {
    return Array.from(this.modelComparisons.values())
      .filter(comp => comp.conversationId === conversationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const storage = new MemStorage();
