import { supabase } from '../lib/supabase-bundle.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Load current state
    const data = await chrome.storage.local.get(['eos', 'memories', 'heatMap']);

    // Update memory count
    document.getElementById('memory-count').textContent = data.memories?.length || 0;

    // Render heat preview
    renderHeatPreview(data.heatMap);

    // Settings button
    document.getElementById('open-settings').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Auth Status
    const { data: { user } } = await supabase.auth.getUser();
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
