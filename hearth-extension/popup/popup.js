import { supabase } from '../lib/supabase-bundle.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔌 Extension popup opened');

    // Check auth first
    const { data: { user } } = await supabase.auth.getUser();
    console.log('👤 User:', user?.id || 'Not signed in');

    let memories = [];
    let heatMap = null;

    if (user) {
        // Fetch fresh data from Supabase
        console.log('☁️ Fetching memories from Supabase...');
        try {
            const { data: fetchedMemories, error } = await supabase
                .from('memories')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Error fetching memories:', error);
            } else {
                memories = fetchedMemories || [];
                console.log('✅ Fetched', memories.length, 'memories from Supabase');
            }

            // Also fetch profile for heat map
            console.log('☁️ Fetching profile from Supabase...');
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('heat_map')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.log('⚠️ No profile found');
            } else {
                heatMap = profile?.heat_map;
                console.log('✅ Profile loaded');
            }
        } catch (err) {
            console.error('❌ Error loading data:', err);
        }
    } else {
        console.log('📭 Not signed in, using local storage fallback');
        // Fallback to local storage if not signed in
        const data = await chrome.storage.local.get(['memories', 'heatMap']);
        memories = data.memories || [];
        heatMap = data.heatMap;
    }

    // Update memory count
    console.log('📊 Displaying', memories.length, 'memories');
    document.getElementById('memory-count').textContent = memories.length;

    // Render heat preview
    renderHeatPreview(heatMap);

    // Settings button
    document.getElementById('open-settings').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Auth Status
    renderAuth(user);
});

function renderAuth(user) {
    const container = document.getElementById('auth-section');
    if (user) {
        container.innerHTML = `
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 11px; color: #888;">${user.email}</span>
        <button id="sign-out" style="padding: 4px 8px; font-size: 10px; width: auto; background: #333;">Sign Out</button>
      </div>
    `;
        document.getElementById('sign-out').addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.reload();
        });
    } else {
        container.innerHTML = `
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #333; text-align: center;">
        <p style="font-size: 11px; color: #888; margin-bottom: 8px;">Sign in to sync memories</p>
        <button id="sign-in-btn" class="primary" style="width: 100%;">Sign In</button>
      </div>
    `;
        document.getElementById('sign-in-btn').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
    }
}

function renderHeatPreview(heatMapData) {
    const container = document.getElementById('heat-preview');

    if (!heatMapData) {
        container.innerHTML = '<p style="font-size: 12px; color: #666;">No activity yet</p>';
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

    const allDimensions = [
        ...Object.entries(domains),
        ...Object.entries(emotions)
    ]
        .map(([name, value]) => [name, typeof value === 'object' ? value.heat : value])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (allDimensions.length === 0 || allDimensions[0][1] === 0) {
        container.innerHTML = '<p style="font-size: 12px; color: #666;">No active heat</p>';
        return;
    }

    container.innerHTML = allDimensions.map(([name, value]) => `
    <div class="heat-bar">
      <span class="heat-label">${name}</span>
      <div class="heat-track">
        <div class="heat-fill" style="width: ${Math.min(100, value * 100)}%"></div>
      </div>
    </div>
  `).join('');
}
