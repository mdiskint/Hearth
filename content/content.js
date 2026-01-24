// content.js - Main content script

console.log('Hearth: Content script loaded');

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHearth);
} else {
  initHearth();
}

function initHearth() {
  console.log('Hearth: Initializing...');
  
  // The injector initializes itself when loaded
  // This file serves as the main entry point and can handle
  // additional functionality like UI indicators, etc.
  
  // Add visual indicator that Hearth is active
  addHearthIndicator();
}

function addHearthIndicator() {
  // Create a small indicator in the corner
  const indicator = document.createElement('div');
  indicator.id = 'hearth-indicator';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 8px 15px;
    border-radius: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    z-index: 10000;
    cursor: pointer;
    transition: all 0.3s ease;
    opacity: 0.8;
  `;
  indicator.textContent = '🔥 Hearth Active';
  
  indicator.addEventListener('mouseenter', () => {
    indicator.style.opacity = '1';
    indicator.style.transform = 'scale(1.05)';
  });
  
  indicator.addEventListener('mouseleave', () => {
    indicator.style.opacity = '0.8';
    indicator.style.transform = 'scale(1)';
  });
  
  indicator.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });
  
  // Check if injection is enabled before showing indicator
  chrome.storage.local.get('settings').then(data => {
    const settings = data.settings || { enabled: true };
    if (settings.enabled) {
      document.body.appendChild(indicator);
    }
  });
  
  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.settings) {
      const enabled = changes.settings.newValue?.enabled;
      const existingIndicator = document.getElementById('hearth-indicator');
      
      if (enabled && !existingIndicator) {
        document.body.appendChild(indicator);
      } else if (!enabled && existingIndicator) {
        existingIndicator.remove();
      }
    }
  });
}
