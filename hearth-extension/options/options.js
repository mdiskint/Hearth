import { supabase } from '../lib/supabase-bundle.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    renderAuth(user);

    if (user) {
        showSettings(true);
        loadSettings(user);
    } else {
        showSettings(false);
    }
});

function showSettings(visible) {
    const display = visible ? 'block' : 'none';
    document.getElementById('api-key-section').style.display = display;
    document.getElementById('main-settings').style.display = display;
    document.getElementById('memories-section').style.display = display;
    document.getElementById('baseline-section').style.display = display;
    document.getElementById('heat-section').style.display = display;
}

function renderAuth(user) {
    const container = document.getElementById('auth-section');
    if (user) {
        container.innerHTML = `
      <div style="background: #262626; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
        <h2 style="margin-top: 0;">Account</h2>
        <p class="description">Signed in as ${user.email}</p>
        <button id="sign-out">Sign Out</button>
      </div>
    `;
        document.getElementById('sign-out').addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.reload();
        });
    } else {
        container.innerHTML = `
      <div style="background: #262626; padding: 20px; border-radius: 12px; margin-bottom: 24px; max-width: 400px; margin-left: auto; margin-right: auto;">
        <h2 style="margin-top: 0;">Sign In</h2>
        <p class="description">Sign in to sync your memories and preferences.</p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <input type="email" id="email" placeholder="Email" style="padding: 10px; border-radius: 6px; border: 1px solid #333; background: #1a1a1a; color: #fff; outline: none;">
          <input type="password" id="password" placeholder="Password" style="padding: 10px; border-radius: 6px; border: 1px solid #333; background: #1a1a1a; color: #fff; outline: none;">
          <div style="display: flex; gap: 8px;">
            <button id="sign-in" class="primary" style="flex: 1;">Sign In</button>
            <button id="sign-up" style="flex: 1;">Sign Up</button>
          </div>
          <div id="auth-message" style="font-size: 13px; color: #888; min-height: 20px;"></div>
        </div>
      </div>
    `;

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const msg = document.getElementById('auth-message');

        document.getElementById('sign-in').addEventListener('click', async () => {
            msg.textContent = 'Signing in...';
            const { error } = await supabase.auth.signInWithPassword({
                email: emailInput.value,
                password: passwordInput.value
            });
            if (error) msg.textContent = error.message;
            else window.location.reload();
        });

        document.getElementById('sign-up').addEventListener('click', async () => {
            msg.textContent = 'Signing up...';
            const { error } = await supabase.auth.signUp({
                email: emailInput.value,
                password: passwordInput.value
            });
            if (error) msg.textContent = error.message;
            else msg.textContent = 'Check your email to confirm sign up!';
        });
    }
}

