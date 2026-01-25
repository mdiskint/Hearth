// popup.js - Quiz logic and UI controller

let currentQuestionIndex = 0;
let answers = {};
let currentMemoryFilter = 'all';

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  const quizCompleted = await HearthStorage.isQuizCompleted();
  
  if (quizCompleted) {
    showDashboard();
  } else {
    showScreen('welcome-screen');
  }
  
  setupEventListeners();
});

function setupEventListeners() {
  // Welcome screen
  document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
  document.getElementById('skip-quiz-btn').addEventListener('click', skipQuiz);
  
  // Quiz navigation
  document.getElementById('back-btn').addEventListener('click', previousQuestion);
  document.getElementById('next-btn').addEventListener('click', nextQuestion);
  
  // Result screen
  document.getElementById('toggle-opspec-btn').addEventListener('click', toggleOpSpec);
  document.getElementById('start-using-btn').addEventListener('click', finishQuiz);
  document.getElementById('retake-quiz-btn').addEventListener('click', retakeQuiz);
  document.getElementById('edit-opspec-btn').addEventListener('click', editOpSpec);
  
  // Dashboard
  document.getElementById('retake-quiz-dashboard-btn').addEventListener('click', retakeQuiz);
  document.getElementById('enable-injection-toggle').addEventListener('change', toggleInjection);
  document.getElementById('visible-injection-toggle').addEventListener('change', toggleVisibility);
  document.getElementById('view-edit-opspec-btn').addEventListener('click', viewEditOpSpec);
  
  // Memory management
  document.getElementById('add-memory-btn').addEventListener('click', openMemoryModal);
  document.getElementById('add-first-memory-btn').addEventListener('click', openMemoryModal);
  document.getElementById('import-memories-btn').addEventListener('click', importMemories);
  document.getElementById('close-memory-modal').addEventListener('click', closeMemoryModal);
  document.getElementById('cancel-memory-btn').addEventListener('click', closeMemoryModal);
  document.getElementById('save-memory-btn').addEventListener('click', saveMemory);
  document.getElementById('memory-content').addEventListener('input', updateCharCount);

  // Heat slider
  document.getElementById('memory-heat').addEventListener('input', updateHeatValue);
document.getElementById('extract-now-btn').addEventListener('click', extractNow);
  document.getElementById('extract-now-header-btn').addEventListener('click', extractNow);

  // Memory type change (show/hide reward fields)
  document.getElementById('memory-type').addEventListener('change', onMemoryTypeChange);

  // Memory filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentMemoryFilter = e.target.dataset.filter;
      loadMemories();
    });
  });
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}

function startQuiz() {
  currentQuestionIndex = 0;
  answers = {};
  showScreen('quiz-screen');
  renderQuestion();
}

function skipQuiz() {
  // Use default OpSpec
  showDashboard();
}

function renderQuestion() {
  const question = QUIZ_QUESTIONS[currentQuestionIndex];
  const totalQuestions = QUIZ_QUESTIONS.length;
  
  // Update progress
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
  document.getElementById('progress-fill').style.width = `${progress}%`;
  document.getElementById('current-question').textContent = currentQuestionIndex + 1;
  document.getElementById('total-questions').textContent = totalQuestions;
  
  // Update section label
  const sectionLabels = {
    'identity': 'Section 1: Identity',
    'communication': 'Section 2: Communication',
    'execution': 'Section 3: Execution',
    'preferences': 'Section 4: Preferences',
    'dealbreakers': 'Section 4: Dealbreakers'
  };
  document.getElementById('section-label').textContent = sectionLabels[question.section] || '';
  
  // Update question text
  document.getElementById('question-text').textContent = question.text;
  document.getElementById('question-instruction').textContent = question.instruction || '';
  
  // Render answers based on type
  const container = document.getElementById('answers-container');
  container.innerHTML = '';
  
  if (question.type === 'single') {
    renderSingleChoice(question, container);
  } else if (question.type === 'multi') {
    renderMultiChoice(question, container);
  } else if (question.type === 'pairs') {
    renderPairs(question, container);
  }
  
  // Update navigation buttons
  document.getElementById('back-btn').disabled = currentQuestionIndex === 0;
  updateNextButton();
}

