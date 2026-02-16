export class ConversationManager {
  constructor() {
    this.dbName = 'ChatHistoryDB';
    this.dbVersion = 1;
    this.storeName = 'conversations';
    this.db = null;
    this.currentConversationId = null;
    this.onConversationLoad = null;
  }
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
  generateId() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
  async saveMessage(role, content) {
    if (!this.currentConversationId) {
      this.currentConversationId = this.generateId();
    }
    const conversation = await this.getConversation(this.currentConversationId) || {
      id: this.currentConversationId,
      messages: [],
      timestamp: Date.now(),
      preview: ''
    };
    conversation.messages.push({ role, content, timestamp: Date.now() });
    conversation.timestamp = Date.now();
    if (!conversation.preview && role === 'user') {
      conversation.preview = content.substring(0, 60) + (content.length > 60 ? '...' : '');
    }
    await this.saveConversation(conversation);
    return conversation;
  }
  async saveConversation(conversation) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(conversation);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async getConversation(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async getAllConversations() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev');
      const conversations = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          conversations.push(cursor.value);
          cursor.continue();
        } else {
          resolve(conversations);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  async deleteConversation(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  startNewConversation() {
    this.currentConversationId = null;
  }
  loadConversation(id) {
    this.currentConversationId = id;
  }
}
export class SidebarUI {
  constructor(conversationManager) {
    this.manager = conversationManager;
    this.isOpen = false;
    this.deleteConfirmModal = null;
    this.pendingDeleteId = null;
  }
  createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar';
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <button id="newChatBtn" class="new-chat-btn">+ New Chat</button>
      </div>
      <div id="conversationList" class="conversation-list"></div>
    `;
    document.body.appendChild(sidebar);
    const toggle = document.createElement('button');
    toggle.id = 'sidebarToggle';
    toggle.className = 'sidebar-toggle';
    toggle.innerHTML = `
      <div class="hamburger">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    document.body.appendChild(toggle);
    this.createDeleteConfirmModal();
    this.attachEventListeners();
  }
  createDeleteConfirmModal() {
    const modal = document.createElement('div');
    modal.id = 'deleteConfirmModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Delete Conversation?</h3>
        <p>This action cannot be undone.</p>
        <div class="modal-buttons">
          <button id="confirmDelete" class="btn-delete">Delete</button>
          <button id="cancelDelete" class="btn-cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this.deleteConfirmModal = modal;
    document.getElementById('confirmDelete').addEventListener('click', () => {
      this.confirmDelete();
    });
    document.getElementById('cancelDelete').addEventListener('click', () => {
      this.closeDeleteModal();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeDeleteModal();
      }
    });
  }
  attachEventListeners() {
    const toggle = document.getElementById('sidebarToggle');
    toggle.addEventListener('click', () => this.toggleSidebar());
    const newChatBtn = document.getElementById('newChatBtn');
    newChatBtn.addEventListener('click', () => this.startNewChat());
  }
  toggleSidebar() {
    this.isOpen = !this.isOpen;
    const toggle = document.getElementById('sidebarToggle');
    if (this.isOpen) {
      document.body.classList.add('sidebar-open');
      toggle.classList.add('open');
      this.loadConversationList();
    } else {
      document.body.classList.remove('sidebar-open');
      toggle.classList.remove('open');
    }
  }
  async loadConversationList() {
    const conversations = await this.manager.getAllConversations();
    const listDiv = document.getElementById('conversationList');
    if (conversations.length === 0) {
      listDiv.innerHTML = '<div class="no-conversations">No conversations yet</div>';
      return;
    }
    listDiv.innerHTML = '';
    conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'conversation-item';
      if (conv.id === this.manager.currentConversationId) {
        item.classList.add('active');
      }
      item.innerHTML = `
        <div class="conversation-preview">${conv.preview || 'New conversation'}</div>
        <button class="delete-btn" data-id="${conv.id}">×</button>
      `;
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-btn')) {
          this.loadConversationIntoChat(conv.id);
        }
      });
      const deleteBtn = item.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showDeleteConfirm(conv.id);
      });
      listDiv.appendChild(item);
    });
  }
  showDeleteConfirm(id) {
    this.pendingDeleteId = id;
    this.deleteConfirmModal.classList.add('show');
  }
  closeDeleteModal() {
    this.deleteConfirmModal.classList.remove('show');
    this.pendingDeleteId = null;
  }
  async confirmDelete() {
    if (this.pendingDeleteId) {
      await this.manager.deleteConversation(this.pendingDeleteId);
      if (this.pendingDeleteId === this.manager.currentConversationId) {
        this.startNewChat();
      }
      this.closeDeleteModal();
      this.loadConversationList();
    }
  }
  async loadConversationIntoChat(id) {
    const conversation = await this.manager.getConversation(id);
    if (conversation && this.manager.onConversationLoad) {
      this.manager.loadConversation(id);
      this.manager.onConversationLoad(conversation);
      this.toggleSidebar();
    }
  }
  startNewChat() {
    this.manager.startNewConversation();
    if (this.manager.onConversationLoad) {
      this.manager.onConversationLoad({ messages: [] });
    }
    if (this.isOpen) {
      this.toggleSidebar();
    }
  }
}