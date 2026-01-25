// injector.js - OpSpec injection logic

const HearthInjector = {
  platform: null,
  opspec: null,
  settings: null,
  memories: null,
  openaiApiKey: null,
  patternEvidence: null,  // NEW: Pattern evidence for confidence calibration

  async init() {
    this.platform = detectPlatform();

    if (!this.platform) {
      console.log('Hearth: Platform not supported');
      return;
    }

    console.log(`Hearth: Detected ${this.platform.name}`);

    // Load OpSpec and settings
    await this.loadData();

    // Start monitoring for input
    this.startMonitoring();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => this.cleanup());
  },

  async loadData() {
    try {
      const data = await chrome.storage.local.get(['opspec', 'settings', 'memories', 'openaiApiKey', 'patternEvidence']);
      this.opspec = data.opspec;
      this.settings = data.settings || { enabled: true };
      this.memories = data.memories || [];
      this.openaiApiKey = data.openaiApiKey || null;
      this.patternEvidence = data.patternEvidence || {};  // NEW

      console.log('Hearth: Loaded data -',
        'OpSpec:', !!this.opspec,
        'Memories:', this.memories.length,
        'OpenAI Key:', !!this.openaiApiKey,
        'Pattern Evidence:', Object.keys(this.patternEvidence).length, 'patterns'  // NEW
      );
    } catch (error) {
      console.error('Hearth: Error loading data:', error);
    }
  },

  startMonitoring() {
    // Inject the fetch interceptor and send data
    this.setupFetchInterceptor();

    // Listen for messages from page context (conversation monitor)
    window.addEventListener('message', async (event) => {
      if (!event.data || !event.data.type) return;

      // Handle setting changes
      if (event.data.type === 'HEARTH_MONITOR_SETTING_CHANGE') {
        // Persist setting change to chrome.storage
        chrome.storage.local.set({
          liveExtractionEnabled: event.data.liveExtractionEnabled
        });
        console.log('Hearth: Persisted live extraction setting:', event.data.liveExtractionEnabled);
      }

      // Handle memory save requests from conversation monitor
      if (event.data.type === 'HEARTH_SAVE_MEMORY' && event.data.memory) {
        try {
          // HearthStorage is available in content script context
          if (typeof HearthStorage !== 'undefined' && HearthStorage.saveMemory) {
            await HearthStorage.saveMemory(event.data.memory);
            console.log('Hearth: Saved live memory:', event.data.memory.content.substring(0, 50) + '...');
          } else {
            console.error('Hearth: HearthStorage not available for saving memory');
          }
        } catch (error) {
          console.error('Hearth: Failed to save live memory:', error.message);
        }
      }

      // NEW: Handle pattern evidence from fetch interceptor
      if (event.data.type === 'HEARTH_NEW_EVIDENCE' && event.data.evidence) {
        try {
          await this.appendEvidenceBatch(event.data.evidence);
          console.log('Hearth: Persisted', event.data.evidence.length, 'new evidence records');
        } catch (error) {
          console.error('Hearth: Failed to persist evidence:', error.message);
        }
      }
    });

    // Reload data when storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        let dataChanged = false;

        if (changes.opspec) {
          this.opspec = changes.opspec.newValue;
          dataChanged = true;
        }
        if (changes.settings) {
          this.settings = changes.settings.newValue;
          dataChanged = true;
        }
        if (changes.memories) {
          this.memories = changes.memories.newValue;
          dataChanged = true;
        }
        if (changes.openaiApiKey) {
          this.openaiApiKey = changes.openaiApiKey.newValue;
          dataChanged = true;
        }
        // NEW: Track pattern evidence changes
        if (changes.patternEvidence) {
          this.patternEvidence = changes.patternEvidence.newValue;
          dataChanged = true;
        }

        // Send updated data to fetch interceptor
        if (dataChanged) {
          this.sendDataToInterceptor();
        }
      }
    });
  },

  // NEW: Append evidence records to chrome.storage
  async appendEvidenceBatch(evidenceArray) {
    if (!evidenceArray || evidenceArray.length === 0) return;

    const maxPerPattern = 100;  // Pruning limit

    try {
      const data = await chrome.storage.local.get('patternEvidence');
      const allEvidence = data.patternEvidence || {};

      for (const evidence of evidenceArray) {
        if (!allEvidence[evidence.pattern_id]) {
          allEvidence[evidence.pattern_id] = [];
        }

        // Add unique ID if not present
        if (!evidence.id) {
          evidence.id = `${evidence.pattern_id}_${evidence.polarity}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        }

        // Set timestamp if not present
        if (!evidence.observed_at) {
          evidence.observed_at = new Date().toISOString();
        }

        allEvidence[evidence.pattern_id].push(evidence);
      }

      // Prune all patterns that exceed limit
      for (const patternId of Object.keys(allEvidence)) {
        if (allEvidence[patternId].length > maxPerPattern) {
          allEvidence[patternId] = allEvidence[patternId]
            .sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))
            .slice(0, maxPerPattern);
        }
      }

      await chrome.storage.local.set({ patternEvidence: allEvidence });
      this.patternEvidence = allEvidence;
    } catch (error) {
      console.error('Hearth: Failed to append evidence batch:', error);
    }
  },

  setupFetchInterceptor() {
    if (!this.settings || !this.settings.enabled) {
      console.log('Hearth: Disabled, skipping fetch interceptor');
      return;
    }

    if (!this.opspec) {
      console.log('Hearth: No OpSpec loaded, skipping fetch interceptor');
      return;
    }

    // Inject the fetch interceptor script
    const fetchScript = document.createElement('script');
    fetchScript.src = chrome.runtime.getURL('content/fetch-interceptor.js');
    fetchScript.onload = () => {
      console.log('Hearth: Fetch interceptor loaded');

      // After fetch interceptor is loaded, inject conversation monitor
      this.injectConversationMonitor();

      // Send data via postMessage
      this.sendDataToInterceptor();
    };
    fetchScript.onerror = (e) => {
      console.error('Hearth: Failed to load fetch interceptor', e);
    };
    (document.head || document.documentElement).appendChild(fetchScript);
  },

  injectConversationMonitor() {
    // First inject modelRouter so it's available for conversation monitor
    const routerScript = document.createElement('script');
    routerScript.src = chrome.runtime.getURL('utils/modelRouter.js');
    routerScript.onload = () => {
      console.log('Hearth: Model router loaded into page context');

      // Then inject the conversation monitor script into page context
      const monitorScript = document.createElement('script');
      monitorScript.src = chrome.runtime.getURL('content-script/conversationMonitor.js');
      monitorScript.onload = () => {
        console.log('Hearth: Conversation monitor loaded into page context');

        // Send initial settings to the monitor
        this.sendSettingsToMonitor();
      };
      monitorScript.onerror = (e) => {
        console.error('Hearth: Failed to load conversation monitor', e);
      };
      (document.head || document.documentElement).appendChild(monitorScript);
    };
    routerScript.onerror = (e) => {
      console.error('Hearth: Failed to load model router', e);
    };
    (document.head || document.documentElement).appendChild(routerScript);
  },

  sendSettingsToMonitor() {
    // Send API key and settings to conversation monitor in page context
    chrome.storage.local.get(['anthropicApiKey', 'liveExtractionEnabled'], (data) => {
      window.postMessage({
        type: 'HEARTH_MONITOR_SETTINGS',
        anthropicApiKey: data.anthropicApiKey || null,
        liveExtractionEnabled: data.liveExtractionEnabled || false
      }, '*');
      console.log('Hearth: Settings sent to conversation monitor');
    });
  },

  sendDataToInterceptor() {
    // Send raw data to fetch interceptor for semantic retrieval
    window.postMessage({
      type: 'HEARTH_DATA',
      opspec: this.opspec,
      memories: this.memories,
      openaiApiKey: this.openaiApiKey,
      patternEvidence: this.patternEvidence  // NEW
    }, '*');

    console.log('Hearth: Data sent to fetch interceptor -',
      'Memories:', this.memories?.length || 0,
      'Has API Key:', !!this.openaiApiKey,
      'Pattern Evidence:', Object.keys(this.patternEvidence || {}).length, 'patterns'  // NEW
    );
  },

  cleanup() {
    console.log('Hearth: Cleaned up');
  }
};

// Auto-initialize when script loads
if (typeof chrome !== 'undefined' && chrome.storage) {
  HearthInjector.init();
}
