window.isMobileDevice = function() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
};
const createDBWorker = () => {
  const workerCode = `
    const DB_NAME = 'ChatHistoryDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'conversations';
    let db = null;
    async function initDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          db = request.result;
          resolve({ success: true });
        };
        request.onupgradeneeded = (event) => {
          const database = event.target.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
      });
    }
    async function getAllConversations() {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
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
    async function getConversation(id) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async function saveConversation(conversation) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(conversation);
        request.onsuccess = () => resolve({ success: true });
        request.onerror = () => reject(request.error);
      });
    }
    async function deleteConversation(id) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve({ success: true });
        request.onerror = () => reject(request.error);
      });
    }
    async function searchConversations(query) {
      const allConversations = await getAllConversations();
      const lowerQuery = query.toLowerCase();
      return allConversations.filter(conv => {
        if (conv.title && conv.title.toLowerCase().includes(lowerQuery)) return true;
        if (conv.preview && conv.preview.toLowerCase().includes(lowerQuery)) return true;
        if (conv.messages && conv.messages.length > 0) {
          return conv.messages.some(msg => msg.content.toLowerCase().includes(lowerQuery));
        }
        return false;
      });
    }
    self.onmessage = async (e) => {
      const { action, data, id: messageId } = e.data;
      try {
        let result;
        switch (action) {
          case 'init': result = await initDB(); break;
          case 'getAllConversations': result = await getAllConversations(); break;
          case 'getConversation': result = await getConversation(data.id); break;
          case 'saveConversation': result = await saveConversation(data.conversation); break;
          case 'deleteConversation': result = await deleteConversation(data.id); break;
          case 'searchConversations': result = await searchConversations(data.query); break;
          default: throw new Error('Unknown action: ' + action);
        }
        self.postMessage({ id: messageId, action, success: true, data: result });
      } catch (error) {
        self.postMessage({ id: messageId, action, success: false, error: error.message });
      }
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};
export class ConversationManager {
  constructor() {
    this.currentConversationId = null;
    this.onConversationLoad = null;
    this.worker = null;
    this.messageId = 0;
    this.pendingMessages = new Map();
  }
  async init() {
    this.worker = createDBWorker();
    this.worker.onmessage = (e) => {
      const { id, success, data, error } = e.data;
      const pending = this.pendingMessages.get(id);
      if (pending) {
        if (success) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(error));
        }
        this.pendingMessages.delete(id);
      }
    };
    await this.sendMessage('init');
  }
  sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pendingMessages.set(id, { resolve, reject });
      this.worker.postMessage({ id, action, data });
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error('Worker timeout'));
        }
      }, 10000);
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
      preview: '',
      title: ''
    };
    conversation.messages.push({ role, content, timestamp: Date.now() });
    conversation.timestamp = Date.now();
    if (!conversation.preview && role === 'user') {
      conversation.preview = content.substring(0, 60) + (content.length > 60 ? '...' : '');
    }
    if (!conversation.title && role === 'user') {
      conversation.title = content.substring(0, 60) + (content.length > 60 ? '...' : '');
    }
    await this.saveConversation(conversation);
    return conversation;
  }
  async saveConversation(conversation) {
    return this.sendMessage('saveConversation', { conversation });
  }
  async getConversation(id) {
    return this.sendMessage('getConversation', { id });
  }
  async getAllConversations() {
    return this.sendMessage('getAllConversations');
  }
  async updateConversationTitle(id, title) {
    const conversation = await this.getConversation(id);
    if (conversation) {
      conversation.title = title;
      conversation.preview = title;
      await this.saveConversation(conversation);
    }
  }
  async deleteConversation(id) {
    return this.sendMessage('deleteConversation', { id });
  }
  async searchConversations(query) {
    return this.sendMessage('searchConversations', { query });
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
    this.draggedElement = null;
    this.editingId = null;
    this.searchQuery = '';
    this.touchStartY = 0;
    this.touchCurrentY = 0;
    this.isDragging = false;
  }
  createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar';
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <button id="newChatBtn" class="new-chat-btn">+ New Chat</button>
        <div class="search-container">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <input type="text" id="searchInput" name="searchInput" class="search-input" placeholder="Search conversations...">
          <button id="clearSearch" class="clear-search-btn" style="display: none;">×</button>
        </div>
      </div>
      <div id="conversationList" class="conversation-list"></div>
      <div class="sidebar-footer">
        <div id="sidebarUser" class="sidebar-user"></div>
      </div>
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
    this.userInfo();
  }
  userInfo() {
    const userDiv = document.getElementById('sidebarUser');
    if (!userDiv) return;
    if (window.userLoggedIn && window.userName) {
      userDiv.textContent = window.userName;
    } else {
      userDiv.textContent = 'Guest';
    }
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
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.searchQuery = e.target.value.trim();
        clearSearch.style.display = this.searchQuery ? 'block' : 'none';
        this.loadConversationList();
      }, 150);
    });
    clearSearch.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      clearSearch.style.display = 'none';
      this.loadConversationList();
    });
    document.addEventListener('keydown', (e) => {
      if (this.deleteConfirmModal?.classList.contains('show')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.confirmDelete();
          return;
        }
        if (e.key === 'Escape') {
          this.closeDeleteModal();
          return;
        }
      }
      if (this.editingId) {
        const activeItem = document.querySelector(
          `.conversation-item[data-id="${this.editingId}"]`
        );
        if (!activeItem) return;
        if (e.key === 'Escape') {
          this.cancelEditingTitle(activeItem);
        }
        return;
      }
      if (e.key === 'Escape' && this.isOpen) {
        this.toggleSidebar();
      }
    });
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
    const listDiv = document.getElementById('conversationList');
    listDiv.innerHTML = '<div class="no-conversations">Loading...</div>';
    try {
      let conversations;
      if (this.searchQuery) {
        conversations = await this.manager.searchConversations(this.searchQuery);
      } else {
        conversations = await this.manager.getAllConversations();
      }
      if (conversations.length === 0) {
        listDiv.innerHTML = `<div class="no-conversations">${this.searchQuery ? 'No matches found' : 'No conversations yet'}</div>`;
        return;
      }
      const fragment = document.createDocumentFragment();
      conversations.forEach((conv, index) => {
        const item = this.createConversationItem(conv, index);
        fragment.appendChild(item);
      });
      listDiv.innerHTML = '';
      listDiv.appendChild(fragment);
    } catch (error) {
      console.error('Error loading conversations:', error);
      listDiv.innerHTML = '<div class="no-conversations">Error loading conversations</div>';
    }
  }
  createConversationItem(conv, index) {
    const item = document.createElement('div');
    item.className = 'conversation-item';
    const isMobile = window.isMobileDevice();
    if (isMobile) {
      item.classList.add('mobile');
    }
    item.setAttribute('draggable', 'true');
    item.dataset.id = conv.id;
    if (conv.id === this.manager.currentConversationId) {
      item.classList.add('active');
    }
    const title = conv.title || conv.preview || 'New conversation';
    const editInputId = `edit-title-${conv.id}`;
    item.innerHTML = `
      <div class="conversation-preview">${this.escapeHtml(title)}</div>
      <input type="text" id="${editInputId}" name="${editInputId}" class="conversation-title-edit" value="${this.escapeHtml(title)}" style="display: none;">
      <div class="conversation-actions">
        <button class="edit-btn" title="Rename">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 2L14 4.5L5.5 13H3V10.5L11.5 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9.5 4L12 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="delete-btn" title="Delete">×</button>
        <div class="drag-handle">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="6" cy="4" r="1" fill="currentColor"/><circle cx="10" cy="4" r="1" fill="currentColor"/><circle cx="6" cy="8" r="1" fill="currentColor"/><circle cx="10" cy="8" r="1" fill="currentColor"/><circle cx="6" cy="12" r="1" fill="currentColor"/><circle cx="10" cy="12" r="1" fill="currentColor"/>
            </svg>
        </div>
      </div>
    `;
    item.addEventListener('click', (e) => this.handleItemClick(e, conv.id, item));
    if (isMobile) {
      const dragHandle = item.querySelector('.drag-handle');
      dragHandle.addEventListener('touchstart', (e) => this.handleTouchStart(e, item), { passive: false });
    } else {
      item.addEventListener('dragstart', (e) => this.handleDragStart(e, item));
      item.addEventListener('dragover', (e) => this.handleDragOver(e));
      item.addEventListener('drop', (e) => this.handleDrop(e, item));
      item.addEventListener('dragend', () => this.handleDragEnd());
      item.addEventListener('dragenter', () => item.classList.add('drag-over'));
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    }
    return item;
  }
  handleTouchStart(e, item) {
    e.preventDefault();
    this.draggedElement = item;
    this.isDragging = true;
    const touch = e.touches[0];
    this.touchStartY = touch.clientY;
    this.touchCurrentY = touch.clientY;
    item.classList.add('dragging');
    const moveHandler = (e) => this.handleTouchMove(e);
    const endHandler = (e) => {
      this.handleTouchEnd(e);
      document.removeEventListener('touchmove', moveHandler);
      document.removeEventListener('touchend', endHandler);
    };
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('touchend', endHandler);
  }
  handleTouchMove(e) {
    if (!this.isDragging || !this.draggedElement) return;
    e.preventDefault();
    const touch = e.touches[0];
    this.touchCurrentY = touch.clientY;
    const deltaY = this.touchCurrentY - this.touchStartY;
    this.draggedElement.style.transform = `translateY(${deltaY}px)`;
    this.draggedElement.style.opacity = '0.8';
    const listDiv = document.getElementById('conversationList');
    const allItems = Array.from(listDiv.querySelectorAll('.conversation-item'));
    const currentRect = this.draggedElement.getBoundingClientRect();
    const currentCenterY = currentRect.top + currentRect.height / 2;
    allItems.forEach(otherItem => {
      if (otherItem === this.draggedElement) return;
      const otherRect = otherItem.getBoundingClientRect();
      const otherCenterY = otherRect.top + otherRect.height / 2;
      if (Math.abs(currentCenterY - otherCenterY) < otherRect.height / 2) {
        otherItem.classList.add('drag-over');
      } else {
        otherItem.classList.remove('drag-over');
      }
    });
  }
  handleTouchEnd(e) {
    if (!this.isDragging || !this.draggedElement) return;
    const listDiv = document.getElementById('conversationList');
    const allItems = Array.from(listDiv.querySelectorAll('.conversation-item'));
    const currentRect = this.draggedElement.getBoundingClientRect();
    const currentCenterY = currentRect.top + currentRect.height / 2;
    let targetItem = null;
    let minDistance = Infinity;
    allItems.forEach(otherItem => {
      if (otherItem === this.draggedElement) return;
      const otherRect = otherItem.getBoundingClientRect();
      const otherCenterY = otherRect.top + otherRect.height / 2;
      const distance = Math.abs(currentCenterY - otherCenterY);
      if (distance < minDistance && distance < otherRect.height) {
        minDistance = distance;
        targetItem = otherItem;
      }
    });
    this.draggedElement.style.transform = '';
    this.draggedElement.style.opacity = '';
    if (targetItem && targetItem !== this.draggedElement) {
      const draggedIndex = allItems.indexOf(this.draggedElement);
      const targetIndex = allItems.indexOf(targetItem);
      if (draggedIndex < targetIndex) {
        targetItem.parentNode.insertBefore(this.draggedElement, targetItem.nextSibling);
      } else {
        targetItem.parentNode.insertBefore(this.draggedElement, targetItem);
      }
    }
    allItems.forEach(item => {
      item.classList.remove('dragging', 'drag-over');
    });
    this.draggedElement = null;
    this.isDragging = false;
  }
  handleItemClick(e, convId, item) {
    const target = e.target.closest('button, input');
    if (!target) {
      if (this.editingId !== convId) {
        this.loadConversationIntoChat(convId);
      }
      return;
    }
    if (target.classList.contains('edit-btn')) {
      e.stopPropagation();
      this.startEditingTitle(convId, item);
    } else if (target.classList.contains('delete-btn')) {
      e.stopPropagation();
      this.showDeleteConfirm(convId);
    } else if (target.classList.contains('conversation-title-edit')) {
      if (e.type === 'blur') {
        this.finishEditingTitle(convId, item);
      } else if (e.type === 'keydown') {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.finishEditingTitle(convId, item);
        } else if (e.key === 'Escape') {
          this.cancelEditingTitle(item);
        }
      }
    }
  }
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  startEditingTitle(id, item) {
    this.editingId = id;
    const preview = item.querySelector('.conversation-preview');
    const editInput = item.querySelector('.conversation-title-edit');
    const actions = item.querySelector('.conversation-actions');
    preview.style.display = 'none';
    actions.style.display = 'none';
    editInput.style.display = 'block';
    editInput.focus();
    editInput.select();
    editInput.addEventListener('blur', () => this.finishEditingTitle(id, item), { once: true });
    editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.finishEditingTitle(id, item);
      } else if (e.key === 'Escape') {
        this.cancelEditingTitle(item);
      }
    }, { once: true });
  }
  async finishEditingTitle(id, item) {
    const editInput = item.querySelector('.conversation-title-edit');
    const newTitle = editInput.value.trim();
    if (newTitle && newTitle.length > 0) {
      await this.manager.updateConversationTitle(id, newTitle);
      const preview = item.querySelector('.conversation-preview');
      preview.textContent = newTitle;
    }
    this.cancelEditingTitle(item);
  }
  cancelEditingTitle(item) {
    this.editingId = null;
    const preview = item.querySelector('.conversation-preview');
    const editInput = item.querySelector('.conversation-title-edit');
    const actions = item.querySelector('.conversation-actions');
    editInput.style.display = 'none';
    preview.style.display = 'block';
    actions.style.display = '';
  }
  handleDragStart(e, item) {
    this.draggedElement = item;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', item.innerHTML);
  }
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
  handleDrop(e, targetItem) {
    e.stopPropagation();
    e.preventDefault();
    targetItem.classList.remove('drag-over');
    if (this.draggedElement !== targetItem) {
      const listDiv = document.getElementById('conversationList');
      const allItems = Array.from(listDiv.querySelectorAll('.conversation-item'));
      const draggedIndex = allItems.indexOf(this.draggedElement);
      const targetIndex = allItems.indexOf(targetItem);
      if (draggedIndex < targetIndex) {
        targetItem.parentNode.insertBefore(this.draggedElement, targetItem.nextSibling);
      } else {
        targetItem.parentNode.insertBefore(this.draggedElement, targetItem);
      }
    }
  }
  handleDragEnd() {
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.remove('dragging', 'drag-over');
    });
    this.draggedElement = null;
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