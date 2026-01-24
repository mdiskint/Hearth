# 🔥 PHASE 2 UPDATE - MEMORY SYSTEM

## What's New

**Phase 2 adds full memory management to Hearth!**

You can now:
- ✅ Create, edit, and delete memories
- ✅ Organize memories by type (fact/value/pattern)
- ✅ Tag memories with life domains (Work, Creative, etc.)
- ✅ Tag memories with emotional states (Joy, Anxiety, etc.)
- ✅ Inject memories alongside your OpSpec
- ✅ View expandable memory cards

---

## How to Update

**If you already have Hearth installed:**

1. Go to `chrome://extensions/`
2. Find Hearth
3. Click **Remove**
4. Download the new `hearth-phase2.zip`
5. Unzip it
6. Click **Load unpacked** and select the new `hearth` folder

**Your quiz results and OpSpec will be preserved!**

**If this is a fresh install:**

Just follow the normal installation steps in QUICKSTART.md

---

## Testing the Memory System

### 1. Open the Dashboard

- Click the Hearth icon
- You should see the Dashboard (since you already completed the quiz)
- Look for the **Memories** section

### 2. Add Your First Memory

Click **"+ Add Memory"** and try adding:

**Example Memory 1:**
- Content: "I'm working on building an AI personalization system called Hearth"
- Type: Fact
- Domain: Work
- Emotion: Curiosity

**Example Memory 2:**
- Content: "I prefer direct feedback over gentle encouragement when building things"
- Type: Value
- Domain: Self
- Emotion: (leave blank)

**Example Memory 3:**
- Content: "When I'm stuck on a problem, I like to talk it through step-by-step"
- Type: Pattern
- Domain: Work
- Emotion: Anxiety

### 3. View Your Memories

- Memory cards show content and badges
- Click a card to expand it
- See domain, emotion, and type in the details
- Click Edit or Delete buttons

### 4. Test Memory Injection

1. Go to claude.ai
2. Refresh the page (important!)
3. Type a message: "What do you know about me?"
4. Before sending, open DevTools → Console
5. Send the message
6. Look for `Hearth: OpSpec injected` in console
7. **Check my response** - I should mention your memories!

---

## What You Should See

**In the injected context, your memories appear like this:**

```
[HEARTH CONTEXT]

OPERATING SPECIFICATION
[Your OpSpec]

MEMORIES
- I'm working on building an AI personalization system called Hearth [Work, Curiosity]
- I prefer direct feedback over gentle encouragement [Self]
- When I'm stuck on a problem, I like to talk it through step-by-step [Work, Anxiety]

[END HEARTH CONTEXT]
```

The AI now sees both your OpSpec AND your memories in every message.

---

## New Features Explained

### Memory Types

**Fact** - Concrete information about you
- "I'm a law student"
- "I use Claude Code for development"
- "I live in California"

**Value** - What matters to you
- "I prefer direct feedback"
- "I take creative risks but I'm conservative with money"
- "I value transparency over polish"

**Pattern** - How you think/behave
- "When stuck, I talk through problems out loud"
- "I learn by building, not reading docs"
- "I prefer starting from scratch over fixing broken code"

### 17 Dimensions

**7 Life Domains:**
Work, Relationships, Creative, Self, Decisions, Resources, Values

**10 Emotional States:**
Joy, Curiosity, Pride, Peace, Grief, Fear, Anxiety, Shame, Anger, Care

Every memory can be tagged with 1 domain + 1 emotion (optional).

### Character Limit

Memories are capped at **500 characters** to keep context manageable. The form shows a character counter as you type.

---

## What's NOT in Phase 2

These are coming in future phases:

❌ Semantic retrieval (no smart filtering yet - all memories inject)
❌ Heat-gating (no intensity matching)
❌ Memory validation states (no trust scoring)
❌ Import from chat history (placeholder button for now)
❌ Memory search/filter in UI

**Right now, ALL memories get injected every time.** In Phase 3, we'll add smart retrieval that only surfaces relevant memories.

---

## Known Issues

**Too many memories = token bloat**
- If you add 50+ memories, the injected context gets huge
- For now, keep it under ~20 memories
- Phase 3 will add smart filtering

**No memory editing in-place**
- You have to click Edit → Modal → Save
- Might add inline editing later

**Import button doesn't work yet**
- It's a placeholder for Phase 4
- Will extract memories from uploaded chat history

---

## What to Test

**Basic CRUD:**
- [ ] Add a memory
- [ ] Edit a memory
- [ ] Delete a memory
- [ ] Character counter updates as you type
- [ ] Can't save empty memory
- [ ] Can't exceed 500 characters

**Memory Display:**
- [ ] Cards show content and badges
- [ ] Click to expand shows full details
- [ ] Edit and Delete buttons work
- [ ] Empty state shows when no memories

**Injection:**
- [ ] Memories appear in injected context
- [ ] Domain and emotion tags show in brackets
- [ ] AI actually responds based on memories
- [ ] Adding/editing memory updates injection immediately

---

## Troubleshooting

**Memories not showing up in injection?**
- Refresh the claude.ai page after adding memories
- Check DevTools console for errors
- Verify "Enable context injection" is ON in settings

**Can't save memory?**
- Check that content isn't empty
- Verify it's under 500 characters
- Check console for validation errors

**Modal won't close?**
- Click the X button or Cancel
- Hit Escape key
- Refresh the extension popup

---

## What's Next?

**Phase 3: Semantic Retrieval**
- Generate embeddings for each memory
- Calculate cosine similarity to current query
- Only inject top N most relevant memories
- Add search/filter in UI

**Phase 4: Heat-Gating**
- Calculate query "heat" (intensity/stakes)
- Match memory depth to conversation stakes
- High-heat memories only surface in high-heat moments

**Phase 5: Validation**
- Track which memories prove useful
- Add trust scores (trusted/provisional/invalidated)
- Prioritize validated memories in retrieval

---

## Need Help?

**Extension not loading?**
- See QUICKSTART.md for setup steps

**Memories not working?**
- Check console logs
- Verify storage in DevTools → Application → Storage

**Found a bug?**
- Note what happened
- Check console for errors
- Report back with details

---

**Ready to test? Update the extension and add some memories!** 🔥
