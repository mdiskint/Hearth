// Supabase sync layer for Hearth memories

const SUPABASE_URL = 'https://wkfwtivvhwyjlkyrikeu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7lxIUGtOAArrrW2t5_mQFg_p24QQDKO';

class SupabaseSync {
  constructor() {
    this.baseUrl = `${SUPABASE_URL}/rest/v1`;
    this.headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  async pushMemory(memory) {
    try {
      // Only send fields that exist in Supabase schema (whitelist approach)
      const dbMemory = {
        id: memory.id,
        content: memory.content,
        type: memory.type || 'fact',
        domain: memory.domain || 'Self',
        emotion: memory.emotion || null,
        heat: memory.heat ?? 0.5,
        embedding: memory.embedding || null,
        created_at: memory.createdAt || memory.created_at || new Date().toISOString(),
        updated_at: memory.updatedAt || memory.updated_at || new Date().toISOString()
      };

      const response = await fetch(`${this.baseUrl}/memories`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(dbMemory)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to push memory: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error pushing memory:', error);
      throw error;
    }
  }

  async pushAllMemories() {
    const { memories } = await chrome.storage.local.get('memories');
    if (!memories || memories.length === 0) {
      console.log('No memories to push');
      return { success: 0, failed: 0 };
    }

    console.log(`Pushing ${memories.length} memories to Supabase...`);
    let success = 0;
    let failed = 0;

    for (const memory of memories) {
      try {
        await this.pushMemory(memory);
        success++;
        if (success % 10 === 0) {
          console.log(`Pushed ${success}/${memories.length} memories...`);
        }
      } catch (error) {
        console.error(`Failed to push memory ${memory.id}:`, error);
        failed++;
      }
    }

    console.log(`Push complete: ${success} succeeded, ${failed} failed`);
    return { success, failed };
  }

  async pullAllMemories() {
    try {
      const response = await fetch(`${this.baseUrl}/memories?select=*`, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Failed to pull memories: ${response.statusText}`);
      }

      const memories = await response.json();
      console.log(`Pulled ${memories.length} memories from Supabase`);
      return memories;
    } catch (error) {
      console.error('Error pulling memories:', error);
      throw error;
    }
  }

  async sync() {
    try {
      console.log('Starting sync...');

      const { memories: localMemories = [] } = await chrome.storage.local.get('memories');
      const remoteMemories = await this.pullAllMemories();

      const localMap = new Map(localMemories.map(m => [m.id, m]));
      const remoteMap = new Map(remoteMemories.map(m => [m.id, m]));

      const toUpdate = [];
      const toPush = [];

      for (const local of localMemories) {
        const remote = remoteMap.get(local.id);

        if (!remote) {
          toPush.push(local);
        } else {
          const localTime = new Date(local.updated_at).getTime();
          const remoteTime = new Date(remote.updated_at).getTime();

          if (localTime > remoteTime) {
            toPush.push(local);
          } else if (remoteTime > localTime) {
            toUpdate.push(remote);
          }
        }
      }

      for (const remote of remoteMemories) {
        if (!localMap.has(remote.id)) {
          toUpdate.push(remote);
        }
      }

      for (const memory of toPush) {
        await this.pushMemory(memory);
      }

      if (toUpdate.length > 0) {
        const mergedMemories = [...localMemories];
        for (const remote of toUpdate) {
          const index = mergedMemories.findIndex(m => m.id === remote.id);
          if (index >= 0) {
            mergedMemories[index] = remote;
          } else {
            mergedMemories.push(remote);
          }
        }
        await chrome.storage.local.set({ memories: mergedMemories });
      }

      console.log(`Sync complete: ${toPush.length} pushed, ${toUpdate.length} pulled`);
      return { pushed: toPush.length, pulled: toUpdate.length };

    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const supabaseSyncInstance = new SupabaseSync();

// Export for both content script (window) and service worker (self) contexts
// Use globalThis for compatibility across all contexts
globalThis.SupabaseSync = supabaseSyncInstance;
