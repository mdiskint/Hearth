import React, { useState, useEffect } from 'react';

// Dimensions configuration
const DOMAINS = ['Work', 'Relationships', 'Creative', 'Self', 'Decisions', 'Resources', 'Values'];
const EMOTIONS = ['Fear', 'Anger', 'Shame', 'Grief', 'Anxiety', 'Joy', 'Pride', 'Love', 'Curiosity', 'Peace'];

// The prompt to copy
const EXTRACTION_PROMPT = `I'm setting up a new AI system that needs to understand who I am. You know me from our conversations. I need you to search your memory and extract the most significant things you've learned about me.
Find 10-20 moments that reveal who I am:

Decisions I've wrestled with
Values or beliefs I've expressed
Emotional breakthroughs or struggles
Important facts about my life (work, family, goals)
Patterns in how I think, work, or relate to others

Skip generic facts. Focus on what actually matters.
For each one, output in this exact format:
MEMORY: [2-3 sentence description, specific and personal]
DOMAINS: [list from: Work, Relationships, Creative, Self, Decisions, Resources, Values]
EMOTIONS: [list from: Fear, Anger, Shame, Grief, Anxiety, Joy, Pride, Love, Curiosity, Peace]
INTENSITY: [0.0-1.0, how significant is this]

After all memories, add:
BASELINE HEAT MAP:
Work: [0-100]
Relationships: [0-100]
Creative: [0-100]
Self: [0-100]
Decisions: [0-100]
Resources: [0-100]
Values: [0-100]
Fear: [0-100]
Anger: [0-100]
Shame: [0-100]
Grief: [0-100]
Anxiety: [0-100]
Joy: [0-100]
Pride: [0-100]
Love: [0-100]
Curiosity: [0-100]
Peace: [0-100]
Base these scores on everything you know about me—not just the memories above, but the overall picture.`;

