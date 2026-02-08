// This script runs in the page context to intercept fetch calls
(function () {
  'use strict';

  // Data received from injector.js
  let hearthData = null;
  let manifestCache = null;
  let manifestLastLoaded = 0;
  const nativeFetch = window.fetch.bind(window);
  function isClaudeHost(url) {
    return url.includes('anthropic.com') || url.includes('claude.ai');
  }

  const selectOpSpec = globalThis.selectOpSpec;

  const MANIFEST_LOCALSTORAGE_KEY = 'hearth_manifest';
  const MANIFEST_URL = 'hearth-manifest.json';
  const MANIFEST_TTL_MS = 30 * 1000;

  function debugRetrieval(...args) {
    if (window.__HEARTH_DEBUG_RETRIEVAL__) {
      console.log(...args);
    }
  }

  function parseManifestJson(raw, sourceLabel) {
    if (!raw || typeof raw !== 'string') return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        parsed.__source = sourceLabel;
        return parsed;
      }
    } catch (e) {
      debugRetrieval('Hearth: Manifest parse failed', sourceLabel, e.message);
    }
    return null;
  }

  function getManifestFromLocalStorage() {
    try {
      const raw = localStorage.getItem(MANIFEST_LOCALSTORAGE_KEY);
      return parseManifestJson(raw, 'localStorage');
    } catch (e) {
      debugRetrieval('Hearth: Manifest localStorage read failed', e.message);
      return null;
    }
  }

  async function getManifestFromFile() {
    try {
      const response = await nativeFetch(MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) return null;
      const text = await response.text();
      return parseManifestJson(text, 'file');
    } catch (e) {
      debugRetrieval('Hearth: Manifest file load failed', e.message);
      return null;
    }
  }

  async function loadManifest() {
    const now = Date.now();
    if (manifestCache && (now - manifestLastLoaded) < MANIFEST_TTL_MS) {
      return manifestCache;
    }

    const fromLocal = getManifestFromLocalStorage();
    if (fromLocal) {
      manifestCache = fromLocal;
      manifestLastLoaded = now;
      return manifestCache;
    }

    const fromFile = await getManifestFromFile();
    if (fromFile) {
      manifestCache = fromFile;
      manifestLastLoaded = now;
      return manifestCache;
    }

    manifestCache = null;
    manifestLastLoaded = now;
    return null;
  }

  function isClaudeUrl(url) {
    return url.includes('claude.ai') || url.includes('/completion') || url.includes('/chat_conversations/');
  }

  /* GUTTED - MEMORY */

  // Listen for data via postMessage (CSP-safe)
  let retrievalInitialized = false;
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'HEARTH_DATA') {
      hearthData = event.data;
      console.log('Hearth: Data received via postMessage',
        'opspec:', !!event.data.opspec,
        'openaiKey:', !!event.data.openaiKey,
        'queryHeat:', event.data.queryHeat,
        'forge:', event.data.forgeEnabled ? (event.data.forgeAutoDetect ? 'auto' : event.data.forgePhase) : 'off'
      );

      // Initialize retrieval pipeline once we have the OpenAI key
      if (!retrievalInitialized) {
        if (!window.HearthRetrieval) {
          console.warn('Hearth: HearthRetrieval not on window — src/retrieval/hearth-retrieval.js may not have loaded');
        } else if (!event.data.openaiKey) {
          console.warn('Hearth: No openaiKey in HEARTH_DATA — retrieval requires OpenAI key for embeddings');
        } else {
          window.HearthRetrieval.init({
            supabaseUrl: 'https://wkfwtivvhwyjlkyrikeu.supabase.co',
            supabaseAnonKey: 'sb_publishable_7lxIUGtOAArrrW2t5_mQFg_p24QQDKO',
            openaiApiKey: event.data.openaiKey,
          });
          retrievalInitialized = true;
          console.log('Hearth: Retrieval pipeline initialized');
        }
      }
    }
  });

  /* GUTTED - MEMORY */

  // ============== Retrieval Policy (Manifest) ==============

  function normalizeText(value) {
    if (!value || typeof value !== 'string') return '';
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function resolveFieldValue(field) {
    if (!field) return { text: '', confidence: null };
    if (typeof field === 'string') return { text: field.trim(), confidence: null };
    if (typeof field === 'object') {
      const text = (field.value || field.state || field.text || '').toString().trim();
      const confidence = field.confidence ? String(field.confidence).toLowerCase() : null;
      return { text, confidence };
    }
    return { text: '', confidence: null };
  }

  function pickConfidenceTag(confidences, hasMissing) {
    const order = ['low', 'medium', 'high'];
    const normalized = confidences.filter(Boolean);
    if (normalized.length === 0) {
      return hasMissing ? 'medium' : null;
    }
    let minIdx = order.length;
    for (const c of normalized) {
      const idx = order.indexOf(c);
      if (idx !== -1 && idx < minIdx) minIdx = idx;
    }
    return minIdx < order.length ? order[minIdx] : null;
  }

  function buildNarrativeBridge(manifest) {
    if (!manifest) return '';
    const sprint = resolveFieldValue(manifest.current_sprint);
    const lastState = resolveFieldValue(manifest.last_known_state);
    const nextStep = resolveFieldValue(manifest.next_step);

    if (!sprint.text && !lastState.text && !nextStep.text) return '';

    const parts = [
      `Continuing: ${sprint.text || 'Unknown'}.`,
      `Last known: ${lastState.text || 'Unknown'}.`,
      `Next: ${nextStep.text || 'Unknown'}.`
    ];

    const hasMissing = !sprint.text || !lastState.text || !nextStep.text;
    const confidence = pickConfidenceTag(
      [sprint.confidence, lastState.confidence, nextStep.confidence],
      hasMissing
    );

    const bridge = parts.join(' ');
    return confidence ? `${bridge} [confidence: ${confidence}]` : bridge;
  }

  function buildAnchorLines(manifest) {
    if (!manifest) return [];
    const anchors = [];

    const sprint = resolveFieldValue(manifest.current_sprint);
    const lastState = resolveFieldValue(manifest.last_known_state);
    const lastDecision = resolveFieldValue(manifest.last_decision);
    const nextStep = resolveFieldValue(manifest.next_step);

    if (sprint.text) anchors.push(`- [ANCHOR] current_sprint: ${sprint.text}`);
    if (lastState.text) anchors.push(`- [ANCHOR] last_known_state: ${lastState.text}`);
    if (lastDecision.text) anchors.push(`- [ANCHOR] last_decision: ${lastDecision.text}`);
    if (nextStep.text) anchors.push(`- [ANCHOR] next_step: ${nextStep.text}`);

    return anchors;
  }

  /* GUTTED - MEMORY */

  /* GUTTED - MEMORY */

  // ============== Scout: Behavioral Verb Patterns (inline for page context) ==============

  /**
   * Behavioral verb patterns detect HOW users do things (behavioral invariants),
   * not WHAT they've done (content/nouns).
   */
  /* GUTTED - MEMORY */

  /* GUTTED - MEMORY */

  // ============== Context Building ==============

  /* GUTTED - MEMORY */

  // ============== Forge Complement Generation ==============
  // Now handled by HearthForgeDetector in utils/forgeDetector.js
  // The detector is called in the fetch interception logic below

  /**
   * Build the full injection context
   */
  function buildInjectionContext(opspec, manifest = null) {
    const narrativeBridge = buildNarrativeBridge(manifest);
    const anchorLines = buildAnchorLines(manifest);

    // Build optional narrative bridge section
    let narrativeSection = '';
    if (narrativeBridge || anchorLines.length > 0) {
      const anchorBlock = anchorLines.length > 0 ? `\n${anchorLines.join('\n')}` : '';
      narrativeSection = `
NARRATIVE BRIDGE
${narrativeBridge || 'Continuing: Unknown. Last known: Unknown. Next: Unknown. [confidence: medium]'}${anchorBlock}
`;
    }

    // Use fullText if available (from quiz-generated OpSpec), otherwise build from fields
    if (opspec.fullText) {
      return `[HEARTH OPERATING SPECIFICATION]

${opspec.fullText}

[END OPERATING SPECIFICATION]
${narrativeSection}`;
    }

    // Fallback: build from individual fields
    const sections = [];

    // Cognitive Architecture / Prime Directive
    if (opspec.cognitiveArchitecture) {
      sections.push(opspec.cognitiveArchitecture);
    }

    // Identity
    if (opspec.identity) {
      sections.push(`WHO YOU'RE WORKING WITH:\n${opspec.identity}`);
    }

    // Communication style
    if (opspec.communication) {
      sections.push(`COMMUNICATION:\n${opspec.communication}`);
    }

    // Execution style
    if (opspec.execution) {
      sections.push(`EXECUTION:\n${opspec.execution}`);
    }

    // Constraints
    if (opspec.constraints && opspec.constraints.length > 0) {
      const constraintList = opspec.constraints.map(c => `- ${c}`).join('\n');
      sections.push(`CONSTRAINTS:\n${constraintList}`);
    }

    // Balance protocol
    if (opspec.balanceProtocol) {
      sections.push(`BALANCE CHECK:\n${opspec.balanceProtocol}`);
    }

    return `[HEARTH OPERATING SPECIFICATION]

${sections.join('\n\n')}

[END OPERATING SPECIFICATION]
${narrativeSection}`;
  }

  // ============== Message Extraction ==============

  /**
   * Extract user message from different API request formats
   */
  function extractUserMessage(url, body) {
    try {
      // ChatGPT
      if (url.includes('chatgpt.com') || url.includes('openai.com')) {
        if (body.messages && body.messages.length > 0) {
          const lastMsg = body.messages[body.messages.length - 1];
          const role = lastMsg.role || lastMsg.author?.role;

          if (role === 'user') {
            // Web format (parts)
            if (lastMsg.content?.parts?.[0]) {
              return lastMsg.content.parts[0];
            }
            // API format (string)
            if (typeof lastMsg.content === 'string') {
              return lastMsg.content;
            }
            // Complex API format (array)
            if (Array.isArray(lastMsg.content)) {
              const textBlock = lastMsg.content.find(c => c.type === 'text');
              return textBlock?.text || '';
            }
          }
        }
      }

      // Claude
      if (url.includes('claude.ai') || url.includes('/completion') || url.includes('/chat_conversations/')) {
        if (body.prompt) {
          return body.prompt;
        }
        if (body.messages && body.messages.length > 0) {
          const lastMsg = body.messages[body.messages.length - 1];
          if (lastMsg.role === 'user') {
            if (typeof lastMsg.content === 'string') {
              return lastMsg.content;
            }
            if (Array.isArray(lastMsg.content)) {
              const textBlock = lastMsg.content.find(c => c.type === 'text');
              return textBlock?.text || '';
            }
          }
        }
      }

      // Gemini
      if (url.includes('generativelanguage.googleapis.com')) {
        if (body.contents && body.contents.length > 0) {
          const lastContent = body.contents[body.contents.length - 1];
          if (lastContent.parts && lastContent.parts.length > 0) {
            const textPart = lastContent.parts.find(p => p.text);
            return textPart?.text || '';
          }
        }
      }
    } catch (e) {
      console.warn('Hearth: Failed to extract user message', e);
    }

    return '';
  }

  /**
   * Inject context into request body
   */
  function injectContext(url, body, context) {
    // ChatGPT (Web & API) - Broad match for completions/conversations
    if (url.includes('openai.com') || url.includes('chatgpt.com')) {
      if (body.messages && body.messages.length > 0) {
        const lastMsg = body.messages[body.messages.length - 1];
        const role = lastMsg.role || lastMsg.author?.role;

        if (role === 'user') {
          // Format 1: Web format (parts)
          if (lastMsg.content?.parts?.[0]) {
            lastMsg.content.parts[0] = `${context}\n\n${lastMsg.content.parts[0]}`;
            console.log('Hearth: Injected into ChatGPT (Web format)');
            return true;
          }

          // Format 2: Standard API (string)
          if (typeof lastMsg.content === 'string') {
            lastMsg.content = `${context}\n\n${lastMsg.content}`;
            console.log('Hearth: Injected into ChatGPT (API format)');
            return true;
          }

          // Format 3: Complex API (array)
          if (Array.isArray(lastMsg.content)) {
            const textPart = lastMsg.content.find(c => c.type === 'text');
            if (textPart) {
              textPart.text = `${context}\n\n${textPart.text}`;
              console.log('Hearth: Injected into ChatGPT (Complex API format)');
              return true;
            }
          }
        }
      }
    }

    // Claude (Web & API)
    if (url.includes('claude.ai') || url.includes('anthropic.com') || url.includes('/completion') || url.includes('/chat_conversations/')) {
      if (body.prompt) {
        body.prompt = `${context}\n\n${body.prompt}`;
        console.log('Hearth: Injected into Claude request');
        return true;
      }
      if (body.messages && body.messages.length > 0) {
        const lastMsg = body.messages[body.messages.length - 1];
        if (lastMsg.role === 'user') {
          if (typeof lastMsg.content === 'string') {
            lastMsg.content = `${context}\n\n${lastMsg.content}`;
          } else if (Array.isArray(lastMsg.content)) {
            const textBlock = lastMsg.content.find(c => c.type === 'text');
            if (textBlock) {
              textBlock.text = `${context}\n\n${textBlock.text}`;
            }
          }
          console.log('Hearth: Injected into Claude request');
          return true;
        }
      }
    }

    // Gemini
    if (url.includes('generativelanguage.googleapis.com')) {
      if (body.contents && body.contents.length > 0) {
        const lastContent = body.contents[body.contents.length - 1];
        if (lastContent.parts && lastContent.parts.length > 0) {
          const textPart = lastContent.parts.find(p => p.text);
          if (textPart) {
            textPart.text = `${context}\n\n${textPart.text}`;
            console.log('Hearth: Injected into Gemini request');
            return true;
          }
        }
      }
    }

    return false;
  }

  // ============== Conversation Monitor Integration ==============

  /**
   * Send message to conversation monitor via postMessage
   */
  function sendToConversationMonitor(role, content) {
    if (!content || content.trim().length === 0) return;

    // Skip Hearth context blocks
    if (content.includes('[HEARTH CONTEXT]')) return;

    window.postMessage({
      type: 'HEARTH_CONVERSATION_MESSAGE',
      role,
      content: content.trim()
    }, '*');

    console.log(`Hearth: Buffered ${role} message for conversation monitor (${content.length} chars)`);
  }

  /**
   * Extract assistant response from API response body
   */
  function extractAssistantResponse(url, responseData) {
    try {
      // ChatGPT / OpenAI
      if (url.includes('api.openai.com') || url.includes('chatgpt.com')) {
        if (responseData.choices && responseData.choices[0]) {
          const choice = responseData.choices[0];
          // Standard API format
          if (choice.message?.content) {
            return choice.message.content;
          }
          // Streaming delta format
          if (choice.delta?.content) {
            return choice.delta.content;
          }
        }
        // ChatGPT web format
        if (responseData.message?.content?.parts) {
          return responseData.message.content.parts.join('\n');
        }
      }

      // Claude
      if (url.includes('claude.ai') || url.includes('/completion') || url.includes('/chat_conversations/')) {
        // Claude API format
        if (responseData.content && Array.isArray(responseData.content)) {
          const textBlocks = responseData.content
            .filter(c => c.type === 'text')
            .map(c => c.text);
          if (textBlocks.length > 0) {
            return textBlocks.join('\n');
          }
        }
        // Claude web format
        if (responseData.completion) {
          return responseData.completion;
        }
      }

      // Gemini
      if (url.includes('generativelanguage.googleapis.com')) {
        if (responseData.candidates && responseData.candidates[0]) {
          const parts = responseData.candidates[0].content?.parts;
          if (parts) {
            return parts.map(p => p.text).join('\n');
          }
        }
      }
    } catch (e) {
      console.warn('Hearth: Failed to extract assistant response', e);
    }

    return null;
  }

  // ============== Fetch Interception ==============

  // Store original fetch
  const originalFetch = window.fetch;

  // Monkeypatch fetch
  window.fetch = async function (...args) {
    const [url, options] = args;
    let capturedUserMessage = null;
    let isAIRequest = false;

    // Only intercept POST requests to AI APIs when we have data
    if (options?.method === 'POST' && hearthData?.opspec) {
      console.log('Hearth: Intercepting POST to:', url);

      try {
        // Check body type before parsing
        if (options.body instanceof FormData) {
          console.log('Hearth: Skipping FormData request');
          // Skip - will fall through to original fetch
        } else if (typeof options.body !== 'string') {
          console.log('Hearth: Skipping non-string request body:', typeof options.body);
          // Skip - will fall through to original fetch
        } else {
          // Parse JSON body
          let body;
          try {
            body = JSON.parse(options.body);
          } catch (parseError) {
            console.log('Hearth: Non-JSON request body, skipping');
            body = null;
          }

          if (body) {
            // Check if this is an AI API request
            isAIRequest =
              url.includes('api.openai.com') ||
              url.includes('chatgpt.com') ||
              url.includes('claude.ai') ||
              url.includes('/completion') ||
              url.includes('/chat_conversations/') ||
              url.includes('generativelanguage.googleapis.com');

            if (isAIRequest) {
              // Extract user message for context injection
              capturedUserMessage = extractUserMessage(url, body);
              console.log('Hearth: User message length:', capturedUserMessage.length);

              /* GUTTED - MEMORY */
              const manifest = await loadManifest();
              const routedOpSpec = typeof selectOpSpec === 'function'
                ? selectOpSpec(capturedUserMessage)
                : '';

              // Build context with OpSpec
              const context = buildInjectionContext(hearthData.opspec, manifest);

              // Run affect detection in real-time on the current message
              let affectSection = '';
              let affectShape = null;
              if (capturedUserMessage && window.HearthAffectDetector) {
                try {
                  affectShape = window.HearthAffectDetector.detectAffect(capturedUserMessage);
                  const complement = window.HearthAffectDetector.generateComplement(affectShape);
                  if (complement.opspec) {
                    affectSection = `\n\n${complement.opspec}`;
                    const mods = complement.modulations.length > 0
                      ? complement.modulations.map(m => m.modulation).join(' + ')
                      : 'neutral';
                    console.log('Hearth: Affect -', `expansion=${affectShape.expansion}`, `activation=${affectShape.activation}`, `certainty=${affectShape.certainty}`, '→', mods);
                  }
                } catch (e) {
                  console.warn('Hearth: Affect detection failed in interceptor', e);
                }
              }

              // Forge creative phase detection
              let forgeSection = '';
              const forgeEnabled = hearthData.forgeEnabled;
              console.log('[Forge] debug -',
                'enabled:', forgeEnabled,
                'HearthForgeDetector available:', typeof window.HearthForgeDetector !== 'undefined'
              );
              if (forgeEnabled && typeof window.HearthForgeDetector !== 'undefined') {
                try {
                  const forgeResult = window.HearthForgeDetector.detect(capturedUserMessage, affectShape);
                  if (forgeResult.block) {
                    forgeSection = `\n\n${forgeResult.block}`;
                    console.log('[Forge]', forgeResult.phase,
                      `openness=${forgeResult.openness}`,
                      `materiality=${forgeResult.materiality}`
                    );
                  }
                } catch (forgeError) {
                  console.warn('[Forge] Detection failed:', forgeError);
                }
              }

              // Run memory retrieval (semantic search, no heat gating)
              let memorySection = '';
              console.log('Hearth: Pre-retrieval check',
                'initialized:', retrievalInitialized,
                'hasRetrieval:', !!window.HearthRetrieval,
                'message:', capturedUserMessage?.substring(0, 30)
              );
              if (capturedUserMessage && window.HearthRetrieval) {
                try {
                  const retrieval = await window.HearthRetrieval.retrieve(
                    capturedUserMessage
                  );
                  console.log('Hearth: Retrieval result',
                    'injection:', !!retrieval.injection,
                    'goal:', retrieval.goal,
                    'user:', retrieval.userMemories.length,
                    'ai:', retrieval.aiMemories.length
                  );
                  if (retrieval.injection) {
                    memorySection = `\n\n${retrieval.injection}`;
                  }
                } catch (retrievalError) {
                  console.warn('Hearth: Retrieval failed:', retrievalError);
                }
              }

              // Pipeline order: OpSpec → affect complement → forge phase → memories → user message
              const fullContext = routedOpSpec
                ? `${routedOpSpec}\n\n${context}${affectSection}${forgeSection}${memorySection}`
                : `${context}${affectSection}${forgeSection}${memorySection}`;

              // Debug: Log what sections are included
              console.log('Hearth: Injection debug -',
                'affectSection:', affectSection.length, 'chars',
                'forgeSection:', forgeSection.length, 'chars',
                'memorySection:', memorySection.length, 'chars',
                'fullContext:', fullContext.length, 'chars'
              );
              if (forgeSection) {
                console.log('Hearth: Forge section preview:', forgeSection.substring(0, 200));
              }

              // Inject context into request
              if (injectContext(url, body, fullContext)) {
                // Sanitize UUID fields: ensure null stays JSON null, not the string "null"
                for (const key of Object.keys(body)) {
                  if (key.endsWith('_uuid') || key.endsWith('_id')) {
                    if (body[key] === 'null' || body[key] === 'undefined') {
                      body[key] = null;
                    }
                  }
                }
                options.body = JSON.stringify(body);
              }
            }
          }
        }
      } catch (e) {
        console.error('Hearth: Failed to process request', e);
      }
    }

    // Call original fetch
    const response = await originalFetch.apply(this, args);
    let modifiedResponse = response;

    // After response: capture messages for conversation monitor
    if (isAIRequest && capturedUserMessage && response.ok) {
      try {
        // Send user message to monitor
        sendToConversationMonitor('user', capturedUserMessage);

        // Check content type - only process JSON responses (not streaming)
        const contentType = response.headers.get('content-type') || '';

        // Detect streaming - Claude uses various content types
        const isStreaming = contentType.includes('text/event-stream') ||
          contentType.includes('text/plain') ||
          contentType.includes('application/x-ndjson') ||
          url.includes('stream=true');

        if (isStreaming) {
          // Streaming response - collect chunks
          console.log('Hearth: Streaming response detected, monitoring will collect chunks');

          const clonedResponse = response.clone();
          collectStreamingResponse(clonedResponse, url).then(assistantMessage => {
            if (assistantMessage && assistantMessage.length > 0) {
              console.log('Hearth: Collected streaming response:', assistantMessage.length, 'chars');
              sendToConversationMonitor('assistant', assistantMessage);
            }
          }).catch(e => {
            console.warn('Hearth: Could not collect streaming response', e.message);
          });
        } else if (contentType.includes('application/json')) {
          // Non-streaming JSON response - extract assistant message and curate native memories
          try {
            const responseData = await response.clone().json();
            const assistantMessage = extractAssistantResponse(url, responseData);
            if (assistantMessage) {
              sendToConversationMonitor('assistant', assistantMessage);
            }
          } catch (e) {
            console.warn('Hearth: Could not parse JSON response for monitoring', e.message);
          }
        } else {
          console.log('Hearth: Unknown content-type, skipping response monitoring:', contentType);
        }
      } catch (monitorError) {
        console.warn('Hearth: Conversation monitor integration error', monitorError);
      }
    }

    return modifiedResponse;
  };

  /**
   * Collect streaming response chunks into complete message
   */
  async function collectStreamingResponse(response, url) {
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              // OpenAI/ChatGPT streaming format
              if (parsed.choices?.[0]?.delta?.content) {
                fullContent += parsed.choices[0].delta.content;
              }

              // Claude streaming format
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullContent += parsed.delta.text;
              }

              // Gemini streaming format
              if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                fullContent += parsed.candidates[0].content.parts[0].text;
              }
            } catch (parseError) {
              // Skip non-JSON lines
            }
          }
        }
      }

      return fullContent || null;
    } catch (e) {
      console.warn('Hearth: Error collecting streaming response', e);
      return null;
    }
  }

  console.log('Hearth: Fetch interceptor active (prompt interception + OpSpec injection)');
})();