function renderSingleChoice(question, container) {
  question.answers.forEach(answer => {
    const option = document.createElement('div');
    option.className = 'answer-option';
    option.dataset.questionId = question.id;
    option.dataset.answerId = answer.id;
    
    if (answers[question.id] === answer.id) {
      option.classList.add('selected');
    }
    
    option.innerHTML = `
      <span class="emoji">${answer.emoji}</span>
      <span class="text">${answer.text}</span>
    `;
    
    option.addEventListener('click', () => {
      answers[question.id] = answer.id;
      document.querySelectorAll(`[data-question-id="${question.id}"]`).forEach(el => {
        el.classList.remove('selected');
      });
      option.classList.add('selected');
      updateNextButton();
    });
    
    container.appendChild(option);
  });
}

function renderMultiChoice(question, container) {
  question.answers.forEach(answer => {
    const option = document.createElement('div');
    option.className = 'answer-option';
    option.dataset.questionId = question.id;
    option.dataset.answerId = answer.id;
    
    const currentAnswers = answers[question.id] || [];
    if (currentAnswers.includes(answer.id)) {
      option.classList.add('selected');
    }
    
    option.innerHTML = `
      <span class="emoji">${answer.emoji}</span>
      <span class="text">${answer.text}</span>
    `;
    
    option.addEventListener('click', () => {
      if (!answers[question.id]) {
        answers[question.id] = [];
      }
      
      const index = answers[question.id].indexOf(answer.id);
      if (index > -1) {
        answers[question.id].splice(index, 1);
        option.classList.remove('selected');
      } else {
        // Check max selections
        if (question.maxSelections && answers[question.id].length >= question.maxSelections) {
          alert(`You can only select ${question.maxSelections} options for this question.`);
          return;
        }
        answers[question.id].push(answer.id);
        option.classList.add('selected');
      }
      
      updateNextButton();
    });
    
    container.appendChild(option);
  });
}

function renderPairs(question, container) {
  if (!answers[question.id]) {
    answers[question.id] = {};
  }
  
  question.pairs.forEach(pair => {
    const row = document.createElement('div');
    row.className = 'pair-row';
    
    const leftOption = createPairOption(question.id, pair.id, 'A', pair.left);
    const rightOption = createPairOption(question.id, pair.id, 'B', pair.right);
    
    row.appendChild(leftOption);
    row.appendChild(rightOption);
    container.appendChild(row);
  });
}

function createPairOption(questionId, pairId, side, data) {
  const option = document.createElement('div');
  option.className = 'pair-option';
  option.dataset.pairId = pairId;
  option.dataset.side = side;
  
  if (answers[questionId][pairId] === side) {
    option.classList.add('selected');
  }
  
  option.innerHTML = `
    <span class="emoji">${data.emoji}</span>
    <span class="text">${data.text}</span>
  `;
  
  option.addEventListener('click', () => {
    answers[questionId][pairId] = side;
    document.querySelectorAll(`[data-pair-id="${pairId}"]`).forEach(el => {
      el.classList.remove('selected');
    });
    option.classList.add('selected');
    updateNextButton();
  });
  
  return option;
}

function updateNextButton() {
  const question = QUIZ_QUESTIONS[currentQuestionIndex];
  const nextBtn = document.getElementById('next-btn');
  
  let isAnswered = false;
  
  if (question.type === 'single') {
    isAnswered = !!answers[question.id];
  } else if (question.type === 'multi') {
    isAnswered = answers[question.id] && answers[question.id].length > 0;
  } else if (question.type === 'pairs') {
    isAnswered = answers[question.id] && 
                 Object.keys(answers[question.id]).length === question.pairs.length;
  }
  
  nextBtn.disabled = !isAnswered;
}

function previousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion();
  }
}

function nextQuestion() {
  if (currentQuestionIndex < QUIZ_QUESTIONS.length - 1) {
    currentQuestionIndex++;
    renderQuestion();
  } else {
    // Quiz complete!
    completeQuiz();
  }
}

async function completeQuiz() {
  // Generate OpSpec from answers
  const opspec = OpSpecGenerator.generate(answers);
  const profile = OpSpecGenerator.buildProfile(answers);
  const summary = OpSpecGenerator.generateSummary(opspec, profile);
  
  // Save to storage
  await HearthStorage.saveQuizAnswers(answers);
  await HearthStorage.saveOpSpec(opspec);
  
  // Show result screen
  showResult(opspec, summary);
}

function showResult(opspec, summary) {
  // Set archetype
  document.getElementById('archetype-title').textContent = summary.archetype;
  document.getElementById('archetype-subtitle').textContent = "Here's how I'll work with you:";
  
  // Set highlights
  const highlightsList = document.getElementById('highlights-list');
  highlightsList.innerHTML = '';
  summary.highlights.forEach(highlight => {
    const item = document.createElement('div');
    item.className = 'highlight-item';
    item.innerHTML = `
      <span class="icon">${highlight.icon}</span>
      <span class="text">${highlight.text}</span>
    `;
    highlightsList.appendChild(item);
  });
  
  // Set full OpSpec
  document.getElementById('opspec-identity').textContent = opspec.identity;
  document.getElementById('opspec-communication').textContent = opspec.communication;
  document.getElementById('opspec-execution').textContent = opspec.execution;
  document.getElementById('opspec-balance').textContent = opspec.balanceProtocol || opspec.balanceCheck || '';
  
  const constraintsList = document.getElementById('opspec-constraints');
  constraintsList.innerHTML = '';
  opspec.constraints.forEach(constraint => {
    const li = document.createElement('li');
    li.textContent = constraint;
    constraintsList.appendChild(li);
  });
  
  showScreen('result-screen');
}

function toggleOpSpec() {
  const fullOpSpec = document.getElementById('opspec-full');
  const toggleBtn = document.getElementById('toggle-opspec-btn');
  
  if (fullOpSpec.classList.contains('hidden')) {
    fullOpSpec.classList.remove('hidden');
    toggleBtn.textContent = 'Hide Full Operating Specification ▲';
  } else {
    fullOpSpec.classList.add('hidden');
    toggleBtn.textContent = 'See Full Operating Specification ▼';
  }
}

async function finishQuiz() {
  await HearthStorage.saveQuizAnswers(answers);
  showDashboard();
}

async function retakeQuiz() {
  const confirmed = confirm('This will reset your quiz answers and generate a new Operating Specification. Continue?');
  if (confirmed) {
    startQuiz();
  }
}

function editOpSpec() {
  // TODO: Phase 2 - Add OpSpec editor
  alert('OpSpec editor coming soon! For now, retake the quiz to generate a new one.');
}

