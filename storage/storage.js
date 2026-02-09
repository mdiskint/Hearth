// storage.js - LocalStorage wrapper for Hearth data with Supabase sync

// Memory classes: fact = what you know, pattern = what you've learned
const MEMORY_CLASSES = ['fact', 'pattern'];

// Memory types (Supabase schema)
const MEMORY_TYPES = ['fact', 'value', 'partner_model', 'reward', 'synthesis', 'self_model'];

// Memory domains
const MEMORY_DOMAINS = ['Work', 'Relationships', 'Creative', 'Self', 'Decisions', 'Resources', 'Values'];

// Validation states
const VALIDATION_STATES = ['validated', 'untested', 'invalidated'];

// Memory sources (local tracking)
const MEMORY_SOURCES = ['extraction', 'manual'];

// Storage key for memories
const MEMORIES_KEY = 'hearth_memories';

/**
 * Invalidate the surprise cache when memories change.
 * Sends postMessage to page context where the cache lives.
 */
function invalidateSurpriseCache() {
  if (typeof window !== 'undefined') {
    window.postMessage({ type: 'HEARTH_INVALIDATE_SURPRISE_CACHE' }, '*');
  }
}

// Supabase config - use from supabase-client.js if available, otherwise define here
const HEARTH_SUPABASE_URL = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : 'https://wkfwtivvhwyjlkyrikeu.supabase.co';
const HEARTH_SUPABASE_ANON_KEY = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : 'sb_publishable_7lxIUGtOAArrrW2t5_mQFg_p24QQDKO';

