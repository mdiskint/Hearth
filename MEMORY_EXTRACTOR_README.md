# Memory Extractor Implementation

## Overview

I've successfully implemented the Memory Extractor feature for Hearth, allowing users to:
1. Upload conversation history files (conversations.json)
2. Parse and extract memories from conversations
3. Review extracted memories with a nice UI
4. Check for duplicates against existing memories
5. Export approved memories to merge into memories.json
6. Switch between Chat mode and Extractor mode seamlessly

## Files Created/Modified

### 1. **src/utils/memoryDeduplication.js** (NEW)
A comprehensive utility for detecting and handling near-duplicate memories:

- **`calculateSimilarity(str1, str2)`**: Uses Levenshtein distance algorithm to compute similarity scores (0-1)
- **`areMemoriesSimilar(memory1, memory2, threshold)`**: Compares memories based on summary and content
- **`mergeMemories(memory1, memory2)`**: Intelligently merges duplicate memories, keeping the most detailed version
- **`deduplicateMemories(memories, options)`**: Main function that processes an array of memories and returns:
  - Deduplicated list
  - List of duplicates found
  - Statistics (reduction percentage, etc.)
- **`findDuplicatePairs(memories, threshold)`**: Finds all pairs of similar memories for review

**Configuration options:**
- `similarityThreshold`: How similar memories need to be (default: 0.75)
- `autoMerge`: Whether to automatically merge or return for review

### 2. **src/app/Extractor.jsx** (NEW)
A complete UI component for memory extraction:

**Features:**
- File upload interface with drag-and-drop styling
- Conversation parsing with progress indicator
- Memory extraction with domain/emotion inference
- Review mode with checkboxes for selection
- Duplicate detection integration
- Export functionality for approved memories

**Smart Inference:**
- **Domain detection**: Analyzes text for keywords related to Work, Relationships, Creative, Decisions, Resources, Self
- **Emotion detection**: Identifies emotional content (Anxiety, Joy, Pride, Love, Curiosity, etc.)
- **Intensity scoring**: Assigns baseline intensity values

**UI Flow:**
1. Upload conversations.json
2. Display count of conversations found
3. Process with live progress bar
4. Show all extracted memories in review mode
5. Allow selection/deselection
6. Check for duplicates against existing memories
7. Export selected memories as JSON

### 3. **src/app/App.jsx** (MODIFIED)
Updated main app to support mode switching:

**Changes:**
- Added `mode` state ('chat' or 'extractor')
- Created mode switcher tabs in header
- Conditional rendering of Chat vs Extractor mode
- Updated header layout with flexbox for better organization
- API key input only shows in Chat mode
- New styles for mode switcher buttons with active state

**New Styles Added:**
- `headerLeft`: Groups title and subtitle
- `modeSwitcher`: Container for mode tabs
- `modeButton`: Tab button styling
- `modeButtonActive`: Orange highlight for active mode

## Usage Flow

### For Users:

1. **Switch to Extractor Mode**
   - Click "Extractor" tab in header

2. **Upload Conversations**
   - Upload a conversations.json file
   - System shows count of conversations detected

3. **Extract Memories**
   - Click "Extract Memories" button
   - Watch progress indicator as each conversation is processed
   - Memories are extracted based on content analysis

4. **Review & Select**
   - All extracted memories displayed with checkboxes
   - Click to select/deselect individual memories
   - See domain tags (blue) and emotion tags (red)
   - All memories selected by default

5. **Check for Duplicates**
   - Click "Check Duplicates" button
   - System compares against existing memories.json
   - Shows duplicate count and reduction percentage

6. **Export**
   - Click "Export Selected" to download JSON
   - Manually merge into memories.json or replace it

7. **Return to Chat**
   - Click "Chat" tab to use Hearth with updated memories

## Technical Details

### Memory Extraction Algorithm

The extractor looks for:
- Assistant messages (responses from AI)
- First-person statements (I, my, me)
- Significant content (>50 characters)
- Structured data when available

### Deduplication Algorithm

Similarity scoring based on:
1. **Summary comparison** (primary, 75% threshold)
2. **Content comparison** (secondary, 75% threshold)
3. **Combined average** (65% threshold for borderline cases)

Merging strategy:
- Keep more detailed content
- Combine unique domains and emotions
- Take higher intensity value
- Track merged memory IDs
- Preserve earliest creation date

### Conversation Format Support

The extractor handles various JSON structures:
- Array of conversations: `[{messages: [...]}, ...]`
- Object with conversations: `{conversations: [{...}]}`
- Messages can be: `messages`, `turns`, or other arrays
- Message roles: `role` or `speaker` field

## Styling

All new components use Hearth's existing design system:
- **Dark theme**: #0f0f0f background, #171717 for cards
- **Orange accents**: #f97316 for primary actions
- **Subtle grays**: #262626, #404040, #737373
- **Blue domains**: #1e3a5f background, #60a5fa text
- **Red emotions**: #3f1f1f background, #f87171 text

## Next Steps

To complete the workflow, you could:

1. Add auto-merge option to integrate directly into memories.json
2. Implement conversation format auto-detection
3. Add manual memory editing in the review interface
4. Create a history of extraction sessions
5. Add filtering/sorting in review mode
6. Implement batch duplicate resolution UI

## Running the App

```bash
npm run dev
```

Server is running at: **http://localhost:5174/**

Access the Extractor by clicking the "Extractor" tab in the header!
