// content/injector.js

(async function () {
    'use strict';

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
        // Watch for send button clicks
        document.addEventListener('click', async (e) => {
            const sendButton = e.target.closest(config.sendButton);
            if (sendButton) {
                // We need to capture the click, inject, then let it proceed or re-trigger
                // But for React apps, modifying the DOM value directly often doesn't update the internal state.
                // We'll try to intercept, modify, and then trigger the send.

                // However, preventing default on a click listener might be too late or break things.
                // A better approach for these apps is often to listen for the capture phase.

                // For this implementation, we'll try to modify the text BEFORE the app processes the send.
                // Since we can't easily pause the click event propagation asynchronously, 
                // we might need to be fast or use a different strategy.

                // Strategy: 
                // 1. Check if we have already enriched the message.
                // 2. If not, stop propagation, enrich, update DOM, dispatch input events, then click again.

                if (sendButton.dataset.hearthProcessed) {
                    delete sendButton.dataset.hearthProcessed;
                    return; // Allow the click
                }

                e.preventDefault();
                e.stopPropagation();

                await handleSend(platform, config, () => {
                    sendButton.dataset.hearthProcessed = "true";
                    sendButton.click();
                });
            }
        }, true);

        // Watch for Enter key (without Shift)
        document.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const textarea = document.querySelector(config.textarea);
                if (textarea && (document.activeElement === textarea || textarea.contains(document.activeElement))) {
                    if (textarea.dataset.hearthProcessed) {
                        delete textarea.dataset.hearthProcessed;
                        return;
                    }

                    e.preventDefault();
                    e.stopPropagation();

                    await handleSend(platform, config, () => {
                        textarea.dataset.hearthProcessed = "true";
                        const newEvent = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            keyCode: 13,
                            which: 13,
                            bubbles: true,
                            cancelable: true,
                            shiftKey: false
                        });
                        textarea.dispatchEvent(newEvent);
                    });
                }
            }
        }, true);
    }

    async function handleSend(platform, config, triggerCallback) {
        // Get the user's message
        const textarea = document.querySelector(config.textarea);
        if (!textarea) {
            triggerCallback();
            return;
        }

        const userMessage = getMessageText(textarea, platform);

        if (!userMessage || !userMessage.trim()) {
            triggerCallback();
            return;
        }

        // Get Hearth context
        const hearthContext = await getHearthContext(userMessage);

        // Build enriched message
        const enrichedMessage = buildEnrichedMessage(userMessage, hearthContext);

        // Set the enriched message
        if (enrichedMessage !== userMessage) {
            setMessageText(textarea, enrichedMessage, platform);
        }

        // Trigger the actual send
        triggerCallback();

        // Update heat map and check for crystallization (async, don't block)
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
            chrome.runtime.sendMessage(
                { type: 'GET_HEARTH_CONTEXT', message: userMessage },
                (response) => resolve(response)
            );
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

    function updateHearth(userMessage, hearthContext) {
        // Send to background for heat map update and crystallization check
        chrome.runtime.sendMessage({
            type: 'UPDATE_HEARTH',
            message: userMessage,
            context: hearthContext
        });
    }

})();