async function viewEditOpSpec() {
  const opspec = await HearthStorage.getOpSpec();

  // Create modal dynamically
  const existingModal = document.getElementById('opspec-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'opspec-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-height: 90vh; overflow-y: auto;">
      <div class="modal-header">
        <h3>Operating Specification</h3>
        <button class="close-btn" onclick="document.getElementById('opspec-modal').classList.add('hidden')">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="opspec-cognitive-edit">Cognitive Architecture (The Internal Council)</label>
          <textarea id="opspec-cognitive-edit" rows="6" style="width: 100%;">${opspec.cognitiveArchitecture || ''}</textarea>
        </div>
        <div class="form-group">
          <label for="opspec-identity-edit">Identity</label>
          <textarea id="opspec-identity-edit" rows="4" style="width: 100%;">${opspec.identity || ''}</textarea>
        </div>
        <div class="form-group">
          <label for="opspec-communication-edit">Communication Style</label>
          <textarea id="opspec-communication-edit" rows="2" style="width: 100%;">${opspec.communication || ''}</textarea>
        </div>
        <div class="form-group">
          <label for="opspec-execution-edit">Execution</label>
          <textarea id="opspec-execution-edit" rows="3" style="width: 100%;">${opspec.execution || ''}</textarea>
        </div>
        <div class="form-group">
          <label for="opspec-constraints-edit">Constraints (one per line)</label>
          <textarea id="opspec-constraints-edit" rows="8" style="width: 100%;">${(opspec.constraints || []).join('\n')}</textarea>
        </div>
        <div class="form-group">
          <label for="opspec-balance-protocol-edit">Balance Protocol</label>
          <textarea id="opspec-balance-protocol-edit" rows="6" style="width: 100%;">${opspec.balanceProtocol || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="document.getElementById('opspec-modal').classList.add('hidden')">Cancel</button>
        <button class="btn-primary" onclick="saveOpSpecFromModal()">Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

async function saveOpSpecFromModal() {
  const opspec = {
    cognitiveArchitecture: document.getElementById('opspec-cognitive-edit').value.trim(),
    identity: document.getElementById('opspec-identity-edit').value.trim(),
    communication: document.getElementById('opspec-communication-edit').value.trim(),
    execution: document.getElementById('opspec-execution-edit').value.trim(),
    constraints: document.getElementById('opspec-constraints-edit').value.trim().split('\n').filter(c => c.trim()),
    balanceProtocol: document.getElementById('opspec-balance-protocol-edit').value.trim()
  };

  try {
    await HearthStorage.saveOpSpec(opspec);
    document.getElementById('opspec-modal').classList.add('hidden');
    showDashboard();
  } catch (error) {
    alert('Error saving OpSpec: ' + error.message);
  }
}

async function showDashboard() {
  const opspec = await HearthStorage.getOpSpec();
  const settings = await HearthStorage.getSettings();

  // Show summary
  const summary = document.getElementById('dashboard-opspec-summary');
  const identity = opspec.identity || '';
  summary.textContent = identity.length > 120 ? `${identity.substring(0, 120)}...` : identity;
  
  // Set toggles
  document.getElementById('enable-injection-toggle').checked = settings.enabled;
  document.getElementById('visible-injection-toggle').checked = settings.injectionVisible;
  
  // Update status indicator
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('.status-indicator span:last-child');
  if (settings.enabled) {
    statusDot.classList.add('active');
    statusText.textContent = 'Active';
  } else {
    statusDot.classList.remove('active');
    statusText.textContent = 'Inactive';
  }
  
  // Load memories
  await loadMemories();
  
  showScreen('dashboard-screen');
}

async function toggleInjection(e) {
  await HearthStorage.updateSettings({ enabled: e.target.checked });
  showDashboard();
}

async function toggleVisibility(e) {
  await HearthStorage.updateSettings({ injectionVisible: e.target.checked });
}

// Memory Management
let currentEditingMemoryId = null;

async function loadMemories() {
  let memories = await HearthStorage.getMemories();
  const memoryList = document.getElementById('memory-list');
  const emptyState = document.getElementById('memory-empty-state');

  // Apply filter
  if (currentMemoryFilter !== 'all') {
    memories = memories.filter(m => m.type === currentMemoryFilter);
  }

  if (memories.length === 0) {
    emptyState.classList.remove('hidden');
    memoryList.innerHTML = '';
  } else {
    emptyState.classList.add('hidden');
    renderMemoryList(memories);
  }
}

function renderMemoryList(memories) {
  const memoryList = document.getElementById('memory-list');
  memoryList.innerHTML = '';
  
  memories.forEach(memory => {
    const card = createMemoryCard(memory);
    memoryList.appendChild(card);
  });
}

function createMemoryCard(memory) {
  const card = document.createElement('div');
  card.className = 'memory-card';
  card.dataset.memoryId = memory.id;

  // Validation state indicator
  const validationState = memory.validation?.state || 'untested';
  const validationIcon = {
    'validated': '✓',
    'untested': '?',
    'invalidated': '✗'
  }[validationState];
  const validationClass = `validation-${validationState}`;

  // Heat indicator (visual bar)
  const heat = memory.heat ?? 0.5;
  const heatPercent = Math.round(heat * 100);

  const typeBadge = `<span class="memory-badge type-${memory.type}">${memory.type}</span>`;
  const domainBadge = memory.domain ? `<span class="memory-badge">${memory.domain}</span>` : '';
  const validationBadge = `<span class="memory-badge ${validationClass}">${validationIcon}</span>`;

  card.innerHTML = `
    <div class="memory-header">
      <div class="memory-content">${memory.content}</div>
      <div class="memory-badges">
        ${validationBadge}
        ${typeBadge}
        ${domainBadge}
      </div>
    </div>
    <div class="memory-details">
      <div class="memory-meta">
        ${memory.domain ? `<div class="memory-meta-item"><span class="memory-meta-label">Domain:</span> ${memory.domain}</div>` : ''}
        ${memory.emotion ? `<div class="memory-meta-item"><span class="memory-meta-label">Emotion:</span> ${memory.emotion}</div>` : ''}
        <div class="memory-meta-item"><span class="memory-meta-label">Type:</span> ${memory.type}</div>
        <div class="memory-meta-item"><span class="memory-meta-label">Heat:</span> ${heatPercent}%</div>
        <div class="memory-meta-item"><span class="memory-meta-label">Status:</span> ${validationState}</div>
        ${memory.parentId ? `<div class="memory-meta-item"><span class="memory-meta-label">Linked to:</span> ${memory.parentId}</div>` : ''}
        ${memory.outcome ? `<div class="memory-meta-item"><span class="memory-meta-label">Outcome:</span> ${memory.outcome}</div>` : ''}
      </div>
      <div class="heat-bar">
        <div class="heat-fill" style="width: ${heatPercent}%"></div>
      </div>
      <div class="memory-actions">
        <button class="btn-success btn-small validate-memory-btn" data-id="${memory.id}" title="Mark as validated">✓</button>
        <button class="btn-warning btn-small invalidate-memory-btn" data-id="${memory.id}" title="Mark as invalidated">✗</button>
        <button class="btn-secondary btn-small edit-memory-btn" data-id="${memory.id}">Edit</button>
        <button class="btn-danger btn-small delete-memory-btn" data-id="${memory.id}">Delete</button>
      </div>
    </div>
  `;

  // Toggle expand on click
  card.addEventListener('click', (e) => {
    if (!e.target.classList.contains('btn-small')) {
      card.classList.toggle('expanded');
    }
  });

  // Validate button
  card.querySelector('.validate-memory-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    validateMemory(memory.id);
  });

  // Invalidate button
  card.querySelector('.invalidate-memory-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    invalidateMemory(memory.id);
  });

  // Edit button
  card.querySelector('.edit-memory-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    editMemory(memory.id);
  });

  // Delete button
  card.querySelector('.delete-memory-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteMemory(memory.id);
  });

  return card;
}

