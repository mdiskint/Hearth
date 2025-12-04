import { HeatTracker } from '../core/heatTracker.js';
import { MemoryRetriever } from '../core/memoryRetriever.js';
import { DimensionDetector } from '../core/dimensionDetector.js';
import { supabase } from '../lib/supabase-bundle.js';
import { checkSignificance, extractMemory, enrichMemoryMetadata } from '../core/memoryExtractor.js';

let heatTracker;
let memoryRetriever;
let dimensionDetector;

// Initialize
chrome.runtime.onInstalled.addListener(initializeHearth);
chrome.runtime.onStartup.addListener(initializeHearth);

// Listen for auth changes to reload data
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        initializeHearth();
    }
});

async function initializeHearth() {
    console.log('Initializing Hearth...');
    const { data: { user } } = await supabase.auth.getUser();

    let memories = [];
    let heatMap = null;
    let eos = null;

    if (user) {
        console.log('User signed in, loading from cloud...');
        // Load from Supabase
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profile) {
            heatMap = profile.heat_map;
            eos = profile.eos;
            // Cache locally for popup
            chrome.storage.local.set({ eos, heatMap });
        }

        const { data: mems } = await supabase
            .from('memories')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        memories = mems || [];
        chrome.storage.local.set({ memories });
    } else {
        console.log('User not signed in, loading from local...');
        // Fallback to local storage (offline/not signed in)
        const local = await chrome.storage.local.get(['eos', 'memories', 'heatMap']);
        memories = local.memories || [];
        heatMap = local.heatMap;
        eos = local.eos;
    }

    heatTracker = new HeatTracker();
    if (heatMap) heatTracker.import(heatMap);

    memoryRetriever = new MemoryRetriever(memories);
    dimensionDetector = new DimensionDetector();
    console.log('Hearth initialized');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_HEARTH_CONTEXT') {
        handleGetContext(request.message).then(sendResponse);
        return true;
    }

    if (request.type === 'CHECK_SIGNIFICANCE') {
        handleSignificanceCheck(request).then(sendResponse);
        return true;
    }

    if (request.type === 'ENRICH_MEMORY') {
        handleEnrichment(request).then(sendResponse);
        return true;
    }

    if (request.type === 'UPDATE_HEARTH') {
        // Optional: handle manual updates or feedback
        return false;
    }
});

async function handleGetContext(userMessage) {
    if (!heatTracker) await initializeHearth();

    // Detect
    const activeDimensions = await dimensionDetector.detect(userMessage);

    // Update Heat
    heatTracker.activate(activeDimensions.domains, activeDimensions.emotions);
    const heatState = heatTracker.getState();

    // Retrieve
    const memoriesResult = memoryRetriever.retrieve(activeDimensions, heatState);

    // Save Heat Map
    const heatMapExport = heatTracker.export();

    // Sync to Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        await supabase.from('profiles').update({
            heat_map: heatMapExport,
            updated_at: new Date().toISOString()
        }).eq('id', user.id);
    }

    // Also save local for popup
    chrome.storage.local.set({ heatMap: heatMapExport });

    // Get EOS (cached)
    const { eos } = await chrome.storage.local.get('eos');

    return {
        eos,
        memories: memoriesResult.memories || [],
        heatMap: heatState
    };
}

async function handleSignificanceCheck(request) {
    console.log('🔍 Checking significance for message:', request.message.substring(0, 50) + '...');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.log('⚠️ User not signed in, skipping memory extraction');
        return { significant: false };
    }

    // Get API key from storage
    const { apiKey, eos } = await chrome.storage.local.get(['apiKey', 'eos']);

    if (!apiKey) {
        console.log('⚠️ No API key set, skipping memory extraction');
        return { significant: false };
    }

    try {
        const isSignificant = await checkSignificance(apiKey, request.message, request.context || []);
        console.log('📊 Significance check complete for:', request.message.substring(0, 30) + '...');
        console.log('📊 Result: ' + (isSignificant ? 'SIGNIFICANT ✨' : 'not significant'));

        if (isSignificant) {
            console.log('✨ Significant message detected, extracting memory...');
            const memory = await extractMemory(apiKey, request.message, request.context || [], eos || '');

            if (memory) {
                console.log('💾 Memory extracted:', memory.summary);

                // Save to Supabase
                const { error } = await supabase.from('memories').insert({
                    user_id: user.id,
                    content: memory.content,
                    domains: memory.domains,
                    emotions: memory.emotions,
                    intensity: memory.intensity
                    // summary and source columns do not exist in DB
                });

                if (error) {
                    console.error('❌ Failed to save memory to Supabase:', error);
                } else {
                    console.log('✅ Memory saved to Supabase');

                    // Reload memories
                    await initializeHearth();

                    return {
                        significant: true,
                        memory: memory.summary
                    };
                }
            }
        }

        return { significant: isSignificant };
    } catch (err) {
        console.error('❌ Error in significance check:', err);
        return { significant: false };
    }
}

async function handleEnrichment(request) {
    console.log('✨ Enriching memory:', request.content.substring(0, 30) + '...');
    const { apiKey } = await chrome.storage.local.get('apiKey');

    if (!apiKey) {
        return { error: 'No API key set' };
    }

    try {
        const metadata = await enrichMemoryMetadata(apiKey, request.content);
        return { metadata };
    } catch (err) {
        console.error('❌ Enrichment failed:', err);
        return { error: err.message };
    }
}
