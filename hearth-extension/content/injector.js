// content/injector.js

(async function () {
    'use strict';

    // Store the latest hearth context globally for fetch interceptor
    let latestHearthContext = null;

    // Intercept fetch to inject context at network level (invisible to user)
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const [url, options] = args;

        // Check if this is a Claude API conversation request
        if (typeof url === 'string' && url.includes('/api/') && options?.method === 'POST') {
            console.log('🌐 Intercepted POST request to:', url);

            try {
                // Try to parse the request body
                if (options.body && latestHearthContext) {
                    const bodyStr = typeof options.body === 'string' ? options.body : await options.body.text();
                    let bodyData = JSON.parse(bodyStr);

                    console.log('📦 Original request body:', bodyData);

                    // Find the user message in the request (Claude's format may vary)
                    // Common patterns: { prompt: "..." }, { messages: [{ content: "..." }] }
                    let modified = false;

                    if (bodyData.prompt && typeof bodyData.prompt === 'string') {
                        // Single prompt field
                        const contextBlock = buildHearthContextBlock(latestHearthContext);
                        bodyData.prompt = contextBlock + '\n\n' + bodyData.prompt;
                        modified = true;
                        console.log('✅ Injected context into prompt field');
                    } else if (bodyData.messages && Array.isArray(bodyData.messages)) {
                        // Messages array (last user message)
                        for (let i = bodyData.messages.length - 1; i >= 0; i--) {
                            if (bodyData.messages[i].role === 'user') {
                                const contextBlock = buildHearthContextBlock(latestHearthContext);
                                bodyData.messages[i].content = contextBlock + '\n\n' + bodyData.messages[i].content;
                                modified = true;
                                console.log('✅ Injected context into messages array');
                                break;
                            }
                        }
                    }

                    if (modified) {
                        // Modify the request with the new body
                        options.body = JSON.stringify(bodyData);
                        console.log('📤 Sending modified request with context');
                    }
                }
            } catch (err) {
                console.warn('⚠️ Error modifying request body:', err);
                // If parsing fails, send original request
            }
        }

        // Call original fetch
        return originalFetch.apply(this, args);
    };

    function buildHearthContextBlock(hearthContext) {
        if (!hearthContext || (!hearthContext.eos && !hearthContext.memories?.length)) {
            return '';
        }

        let contextBlock = '<hearth_context>\n';

        if (hearthContext.eos) {
            contextBlock += `<communication_preferences>\n${hearthContext.eos}\n</communication_preferences>\n\n`;
        }

        if (hearthContext.memories?.length > 0) {
            contextBlock += '<relevant_memories>\n';
            hearthContext.memories.forEach(m => {
                contextBlock += `- ${m.content}\n`;
            });
            contextBlock += '</relevant_memories>\n';
        }

        contextBlock += '</hearth_context>';
        return contextBlock;
    }

    // Detect platform
    const platform = detectPlatform();
    if (!platform) return;

    console.log(`Hearth active on ${platform}`);

    // Platform-specific selectors
    const selectors = {
        claude: {
            textarea: 'div[contenteditable="true"]',
            sendButton: 'button[aria-label="Send Message"]', // Updated selector for Claude
            // Note: Claude's send button aria-label might vary, checking for common ones
        },
        chatgpt: {
            textarea: '#prompt-textarea',
            sendButton: 'button[data-testid="send-button"]',
        },
        gemini: {
            textarea: 'div[contenteditable="true"]', // Gemini often uses contenteditable too
            sendButton: 'button[aria-label="Send message"]', // Verify Gemini selector
        }
    };

    // Refined selectors for better reliability
    if (platform === 'claude') {
        selectors.claude.sendButton = 'button[aria-label="Send Message"], button:has(svg)';
    }
    if (platform === 'gemini') {
        selectors.gemini.textarea = '.rich-textarea div[contenteditable="true"], rich-textarea div[contenteditable="true"]';
        selectors.gemini.sendButton = '.send-button, button[aria-label="Send message"]';
    }

    const config = selectors[platform];

    // Wait for elements to exist
    try {
        await waitForElement(config.textarea);
    } catch (e) {
        console.log("Hearth: Textarea not found immediately, continuing to watch...");
    }

    // Set up interception
    interceptMessages(platform, config);

    function detectPlatform() {
        const host = window.location.hostname;
        if (host.includes('claude.ai')) return 'claude';
        if (host.includes('chat.openai.com') || host.includes('chatgpt.com')) return 'chatgpt';
        if (host.includes('gemini.google.com')) return 'gemini';
        return null;
    }

    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) return resolve(element);

            const observer = new MutationObserver((mutations, obs) => {
                const el = document.querySelector(selector);
                if (el) {
                    obs.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found`));
            }, timeout);
        });
    }

    function interceptMessages(platform, config) {
        console.log('🎣 Setting up message interception for', platform);
        console.log('🎯 Send button selector:', config.sendButton);
        console.log('🎯 Textarea selector:', config.textarea);

        // Watch for send button clicks
        document.addEventListener('click', async (e) => {
            console.log('👆 Click detected on:', e.target);
            const sendButton = e.target.closest(config.sendButton);
            console.log('🔍 Matched send button?', !!sendButton, sendButton);

            if (sendButton) {
                console.log('✅ Send button clicked!');

                // CAPTURE TEXT IMMEDIATELY before any async or preventDefault
                const textarea = document.querySelector(config.textarea);
                const userMessage = textarea ? getMessageText(textarea, platform) : '';
                console.log('💬 Captured text IMMEDIATELY (click):', userMessage ? `"${userMessage.substring(0, 50)}..."` : '(empty)');

                if (sendButton.dataset.hearthProcessed) {
                    delete sendButton.dataset.hearthProcessed;
                    console.log('🔄 Already processed, allowing click through');
                    return; // Allow the click
                }

                e.preventDefault();
                e.stopPropagation();
                console.log('⏸️ Click intercepted, processing...');

                await handleSend(platform, config, userMessage, () => {
                    sendButton.dataset.hearthProcessed = "true";
                    sendButton.click();
                    console.log('▶️ Re-triggered send button click');
                });
            }
        }, true);

        // Watch for Enter key (without Shift)
        document.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                console.log('⌨️ Enter key pressed (no shift)');
                console.log('🎯 Active element:', document.activeElement);
                console.log('🎯 Is contenteditable?', document.activeElement?.contentEditable === 'true');

                // For contenteditable divs (Claude, Gemini), check if we're in one
                const isInContentEditable = document.activeElement?.contentEditable === 'true';

                // Also try to find the textarea via selector as fallback
                const textarea = document.querySelector(config.textarea);
                console.log('📝 Found textarea via selector?', !!textarea, textarea);

                // Check if we're in the message input
                const inMessageInput = isInContentEditable ||
                    (textarea && (document.activeElement === textarea || textarea.contains(document.activeElement)));

                console.log('📝 In message input?', inMessageInput);

                if (inMessageInput) {
                    console.log('✅ Enter in message input detected!');

                    // Use the active element if it's contenteditable, otherwise fall back to textarea
                    const targetElement = isInContentEditable ? document.activeElement : textarea;

                    // CAPTURE TEXT IMMEDIATELY, before preventDefault or any async operations
                    const userMessage = getMessageText(targetElement, platform);
                    console.log('💬 Captured text IMMEDIATELY:', userMessage ? `"${userMessage.substring(0, 50)}..."` : '(empty)');

                    if (targetElement?.dataset.hearthProcessed) {
                        delete targetElement.dataset.hearthProcessed;
                        console.log('🔄 Already processed, allowing Enter through');
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();
                    console.log('⏸️ Enter intercepted, processing...');

                    await handleSend(platform, config, userMessage, () => {
                        if (targetElement) {
                            targetElement.dataset.hearthProcessed = "true";
                        }
                        const newEvent = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true,
                            shiftKey: false
                        });
                        (targetElement || document.activeElement).dispatchEvent(newEvent);
                        console.log('▶️ Re-triggered Enter keydown event');
                    });
                }
            }
        }, true);
    }

    async function handleSend(platform, config, userMessage, triggerCallback) {
        console.log('📨 handleSend called for platform:', platform);
        console.log('💬 Received pre-captured message:', userMessage ? `"${userMessage.substring(0, 50)}..."` : '(empty)');

        if (!userMessage || !userMessage.trim()) {
            console.warn('⚠️ Empty message, triggering send anyway');
            triggerCallback();
            return;
        }

        // Get Hearth context
        console.log('🔍 Fetching Hearth context...');
        const hearthContext = await getHearthContext(userMessage);
        console.log('📦 Hearth context received:', hearthContext);

        // Store context globally for fetch interceptor to use
        latestHearthContext = hearthContext;
        console.log('✅ Stored context for network interception');

        // DO NOT modify the textarea - let fetch interceptor handle injection
        // The user's message stays clean in the UI

        // Trigger the actual send (fetch interceptor will modify the network request)
        console.log('▶️ Triggering send... (fetch interceptor will inject context)');
        triggerCallback();

        // Update heat map and check for memory extraction (async, don't block)
        console.log('🔄 Calling updateHearth for memory extraction...');
        updateHearth(userMessage, hearthContext);
    }

    function getMessageText(textarea, platform) {
        if (platform === 'claude' || platform === 'gemini') {
            return textarea.innerText || textarea.textContent;
        }
        return textarea.value || textarea.innerText || textarea.textContent;
    }

    function setMessageText(textarea, text, platform) {
        if (platform === 'claude' || platform === 'gemini') {
            // Claude/Gemini use contenteditable
            // We need to be careful not to break their editor state
            // Clearing and setting textContent is usually safe for simple text

            // Focus first
            textarea.focus();

            // Select all text
            document.execCommand('selectAll', false, null);

            // Insert new text
            document.execCommand('insertText', false, text);

            // Fallback if execCommand fails or isn't supported
            if (textarea.innerText !== text) {
                textarea.innerText = text;
                textarea.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
            }
        } else {
            // ChatGPT textarea
            textarea.value = text;
            textarea.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    async function getHearthContext(userMessage) {
        // Send message to background script to get Hearth context
        return new Promise((resolve) => {
            try {
                // 1. Safe check for extension ID
                let extensionId = null;
                try {
                    extensionId = chrome?.runtime?.id;
                } catch (e) {
                    // Accessing runtime.id can throw if context is invalidated
                }

                if (!extensionId) {
                    console.warn('⚠️ Extension context invalidated. Please reload the page.');
                    showContextInvalidatedNotification();
                    resolve({ eos: null, memories: [], heatMap: null });
                    return;
                }

                // 2. Safe sendMessage
                chrome.runtime.sendMessage(
                    { type: 'GET_HEARTH_CONTEXT', message: userMessage },
                    (response) => {
                        // 3. Check for lastError in callback
                        const lastError = chrome.runtime.lastError;
                        if (lastError) {
                            console.warn('⚠️ Extension connection error:', lastError.message);
                            resolve({ eos: null, memories: [], heatMap: null });
                            return;
                        }
                        resolve(response || { eos: null, memories: [], heatMap: null });
                    }
                );
            } catch (err) {
                // 4. Catch synchronous errors (like sendMessage throwing)
                console.warn('⚠️ Error communicating with extension:', err.message);
                resolve({ eos: null, memories: [], heatMap: null });
            }
        });
    }

    function buildEnrichedMessage(userMessage, hearthContext) {
        if (!hearthContext || (!hearthContext.eos && !hearthContext.memories?.length)) {
            return userMessage;
        }

        let contextBlock = '\n\n<hearth_context>\n';

        if (hearthContext.eos) {
            contextBlock += `<communication_preferences>\n${hearthContext.eos}\n</communication_preferences>\n\n`;
        }

        if (hearthContext.memories?.length > 0) {
            contextBlock += '<relevant_memories>\n';
            hearthContext.memories.forEach(m => {
                contextBlock += `- ${m.content}\n`;
            });
            contextBlock += '</relevant_memories>\n';
        }

        contextBlock += '</hearth_context>';

        // We append context at the end usually, or prepend? 
        // Prompt said "Prepend the context invisibly". 
        // "Invisibly" is hard without using system prompts which we can't easily access in web UI.
        // We will prepend it to the message.

        return contextBlock + '\n\n' + userMessage;
    }

    // Track conversation for memory extraction
    let conversationHistory = [];
    let hasShownContextInvalidatedWarning = false;

    function showContextInvalidatedNotification() {
        if (hasShownContextInvalidatedWarning) return;
        hasShownContextInvalidatedWarning = true;

        const notification = document.createElement('div');
        notification.id = 'hearth-context-warning';
        notification.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; background: #ff6b6b; color: white; padding: 16px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 999999; font-family: system-ui; max-width: 350px;">
                <div style="font-weight: 600; margin-bottom: 8px;">⚠️ Hearth Extension Disconnected</div>
                <div style="font-size: 13px; margin-bottom: 12px;">The extension was reloaded. Please refresh this page to restore functionality.</div>
                <button onclick="location.reload()" style="background: white; color: #ff6b6b; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">Reload Page</button>
            </div>
        `;
        document.body.appendChild(notification);
    }

    function updateHearth(userMessage, hearthContext) {
        console.log('🔄 updateHearth called with message:', userMessage.substring(0, 50) + '...');

        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
            console.warn('⚠️ Extension context invalidated, skipping Hearth update');
            showContextInvalidatedNotification();
            return;
        }

        // Add to conversation history
        conversationHistory.push({
            role: 'user',
            content: userMessage
        });

        // Keep only last 6 messages for context
        if (conversationHistory.length > 6) {
            conversationHistory = conversationHistory.slice(-6);
        }

        // Send to background for heat map update
        try {
            chrome.runtime.sendMessage({
                type: 'UPDATE_HEARTH',
                message: userMessage,
                context: hearthContext
            });
        } catch (err) {
            console.warn('⚠️ Could not update heat map:', err.message);
        }

        // Check significance and extract memory in background
        try {
            console.log('📤 Sending CHECK_SIGNIFICANCE to background...');
            chrome.runtime.sendMessage({
                type: 'CHECK_SIGNIFICANCE',
                message: userMessage,
                context: conversationHistory
            }, (response) => {
                if (chrome.runtime.lastError) {
                    // Silently ignore if extension was reloaded
                    return;
                }
                if (response?.significant && response?.memory) {
                    console.log('✨ Memory created:', response.memory);
                }
            });
        } catch (err) {
            console.warn('⚠️ Could not check significance:', err.message);
        }
    }

})();
