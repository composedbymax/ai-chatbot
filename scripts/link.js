export class ShareableLink {
  constructor(conversationManager) {
    this.conversationManager = conversationManager;
    this.isGeneratingLink = false;
    this.updateInterval = null;
    this.worker = null;
    this.pendingCompression = false;
    this.lastCompressed = '';
    this.setupKeyboardShortcut();
  }
  initializeWorker() {
    if (this.worker) {
      this.worker.terminate();
    }
    const workerCode = `
      function compressString(str) {
        try {
          const encoded = btoa(unescape(encodeURIComponent(str)));
          return encoded.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
        } catch (error) {
          throw new Error('Compression failed: ' + error.message);
        }
      }
      self.onmessage = function(e) {
        try {
          const { messages } = e.data;
          const chatData = {
            messages: messages,
            timestamp: new Date().toISOString()
          };
          const jsonString = JSON.stringify(chatData);
          const compressed = compressString(jsonString);
          self.postMessage({ compressed, success: true });
        } catch (error) {
          self.postMessage({ error: error.message, success: false });
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const blobURL = URL.createObjectURL(blob);
    this.worker = new Worker(blobURL);
    this.worker.onmessage = (e) => {
      this.pendingCompression = false;
      if (!e.data.success) {
        console.error('Worker compression error:', e.data.error);
        return;
      }
      const { compressed } = e.data;
      this.lastCompressed = compressed;
      this.updateURLBar(compressed);
    };
    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
      this.pendingCompression = false;
    };
  }
  setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        this.toggleLinkGeneration();
      }
    });
  }
  toggleLinkGeneration() {
    if (this.isGeneratingLink) {
      this.stopGeneratingLink();
    } else {
      this.startGeneratingLink();
    }
  }
  startGeneratingLink() {
    if (this.isGeneratingLink) return;
    this.isGeneratingLink = true;
    this.initializeWorker();
    this.generateLink();
    this.updateInterval = setInterval(() => {
      if (!this.pendingCompression) {
        this.generateLink();
      }
    }, 5000);
  }
  stopGeneratingLink() {
    this.isGeneratingLink = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingCompression = false;
    const url = new URL(window.location);
    url.searchParams.delete('share');
    window.history.replaceState({}, '', url);
  }
  async generateLink() {
    if (this.pendingCompression) return;
    try {
      const conversationId = this.conversationManager.currentConversationId;
      if (!conversationId) {
        return;
      }
      const conversation = await this.conversationManager.getConversation(conversationId);
      if (!conversation || !conversation.messages || conversation.messages.length === 0) {
        return;
      }
      const messages = conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      if (this.worker && this.isGeneratingLink) {
        this.pendingCompression = true;
        this.worker.postMessage({ messages });
      }
    } catch (error) {
      console.error('Error generating shareable link:', error);
      this.pendingCompression = false;
    }
  }
  updateURLBar(compressed) {
    try {
      const url = new URL(window.location);
      url.searchParams.set('share', compressed);
      window.history.replaceState({}, '', url);
    } catch (error) {
      console.error('Error updating URL:', error);
    }
  }
  decompressString(c) {
    try {
      let b64 = c.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) {
        b64 += '=';
      }
      const decoded = decodeURIComponent(escape(atob(b64)));
      return decoded;
    } catch (error) {
      console.error('Decompression error:', error);
      throw new Error('Failed to decompress: ' + error.message);
    }
  }
  loadSharedConversation() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareParam = urlParams.get('share');
    if (!shareParam) {
      return null;
    }
    try {
      const decompressed = this.decompressString(shareParam);
      const chatData = JSON.parse(decompressed);
      return chatData;
    } catch (error) {
      console.error('Error loading shared conversation:', error);
      return null;
    }
  }
  cleanup() {
    this.stopGeneratingLink();
  }
}