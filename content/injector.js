// injector.js - OpSpec injection logic with V2 semantic retrieval

const HearthInjector = {
  platform: null,
  opspec: null,
  settings: null,
  memories: null,           // Full memory cache
  lastUserMessage: null,
  lastQueryHeat: 0,
  pendingMemories: [],
  liveExtractionEnabled: true,
  _flushTimer: null,
  openaiKey: null,
  forgeEnabled: false,
  forgePhase: null,
  forgeAutoDetect: true,

  async init() {
    this.platform = detectPlatform();

    if (!this.platform) {
      console.log('Hearth: Platform not supported');
      return;
    }

    console.log(`Hearth: Detected ${this.platform.name}`);

    // Load OpSpec, settings, and OpenAI key
    await this.loadData();

    // Start monitoring for input
    this.startMonitoring();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => this.cleanup());
  },

  async loadData() {
    try {
      const data = await chrome.storage.local.get(['opspec', 'settings', 'openaiKey', 'liveExtractionEnabled', 'forgeEnabled', 'forgePhase', 'forgeAutoDetect', 'hearth_memories']);
      this.opspec = data.opspec;
      this.settings = data.settings || { enabled: true };
      this.openaiKey = data.openaiKey || null;
      this.liveExtractionEnabled = data.liveExtractionEnabled || false;
      this.forgeEnabled = data.forgeEnabled || false;
      this.forgePhase = data.forgePhase || null;
      this.forgeAutoDetect = data.forgeAutoDetect !== false; // Default true

      // Load local memories for fallback injection
      this.localMemories = data.hearth_memories || [];

      // Set OpenAI key for embeddings
      if (this.openaiKey && window.HearthSupabase) {
        window.HearthSupabase.setOpenAIKey(this.openaiKey);
        console.log('Hearth: OpenAI key configured for embeddings');
      }

      // Load all memories (will be filtered at retrieval time)
      this.memories = window.HearthSupabase
        ? await window.HearthSupabase.fetchMemories()
        : [];

      console.log('Hearth: Loaded data -',
        'OpSpec:', !!this.opspec,
        'Memories:', this.memories.length,
        'Local memories:', this.localMemories.length,
        'OpenAI Key:', this.openaiKey ? 'set' : 'not set',
        'Forge:', this.forgeEnabled ? (this.forgeAutoDetect ? 'auto' : this.forgePhase) : 'off'
      );
    } catch (error) {
      console.error('Hearth: Error loading data:', error);
    }
  },

  startMonitoring() {
    // Inject the fetch interceptor and send data
    this.setupFetchInterceptor();

    // Listen for messages from page context (conversation monitor + fetch proxy)
    window.addEventListener('message', async (event) => {
      if (!event.data || !event.data.type) return;

      // Proxy fetch requests from page context (CSP bypass)
      // hearth-retrieval.js runs in page context and can't make cross-origin
      // requests due to the host page's CSP. We relay them here in the content
      // script, which bypasses page CSP.
      if (event.data.type === 'HEARTH_PROXY_FETCH') {
        const { id, url, options } = event.data;
        try {
          const res = await fetch(url, options);
          const body = await res.json();
          window.postMessage({
            type: 'HEARTH_PROXY_FETCH_RESPONSE',
            id,
            ok: res.ok,
            status: res.status,
            body,
          }, '*');
        } catch (err) {
          window.postMessage({
            type: 'HEARTH_PROXY_FETCH_RESPONSE',
            id,
            error: err.message,
          }, '*');
        }
        return;
      }

      // Handle setting changes
      if (event.data.type === 'HEARTH_MONITOR_SETTING_CHANGE') {
        this.liveExtractionEnabled = event.data.liveExtractionEnabled;
        chrome.storage.local.set({
          liveExtractionEnabled: event.data.liveExtractionEnabled
        });
        console.log('Hearth: Persisted live extraction setting:', event.data.liveExtractionEnabled);
      }

      // Capture user messages for retrieval
      if (event.data.type === 'HEARTH_CONVERSATION_MESSAGE' && event.data.role === 'user') {
        this.lastUserMessage = event.data.content;

        // Calculate query heat (still used by other subsystems)
        if (window.detectQueryHeat) {
          this.lastQueryHeat = window.detectQueryHeat(event.data.content);
          console.log('Hearth: Query heat:', this.lastQueryHeat);
        }

        // Trigger data send to fetch interceptor
        await this.sendDataToInterceptor();
      }

      // Extract AI memories from assistant responses
      if (event.data.type === 'HEARTH_CONVERSATION_MESSAGE' && event.data.role === 'assistant') {
        if (this.liveExtractionEnabled && window.HearthAIMemoryExtractor) {
          try {
            const aiMemory = window.HearthAIMemoryExtractor.processAssistantResponse(
              event.data.content,
              { userMessage: this.lastUserMessage }
            );
            if (aiMemory) {
              this.pendingMemories.push(aiMemory);
              console.log('Hearth: Extracted AI memory:', aiMemory.type, '- pending:', this.pendingMemories.length);
              this.debouncedFlush();
            }
          } catch (e) {
            console.warn('Hearth: AI memory extraction failed:', e);
          }
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
        if (changes.openaiKey) {
          this.openaiKey = changes.openaiKey.newValue;
          dataChanged = true;
          if (this.openaiKey && window.HearthSupabase) {
            window.HearthSupabase.setOpenAIKey(this.openaiKey);
          }
        }
        if (changes.liveExtractionEnabled) {
          this.liveExtractionEnabled = changes.liveExtractionEnabled.newValue;
          console.log('Hearth: Live extraction setting changed:', this.liveExtractionEnabled);
        }
        if (changes.forgeEnabled) {
          this.forgeEnabled = changes.forgeEnabled.newValue;
          dataChanged = true;
          console.log('Hearth: Forge enabled changed:', this.forgeEnabled);
        }
        if (changes.forgePhase) {
          this.forgePhase = changes.forgePhase.newValue;
          dataChanged = true;
          console.log('Hearth: Forge phase changed:', this.forgePhase);
        }
        if (changes.forgeAutoDetect) {
          this.forgeAutoDetect = changes.forgeAutoDetect.newValue;
          dataChanged = true;
          console.log('Hearth: Forge auto-detect changed:', this.forgeAutoDetect);
        }

        if (dataChanged) {
          this.sendDataToInterceptor();
        }
      }
    });
  },

  debouncedFlush() {
    if (this._flushTimer) clearTimeout(this._flushTimer);
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this.flushPendingMemories();
    }, 5000);
  },

  async flushPendingMemories() {
    if (this.pendingMemories.length === 0) {
      return;
    }

    if (!window.HearthSupabase?.writeMemory) {
      console.warn('Hearth: HearthSupabase.writeMemory not available, cannot flush');
      return;
    }

    // Grab batch and clear immediately to prevent double-flush
    const batch = this.pendingMemories;
    this.pendingMemories = [];
    console.log(`Hearth: Flushing ${batch.length} pending memories`);

    for (const candidate of batch) {
      try {
        // Strip metadata (not a DB column) and map field names to match Supabase schema
        const { metadata, ...memoryData } = candidate;
        memoryData.domain = memoryData.life_domain ? memoryData.life_domain.charAt(0).toUpperCase() + memoryData.life_domain.slice(1) : null;
        memoryData.emotion = memoryData.emotional_state ? memoryData.emotional_state.charAt(0).toUpperCase() + memoryData.emotional_state.slice(1) : null;

        const result = await window.HearthSupabase.writeMemory(memoryData);
        if (result) {
          this.memories.push(result);
          console.log('Hearth: Wrote memory:', memoryData.type, result.id);
        } else {
          console.warn('Hearth: writeMemory returned null for:', memoryData.type);
        }
      } catch (e) {
        console.error('Hearth: writeMemory failed for:', candidate.type, e);
      }
    }
  },

  setupFetchInterceptor() {
    if (!this.settings?.enabled) {
      console.log('Hearth: Disabled, skipping fetch interceptor');
      return;
    }

    if (!this.opspec) {
      console.log('Hearth: No OpSpec loaded, skipping fetch interceptor');
      return;
    }

    // Inject heatDetector first
    const heatScript = document.createElement('script');
    heatScript.src = chrome.runtime.getURL('utils/heatDetector.js');
    heatScript.onload = () => {
      console.log('Hearth: Heat detector loaded');
    };
    (document.head || document.documentElement).appendChild(heatScript);

    // Inject OpSpec modules
    const modulesScript = document.createElement('script');
    modulesScript.src = chrome.runtime.getURL('opspec-modules.js');
    modulesScript.onload = () => {
      console.log('Hearth: OpSpec modules loaded');

      // Inject Scout V2 modules
      this.injectExtraModules().then(() => {
        // Finally inject the fetch interceptor
        const fetchScript = document.createElement('script');
        fetchScript.src = chrome.runtime.getURL('content/fetch-interceptor.js');
        fetchScript.onload = () => {
          console.log('Hearth: Fetch interceptor loaded');
          this.sendDataToInterceptor();
        };
        fetchScript.onerror = (e) => {
          console.error('Hearth: Failed to load fetch interceptor', e);
        };
        (document.head || document.documentElement).appendChild(fetchScript);
      });
    };
    modulesScript.onerror = (e) => {
      console.error('Hearth: Failed to load OpSpec modules', e);
    };
    (document.head || document.documentElement).appendChild(modulesScript);
  },

  async injectExtraModules() {
    const modules = [
      'utils/affectDetector.js',
      'utils/forgeDetector.js',
      'utils/durabilityClassifier.js',
      'utils/scout/goalExtractor.js',
      'utils/scout/memoryFilter.js',
      'utils/scout/scoutAnalyzerV2.js',
      'utils/memoryExtractor.js',
      'utils/aiMemoryExtractor.js',
      'src/retrieval/hearth-retrieval.js'
    ];

    for (const modulePath of modules) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = chrome.runtime.getURL(modulePath);
          script.onload = () => {
            console.log(`Hearth: Loaded ${modulePath}`);
            resolve();
          };
          script.onerror = () => {
            console.warn(`Hearth: Failed to load module ${modulePath}, skipping`);
            // Resolve anyway to continue loading other modules
            resolve();
          };
          (document.head || document.documentElement).appendChild(script);
        });
      } catch (e) {
        console.warn(`Hearth: Error injecting ${modulePath}`, e);
      }
    }

    // Debug: Confirm key detectors loaded in page context
    // Inject a tiny script to log from page context
    setTimeout(() => {
      const checkScript = document.createElement('script');
      checkScript.textContent = `
        console.log('Hearth: Page context check -',
          'HearthForgeDetector:', typeof window.HearthForgeDetector !== 'undefined' ? 'loaded' : 'MISSING',
          'HearthAffectDetector:', typeof window.HearthAffectDetector !== 'undefined' ? 'loaded' : 'MISSING'
        );
      `;
      document.head.appendChild(checkScript);
      checkScript.remove();
    }, 100);
  },

  async sendDataToInterceptor() {
    console.log('Hearth: sendDataToInterceptor',
      'opspec:', !!this.opspec,
      'openaiKey:', !!this.openaiKey,
      'queryHeat:', this.lastQueryHeat,
      'forge:', this.forgeEnabled ? (this.forgeAutoDetect ? 'auto' : this.forgePhase) : 'off'
    );
    // Send data to fetch interceptor (affect + retrieval handled in page context)
    window.postMessage({
      type: 'HEARTH_DATA',
      opspec: this.opspec,
      queryHeat: this.lastQueryHeat,
      openaiKey: this.openaiKey,
      forgeEnabled: this.forgeEnabled,
      forgePhase: this.forgePhase,
      forgeAutoDetect: this.forgeAutoDetect
    }, '*');
  },

  cleanup() {
    this.flushPendingMemories();
    console.log('Hearth: Cleaned up');
  }
};

// Auto-initialize when script loads
if (typeof chrome !== 'undefined' && chrome.storage) {
  HearthInjector.init();
}

// Listen for messages from popup
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'HEARTH_FLUSH_MEMORIES') {
      HearthInjector.flushPendingMemories().then(() => {
        sendResponse({ success: true, flushed: HearthInjector.pendingMemories.length === 0 });
      });
      return true;
    }

    if (message.type === 'HEARTH_BACKFILL_EMBEDDINGS') {
      if (window.HearthSupabase?.backfillEmbeddings) {
        window.HearthSupabase.backfillEmbeddings(50).then(count => {
          sendResponse({ success: true, updated: count });
        });
      } else {
        sendResponse({ success: false, error: 'Supabase not available' });
      }
      return true;
    }

    if (message.type === 'HEARTH_GET_DIMENSIONAL_COVERAGE') {
      if (window.HearthSupabase?.getDimensionalCoverage) {
        window.HearthSupabase.getDimensionalCoverage().then(data => {
          sendResponse({ success: true, ...data });
        });
      } else {
        sendResponse({ success: false, error: 'Supabase not available' });
      }
      return true;
    }
  });
}