async function openMemoryModal(editMemory = null) {
  const modal = document.getElementById('memory-modal');
  const title = document.getElementById('memory-modal-title');

  // Populate value memories for reward linking
  await populateValueMemories();

  if (editMemory) {
    title.textContent = 'Edit Memory';
    currentEditingMemoryId = editMemory.id;
    document.getElementById('memory-content').value = editMemory.content;
    document.getElementById('memory-type').value = editMemory.type;
    document.getElementById('memory-heat').value = editMemory.heat ?? 0.5;
    document.getElementById('heat-value').textContent = editMemory.heat ?? 0.5;
    document.getElementById('memory-domain').value = editMemory.domain || '';
    document.getElementById('memory-emotion').value = editMemory.emotion || '';
    document.getElementById('memory-parent').value = editMemory.parentId || '';
    document.getElementById('memory-outcome').value = editMemory.outcome || '';
  } else {
    title.textContent = 'Add Memory';
    currentEditingMemoryId = null;
    document.getElementById('memory-content').value = '';
    document.getElementById('memory-type').value = 'fact';
    document.getElementById('memory-heat').value = 0.5;
    document.getElementById('heat-value').textContent = '0.5';
    document.getElementById('memory-domain').value = '';
    document.getElementById('memory-emotion').value = '';
    document.getElementById('memory-parent').value = '';
    document.getElementById('memory-outcome').value = '';
  }

  // Show/hide reward fields based on type
  onMemoryTypeChange();
  updateCharCount();
  modal.classList.remove('hidden');
}

