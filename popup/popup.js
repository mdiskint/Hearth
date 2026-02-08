// popup.js - Quiz logic and UI controller

let currentQuestionIndex = 0;
let answers = {};
let currentMemoryFilter = 'all';
let isSignUpMode = false;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Hearth popup: Initializing...');

  // Always set up event listeners first so buttons work even if storage fails
  setupEventListeners();
  console.log('Hearth popup: Event listeners attached');

  try {
    const quizCompleted = await HearthStorage.isQuizCompleted();
    console.log('Hearth popup: Quiz completed =', quizCompleted);

    if (quizCompleted) {
      showDashboard();
    } else {
      showScreen('welcome-screen');
    }
  } catch (error) {
    console.error('Hearth popup: Init error', error);
    // Default to welcome screen if storage fails
    showScreen('welcome-screen');
  }

  // Listen for auth state changes
  if (typeof HearthAuth !== 'undefined') {
    HearthAuth.onAuthStateChange(updateAuthUI);
  }
});

function setupEventListeners() {
  // Welcome screen
  document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
  document.getElementById('skip-quiz-btn').addEventListener('click', skipQuiz);
  document.getElementById('welcome-sign-in-btn').addEventListener('click', showAuthScreen);
  
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
  document.getElementById('view-edit-opspec-btn').addEventListener('click', viewEditOpSpec);
  
  // Memory management
  document.getElementById('add-first-memory-btn').addEventListener('click', openMemoryModal);
  document.getElementById('import-memories-btn').addEventListener('click', importMemories);
  document.getElementById('close-memory-modal').addEventListener('click', closeMemoryModal);
  document.getElementById('cancel-memory-btn').addEventListener('click', closeMemoryModal);
  document.getElementById('save-memory-btn').addEventListener('click', saveMemory);
  document.getElementById('memory-content').addEventListener('input', updateCharCount);

  // Extract now button
  document.getElementById('extract-now-btn').addEventListener('click', extractNow);

  // Forge toggle
  document.getElementById('forge-toggle').addEventListener('change', toggleForge);

  // Auth
  document.getElementById('auth-submit-btn').addEventListener('click', handleAuthSubmit);
  document.getElementById('auth-toggle-btn').addEventListener('click', toggleAuthMode);
  document.getElementById('auth-skip-btn').addEventListener('click', skipAuth);
  document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);
  document.getElementById('sign-in-header-btn').addEventListener('click', showAuthScreen);

  // Allow Enter key in auth form
  document.getElementById('auth-email').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('auth-password').focus();
  });
  document.getElementById('auth-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAuthSubmit();
  });
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}

function startQuiz() {
  // Go directly to quiz - auth is optional
  currentQuestionIndex = 0;
  answers = {};
  showScreen('quiz-screen');
  renderQuestion();
}

function skipQuiz() {
  // Go directly to dashboard - auth is optional
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

  // Load Forge state
  const forgeData = await chrome.storage.local.get(['forgeEnabled']);
  document.getElementById('forge-toggle').checked = forgeData.forgeEnabled || false;

  // Update auth UI
  if (typeof HearthAuth !== 'undefined') {
    const user = await HearthAuth.getUser();
    updateAuthUI(user);
  } else {
    updateAuthUI(null);
  }

  showScreen('dashboard-screen');
}

async function toggleInjection(e) {
  await HearthStorage.updateSettings({ enabled: e.target.checked });
  showDashboard();
}

function toggleForge(e) {
  chrome.storage.local.set({ forgeEnabled: e.target.checked });
}

// ==================== AUTH ====================

function showAuthScreen() {
  isSignUpMode = false;
  updateAuthModeUI();
  clearAuthError();
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  showScreen('auth-screen');
}

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  updateAuthModeUI();
  clearAuthError();
}