const HearthStorage = {

  // Initialize default data structure
  async init() {
    const data = await this.getAll();
    if (!data.initialized) {
      await chrome.storage.local.set({
        initialized: true,
        quizCompleted: false,
        quizAnswers: {},
        opspec: this.getDefaultOpSpec(),
        [MEMORIES_KEY]: [],
        settings: {
          enabled: true
        }
      });
    }
  },

  // Get all stored data
  async getAll() {
    return await chrome.storage.local.get(null);
  },

  // Quiz answers
  async saveQuizAnswers(answers) {
    await chrome.storage.local.set({
      quizAnswers: answers,
      quizCompleted: true
    });
  },

  async getQuizAnswers() {
    const data = await chrome.storage.local.get('quizAnswers');
    return data.quizAnswers || {};
  },

  // OpSpec
  async saveOpSpec(opspec) {
    await chrome.storage.local.set({ opspec });
  },

  async getOpSpec() {
    const data = await chrome.storage.local.get('opspec');
    return data.opspec || this.getDefaultOpSpec();
  },

  // Quiz completion status
  async isQuizCompleted() {
    const data = await chrome.storage.local.get('quizCompleted');
    return data.quizCompleted || false;
  },

  // Settings
  async getSettings() {
    const data = await chrome.storage.local.get('settings');
    return data.settings || { enabled: true };
  },

  async updateSettings(settings) {
    const current = await this.getSettings();
    await chrome.storage.local.set({
      settings: { ...current, ...settings }
    });
  },

  // ============== Memory CRUD (local-first with Supabase sync) ==============
  // Local storage format mirrors Supabase schema for clean sync

  // Get all memories (always from local - fast, no network)
  async getMemories() {
    const data = await chrome.storage.local.get(MEMORIES_KEY);
    return data[MEMORIES_KEY] || [];
  },

  // Save a new memory (local first, then sync to Supabase if authenticated)
  // Memory format matches Supabase schema:
  // { id, content, memory_class, type, domain, heat, validation, source, created_at, updated_at }
  async saveMemory(memory) {
    const memories = await this.getMemories();

    // Check for duplicate (exact content match)
    const isDuplicate = memories.some(m => m.content === memory.content);
    if (isDuplicate) {
      console.log('Hearth: Duplicate memory skipped:', memory.content.substring(0, 50));
      return null;
    }

    const now = new Date().toISOString();
    const newMemory = {
      id: crypto.randomUUID(),
      content: memory.content,
      memory_class: memory.memory_class || memory.type || 'fact',
      type: memory.type || 'fact',
      domain: memory.domain || null,
      heat: memory.heat ?? 0.5,
      validation: memory.validation || 'untested',
      source: memory.source || 'manual',
      created_at: now,
      updated_at: now
    };

    // Write to local first
    memories.push(newMemory);
    await chrome.storage.local.set({ [MEMORIES_KEY]: memories });
    console.log('Hearth: Memory saved locally:', newMemory.id);

    // Sync to Supabase if authenticated (fire and forget)
    this._syncMemoryToSupabase(newMemory);

    // Invalidate surprise cache since memory pool changed
    invalidateSurpriseCache();

    return newMemory;
  },

  // Update an existing memory
  async updateMemory(id, updates) {
    const memories = await this.getMemories();
    const index = memories.findIndex(m => m.id === id);
    if (index === -1) return null;

    // Update timestamp
    updates.updated_at = new Date().toISOString();
    memories[index] = { ...memories[index], ...updates };
    await chrome.storage.local.set({ [MEMORIES_KEY]: memories });

    // Sync to Supabase if authenticated
    this._syncMemoryToSupabase(memories[index]);

    // Invalidate surprise cache since memory content may have changed
    invalidateSurpriseCache();

    return memories[index];
  },

  // Delete a memory by id (local first, then Supabase)
  async deleteMemory(id) {
    const memories = await this.getMemories();
    const filtered = memories.filter(m => m.id !== id);
    if (filtered.length === memories.length) return false;

    // Delete from local first
    await chrome.storage.local.set({ [MEMORIES_KEY]: filtered });
    console.log('Hearth: Memory deleted locally:', id);

    // Delete from Supabase if authenticated
    this._deleteMemoryFromSupabase(id);

    // Invalidate surprise cache since memory pool changed
    invalidateSurpriseCache();

    return true;
  },

  // Update heat for a memory (replaces updateMemoryUsage)
  async updateMemoryHeat(id, heat) {
    return this.updateMemory(id, { heat: Math.max(0, Math.min(1, heat)) });
  },

  // Boost heat when memory is used
  async boostMemoryHeat(id, boost = 0.1) {
    const memories = await this.getMemories();
    const memory = memories.find(m => m.id === id);
    if (!memory) return null;

    const newHeat = Math.min(1, (memory.heat || 0.5) + boost);
    return this.updateMemory(id, { heat: newHeat });
  },

  // Get memories formatted for injection (max 10, sorted by heat descending)
  async getMemoriesForInjection() {
    const memories = await this.getMemories();
    if (memories.length === 0) return '';

    // Sort by heat descending (hottest first) and take top 10
    const sorted = [...memories].sort((a, b) =>
      (b.heat || 0) - (a.heat || 0)
    ).slice(0, 10);

    // Split into facts and patterns by memory_class
    const facts = sorted.filter(m => m.memory_class === 'fact');
    const patterns = sorted.filter(m => m.memory_class === 'pattern');

    let output = '[MEMORIES]\n';

    if (facts.length > 0) {
      output += '\nWhat you know about them:\n';
      facts.forEach(m => {
        output += `- ${m.content}\n`;
      });
    }

    if (patterns.length > 0) {
      output += '\nWhat you\'ve learned:\n';
      patterns.forEach(m => {
        output += `- ${m.content}\n`;
      });
    }

    output += '\n[END MEMORIES]';
    return output;
  },

  // ============== Supabase Sync Methods ==============

  // Check if authenticated (uses HearthAuth from supabase-client.js)
  async _isAuthenticated() {
    if (typeof HearthAuth === 'undefined') return false;
    return await HearthAuth.isAuthenticated();
  },

  // Get auth headers for Supabase API calls
  async _getAuthHeaders() {
    if (typeof HearthAuth === 'undefined') {
      return {
        'apikey': HEARTH_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      };
    }
    const headers = await HearthAuth.getAuthHeaders();
    return { ...headers, 'Content-Type': 'application/json' };
  },

  // Get current user ID
  async _getUserId() {
    if (typeof HearthAuth === 'undefined') return null;
    const user = await HearthAuth.getUser();
    return user?.id || null;
  },

  // Sync a single memory to Supabase (upsert)
  async _syncMemoryToSupabase(memory) {
    if (!await this._isAuthenticated()) return;

    try {
      const userId = await this._getUserId();
      if (!userId) return;

      const headers = await this._getAuthHeaders();
      headers['Prefer'] = 'resolution=merge-duplicates';

      const response = await fetch(`${HEARTH_SUPABASE_URL}/rest/v1/memories`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: memory.id,
          user_id: userId,
          content: memory.content,
          memory_class: memory.memory_class,
          type: memory.type,
          domain: memory.domain,
          heat: memory.heat,
          validation: memory.validation,
          created_at: memory.created_at,
          updated_at: memory.updated_at
        })
      });

      if (response.ok) {
        console.log('Hearth: Memory synced to Supabase:', memory.id);
      } else {
        const error = await response.text();
        console.warn('Hearth: Supabase sync failed:', error);
      }
    } catch (error) {
      // Silent fail - local storage is source of truth
      console.warn('Hearth: Supabase sync error:', error.message);
    }
  },

  // Delete a memory from Supabase
  async _deleteMemoryFromSupabase(id) {
    if (!await this._isAuthenticated()) return;

    try {
      const headers = await this._getAuthHeaders();

      const response = await fetch(`${HEARTH_SUPABASE_URL}/rest/v1/memories?id=eq.${id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        console.log('Hearth: Memory deleted from Supabase:', id);
      }
    } catch (error) {
      // Silent fail
      console.warn('Hearth: Supabase delete error:', error.message);
    }
  },

  // Sync memories from Supabase and merge with local (newer wins by updated_at)
  // Called on sign-in and periodically
  async syncMemories() {
    if (!await this._isAuthenticated()) {
      console.log('Hearth: Not authenticated, skipping sync');
      return { synced: 0, source: 'local' };
    }

    try {
      const headers = await this._getAuthHeaders();

      // RLS automatically filters to user's own memories
      const response = await fetch(
        `${HEARTH_SUPABASE_URL}/rest/v1/memories?select=*`,
        { method: 'GET', headers }
      );

      if (!response.ok) {
        console.warn('Hearth: Failed to fetch memories from Supabase');
        return { synced: 0, source: 'local' };
      }

      const remoteMemories = await response.json();
      const localMemories = await this.getMemories();

      // Create lookup maps
      const localById = new Map(localMemories.map(m => [m.id, m]));
      const remoteById = new Map(remoteMemories.map(m => [m.id, m]));

      const merged = [];
      const allIds = new Set([...localById.keys(), ...remoteById.keys()]);

      for (const id of allIds) {
        const local = localById.get(id);
        const remote = remoteById.get(id);

        if (local && remote) {
          // Both exist - newer wins by updated_at
          const localTime = new Date(local.updated_at || local.created_at).getTime();
          const remoteTime = new Date(remote.updated_at || remote.created_at).getTime();

          if (remoteTime > localTime) {
            // Remote is newer
            merged.push(this._mapRemoteToLocal(remote));
          } else {
            // Local is newer or same
            merged.push(local);
          }
        } else if (local) {
          // Only in local
          merged.push(local);
        } else if (remote) {
          // Only in remote
          merged.push(this._mapRemoteToLocal(remote));
        }
      }

      // Save merged memories to local
      await chrome.storage.local.set({ [MEMORIES_KEY]: merged });
      console.log('Hearth: Synced memories -',
        'local:', localMemories.length,
        'remote:', remoteMemories.length,
        'merged:', merged.length
      );

      return { synced: merged.length, source: 'merged' };
    } catch (error) {
      console.error('Hearth: Sync error:', error);
      return { synced: 0, source: 'local', error: error.message };
    }
  },

  // Push all local memories to Supabase (called after extraction)
  async pushMemories() {
    if (!await this._isAuthenticated()) {
      console.log('Hearth: Not authenticated, skipping push');
      return { pushed: 0 };
    }

    try {
      const memories = await this.getMemories();
      if (memories.length === 0) return { pushed: 0 };

      const userId = await this._getUserId();
      if (!userId) return { pushed: 0 };

      const headers = await this._getAuthHeaders();
      headers['Prefer'] = 'resolution=merge-duplicates';

      // Prepare batch for upsert - map to Supabase schema
      const batch = memories.map(m => ({
        id: m.id,
        user_id: userId,
        content: m.content,
        memory_class: m.memory_class,
        type: m.type,
        domain: m.domain,
        heat: m.heat,
        validation: m.validation,
        created_at: m.created_at,
        updated_at: m.updated_at
      }));

      const response = await fetch(`${HEARTH_SUPABASE_URL}/rest/v1/memories`, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch)
      });

      if (response.ok) {
        console.log('Hearth: Pushed', batch.length, 'memories to Supabase');
        return { pushed: batch.length };
      } else {
        const error = await response.text();
        console.warn('Hearth: Push failed:', error);
        return { pushed: 0, error };
      }
    } catch (error) {
      console.error('Hearth: Push error:', error);
      return { pushed: 0, error: error.message };
    }
  },

  // Map Supabase row to local memory format (same schema, just ensure all fields)
  _mapRemoteToLocal(remote) {
    return {
      id: remote.id,
      content: remote.content,
      memory_class: remote.memory_class,
      type: remote.type,
      domain: remote.domain,
      heat: remote.heat ?? 0.5,
      validation: remote.validation || 'untested',
      source: remote.source || 'extraction',
      created_at: remote.created_at,
      updated_at: remote.updated_at
    };
  },

  // ============== Default OpSpec ==============

  getDefaultOpSpec() {
    return {
      cognitiveArchitecture: `Use the routed OpSpec modules above as primary guidance. If no modules apply, respond with clear, concrete help.`,
      identity: `You are a practical collaborator focused on useful, high-signal answers.`,
      communication: `Direct, concise, and specific. Avoid fluff.`,
      execution: `When choices exist, present 2-3 options and recommend one. When clear, execute.`,
      constraints: [
        "Be direct and concrete",
        "Do not fabricate",
        "State uncertainty explicitly"
      ],
      balanceProtocol: `Optimize for clarity and usefulness. Prefer action over speculation.`,
      opspecAppendix: `{}`
    };
  },

  // Clear all data (for testing/reset)
  async clearAll() {
    await chrome.storage.local.clear();
    await this.init();
  },

  // Get memory classes for UI
  getMemoryClasses() {
    return MEMORY_CLASSES;
  },

  // Get memory types for UI
  getMemoryTypes() {
    return MEMORY_TYPES;
  },

  // Get memory domains for UI
  getMemoryDomains() {
    return MEMORY_DOMAINS;
  },

  // Get validation states for UI
  getValidationStates() {
    return VALIDATION_STATES;
  },

  // Get memory sources for UI
  getMemorySources() {
    return MEMORY_SOURCES;
  },

  // Get memories filtered by memory_class
  async getMemoriesByClass(memoryClass) {
    const memories = await this.getMemories();
    return memories.filter(m => m.memory_class === memoryClass);
  },

  // Get memories filtered by type
  async getMemoriesByType(type) {
    const memories = await this.getMemories();
    return memories.filter(m => m.type === type);
  },

  // Get memories filtered by domain
  async getMemoriesByDomain(domain) {
    const memories = await this.getMemories();
    return memories.filter(m => m.domain === domain);
  },

  // Get memories filtered by source
  async getMemoriesBySource(source) {
    const memories = await this.getMemories();
    return memories.filter(m => m.source === source);
  },

  // Get hot memories (heat > threshold)
  async getHotMemories(threshold = 0.7) {
    const memories = await this.getMemories();
    return memories.filter(m => (m.heat || 0) >= threshold);
  },

  // Clear all memories (for testing/reset)
  async clearMemories() {
    await chrome.storage.local.set({ [MEMORIES_KEY]: [] });
    console.log('Hearth: All memories cleared');
  }
};

// Auto-initialize on load
if (typeof chrome !== 'undefined' && chrome.storage) {
  HearthStorage.init();
}