function closeMemoryModal() {
  const modal = document.getElementById('memory-modal');
  modal.classList.add('hidden');
  currentEditingMemoryId = null;
}

async function saveMemory() {
  const content = document.getElementById('memory-content').value.trim();
  const type = document.getElementById('memory-type').value;
  const heat = parseFloat(document.getElementById('memory-heat').value);
  const domain = document.getElementById('memory-domain').value;
  const emotion = document.getElementById('memory-emotion').value;
  const parentId = document.getElementById('memory-parent').value;
  const outcome = document.getElementById('memory-outcome').value;

  if (!content) {
    alert('Please enter memory content');
    return;
  }

  if (content.length > 500) {
    alert('Memory content cannot exceed 500 characters');
    return;
  }

  const memory = {
    content,
    type,
    heat,
    domain: domain || null,
    emotion: emotion || null,
    parentId: parentId || null,
    outcome: outcome || null
  };

  try {
    if (currentEditingMemoryId) {
      await HearthStorage.updateMemory(currentEditingMemoryId, memory);
    } else {
      await HearthStorage.saveMemory(memory);
    }

    closeMemoryModal();
    await loadMemories();
  } catch (error) {
    alert(`Error saving memory: ${error.message}`);
  }
}

async function editMemory(id) {
  const memories = await HearthStorage.getMemories();
  const memory = memories.find(m => m.id === id);
  if (memory) {
    openMemoryModal(memory);
  }
}

async function deleteMemory(id) {
  if (confirm('Are you sure you want to delete this memory?')) {
    await HearthStorage.deleteMemory(id);
    await loadMemories();
  }
}

function updateCharCount() {
  const content = document.getElementById('memory-content').value;
  document.getElementById('char-count').textContent = content.length;
}

function importMemories() {
  handleImportClick();
}

// Handle import button click - opens file picker
function handleImportClick() {
  // Create hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Show progress indicator
      showImportProgress('Reading file...');

      // Read file contents
      const text = await file.text();
      const jsonData = JSON.parse(text);

      // Process the import
      await processImport(jsonData);

    } catch (error) {
      console.error('Import error:', error);
      showImportError(`Import failed: ${error.message}`);
    }
  });

  // Trigger file picker
  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
}

// Process imported JSON data
async function processImport(jsonData) {
  try {
    showImportProgress('Parsing conversations...');

    // Parse the Claude export format
    const conversations = parseClaudeExport(jsonData);

    if (conversations.length === 0) {
      showImportError('No conversations found in the file.');
      return;
    }

    const batchCount = conversations.length; // BATCH_SIZE = 1
    showImportProgress(`Found ${conversations.length} conversations. Processing in ${batchCount} batches...`);

    // Extract and save memories using Claude API (with batch processing)
    // Memories are saved immediately as each batch completes
    const savedCount = await extractMemories(conversations);

    if (savedCount === 0) {
      showImportError('No memories could be extracted from the conversations.');
      return;
    }

    // Show success message
    showImportSuccess(`Imported ${savedCount} memories successfully!`);

    // Refresh the memory list
    await loadMemories();

  } catch (error) {
    console.error('Process import error:', error);
    showImportError(`Processing failed: ${error.message}`);
  }
}

