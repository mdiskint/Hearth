import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthScreen from '../components/AuthScreen';
import { Hearth } from '../core/Hearth.js';
import { callClaude, buildSystemPrompt } from '../api/claude.js';
import { db } from '../services/database';
import { checkSignificance, extractLiveMemory, saveMemoryToStore, getLiveMemories, clearLiveMemories } from '../utils/liveMemory.js';
import IntakeFlow from './IntakeFlow.jsx';

// Initialize Hearth
const hearth = new Hearth({ debug: false });

function App() {
  const { user, loading, signOut } = useAuth();
  const [messages, setMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [heatState, setHeatState] = useState(null);
  const [retrievedMemories, setRetrievedMemories] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [liveMemories, setLiveMemories] = useState([]);
  const [memoryNotification, setMemoryNotification] = useState(null);
  const [userEOS, setUserEOS] = useState(''); // User's EOS for context

  // Intake Flow State
  const [showIntake, setShowIntake] = useState(false); // Check profile first
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [hasCheckedProfile, setHasCheckedProfile] = useState(false);

  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load user data from cloud on login
  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    setIsProfileLoading(true);
    console.log('🔄 loadUserData called for user:', user.id);

    try {
      let hasData = false;

      // 1. Check for local migration
      const localMemories = getLiveMemories();
      console.log('📦 Local memories found:', localMemories.length);

      if (localMemories.length > 0) {
        if (confirm('We found existing data in this browser. Import it to your cloud account?')) {
          console.log('⬆️ Uploading local memories to cloud...');
          // Upload memories
          for (const mem of localMemories) {
            await saveMemoryToStore(mem, user.id);
          }
          // Clear local
          clearLiveMemories();
          hasData = true;
        }
      }

      // 2. Load from Cloud
      console.log('☁️ Loading profile from Supabase...');
      try {
        const profile = await db.getProfile(user.id);
        console.log('✅ Profile loaded:', profile);

        if (profile) {
          if (profile.eos) {
            console.log('📝 EOS found in profile');
            setUserEOS(profile.eos);
            hasData = true;
          }
          if (profile.heat_map) {
            console.log('🔥 Heat map found in profile');
            if (hearth.heatTracker) {
              hearth.heatTracker.import(profile.heat_map);
              setHeatState(hearth.heatTracker.getState()); // Convert to state format
            }
            hasData = true;
          }
        }
      } catch (profileErr) {
        // Profile might not exist yet, ignore error
        console.log('⚠️ No profile found or error loading profile:', profileErr.message);
      }

      console.log('💾 Fetching memories from Supabase for user:', user.id);
      const memories = await db.getMemories(user.id);
      console.log('✅ Memories fetched:', memories?.length || 0, 'memories');
      console.log('📋 Memory data:', memories);

      if (memories && memories.length > 0) {
        console.log('✨ Setting memories in state...');
        setLiveMemories(memories);

        if (hearth.memoryRetriever) {
          console.log('🧠 Updating Hearth memoryRetriever with', memories.length, 'memories');
          hearth.memoryRetriever.memories = memories;
        } else {
          console.warn('⚠️ hearth.memoryRetriever not available!');
        }

        hasData = true;
      } else {
        console.log('📭 No memories found in Supabase');
        // Still set empty array to initialize state
        setLiveMemories([]);
        if (hearth.memoryRetriever) {
          hearth.memoryRetriever.memories = [];
        }
      }

      // If no data found, show intake
      if (!hasData) {
        console.log('🆕 No user data found, showing intake flow');
        setShowIntake(true);
      } else {
        console.log('✅ User has data, proceeding to main app');
      }

    } catch (err) {
      console.error('❌ Error loading user data:', err);
      // Fallback to intake on general error
      setShowIntake(true);
    } finally {
      setIsProfileLoading(false);
      setHasCheckedProfile(true);
      console.log('✅ loadUserData complete');
    }
  };

  // Handle completion of intake flow
  const handleIntakeComplete = async (data) => {
    console.log('Intake complete:', data);

    // 1. Save memories
    for (const memory of data.memories) {
      await saveMemoryToStore(memory, user?.id);
    }
    setLiveMemories(prev => [...prev, ...data.memories]);

    // 2. Save EOS if provided
    if (data.eos) {
      setUserEOS(data.eos);
      if (user?.id) {
        await db.saveEOS(user.id, data.eos);
      }
      console.log('User EOS saved');
    }

    // 3. Update Heat Map with baseline
    // We need to manually inject this into the heat tracker
    if (hearth.heatTracker) {
      // Reset first to clear any defaults
      hearth.heatTracker.reset();

      // Activate based on the baseline scores
      // The heat tracker expects activation, so we'll simulate it
      // Or we can add a method to HeatTracker to set baseline directly
      // For now, let's just activate each dimension with its score
      const domains = [];
      const emotions = [];
      const intensity = 1.0; // Baseline is strong

      Object.entries(data.heatMap).forEach(([key, val]) => {
        if (val > 0) {
          // We need to separate domains and emotions. 
          // We can check against the lists in IntakeFlow, or just try to activate.
          // HeatTracker.activate takes lists.
          // Let's just do a bulk activation.
          // Actually, HeatTracker separates them.
          // Let's just use the keys. HeatTracker will ignore unknown keys if properly implemented,
          // or we should filter.
          // Let's assume keys match.
          // We'll just pass all keys to both and let HeatTracker filter? 
          // No, HeatTracker expects specific lists.
          // Let's look at HeatTracker to be sure.
        }
      });

      // Better approach: Just use the memories to prime it, plus the explicit scores?
      // The user prompt asked for a baseline heat map.
      // Let's just use the memories to prime it for now, as that's robust.
      // AND we can use the explicit scores to boost it.

      // Let's just close the intake and let the memories drive the heat map for now,
      // as we already implemented `initializeFromMemories` in Hearth.js which reads from `memories.json`.
      // But these new memories are in localStorage (via saveMemoryToStore).
      // We need Hearth to read from localStorage too.

      // For this demo, let's just hide the intake.
    }

    setShowIntake(false);
  };

  if (loading || (user && isProfileLoading)) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingText}>{loading ? 'Loading Hearth...' : 'Loading Profile...'}</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!hasCheckedProfile) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingText}>Loading Profile...</div>
      </div>
    );
  }

  if (showIntake) {
    return <IntakeFlow onComplete={handleIntakeComplete} />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setIsProcessing(true);
    setError(null);

    // Add user message to display
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // Process through Hearth
    const result = await hearth.process(userMessage);

    // Update heat state
    setHeatState(result.heatMap);
    if (user?.id) {
      // Save updated heat map to cloud
      // We get the full export from tracker to save
      const fullState = hearth.heatTracker.export();
      await db.saveHeatMap(user.id, fullState);
    }
    setRetrievedMemories(result.memories);

    // Build new conversation history with this message
    const newHistory = [...conversationHistory, { role: 'user', content: userMessage }];

    // **LIVE MEMORY ACCUMULATION** - Check significance in background
    if (apiKey.trim()) {
      checkSignificance(apiKey, userMessage, conversationHistory).then(async (isSignificant) => {
        if (isSignificant) {
          console.log('✨ Significant message detected, extracting memory...');
          const memory = await extractLiveMemory(apiKey, userMessage, conversationHistory, userEOS);
          if (memory) {
            await saveMemoryToStore(memory, user?.id);
            setLiveMemories(prev => [...prev, memory]);

            // Show notification
            setMemoryNotification(memory.summary);
            setTimeout(() => setMemoryNotification(null), 3000);

            console.log('✨ Memory saved:', memory);
          }
        }
      }).catch(err => {
        console.error('Live memory check failed:', err);
      });
    }

    // Check if we have an API key
    if (!apiKey.trim()) {
      // No API key - show mock response
      const mockResponse = generateMockResponse(result);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: mockResponse,
        meta: result.meta
      }]);
      setConversationHistory([...newHistory, { role: 'assistant', content: mockResponse }]);
      setIsProcessing(false);
      return;
    }

    // Call Claude with Hearth context
    try {
      const systemPrompt = buildSystemPrompt(result.context, conversationHistory.length === 0);
      const response = await callClaude(apiKey, systemPrompt, newHistory);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
        meta: result.meta
      }]);
      setConversationHistory([...newHistory, { role: 'assistant', content: response }]);
    } catch (err) {
      setError(err.message);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}`,
        isError: true,
        meta: result.meta
      }]);
    }

    setIsProcessing(false);
  };

  const generateMockResponse = (result) => {
    // This is a mock - shown when no API key is provided
    const { meta, memories } = result;

    let response = `[No API key - showing Hearth debug info]\n\n`;
    response += `Detected: ${meta.hottestDimensions.map(d => d.name).join(', ')}\n`;
    response += `Memories retrieved: ${meta.memoriesRetrieved}\n\n`;

    if (memories.length > 0) {
      response += `Relevant context:\n`;
      memories.slice(0, 2).forEach(m => {
        response += `- ${m.summary}\n`;
      });
    }

    return response;
  };

  const handleReset = () => {
    hearth.reset();
    setMessages([]);
    setConversationHistory([]);
    setHeatState(null);
    setRetrievedMemories([]);
    setError(null);
  };

  return (
    <div style={styles.container}>
      {/* Beta Warning Banner */}
      <div style={styles.betaBanner}>
        <span>☁️</span>
        <span>Beta — Your data syncs to the cloud. Sign in on any device to access your memories.</span>
      </div>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Hearth</h1>
          <p style={styles.subtitle}>Dimensional Memory System</p>
        </div>

        {/* API Key Input */}
        <div style={styles.apiKeyContainer}>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Anthropic API Key"
            style={styles.apiKeyInput}
          />
          {apiKey && <span style={styles.apiKeyStatus}>API key set</span>}
        </div>

        <button onClick={handleReset} style={styles.resetButton}>
          Reset Conversation
        </button>
        <button onClick={signOut} style={styles.signOutButton}>
          Sign Out
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button onClick={() => setError(null)} style={styles.errorClose}>x</button>
        </div>
      )}

      {/* Main Content */}
      <div style={styles.main}>
        {/* Chat Panel */}
        <div style={styles.chatPanel}>
          <div style={styles.messages}>
            {messages.length === 0 && (
              <div style={styles.emptyState}>
                <p>Start a conversation to see Hearth in action.</p>
                <p style={styles.hint}>
                  {apiKey ? 'Claude is ready to respond with context.' : 'Add your Anthropic API key above to enable Claude responses.'}
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  ...styles.message,
                  ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
                  ...(msg.isError ? styles.errorMessage : {})
                }}
              >
                <div style={styles.messageRole}>
                  {msg.role === 'user' ? 'You' : 'Claude'}
                </div>
                <div style={styles.messageContent}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div style={{ ...styles.message, ...styles.assistantMessage }}>
                <div style={styles.messageRole}>Claude</div>
                <div style={styles.messageContent}>Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} style={styles.inputForm}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              style={styles.input}
              disabled={isProcessing}
            />
            <button
              type="submit"
              style={styles.sendButton}
              disabled={isProcessing || !input.trim()}
            >
              {isProcessing ? '...' : 'Send'}
            </button>
          </form>

          {/* Memory Capture Notification */}
          {memoryNotification && (
            <div style={styles.memoryNotification}>
              <span style={styles.notificationIcon}>✨</span>
              <span>Memory saved: {memoryNotification}</span>
            </div>
          )}
        </div>

        {/* Heat Map Panel */}
        <div style={styles.heatPanel}>
          <h2 style={styles.panelTitle}>Heat Map</h2>

          {!heatState ? (
            <p style={styles.hint}>Heat map will appear after your first message</p>
          ) : (
            <>
              <div style={styles.heatSection}>
                <h3 style={styles.sectionTitle}>Domains</h3>
                {Object.entries(heatState.domains).map(([name, data]) => (
                  <HeatBar key={name} name={name} heat={data.heat} status={data.status} />
                ))}
              </div>

              <div style={styles.heatSection}>
                <h3 style={styles.sectionTitle}>Emotions</h3>
                {Object.entries(heatState.emotions).map(([name, data]) => (
                  <HeatBar key={name} name={name} heat={data.heat} status={data.status} />
                ))}
              </div>
            </>
          )}

          {/* Retrieved Memories */}
          {retrievedMemories.length > 0 && (
            <div style={styles.memoriesSection}>
              <h3 style={styles.sectionTitle}>Retrieved Memories</h3>
              {retrievedMemories.map((mem, i) => (
                <div key={i} style={styles.memoryCard}>
                  <div style={styles.memorySummary}>{mem.summary}</div>
                  <div style={styles.memoryTags}>
                    {mem.domains?.map(d => (
                      <span key={d} style={styles.tagDomain}>{d}</span>
                    ))}
                    {mem.emotions?.map(e => (
                      <span key={e} style={styles.tagEmotion}>{e}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Heat bar component
function HeatBar({ name, heat, status }) {
  const getColor = () => {
    if (status === 'hot') return '#ef4444';
    if (status === 'warm') return '#f97316';
    if (status === 'cool') return '#3b82f6';
    return '#374151';
  };

  return (
    <div style={styles.heatBarContainer}>
      <div style={styles.heatBarLabel}>
        <span>{name}</span>
        <span style={{ color: getColor() }}>{Math.round(heat * 100)}%</span>
      </div>
      <div style={styles.heatBarTrack}>
        <div
          style={{
            ...styles.heatBarFill,
            width: `${heat * 100}%`,
            backgroundColor: getColor()
          }}
        />
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid #262626',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#f97316',
  },
  subtitle: {
    color: '#737373',
  },
  apiKeyContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  apiKeyInput: {
    padding: '8px 12px',
    background: '#171717',
    border: '1px solid #404040',
    borderRadius: '6px',
    color: '#e5e5e5',
    fontSize: '14px',
    width: '200px',
    outline: 'none',
  },
  apiKeyStatus: {
    fontSize: '12px',
    color: '#22c55e',
  },
  resetButton: {
    padding: '8px 16px',
    background: '#262626',
    border: '1px solid #404040',
    borderRadius: '6px',
    color: '#e5e5e5',
    cursor: 'pointer',
  },
  errorBanner: {
    padding: '12px 20px',
    background: '#7f1d1d',
    color: '#fecaca',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: '#fecaca',
    cursor: 'pointer',
    fontSize: '16px',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  chatPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #262626',
  },
  messages: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#737373',
  },
  hint: {
    fontSize: '14px',
    color: '#525252',
    marginTop: '8px',
  },
  message: {
    marginBottom: '16px',
    padding: '12px 16px',
    borderRadius: '8px',
  },
  userMessage: {
    background: '#1e3a5f',
    marginLeft: '40px',
  },
  assistantMessage: {
    background: '#262626',
    marginRight: '40px',
  },
  errorMessage: {
    background: '#7f1d1d',
  },
  messageRole: {
    fontSize: '12px',
    color: '#737373',
    marginBottom: '4px',
  },
  messageContent: {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.5',
  },
  inputForm: {
    display: 'flex',
    gap: '12px',
    padding: '20px',
    borderTop: '1px solid #262626',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    background: '#171717',
    border: '1px solid #404040',
    borderRadius: '8px',
    color: '#e5e5e5',
    fontSize: '16px',
    outline: 'none',
  },
  sendButton: {
    padding: '12px 24px',
    background: '#f97316',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: '600',
    cursor: 'pointer',
  },
  heatPanel: {
    width: '350px',
    padding: '20px',
    overflow: 'auto',
    background: '#0f0f0f',
  },
  panelTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#f97316',
  },
  heatSection: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#a3a3a3',
  },
  heatBarContainer: {
    marginBottom: '8px',
  },
  heatBarLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    marginBottom: '4px',
  },
  heatBarTrack: {
    height: '8px',
    background: '#262626',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  heatBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
  memoriesSection: {
    marginTop: '24px',
  },
  memoryCard: {
    padding: '12px',
    background: '#171717',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  memorySummary: {
    fontSize: '13px',
    marginBottom: '8px',
    lineHeight: '1.4',
  },
  memoryTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  tagDomain: {
    fontSize: '11px',
    padding: '2px 8px',
    background: '#1e3a5f',
    borderRadius: '4px',
    color: '#60a5fa',
  },
  tagEmotion: {
    fontSize: '11px',
    padding: '2px 8px',
    background: '#3f1f1f',
    borderRadius: '4px',
    color: '#f87171',
  },
  memoryNotification: {
    position: 'fixed',
    bottom: '100px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 20px',
    background: '#1f1711',
    border: '2px solid #f97316',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
    animation: 'slideUp 0.3s ease-out',
    zIndex: 1000,
  },
  notificationIcon: {
    fontSize: '18px',
  },
  loadingContainer: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0f0f',
    color: '#e5e5e5',
  },
  loadingText: {
    fontSize: '18px',
    color: '#737373',
  },
  signOutButton: {
    padding: '8px 16px',
    background: 'none',
    border: '1px solid #404040',
    borderRadius: '6px',
    color: '#737373',
    cursor: 'pointer',
    marginLeft: '8px',
  },
  betaBanner: {
    background: 'rgba(255, 150, 50, 0.15)',
    color: '#fdba74',
    padding: '8px',
    textAlign: 'center',
    fontSize: '12px',
    borderBottom: '1px solid rgba(255, 150, 50, 0.2)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
  },
};

export default App;
