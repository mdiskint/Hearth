import React, { useState } from 'react';
import { deduplicateMemories } from '../utils/memoryDeduplication.js';

/**
 * Memory Extractor Component
 * 
 * Allows users to:
 * 1. Upload conversations.json
 * 2. Parse and extract memories
 * 3. Review extracted memories
 * 4. Deduplicate against existing memories
 * 5. Approve and merge into memories.json
 */
function Extractor() {
    const [file, setFile] = useState(null);
    const [conversations, setConversations] = useState(null);
    const [extractedMemories, setExtractedMemories] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [reviewMode, setReviewMode] = useState(false);
    const [selectedMemories, setSelectedMemories] = useState(new Set());
    const [duplicates, setDuplicates] = useState(null);
    const [error, setError] = useState(null);

    // Handle file upload
    const handleFileUpload = (e) => {
        const uploadedFile = e.target.files[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);
        setError(null);

        // Read and parse the file
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                setConversations(data);
            } catch (err) {
                setError('Invalid JSON file. Please upload a valid conversations.json file.');
            }
        };
        reader.readAsText(uploadedFile);
    };

    // Process conversations and extract memories
    const processConversations = async () => {
        if (!conversations) return;

        setProcessing(true);
        setError(null);
        const extracted = [];

        // Determine structure - could be array or object with conversations array
        const convArray = Array.isArray(conversations)
            ? conversations
            : conversations.conversations || [];

        setProgress({ current: 0, total: convArray.length });

        // Process each conversation
        for (let i = 0; i < convArray.length; i++) {
            const conv = convArray[i];

            // Simulate processing delay for UI feedback
            await new Promise(resolve => setTimeout(resolve, 100));

            // Extract memories from conversation
            const memories = extractMemoriesFromConversation(conv, i);
            extracted.push(...memories);

            setProgress({ current: i + 1, total: convArray.length });
        }

        setExtractedMemories(extracted);
        setProcessing(false);
        setReviewMode(true);

        // Select all by default
        setSelectedMemories(new Set(extracted.map((_, idx) => idx)));
    };

    // Extract memories from a single conversation
    const extractMemoriesFromConversation = (conversation, index) => {
        const memories = [];

        // Try to extract from different conversation formats
        const messages = conversation.messages || conversation.turns || [];

        // Look for assistant messages that might contain memory-worthy content
        messages.forEach((msg, msgIdx) => {
            if (msg.role === 'assistant' || msg.speaker === 'assistant') {
                // Simple heuristic: look for statements about user preferences, decisions, emotions
                const content = msg.content || msg.text || '';

                // Skip very short messages
                if (content.length < 50) return;

                // Look for first-person statements or significant content
                const hasFirstPerson = /\b(I|my|me|I'm|I've)\b/i.test(content);

                if (hasFirstPerson || content.length > 150) {
                    memories.push({
                        id: `extracted_${index}_${msgIdx}_${Date.now()}`,
                        content: content.slice(0, 300), // Truncate if too long
                        summary: content.slice(0, 80) + (content.length > 80 ? '...' : ''),
                        domains: inferDomains(content),
                        emotions: inferEmotions(content),
                        intensity: 0.6,
                        created: conversation.created_at || new Date().toISOString(),
                        last_accessed: null,
                        access_count: 0,
                        source: 'extracted',
                    });
                }
            }
        });

        return memories;
    };

    // Simple domain inference based on keywords
    const inferDomains = (text) => {
        const domains = [];
        const lower = text.toLowerCase();

        if (/\b(work|project|build|code|develop|ship)\b/.test(lower)) domains.push('Work');
        if (/\b(family|kids|wife|husband|relationship|friend)\b/.test(lower)) domains.push('Relationships');
        if (/\b(create|art|design|music|write|story)\b/.test(lower)) domains.push('Creative');
        if (/\b(decide|choice|decision|choose)\b/.test(lower)) domains.push('Decisions');
        if (/\b(money|financial|mortgage|resource|budget)\b/.test(lower)) domains.push('Resources');
        if (/\b(feel|myself|identity|personal)\b/.test(lower)) domains.push('Self');

        return domains.length > 0 ? domains : ['Self'];
    };

    // Simple emotion inference based on keywords
    const inferEmotions = (text) => {
        const emotions = [];
        const lower = text.toLowerCase();

        if (/\b(afraid|scared|worry|anxious|nervous)\b/.test(lower)) emotions.push('Anxiety');
        if (/\b(angry|mad|furious|frustrated)\b/.test(lower)) emotions.push('Anger');
        if (/\b(sad|grief|loss|mourn)\b/.test(lower)) emotions.push('Grief');
        if (/\b(happy|joy|excited|delighted)\b/.test(lower)) emotions.push('Joy');
        if (/\b(proud|accomplished|achieved)\b/.test(lower)) emotions.push('Pride');
        if (/\b(love|care|cherish|adore)\b/.test(lower)) emotions.push('Love');
        if (/\b(curious|wonder|explore|interest)\b/.test(lower)) emotions.push('Curiosity');
        if (/\b(peace|calm|serene|content)\b/.test(lower)) emotions.push('Peace');
        if (/\b(shame|embarrass|guilty)\b/.test(lower)) emotions.push('Shame');
        if (/\b(fear|terrified|dread)\b/.test(lower)) emotions.push('Fear');

        return emotions.length > 0 ? emotions : ['Peace'];
    };

    // Toggle memory selection
    const toggleMemory = (index) => {
        const newSelected = new Set(selectedMemories);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedMemories(newSelected);
    };

    // Check for duplicates against existing memories
    const checkDuplicates = async () => {
        try {
            // Load existing memories
            const response = await fetch('/memories.json');
            const existingData = await response.json();
            const existingMemories = existingData.memories || [];

            // Get selected memories
            const selected = extractedMemories.filter((_, idx) => selectedMemories.has(idx));

            // Combine and check for duplicates
            const combined = [...existingMemories, ...selected];
            const result = deduplicateMemories(combined, {
                similarityThreshold: 0.75,
                autoMerge: false,
            });

            setDuplicates(result);
        } catch (err) {
            setError('Could not load existing memories for duplicate checking.');
        }
    };

    // Export approved memories
    const exportMemories = () => {
        const selected = extractedMemories.filter((_, idx) => selectedMemories.has(idx));

        const dataStr = JSON.stringify({ memories: selected }, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'extracted-memories.json';
        link.click();

        URL.revokeObjectURL(url);
    };

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <h1 style={styles.title}>Memory Extractor</h1>
                <p style={styles.subtitle}>Extract memories from conversation history</p>

                {/* Upload Section */}
                {!conversations && (
                    <div style={styles.uploadSection}>
                        <div style={styles.uploadBox}>
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                style={styles.fileInput}
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" style={styles.uploadLabel}>
                                <div style={styles.uploadIcon}>📁</div>
                                <div>Choose conversations.json file</div>
                                <div style={styles.uploadHint}>or drag and drop</div>
                            </label>
                        </div>
                    </div>
                )}

                {/* Conversation Info */}
                {conversations && !reviewMode && (
                    <div style={styles.infoSection}>
                        <div style={styles.infoCard}>
                            <div style={styles.infoLabel}>Conversations Found</div>
                            <div style={styles.infoValue}>
                                {Array.isArray(conversations)
                                    ? conversations.length
                                    : (conversations.conversations?.length || 0)}
                            </div>
                        </div>

                        <button
                            onClick={processConversations}
                            style={styles.processButton}
                            disabled={processing}
                        >
                            {processing ? 'Processing...' : 'Extract Memories'}
                        </button>
                    </div>
                )}

                {/* Processing Progress */}
                {processing && (
                    <div style={styles.progressSection}>
                        <div style={styles.progressLabel}>
                            Processing conversation {progress.current} of {progress.total}
                        </div>
                        <div style={styles.progressBar}>
                            <div
                                style={{
                                    ...styles.progressFill,
                                    width: `${(progress.current / progress.total) * 100}%`
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Review Mode */}
                {reviewMode && (
                    <div style={styles.reviewSection}>
                        <div style={styles.reviewHeader}>
                            <div>
                                <div style={styles.reviewTitle}>
                                    {extractedMemories.length} memories extracted
                                </div>
                                <div style={styles.reviewSubtitle}>
                                    {selectedMemories.size} selected
                                </div>
                            </div>
                            <div style={styles.reviewActions}>
                                <button onClick={checkDuplicates} style={styles.checkButton}>
                                    Check Duplicates
                                </button>
                                <button onClick={exportMemories} style={styles.exportButton}>
                                    Export Selected
                                </button>
                            </div>
                        </div>

                        {/* Duplicate Info */}
                        {duplicates && (
                            <div style={styles.duplicateInfo}>
                                <strong>{duplicates.stats.duplicatesFound}</strong> potential duplicates found
                                ({duplicates.stats.reduction} reduction)
                            </div>
                        )}

                        {/* Memory List */}
                        <div style={styles.memoryList}>
                            {extractedMemories.map((memory, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        ...styles.memoryCard,
                                        ...(selectedMemories.has(idx) ? styles.memoryCardSelected : {})
                                    }}
                                    onClick={() => toggleMemory(idx)}
                                >
                                    <div style={styles.memoryHeader}>
                                        <input
                                            type="checkbox"
                                            checked={selectedMemories.has(idx)}
                                            onChange={() => toggleMemory(idx)}
                                            style={styles.checkbox}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <div style={styles.memorySummary}>{memory.summary}</div>
                                    </div>
                                    <div style={styles.memoryContent}>{memory.content}</div>
                                    <div style={styles.memoryTags}>
                                        {memory.domains?.map(d => (
                                            <span key={d} style={styles.tagDomain}>{d}</span>
                                        ))}
                                        {memory.emotions?.map(e => (
                                            <span key={e} style={styles.tagEmotion}>{e}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div style={styles.error}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}

// Styles
const styles = {
    container: {
        minHeight: '100vh',
        padding: '40px 20px',
    },
    content: {
        maxWidth: '900px',
        margin: '0 auto',
    },
    title: {
        fontSize: '32px',
        fontWeight: '700',
        color: '#f97316',
        marginBottom: '8px',
    },
    subtitle: {
        fontSize: '16px',
        color: '#737373',
        marginBottom: '40px',
    },
    uploadSection: {
        marginTop: '60px',
    },
    uploadBox: {
        border: '2px dashed #404040',
        borderRadius: '12px',
        padding: '60px 40px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
    },
    fileInput: {
        display: 'none',
    },
    uploadLabel: {
        cursor: 'pointer',
        color: '#e5e5e5',
    },
    uploadIcon: {
        fontSize: '48px',
        marginBottom: '16px',
    },
    uploadHint: {
        fontSize: '14px',
        color: '#737373',
        marginTop: '8px',
    },
    infoSection: {
        marginTop: '40px',
    },
    infoCard: {
        background: '#171717',
        padding: '24px',
        borderRadius: '12px',
        marginBottom: '24px',
    },
    infoLabel: {
        fontSize: '14px',
        color: '#737373',
        marginBottom: '8px',
    },
    infoValue: {
        fontSize: '32px',
        fontWeight: '700',
        color: '#f97316',
    },
    processButton: {
        width: '100%',
        padding: '16px',
        background: '#f97316',
        border: 'none',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    progressSection: {
        marginTop: '40px',
    },
    progressLabel: {
        fontSize: '14px',
        color: '#737373',
        marginBottom: '12px',
    },
    progressBar: {
        height: '8px',
        background: '#262626',
        borderRadius: '4px',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        background: '#f97316',
        transition: 'width 0.3s ease',
    },
    reviewSection: {
        marginTop: '40px',
    },
    reviewHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '24px',
        borderBottom: '1px solid #262626',
    },
    reviewTitle: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#e5e5e5',
    },
    reviewSubtitle: {
        fontSize: '14px',
        color: '#737373',
        marginTop: '4px',
    },
    reviewActions: {
        display: 'flex',
        gap: '12px',
    },
    checkButton: {
        padding: '10px 20px',
        background: '#262626',
        border: '1px solid #404040',
        borderRadius: '6px',
        color: '#e5e5e5',
        fontSize: '14px',
        cursor: 'pointer',
    },
    exportButton: {
        padding: '10px 20px',
        background: '#f97316',
        border: 'none',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    duplicateInfo: {
        padding: '16px',
        background: '#1e3a5f',
        borderRadius: '8px',
        marginBottom: '24px',
        color: '#e5e5e5',
    },
    memoryList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    memoryCard: {
        background: '#171717',
        padding: '16px',
        borderRadius: '8px',
        border: '2px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    memoryCardSelected: {
        borderColor: '#f97316',
        background: '#1f1711',
    },
    memoryHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '12px',
    },
    checkbox: {
        marginTop: '2px',
        cursor: 'pointer',
    },
    memorySummary: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#e5e5e5',
        flex: 1,
    },
    memoryContent: {
        fontSize: '13px',
        color: '#a3a3a3',
        lineHeight: '1.5',
        marginBottom: '12px',
        paddingLeft: '28px',
    },
    memoryTags: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        paddingLeft: '28px',
    },
    tagDomain: {
        fontSize: '11px',
        padding: '4px 10px',
        background: '#1e3a5f',
        borderRadius: '4px',
        color: '#60a5fa',
    },
    tagEmotion: {
        fontSize: '11px',
        padding: '4px 10px',
        background: '#3f1f1f',
        borderRadius: '4px',
        color: '#f87171',
    },
    error: {
        padding: '16px',
        background: '#7f1d1d',
        color: '#fecaca',
        borderRadius: '8px',
        marginTop: '20px',
    },
};

export default Extractor;
