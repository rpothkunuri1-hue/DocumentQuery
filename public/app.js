class DocuChat {
    constructor() {
        this.activeDocumentId = null;
        this.conversationId = null;
        this.isStreaming = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDocuments();
    }

    setupEventListeners() {
        document.getElementById('uploadBtn').addEventListener('click', () => this.showUploadModal());
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideUploadModal());
        document.getElementById('browseBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        const dropzone = document.getElementById('dropzone');
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.handleFileSelect(file);
        });
        dropzone.addEventListener('click', () => document.getElementById('fileInput').click());
    }

    async loadDocuments() {
        try {
            const response = await fetch('/api/documents');
            const documents = await response.json();
            this.renderDocuments(documents);
        } catch (error) {
            console.error('Failed to load documents:', error);
            this.showToast('Failed to load documents', 'error');
        }
    }

    renderDocuments(documents) {
        const container = document.getElementById('documentsList');
        if (documents.length === 0) {
            container.innerHTML = '<div class="loading">No documents yet. Upload one to get started!</div>';
            return;
        }

        container.innerHTML = documents.map(doc => `
            <div class="document-item ${doc.id === this.activeDocumentId ? 'active' : ''}" data-id="${doc.id}">
                <h3>${this.escapeHtml(doc.name)}</h3>
                <p>${new Date(doc.uploadedAt).toLocaleDateString()}</p>
            </div>
        `).join('');

        container.querySelectorAll('.document-item').forEach(item => {
            item.addEventListener('click', () => this.selectDocument(item.dataset.id));
        });
    }

    async selectDocument(documentId) {
        this.activeDocumentId = documentId;
        this.conversationId = null;
        
        try {
            const [document, conversation] = await Promise.all([
                fetch(`/api/documents/${documentId}`).then(r => r.json()),
                fetch(`/api/conversations/${documentId}`).then(r => r.json())
            ]);

            this.conversationId = conversation.id;
            
            document.getElementById('welcomeScreen').style.display = 'none';
            document.getElementById('chatView').style.display = 'flex';
            document.getElementById('documentTitle').textContent = document.name;
            
            this.loadDocuments();
            this.loadMessages();
        } catch (error) {
            console.error('Failed to load document:', error);
            this.showToast('Failed to load document', 'error');
        }
    }

    async loadMessages() {
        if (!this.conversationId) return;

        try {
            const messages = await fetch(`/api/messages/${this.conversationId}`).then(r => r.json());
            this.renderMessages(messages);
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    renderMessages(messages) {
        const container = document.getElementById('messages');
        container.innerHTML = messages.map(msg => `
            <div class="message ${msg.role}">
                <div class="message-avatar">${msg.role === 'user' ? 'U' : 'AI'}</div>
                <div class="message-content">${this.escapeHtml(msg.content)}</div>
            </div>
        `).join('');
        this.scrollToBottom();
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message || this.isStreaming || !this.conversationId) return;

        input.value = '';
        this.isStreaming = true;
        document.getElementById('sendBtn').disabled = true;

        this.addMessageToUI('user', message);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: this.activeDocumentId,
                    conversationId: this.conversationId,
                    question: message
                })
            });

            if (!response.ok) throw new Error('Failed to send message');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';
            let messageElement = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.type === 'message_id') {
                                messageElement = this.addMessageToUI('assistant', '');
                            } else if (data.type === 'token' && messageElement) {
                                assistantMessage += data.content;
                                messageElement.querySelector('.message-content').textContent = assistantMessage;
                                this.scrollToBottom();
                            } else if (data.type === 'done') {
                                this.isStreaming = false;
                                document.getElementById('sendBtn').disabled = false;
                                input.focus();
                            }
                        } catch (e) {
                            console.error('Parse error:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showToast('Failed to send message', 'error');
            this.isStreaming = false;
            document.getElementById('sendBtn').disabled = false;
        }
    }

    addMessageToUI(role, content) {
        const container = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.innerHTML = `
            <div class="message-avatar">${role === 'user' ? 'U' : 'AI'}</div>
            <div class="message-content">${this.escapeHtml(content)}</div>
        `;
        container.appendChild(messageDiv);
        this.scrollToBottom();
        return messageDiv;
    }

    scrollToBottom() {
        const messages = document.getElementById('messages');
        messages.scrollTop = messages.scrollHeight;
    }

    showUploadModal() {
        document.getElementById('uploadModal').style.display = 'flex';
    }

    hideUploadModal() {
        document.getElementById('uploadModal').style.display = 'none';
        document.getElementById('fileInput').value = '';
        document.getElementById('dropzone').style.display = 'block';
        document.getElementById('uploadProgress').style.display = 'none';
    }

    handleFileSelect(file) {
        if (!file) return;

        const validTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        
        if (!validTypes.includes(file.type)) {
            this.showToast('Please upload PDF, TXT, or DOCX files', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showToast('Maximum file size is 10MB', 'error');
            return;
        }

        this.uploadFile(file);
    }

    async uploadFile(file) {
        document.getElementById('dropzone').style.display = 'none';
        document.getElementById('uploadProgress').style.display = 'block';
        
        const progressFill = document.getElementById('progressFill');
        progressFill.style.width = '30%';

        const formData = new FormData();
        formData.append('file', file);

        try {
            setTimeout(() => progressFill.style.width = '60%', 300);
            setTimeout(() => progressFill.style.width = '90%', 600);

            const response = await fetch('/api/documents/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');

            const document = await response.json();
            progressFill.style.width = '100%';
            
            this.showToast('Document uploaded successfully', 'success');
            this.hideUploadModal();
            await this.loadDocuments();
            this.selectDocument(document.id);
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('Upload failed. Please try again', 'error');
            this.hideUploadModal();
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DocuChat();
});
