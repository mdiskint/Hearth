/**
 * Supabase Auth Client for Hearth
 * Handles email/password authentication
 * Auth is optional - extension works fully without it
 */

const SUPABASE_URL = 'https://wkfwtivvhwyjlkyrikeu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7lxIUGtOAArrrW2t5_mQFg_p24QQDKO';

const HearthAuth = {
  /**
   * Sign in with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{user: Object|null, error: string|null}>}
   */
  async signIn(email, password) {
    console.log('Hearth: Attempting sign in for', email);
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('Hearth: Auth response status', response.status);

      const data = await response.json();
      console.log('Hearth: Auth response data', data.error || 'success');

      if (!response.ok) {
        return { user: null, error: data.error_description || data.msg || data.error || 'Sign in failed' };
      }

      // Store session
      await this._saveSession(data);
      console.log('Hearth: Signed in as', data.user?.email);

      return { user: data.user, error: null };
    } catch (error) {
      console.error('Hearth: Sign in error', error);
      if (error.name === 'AbortError') {
        return { user: null, error: 'Request timed out. Check your internet connection.' };
      }
      return { user: null, error: error.message };
    }
  },

  /**
   * Sign up with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{user: Object|null, error: string|null}>}
   */
  async signUp(email, password) {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        return { user: null, error: data.error_description || data.msg || 'Sign up failed' };
      }

      // If email confirmation is required, user won't have a session yet
      if (data.access_token) {
        await this._saveSession(data);
      }

      console.log('Hearth: Signed up', data.user?.email);
      return { user: data.user, error: null, needsConfirmation: !data.access_token };
    } catch (error) {
      console.error('Hearth: Sign up error', error);
      return { user: null, error: error.message };
    }
  },

  /**
   * Sign out current user
   * @returns {Promise<{error: string|null}>}
   */
  async signOut() {
    try {
      const session = await this.getSession();

      if (session?.access_token) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`
          }
        });
      }

      // Clear stored session
      await chrome.storage.local.remove(['supabaseSession', 'supabaseUser']);
      console.log('Hearth: Signed out');

      // Notify listeners
      this._notifyAuthChange(null);

      return { error: null };
    } catch (error) {
      console.error('Hearth: Sign out error', error);
      return { error: error.message };
    }
  },

  /**
   * Get current session if valid
   * @returns {Promise<Object|null>}
   */
  async getSession() {
    try {
      const data = await chrome.storage.local.get(['supabaseSession']);
      const session = data.supabaseSession;

      if (!session) return null;

      // Check if token is expired
      const expiresAt = session.expires_at * 1000; // Convert to ms
      if (Date.now() >= expiresAt - 60000) { // Refresh if < 1 min left
        return await this._refreshSession(session.refresh_token);
      }

      return session;
    } catch (error) {
      console.error('Hearth: Get session error', error);
      return null;
    }
  },

  /**
   * Get current user
   * @returns {Promise<Object|null>}
   */
  async getUser() {
    try {
      const data = await chrome.storage.local.get(['supabaseUser']);
      return data.supabaseUser || null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    const session = await this.getSession();
    return session !== null;
  },

  /**
   * Refresh the session using refresh token
   * @private
   */
  async _refreshSession(refreshToken) {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) {
        // Refresh failed, clear session
        await chrome.storage.local.remove(['supabaseSession', 'supabaseUser']);
        this._notifyAuthChange(null);
        return null;
      }

      const data = await response.json();
      await this._saveSession(data);
      return data;
    } catch (error) {
      console.error('Hearth: Refresh session error', error);
      return null;
    }
  },

  /**
   * Save session to storage
   * @private
   */
  async _saveSession(data) {
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || (Math.floor(Date.now() / 1000) + data.expires_in)
    };

    await chrome.storage.local.set({
      supabaseSession: session,
      supabaseUser: data.user
    });

    // Notify listeners
    this._notifyAuthChange(data.user);
  },

  /**
   * Auth state change listeners
   * @private
   */
  _authListeners: [],

  /**
   * Subscribe to auth state changes
   * @param {Function} callback - Called with (user) on auth change
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChange(callback) {
    this._authListeners.push(callback);

    // Call immediately with current state
    this.getUser().then(user => callback(user));

    return () => {
      const index = this._authListeners.indexOf(callback);
      if (index > -1) {
        this._authListeners.splice(index, 1);
      }
    };
  },

  /**
   * Notify all auth listeners
   * @private
   */
  _notifyAuthChange(user) {
    for (const listener of this._authListeners) {
      try {
        listener(user);
      } catch (e) {
        console.error('Hearth: Auth listener error', e);
      }
    }
  },

  /**
   * Get auth headers for API calls
   * @returns {Promise<Object>}
   */
  async getAuthHeaders() {
    const session = await this.getSession();
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': session ? `Bearer ${session.access_token}` : `Bearer ${SUPABASE_ANON_KEY}`
    };
  }
};

// Export for browser
if (typeof window !== 'undefined') {
  window.HearthAuth = HearthAuth;
}
