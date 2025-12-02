import React, { useState, useRef, useEffect } from 'react';
import { Hearth } from '../core/Hearth.js';
import { callClaude, buildSystemPrompt } from '../api/claude.js';
import Extractor from './Extractor.jsx';

// Initialize Hearth
const hearth = new Hearth({ debug: false });

function App() {
  const [mode, setMode] = useState('chat'); // 'chat' or 'extractor'
  const [messages, setMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [heatState, setHeatState] = useState(null);
  const [retrievedMemories, setRetrievedMemories] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    setRetrievedMemories(result.memories);

    // Build new conversation history with this message
    const newHistory = [...conversationHistory, { role: 'user', content: userMessage }];

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
      const systemPrompt = buildSystemPrompt(result.context);
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
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Hearth</h1>
          <p style={styles.subtitle}>Dimensional Memory System</p>
        </div>

        {/* Mode Switcher */}
        <div style={styles.modeSwitcher}>
          <button
            onClick={() => setMode('chat')}
            style={{
              ...styles.modeButton,
              ...(mode === 'chat' ? styles.modeButtonActive : {})
            }}
          >
            Chat
          </button>
          <button
            onClick={() => setMode('extractor')}
            style={{
              ...styles.modeButton,
              ...(mode === 'extractor' ? styles.modeButtonActive : {})
            }}
          >
            Extractor
          </button>
        </div>

        {/* API Key Input - only show in chat mode */}
        {mode === 'chat' && (
          <>
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
          </>
        )}
      </header>

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button onClick={() => setError(null)} style={styles.errorClose}>x</button>
        </div>
      )}

      {/* Conditional Mode Rendering */}
      {mode === 'chat' ? (
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
      ) : (
        <Extractor />
      )}
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
  modeSwitcher: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    background: '#171717',
    borderRadius: '8px',
  },
  modeButton: {
    padding: '8px 20px',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#a3a3a3',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modeButtonActive: {
    background: '#f97316',
    color: '#fff',
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
};

export default App;