async function loadSettings(user) {
    // Load state from Supabase
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    // API Key
    const { apiKey } = await chrome.storage.local.get('apiKey');
    const apiKeyInput = document.getElementById('api-key-input');
    const apiKeyStatus = document.getElementById('api-key-status');

    if (apiKey) {
        apiKeyInput.value = apiKey;
        apiKeyStatus.textContent = '✅ API key set (for memory extraction)';
        apiKeyStatus.style.color = '#22c55e';
    }

    document.getElementById('save-api-key').addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            await chrome.storage.local.set({ apiKey: key });
            apiKeyStatus.textContent = '✅ API key saved';
            apiKeyStatus.style.color = '#22c55e';
        } else {
            await chrome.storage.local.remove('apiKey');
            apiKeyStatus.textContent = 'API key removed';
            apiKeyStatus.style.color = '#888';
        }
    });

    // EOS
    const eosInput = document.getElementById('eos-input');
    if (profile?.eos) eosInput.value = profile.eos;

    document.getElementById('save-eos').addEventListener('click', async () => {
        await supabase.from('profiles').update({ eos: eosInput.value, updated_at: new Date() }).eq('id', user.id);
        chrome.storage.local.set({ eos: eosInput.value });
        alert('EOS saved!');
    });

    // Memories
    const { data: memories } = await supabase.from('memories').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    renderMemories(memories || []);

    document.getElementById('clear-memories').addEventListener('click', async () => {
        if (confirm('Are you sure? This deletes ALL memories from cloud.')) {
            await supabase.from('memories').delete().eq('user_id', user.id);
            renderMemories([]);
            chrome.storage.local.set({ memories: [] });
        }
    });

    // Heat Map
    renderHeatMap(profile?.heat_map);

    document.getElementById('reset-heat').addEventListener('click', async () => {
        if (confirm('Reset heat map?')) {
            await supabase.from('profiles').update({ heat_map: null }).eq('id', user.id);
            renderHeatMap(null);
            chrome.storage.local.set({ heatMap: null });
        }
    });

    // Import Baseline (JSON)
    document.getElementById('import-baseline').addEventListener('click', async () => {
        const text = document.getElementById('baseline-input').value;
        const status = document.getElementById('import-status');
        if (!text) return;

        try {
            status.textContent = 'Parsing...';
            let memories = [];

            // Try parsing JSON first
            try {
                const json = JSON.parse(text);
                if (json.memories && Array.isArray(json.memories)) {
                    memories = json.memories;
                } else if (Array.isArray(json)) {
                    memories = json;
                }
            } catch (e) {
                // Fallback to text parsing if JSON fails
                console.log('JSON parse failed, trying text format');
                const memoryBlocks = text.split(/MEMORY:\s*/i).slice(1);
                memoryBlocks.forEach(block => {
                    if (block.includes('BASELINE HEAT MAP:')) block = block.split('BASELINE HEAT MAP:')[0];
                    const contentMatch = block.match(/^(.+?)(?=\n(?:DOMAINS|EMOTIONS|INTENSITY):)/s);
                    if (contentMatch) {
                        memories.push({
                            content: contentMatch[1].trim(),
                            domains: [], emotions: [], intensity: 0.5
                        });
                    }
                });
            }

            if (memories.length > 0) {
                status.textContent = `Importing ${memories.length} memories...`;
                let count = 0;

                for (const mem of memories) {
                    await supabase.from('memories').insert({
                        user_id: user.id,
                        content: mem.content,
                        domains: mem.domains || [],
                        emotions: mem.emotions || [],
                        intensity: mem.intensity || 0.5,
                        source: 'import_json'
                    });
                    count++;
                    status.textContent = `Importing ${count}/${memories.length}...`;
                }

                status.textContent = `✅ Successfully imported ${count} memories!`;
                setTimeout(() => window.location.reload(), 1500);
            } else {
                status.textContent = '❌ No memories found in input.';
            }
        } catch (err) {
            console.error(err);
            status.textContent = '❌ Error: ' + err.message;
        }
    });

    // Enrich Memories
    document.getElementById('enrich-memories').addEventListener('click', async () => {
        const status = document.getElementById('import-status');
        const { apiKey } = await chrome.storage.local.get('apiKey');

        if (!apiKey) {
            alert('Please set your Anthropic API Key first!');
            return;
        }

        if (!confirm('This will scan all your memories and use Claude to add missing metadata (domains, emotions). Continue?')) return;

        status.textContent = 'Fetching memories...';

        const { data: memories } = await supabase
            .from('memories')
            .select('*')
            .eq('user_id', user.id);

        const toEnrich = memories.filter(m =>
            !m.domains || m.domains.length === 0 ||
            !m.emotions || m.emotions.length === 0
        );

        if (toEnrich.length === 0) {
            status.textContent = '✅ All memories are already enriched!';
            return;
        }

        status.textContent = `Found ${toEnrich.length} memories to enrich...`;
        let count = 0;
        for (const mem of toEnrich) {
            count++;
            status.textContent = `Enriching ${count}/${toEnrich.length}: "${mem.content.substring(0, 20)}..."`;

            // Delegate to background script to avoid CORS
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({
                    type: 'ENRICH_MEMORY',
                    content: mem.content
                }, resolve);
            });

            if (response && response.metadata) {
                const metadata = response.metadata;
                await supabase.from('memories').update({
                    domains: metadata.domains,
                    emotions: metadata.emotions,
                    intensity: metadata.intensity
                }).eq('id', mem.id);
            } else if (response && response.error) {
                console.error('Enrichment error:', response.error);
            }

            // Rate limit pause
            await new Promise(r => setTimeout(r, 500));
        }

        status.textContent = `✅ Enriched ${count} memories! Reloading...`;
        setTimeout(() => window.location.reload(), 1500);
    });
}

function renderMemories(memories) {
    const list = document.getElementById('memories-list');
    if (memories.length === 0) {
        list.innerHTML = '<div class="memory-item" style="color: #666; text-align: center;">No memories yet</div>';
        return;
    }

    list.innerHTML = memories.slice().reverse().map(m => `
    <div class="memory-item">
      <div class="memory-content">${m.content}</div>
      <div class="memory-meta">${new Date(m.created_at || m.created).toLocaleDateString()} • ${m.source || 'unknown'}</div>
    </div>
  `).join('');
}

function renderHeatMap(heatMapData) {
    const container = document.getElementById('heat-map-full');
    if (!heatMapData) {
        container.innerHTML = '<p style="grid-column: 1/-1; color: #666; text-align: center;">No heat data</p>';
        return;
    }

    let domains = {};
    let emotions = {};

    if (heatMapData.domainHeat) {
        domains = heatMapData.domainHeat;
        emotions = heatMapData.emotionHeat;
    } else if (heatMapData.domains) {
        for (const [k, v] of Object.entries(heatMapData.domains)) {
            domains[k] = v.heat || v;
        }
        for (const [k, v] of Object.entries(heatMapData.emotions)) {
            emotions[k] = v.heat || v;
        }
    }

    const renderSection = (title, data) => `
    <div class="heat-column">
      <h3>${title}</h3>
      ${Object.entries(data).map(([name, value]) => `
        <div class="heat-row">
          <span class="heat-name">${name}</span>
          <div class="heat-bar-container">
            <div class="heat-bar-fill" style="width: ${Math.min(100, value * 100)}%"></div>
          </div>
          <span style="font-size: 11px; color: #666; margin-left: 8px; width: 30px;">${Math.round(value * 100)}%</span>
        </div>
      `).join('')}
    </div>
  `;

    container.innerHTML = renderSection('Domains', domains) + renderSection('Emotions', emotions);
}