// Show import progress indicator
function showImportProgress(message) {
  const progressDiv = document.getElementById('import-progress');
  const statusDiv = document.getElementById('import-status');

  if (progressDiv) {
    progressDiv.classList.remove('hidden');
    progressDiv.querySelector('.progress-spinner')?.classList.remove('hidden');
  }
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = 'import-status';
  }
}

// Update import progress message (called from memoryExtractor.js)
function updateImportProgress(message) {
  const statusDiv = document.getElementById('import-status');
  if (statusDiv) {
    statusDiv.textContent = message;
  }
  console.log('Hearth UI:', message);
}

// Show import error
function showImportError(message) {
  const progressDiv = document.getElementById('import-progress');
  const statusDiv = document.getElementById('import-status');

  if (progressDiv) {
    progressDiv.querySelector('.progress-spinner')?.classList.add('hidden');
  }
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = 'import-status error';
  }

  // Hide after 5 seconds
  setTimeout(() => {
    if (progressDiv) progressDiv.classList.add('hidden');
  }, 5000);
}

// Show import success
function showImportSuccess(message) {
  const progressDiv = document.getElementById('import-progress');
  const statusDiv = document.getElementById('import-status');

  if (progressDiv) {
    progressDiv.querySelector('.progress-spinner')?.classList.add('hidden');
  }
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = 'import-status success';
  }

  // Hide after 3 seconds
  setTimeout(() => {
    if (progressDiv) progressDiv.classList.add('hidden');
  }, 3000);
}

// Heat slider update
function updateHeatValue() {
  const heat = document.getElementById('memory-heat').value;
  document.getElementById('heat-value').textContent = heat;
}

// Show/hide reward-specific fields based on memory type
function onMemoryTypeChange() {
  const type = document.getElementById('memory-type').value;
  const rewardFields = document.getElementById('reward-fields');

  if (type === 'reward') {
    rewardFields.classList.remove('hidden');
  } else {
    rewardFields.classList.add('hidden');
  }
}

// Populate value memories dropdown for reward linking
async function populateValueMemories() {
  const valueMemories = await HearthStorage.getMemoriesByType('value');
  const select = document.getElementById('memory-parent');

  // Keep the first option, clear the rest
  select.innerHTML = '<option value="">Select a value memory...</option>';

  valueMemories.forEach(memory => {
    const option = document.createElement('option');
    option.value = memory.id;
    option.textContent = memory.content.substring(0, 50) + (memory.content.length > 50 ? '...' : '');
    select.appendChild(option);
  });
}

// Validate a memory
async function validateMemory(id) {
  try {
    await HearthStorage.validateMemory(id);
    await loadMemories();
  } catch (error) {
    alert(`Error validating memory: ${error.message}`);
  }
}

// Invalidate a memory
async function invalidateMemory(id) {
  try {
    await HearthStorage.invalidateMemory(id);
    await loadMemories();
  } catch (error) {
    alert(`Error invalidating memory: ${error.message}`);
  }
}
async function extractNow() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      alert('No active tab found');
      return;
    }
    const supportedPlatforms = ['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com'];
    const url = new URL(tab.url);
    if (!supportedPlatforms.some(platform => url.hostname.includes(platform))) {
      alert('Please navigate to ChatGPT, Claude, or Gemini to extract memories');
      return;
    }
    await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_NOW' });
    const btns = [
      document.getElementById('extract-now-btn'),
      document.getElementById('extract-now-header-btn')
    ].filter(Boolean);
    btns.forEach(btn => {
      btn.textContent = '⚡ Extracting...';
      btn.disabled = true;
    });
    setTimeout(() => {
      btns.forEach(btn => {
        btn.textContent = '⚡ Extract Now';
        btn.disabled = false;
      });
    }, 2000);
  } catch (error) {
    console.error('Extract Now error:', error);
    alert('Error triggering extraction. Make sure you have an active conversation.');
  }
}