class DraftSaver {
  constructor(textareaElement, storageKey = 'chat_draft') {
    this.textarea = textareaElement;
    this.storageKey = storageKey;
    this.worker = null;
    this.debounceDelay = 300;
    this.initWorker();
    this.restoreDraft();
    this.attachListeners();
  }
  initWorker() {
    const workerCode = `
      let saveTimeout = null;
      self.addEventListener('message', function(e) {
        const { action, key, value, delay } = e.data;
        if (action === 'save') {
          if (saveTimeout) {
            clearTimeout(saveTimeout);
          }
          saveTimeout = setTimeout(() => {
            self.postMessage({
              action: 'performSave',
              key: key,
              value: value
            });
          }, delay || 0);
        } else if (action === 'delete') {
          if (saveTimeout) {
            clearTimeout(saveTimeout);
          }
          self.postMessage({
            action: 'performDelete',
            key: key
          });
        }
      });
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    this.worker = new Worker(workerUrl);
    URL.revokeObjectURL(workerUrl);
    this.worker.addEventListener('message', (e) => {
      const { action, key, value } = e.data;
      if (action === 'performSave') {
        try {
          localStorage.setItem(key, value);
        } catch (error) {
          console.error('Failed to save draft:', error);
        }
      } else if (action === 'performDelete') {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error('Failed to delete draft:', error);
        }
      }
    });
  }
  attachListeners() {
    this.textarea.addEventListener('input', () => {
      this.saveDraft();
    });
    this.textarea.addEventListener('blur', () => {
      this.saveDraft(0);
    });
  }
  saveDraft(delay = this.debounceDelay) {
    const value = this.textarea.value.trim();
    if (value) {
      this.worker.postMessage({
        action: 'save',
        key: this.storageKey,
        value: value,
        delay: delay
      });
    } else {
      this.deleteDraft();
    }
  }
  restoreDraft() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.textarea.value = saved;
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (error) {
      console.error('Failed to restore draft:', error);
    }
  }
  deleteDraft() {
    this.worker.postMessage({
      action: 'delete',
      key: this.storageKey
    });
  }
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
export { DraftSaver };