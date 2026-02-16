export class WelcomeMessage {
  constructor() {
    this.welcomeElement = null;
    this.lastGreeting = null;
  }
  getGreeting() {
    const hour = new Date().getHours();
    const name = window.userName ? `, ${window.userName}` : "";
    const greetings = {
      morning: [
        `Good morning${name}`,
        `Rise and shine${name}!`,
        `Up early? ${name}!`,
        `Ready to conquer today${name}?`
      ],
      afternoon: [
        `Good afternoon${name}!`,
        `Hope your day’s going strong${name}`,
        `Keep crushing it${name}!`,
        `Let’s finish strong${name}`
      ],
      evening: [
        `Good evening${name}`,
        `You made it through the day${name}!`,
        `Time to unwind${name}`,
        `Evening vibes${name}`
      ],
      night: [
        `Still awake${name}?`,
        `Burning the midnight oil${name}?`,
        `Night owl mode${name}`,
        `Don’t forget to rest${name}`
      ]
    };
    let timeOfDay;
    if (hour >= 5 && hour < 12) {
      timeOfDay = "morning";
    } else if (hour >= 12 && hour < 17) {
      timeOfDay = "afternoon";
    } else if (hour >= 17 && hour < 22) {
      timeOfDay = "evening";
    } else {
      timeOfDay = "night";
    }
    let options = greetings[timeOfDay];
    if (this.lastGreeting) {
      options = options.filter(g => g !== this.lastGreeting);
    }
    const greeting =
      options[Math.floor(Math.random() * options.length)];
    this.lastGreeting = greeting;
    return greeting;
  }
  show() {
    if (this.welcomeElement && document.body.contains(this.welcomeElement)) {
      return;
    }
    const messagesDiv = document.getElementById('messages');
    if (!messagesDiv) return;
    this.welcomeElement = document.createElement('div');
    this.welcomeElement.className = 'welcome-message';
    this.welcomeElement.innerHTML = `
      <div class="welcome-content">
        <h1 class="welcome-greeting">${this.getGreeting()}</h1>
        <p class="welcome-subtext">How can I help you today?</p>
        <div class="welcome-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
        </div>
      </div>
    `;
    messagesDiv.appendChild(this.welcomeElement);
  }
  hide() {
    if (this.welcomeElement) {
      this.welcomeElement.classList.add('welcome-fade-out');
      setTimeout(() => {
        if (this.welcomeElement && this.welcomeElement.parentNode) {
          this.welcomeElement.remove();
          this.welcomeElement = null;
        }
      }, 300);
    }
  }
}