function updateAuthModeUI() {
  const title = document.getElementById('auth-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleText = document.getElementById('auth-toggle-text');

  if (isSignUpMode) {
    title.textContent = 'Create Account';
    submitBtn.textContent = 'Sign Up';
    toggleText.innerHTML = 'Already have an account? <button id="auth-toggle-btn" class="btn-link">Sign In</button>';
  } else {
    title.textContent = 'Sign In';
    submitBtn.textContent = 'Sign In';
    toggleText.innerHTML = 'Don\'t have an account? <button id="auth-toggle-btn" class="btn-link">Sign Up</button>';
  }

  // Re-attach toggle listener
  document.getElementById('auth-toggle-btn').addEventListener('click', toggleAuthMode);
}

async function handleAuthSubmit() {
  console.log('Hearth: handleAuthSubmit called');
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  if (!email || !password) {
    showAuthError('Please enter email and password');
    return;
  }

  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters');
    return;
  }

  const submitBtn = document.getElementById('auth-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = isSignUpMode ? 'Creating account...' : 'Signing in...';

  try {
    console.log('Hearth: Calling HearthAuth...', typeof HearthAuth);
    if (typeof HearthAuth === 'undefined') {
      showAuthError('Auth service not available. Please reload the extension.');
      submitBtn.disabled = false;
      submitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
      return;
    }

    let result;
    if (isSignUpMode) {
      result = await HearthAuth.signUp(email, password);
      console.log('Hearth: signUp result', result);
      if (result.needsConfirmation) {
        showAuthError('Check your email to confirm your account, then sign in.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
        isSignUpMode = false;
        updateAuthModeUI();
        return;
      }
    } else {
      result = await HearthAuth.signIn(email, password);
      console.log('Hearth: signIn result', result);
    }

    if (result.error) {
      console.log('Hearth: Auth error', result.error);
      showAuthError(result.error);
      submitBtn.disabled = false;
      submitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
      return;
    }

    // Success - proceed with pending action
    console.log('Hearth: Auth success, proceeding...');
    await proceedAfterAuth();
  } catch (error) {
    console.error('Hearth: handleAuthSubmit error', error);
    showAuthError(error.message || 'Authentication failed');
    submitBtn.disabled = false;
    submitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
  }
}

async function skipAuth() {
  // Clear pending action and proceed without auth
  const data = await chrome.storage.local.get(['pendingAction']);
  await chrome.storage.local.remove(['pendingAction']);

  if (data.pendingAction === 'startQuiz') {
    startQuiz();
  } else {
    showDashboard();
  }
}

async function proceedAfterAuth() {
  console.log('Hearth: proceedAfterAuth called');
  const data = await chrome.storage.local.get(['pendingAction']);
  await chrome.storage.local.remove(['pendingAction']);
  console.log('Hearth: pendingAction was', data.pendingAction);

  if (data.pendingAction === 'startQuiz') {
    startQuiz();
  } else {
    showDashboard();
  }
}

async function handleSignOut() {
  if (typeof HearthAuth !== 'undefined') {
    await HearthAuth.signOut();
  }
  updateAuthUI(null);
}

function showAuthError(message) {
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearAuthError() {
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
}

function updateAuthUI(user) {
  console.log('Hearth: updateAuthUI called, user =', user?.email || 'null');

  const userIndicator = document.getElementById('user-indicator');
  const signInBtn = document.getElementById('sign-in-header-btn');
  const userAvatar = document.getElementById('user-avatar');

  if (user) {
    // User is signed in - show user indicator, hide sign-in button
    userIndicator.classList.remove('hidden');
    signInBtn.classList.add('hidden');

    // Set avatar to first letter of email
    const initial = user.email ? user.email[0].toUpperCase() : '?';
    userAvatar.textContent = initial;
    userAvatar.title = user.email;
    console.log('Hearth: Showing signed-in UI for', user.email);
  } else {
    // User is signed out - hide user indicator, show sign-in button
    userIndicator.classList.add('hidden');
    signInBtn.classList.remove('hidden');
    console.log('Hearth: Showing signed-out UI');
  }
}

// Memory Management
let currentEditingMemoryId = null;

async function loadMemories() {
  let memories = await HearthStorage.getMemories();
  const memoryList = document.getElementById('memory-list');
  const emptyState = document.getElementById('memory-empty-state');

  // Apply filter by memory_class (new schema)
  if (currentMemoryFilter !== 'all') {
    memories = memories.filter(m => m.memory_class === currentMemoryFilter);
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

  // Use new schema field names (content, memory_class, created_at)
  const memoryClass = memory.memory_class || 'fact';
  const typeBadge = `<span class="memory-badge type-${memoryClass}">${memoryClass}</span>`;
  const sourceBadge = `<span class="memory-badge source-${memory.source}">${memory.source}</span>`;

  // Format date - use created_at (new schema)
  const createdDate = memory.created_at ? new Date(memory.created_at).toLocaleDateString() : '';

  // Heat indicator
  const heat = memory.heat ?? 0.5;
  const heatPercent = Math.round(heat * 100);

  card.innerHTML = `
    <div class="memory-header">
      <div class="memory-text">${memory.content || ''}</div>
      <div class="memory-badges">
        ${typeBadge}
        ${sourceBadge}
      </div>
    </div>
    <div class="memory-details">
      <div class="memory-meta">
        <div class="memory-meta-item"><span class="memory-meta-label">Class:</span> ${memoryClass}</div>
        <div class="memory-meta-item"><span class="memory-meta-label">Heat:</span> ${heatPercent}%</div>
        <div class="memory-meta-item"><span class="memory-meta-label">Created:</span> ${createdDate}</div>
      </div>
      <div class="memory-actions">
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

  if (editMemory) {
    title.textContent = 'Edit Memory';
    currentEditingMemoryId = editMemory.id;
    // Use new schema field names (content, memory_class)
    document.getElementById('memory-content').value = editMemory.content || '';
    document.getElementById('memory-type').value = editMemory.memory_class || 'fact';
  } else {
    title.textContent = 'Add Memory';
    currentEditingMemoryId = null;
    document.getElementById('memory-content').value = '';
    document.getElementById('memory-type').value = 'fact';
  }

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
  const memoryClass = document.getElementById('memory-type').value; // 'fact' or 'pattern'

  if (!content) {
    alert('Please enter memory content');
    return;
  }

  if (content.length > 500) {
    alert('Memory content cannot exceed 500 characters');
    return;
  }

  // Use new schema field names
  const memory = {
    content,
    memory_class: memoryClass,
    type: memoryClass, // type mirrors memory_class for now
    source: 'manual'
  };

  try {
    if (currentEditingMemoryId) {
      await HearthStorage.updateMemory(currentEditingMemoryId, { content, memory_class: memoryClass });
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