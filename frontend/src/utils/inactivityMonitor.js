/**
 * Inactivity Monitor - Auto logout after period of inactivity
 */

import { logout } from './authUtils';

class InactivityMonitor {
  constructor() {
    this.timeout = null;
    this.warningTimeout = null;
    this.inactivityTime = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.warningTime = 28 * 60 * 1000; // 28 minutes (2 min before logout)
    this.events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    this.isActive = false;
    this.warningShown = false;
  }

  /**
   * Start monitoring user activity
   */
  start() {
    if (this.isActive) return;
    
    console.log('🕐 Inactivity monitor started - will logout after 30 minutes of inactivity');
    this.isActive = true;
    
    // Bind event listeners
    this.events.forEach(event => {
      window.addEventListener(event, this.resetTimer.bind(this), true);
    });
    
    // Start the timer
    this.resetTimer();
  }

  /**
   * Stop monitoring (call on logout)
   */
  stop() {
    if (!this.isActive) return;
    
    console.log('🕐 Inactivity monitor stopped');
    this.isActive = false;
    this.warningShown = false;
    
    // Clear timers
    if (this.timeout) clearTimeout(this.timeout);
    if (this.warningTimeout) clearTimeout(this.warningTimeout);
    
    // Remove event listeners
    this.events.forEach(event => {
      window.removeEventListener(event, this.resetTimer.bind(this), true);
    });
  }

  /**
   * Reset the inactivity timer
   */
  resetTimer() {
    if (!this.isActive) return;
    
    // Clear existing timers
    if (this.timeout) clearTimeout(this.timeout);
    if (this.warningTimeout) clearTimeout(this.warningTimeout);
    
    // Reset warning flag
    this.warningShown = false;
    
    // Set warning timer (2 minutes before logout)
    this.warningTimeout = setTimeout(() => {
      this.showWarning();
    }, this.warningTime);
    
    // Set logout timer (30 minutes)
    this.timeout = setTimeout(() => {
      this.handleInactivity();
    }, this.inactivityTime);
  }

  /**
   * Show warning before auto-logout
   */
  showWarning() {
    if (this.warningShown) return;
    
    this.warningShown = true;
    console.warn('⚠️ Inactivity warning: You will be logged out in 2 minutes');
    
    // Show a non-intrusive warning
    const warningDiv = document.createElement('div');
    warningDiv.id = 'inactivity-warning';
    warningDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        min-width: 300px;
        animation: slideIn 0.3s ease-out;
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 4px;">Session Expiring Soon</div>
            <div style="opacity: 0.9; font-size: 13px;">You'll be logged out in 2 minutes due to inactivity</div>
          </div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="
          position: absolute;
          top: 8px;
          right: 8px;
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 20px;
          padding: 0;
          width: 24px;
          height: 24px;
          line-height: 1;
        ">×</button>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    
    document.body.appendChild(warningDiv);
    
    // Auto-remove warning after 10 seconds
    setTimeout(() => {
      const warning = document.getElementById('inactivity-warning');
      if (warning) warning.remove();
    }, 10000);
  }

  /**
   * Handle inactivity timeout - logout user
   */
  handleInactivity() {
    console.error('⏱️ User inactive for 30 minutes - auto logout');
    
    // Show logout message
    const message = 'You have been logged out due to 30 minutes of inactivity.';
    
    // Stop monitoring
    this.stop();
    
    // Logout
    localStorage.clear();
    alert(message);
    window.location.href = '/login';
  }

  /**
   * Set custom inactivity time (in minutes)
   */
  setInactivityTime(minutes) {
    this.inactivityTime = minutes * 60 * 1000;
    this.warningTime = (minutes - 2) * 60 * 1000; // 2 min before logout
    console.log(`⏱️ Inactivity timeout set to ${minutes} minutes`);
    
    if (this.isActive) {
      this.resetTimer();
    }
  }

  /**
   * Get remaining time before logout (in seconds)
   */
  getRemainingTime() {
    // This is approximate since we don't track the exact start time
    return Math.floor(this.inactivityTime / 1000);
  }
}

// Create singleton instance
const inactivityMonitor = new InactivityMonitor();

export default inactivityMonitor;