export default function IntakeFlow({ onComplete }) {
    const [step, setStep] = useState('WELCOME'); // WELCOME, CHOOSE_AI, COPY_PROMPT, PASTE_OUTPUT, PROCESSING, MIRROR, EOS_PITCH, PASTE_EOS, READY
    const [selectedAI, setSelectedAI] = useState(null); // 'Claude' or 'ChatGPT'
    const [pastedText, setPastedText] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [copyStatus, setCopyStatus] = useState('Copy to Clipboard');
    const [eosText, setEosText] = useState('');

    // Parse the pasted text
    const parseInput = (text) => {
        const memories = [];
        const heatMap = {};

        // 1. Extract Memories
        // Split by "MEMORY:" to find blocks, ignore the preamble
        const memoryBlocks = text.split(/MEMORY:\s*/i).slice(1);

        memoryBlocks.forEach(block => {
            // Stop parsing this block if we hit the heat map section
            if (block.includes('BASELINE HEAT MAP:')) {
                block = block.split('BASELINE HEAT MAP:')[0];
            }

            const contentMatch = block.match(/^(.+?)(?=\n(?:DOMAINS|EMOTIONS|INTENSITY):)/s);
            const domainsMatch = block.match(/DOMAINS:\s*\[?(.*?)\]?(?:\n|$)/i);
            const emotionsMatch = block.match(/EMOTIONS:\s*\[?(.*?)\]?(?:\n|$)/i);
            const intensityMatch = block.match(/INTENSITY:\s*\[?([\d\.]+)\]?/i);

            if (contentMatch) {
                const content = contentMatch[1].trim();

                // Parse comma-separated lists
                const domains = domainsMatch ? domainsMatch[1].split(',').map(s => s.trim()).filter(s => DOMAINS.includes(s)) : [];
                const emotions = emotionsMatch ? emotionsMatch[1].split(',').map(s => s.trim()).filter(s => EMOTIONS.includes(s)) : [];
                const intensity = intensityMatch ? parseFloat(intensityMatch[1]) : 0.5;

                if (content) {
                    memories.push({
                        content,
                        summary: content.slice(0, 50) + (content.length > 50 ? '...' : ''), // Simple summary
                        domains,
                        emotions,
                        intensity,
                        created: new Date().toISOString(),
                        source: 'intake_baseline'
                    });
                }
            }
        });

        // 2. Extract Heat Map
        const heatMapSection = text.match(/BASELINE HEAT MAP:([\s\S]*)/i);
        if (heatMapSection) {
            const lines = heatMapSection[1].split('\n');
            lines.forEach(line => {
                const match = line.match(/([A-Za-z]+):\s*\[?(\d+)\]?/);
                if (match) {
                    const key = match[1].trim();
                    const val = parseInt(match[2], 10);
                    if ([...DOMAINS, ...EMOTIONS].includes(key)) {
                        heatMap[key] = val;
                    }
                }
            });
        }

        // Fill missing heat map values with 0
        [...DOMAINS, ...EMOTIONS].forEach(key => {
            if (heatMap[key] === undefined) heatMap[key] = 0;
        });

        return { memories, heatMap };
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(EXTRACTION_PROMPT);
        setCopyStatus('Copied!');
        setTimeout(() => setCopyStatus('Copy to Clipboard'), 2000);
    };

    const handlePasteProcess = () => {
        setStep('PROCESSING');
        setTimeout(() => {
            const result = parseInput(pastedText);
            setParsedData(result);
            setStep('MIRROR');
        }, 1500); // Fake processing delay for UX
    };

    const handleConfirm = () => {
        setStep('EOS_PITCH');
    };

    const handleEosSubmit = () => {
        setStep('READY');
    };

    const handleSkipEos = () => {
        setEosText('');
        setStep('READY');
    };

    const handleFinalStart = () => {
        if (onComplete && parsedData) {
            onComplete({
                ...parsedData,
                eos: eosText
            });
        }
    };

    // --- RENDER STEPS ---

    if (step === 'WELCOME') {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <h1 style={styles.title}>Welcome to Hearth</h1>
                    <p style={styles.text}>
                        Hearth learns who you are. Let's start by asking your current AI what it already knows.
                    </p>
                    <button style={styles.primaryButton} onClick={() => setStep('CHOOSE_AI')}>
                        Get Started
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'CHOOSE_AI') {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <h2 style={styles.heading}>Which AI do you use most?</h2>
                    <div style={styles.buttonGroup}>
                        <button
                            style={{ ...styles.choiceButton, ...(selectedAI === 'Claude' ? styles.choiceActive : {}) }}
                            onClick={() => setSelectedAI('Claude')}
                        >
                            Claude
                        </button>
                        <button
                            style={{ ...styles.choiceButton, ...(selectedAI === 'ChatGPT' ? styles.choiceActive : {}) }}
                            onClick={() => setSelectedAI('ChatGPT')}
                        >
                            ChatGPT
                        </button>
                    </div>
                    <button
                        style={styles.primaryButton}
                        disabled={!selectedAI}
                        onClick={() => setStep('COPY_PROMPT')}
                    >
                        Next
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'COPY_PROMPT') {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <h2 style={styles.heading}>Ask {selectedAI}</h2>
                    <p style={styles.text}>
                        Paste this prompt into {selectedAI}, then come back with the result.
                    </p>
                    <div style={styles.promptBox}>
                        {EXTRACTION_PROMPT}
                    </div>
                    <button style={styles.copyButton} onClick={handleCopy}>
                        {copyStatus}
                    </button>
                    <button style={styles.primaryButton} onClick={() => setStep('PASTE_OUTPUT')}>
                        I have the result
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'PASTE_OUTPUT') {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <h2 style={styles.heading}>Paste Result</h2>
                    <p style={styles.text}>Paste exactly what {selectedAI} gave you below.</p>
                    <textarea
                        style={styles.textarea}
                        placeholder="Paste here..."
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                    />
                    <button
                        style={styles.primaryButton}
                        disabled={!pastedText.trim()}
                        onClick={handlePasteProcess}
                    >
                        Process
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'PROCESSING') {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={styles.spinner}></div>
                    <h2 style={styles.heading}>Building your baseline...</h2>
                    <p style={styles.text}>Parsing memories and emotional profile</p>
                </div>
            </div>
        );
    }

    if (step === 'MIRROR') {
        return (
            <div style={styles.container}>
                <div style={{ ...styles.card, maxWidth: '800px' }}>
                    <h2 style={styles.heading}>Here's what I see</h2>

                    <div style={styles.mirrorGrid}>
                        {/* Heat Map Column */}
                        <div style={styles.heatColumn}>
                            <h3 style={styles.subHeading}>Baseline Heat Map</h3>
                            <div style={styles.heatList}>
                                {[...DOMAINS, ...EMOTIONS].map(key => (
                                    <div key={key} style={styles.heatItem}>
                                        <div style={styles.heatLabel}>
                                            <span>{key}</span>
                                            <span>{parsedData.heatMap[key]}%</span>
                                        </div>
                                        <div style={styles.heatTrack}>
                                            <div
                                                style={{
                                                    ...styles.heatFill,
                                                    width: `${parsedData.heatMap[key]}%`,
                                                    background: getHeatColor(parsedData.heatMap[key])
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Memories Column */}
                        <div style={styles.memoriesColumn}>
                            <h3 style={styles.subHeading}>Core Memories ({parsedData.memories.length})</h3>
                            <div style={styles.memoriesList}>
                                {parsedData.memories.map((mem, i) => (
                                    <div key={i} style={styles.memoryCard}>
                                        <p style={styles.memoryContent}>{mem.content}</p>
                                        <div style={styles.tagRow}>
                                            {mem.domains.map(d => <span key={d} style={styles.tagDomain}>{d}</span>)}
                                            {mem.emotions.map(e => <span key={e} style={styles.tagEmotion}>{e}</span>)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={styles.actionRow}>
                        <p style={styles.text}>Does this feel right?</p>
                        <button style={styles.primaryButton} onClick={handleConfirm}>
                            Confirm Baseline
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'EOS_PITCH') {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <h2 style={styles.heading}>Make this even better</h2>
                    <p style={styles.text}>
                        Your memories tell me who you are. But an EOS (Emotional Operating System) tells me how to talk to you—your preferred tone, how direct you want me to be, whether you like tangents or focus.
                    </p>
                    <p style={styles.text}>
                        It takes about 5 minutes to create one. It's free. And it works everywhere, not just Hearth.
                    </p>
                    <a
                        href="https://eos-app-seven.vercel.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'block', color: '#ff6b35', marginBottom: '32px', textDecoration: 'none', fontWeight: '500' }}
                    >
                        Create your EOS at eos-app-seven.vercel.app ↗
                    </a>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <button
                            style={{ ...styles.primaryButton, background: '#171717', border: '1px solid #404040' }}
                            onClick={handleSkipEos}
                        >
                            Maybe later
                        </button>
                        <button
                            style={styles.primaryButton}
                            onClick={() => setStep('PASTE_EOS')}
                        >
                            I have one
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'PASTE_EOS') {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <h2 style={styles.heading}>Paste your EOS</h2>
                    <p style={styles.text}>Paste your generated EOS below.</p>
                    <textarea
                        style={styles.textarea}
                        placeholder="Paste EOS here..."
                        value={eosText}
                        onChange={(e) => setEosText(e.target.value)}
                    />
                    <button
                        style={styles.primaryButton}
                        disabled={!eosText.trim()}
                        onClick={handleEosSubmit}
                    >
                        Save & Continue
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'READY') {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <h1 style={styles.title}>Let's begin.</h1>
                    <p style={styles.text}>
                        {eosText ? "Got it. I'll match your style." : "Your baseline is set. Hearth is ready."}
                    </p>
                    <button style={styles.primaryButton} onClick={handleFinalStart}>
                        Start First Conversation
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

// Helper for heat colors
const getHeatColor = (val) => {
    if (val >= 80) return 'linear-gradient(90deg, #ff6b35, #ef4444)';
    if (val >= 50) return 'linear-gradient(90deg, #f97316, #fb923c)';
    if (val >= 20) return '#3b82f6';
    return '#374151';
};

// Styles
const styles = {
    container: {
        minHeight: '100vh',
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: '#e5e5e5',
        fontFamily: 'Inter, sans-serif',
    },
    card: {
        background: '#262626',
        padding: '40px',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
    },
    title: {
        fontSize: '32px',
        fontWeight: '700',
        marginBottom: '16px',
        color: '#ff6b35',
    },
    heading: {
        fontSize: '24px',
        fontWeight: '600',
        marginBottom: '16px',
        color: '#fff',
    },
    subHeading: {
        fontSize: '18px',
        fontWeight: '600',
        marginBottom: '12px',
        color: '#a3a3a3',
        textAlign: 'left',
    },
    text: {
        fontSize: '16px',
        color: '#a3a3a3',
        marginBottom: '32px',
        lineHeight: '1.5',
    },
    primaryButton: {
        background: '#ff6b35',
        color: '#fff',
        border: 'none',
        padding: '14px 32px',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'transform 0.1s',
        width: '100%',
    },
    buttonGroup: {
        display: 'flex',
        gap: '16px',
        marginBottom: '32px',
    },
    choiceButton: {
        flex: 1,
        padding: '20px',
        background: '#171717',
        border: '2px solid #404040',
        borderRadius: '12px',
        color: '#fff',
        fontSize: '18px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    choiceActive: {
        borderColor: '#ff6b35',
        background: '#2a1a15',
    },
    promptBox: {
        background: '#171717',
        padding: '16px',
        borderRadius: '8px',
        textAlign: 'left',
        fontSize: '12px',
        color: '#a3a3a3',
        maxHeight: '200px',
        overflowY: 'auto',
        marginBottom: '16px',
        whiteSpace: 'pre-wrap',
        border: '1px solid #404040',
    },
    copyButton: {
        background: '#333',
        color: '#fff',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '6px',
        cursor: 'pointer',
        marginBottom: '32px',
        width: '100%',
        fontWeight: '500',
    },
    textarea: {
        width: '100%',
        height: '200px',
        background: '#171717',
        border: '1px solid #404040',
        borderRadius: '8px',
        padding: '16px',
        color: '#fff',
        fontSize: '14px',
        marginBottom: '24px',
        resize: 'none',
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '4px solid #333',
        borderTop: '4px solid #ff6b35',
        borderRadius: '50%',
        margin: '0 auto 24px',
        animation: 'spin 1s linear infinite',
    },
    mirrorGrid: {
        display: 'flex',
        gap: '32px',
        textAlign: 'left',
        marginBottom: '32px',
        height: '500px',
    },
    heatColumn: {
        flex: '0 0 250px',
        overflowY: 'auto',
        paddingRight: '10px',
    },
    memoriesColumn: {
        flex: 1,
        overflowY: 'auto',
        paddingRight: '10px',
    },
    heatList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    heatItem: {
        fontSize: '13px',
    },
    heatLabel: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '4px',
        color: '#d4d4d4',
    },
    heatTrack: {
        height: '6px',
        background: '#333',
        borderRadius: '3px',
        overflow: 'hidden',
    },
    heatFill: {
        height: '100%',
        borderRadius: '3px',
    },
    memoriesList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    memoryCard: {
        background: '#171717',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #333',
    },
    memoryContent: {
        fontSize: '14px',
        color: '#e5e5e5',
        marginBottom: '12px',
        lineHeight: '1.5',
    },
    tagRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
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
    actionRow: {
        borderTop: '1px solid #333',
        paddingTop: '24px',
        textAlign: 'center',
    },
};

// Add keyframes for spinner
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);
