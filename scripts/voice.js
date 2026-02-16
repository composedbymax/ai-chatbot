export class VoiceInput {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.activeInput = null;
    this.activeButton = null;
    this.checkBrowserSupport();
  }
  checkBrowserSupport() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.onresult = (event) => this.handleResult(event);
      this.recognition.onerror = (event) => this.handleError(event);
      this.recognition.onend = () => this.handleEnd();
    }
  }
  isSupported() {
    return this.recognition !== null;
  }
  attachToInput(inputElement) {
    if (!this.isSupported()) {
      console.warn('Web Speech API not supported in this browser');
      return;
    }
    if (inputElement.parentElement.querySelector('.voice-input-btn')) {
      return;
    }
    let wrapper = inputElement.parentElement;
    if (!wrapper.classList.contains('voice-input-wrapper')) {
      wrapper = document.createElement('div');
      wrapper.className = 'voice-input-wrapper';
      inputElement.parentElement.insertBefore(wrapper, inputElement);
      wrapper.appendChild(inputElement);
    }
    const micButton = document.createElement('button');
    micButton.type = 'button';
    micButton.className = 'voice-input-btn';
    micButton.setAttribute('aria-label', 'Voice input');
    micButton.innerHTML = `
      <svg class="mic-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 15C13.66 15 15 13.66 15 12V6C15 4.34 13.66 3 12 3C10.34 3 9 4.34 9 6V12C9 13.66 10.34 15 12 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M19 12C19 15.866 15.866 19 12 19M12 19C8.13401 19 5 15.866 5 12M12 19V23M8 23H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    micButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleListening(inputElement, micButton);
    });
    micButton.addEventListener('mouseenter', () => {
      if (this.isListening && this.activeButton === micButton) {
        micButton.classList.add('hover-stop');
      } else if (!this.isListening) {
        micButton.classList.add('hover-start');
      }
    });
    micButton.addEventListener('mouseleave', () => {
      micButton.classList.remove('hover-stop', 'hover-start');
    });
    wrapper.appendChild(micButton);
  }
  toggleListening(inputElement, button) {
    if (this.isListening && this.activeButton === button) {
      this.stopListening();
    } else {
      this.startListening(inputElement, button);
    }
  }
  startListening(inputElement, button) {
    if (!this.isSupported()) return;
    if (this.isListening) {
      this.stopListening();
    }
    this.activeInput = inputElement;
    this.activeButton = button;
    this.isListening = true;
    button.classList.add('listening');
    button.classList.remove('hover-start');
    try {
      this.recognition.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.stopListening();
    }
  }
  stopListening() {
    if (!this.isSupported() || !this.isListening) return;
    this.isListening = false;
    if (this.activeButton) {
      this.activeButton.classList.remove('listening', 'hover-stop');
    }
    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
    this.activeInput = null;
    this.activeButton = null;
  }
  handleResult(event) {
    if (!this.activeInput) return;
    let interimTranscript = '';
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }
    if (finalTranscript) {
      const currentValue = this.activeInput.value;
      const newValue = currentValue + (currentValue ? ' ' : '') + finalTranscript.trim();
      this.activeInput.value = newValue;
      const inputEvent = new Event('input', { bubbles: true });
      this.activeInput.dispatchEvent(inputEvent);
    }
  }
  handleError(event) {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'no-speech') {
      return;
    }
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      alert('Microphone access was denied. Please allow microphone access in your browser settings.');
    }
    this.stopListening();
  }
  handleEnd() {
    if (this.isListening) {
      try {
        this.recognition.start();
      } catch (error) {
        console.error('Error restarting recognition:', error);
        this.stopListening();
      }
    }
  }
  destroy() {
    this.stopListening();
    if (this.recognition) {
      this.recognition.abort();
    }
  }
}