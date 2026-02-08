// opspec-modules.js - OpSpec module library and router

const OPSPEC_MODULES = [
  {
    id: 'flow_mode',
    priority: 1,
    content: 'Expand the world. Embrace tangents. Execute confidently without asking permission.',
    triggers: ['let\'s', 'build', 'do it', 'execute'],
    conflicts_with: ['stuck_mode'],
    anti_drift: 'Prevents unnecessary caution when momentum is high.'
  },
  {
    id: 'options_not_overwhelm',
    priority: 2,
    content: 'Do not overwhelm with options. Present a small set and help choose.',
    triggers: ['should i', 'which', 'recommend'],
    conflicts_with: [],
    anti_drift: 'Avoids option overload and decision paralysis.'
  },
  {
    id: 'domain_technical',
    priority: 2,
    content: 'Use step-by-step reasoning and concrete code examples. Be precise about filenames and changes.',
    triggers: ['code', 'function', '.js', '.py', '.ts', '.tsx', '.jsx', '.go', '.rs'],
    conflicts_with: [],
    anti_drift: 'Keeps responses implementation-focused and specific.'
  },
  {
    id: 'high_stakes',
    priority: 3,
    content: 'This is high-stakes. Ask before acting, show reasoning, and surface risks.',
    triggers: ['expensive', 'important', 'first time', 'critical'],
    conflicts_with: [],
    anti_drift: 'Prevents reckless execution when stakes are high.'
  }
];

function detectSignals(prompt) {
  const text = (prompt || '').toLowerCase();
  return {
    stuck: ['stuck', 'overwhelmed', 'not sure', 'confused'].some(t => text.includes(t)),
    flowing: ['let\'s', 'build', 'do it', 'execute'].some(t => text.includes(t)),
    high_stakes: ['expensive', 'important', 'first time', 'critical'].some(t => text.includes(t)),
    technical: ['code', 'function', '.js', '.py', '.ts', '.tsx', '.jsx', '.go', '.rs'].some(t => text.includes(t)),
    decision_support: ['should i', 'which', 'recommend'].some(t => text.includes(t))
  };
}

function selectModules(prompt) {
  const signals = detectSignals(prompt);
  const selected = [];

  // Always include priority 0
  for (const module of OPSPEC_MODULES) {
    if (module.priority === 0) selected.push(module);
  }

  // Momentum selection
  if (signals.flowing) {
    selected.push(OPSPEC_MODULES.find(m => m.id === 'flow_mode'));
  }

  // Domain modules
  if (signals.technical) {
    selected.push(OPSPEC_MODULES.find(m => m.id === 'domain_technical'));
  }
  if (signals.decision_support) {
    selected.push(OPSPEC_MODULES.find(m => m.id === 'options_not_overwhelm'));
  }

  // Situational modules
  if (signals.high_stakes) {
    selected.push(OPSPEC_MODULES.find(m => m.id === 'high_stakes'));
  }

  // Remove nulls and conflicts
  const deduped = [];
  const ids = new Set();
  for (const mod of selected) {
    if (!mod || ids.has(mod.id)) continue;
    ids.add(mod.id);
    deduped.push(mod);
  }

  const conflicts = new Set();
  for (const mod of deduped) {
    for (const conflict of mod.conflicts_with || []) {
      conflicts.add(conflict);
    }
  }

  return deduped.filter(mod => !conflicts.has(mod.id));
}

function assembleOpSpec(modules) {
  const sorted = [...modules].sort((a, b) => a.priority - b.priority);
  return sorted.map(m => m.content).join('\n\n');
}

function selectOpSpec(userPrompt) {
  const modules = selectModules(userPrompt);
  return assembleOpSpec(modules);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OPSPEC_MODULES, detectSignals, selectModules, assembleOpSpec, selectOpSpec };
}

if (typeof globalThis !== 'undefined') {
  globalThis.selectOpSpec = selectOpSpec;
}
