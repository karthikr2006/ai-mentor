/**
 * AI Mentor 1.0 - Frontend Script (Vanilla JavaScript)
 * 
 * Features:
 * - Reads user questions and sends to FastAPI backend at http://127.0.0.1:8000/chat
 * - NDJSON progressive streaming responses with visual streaming cursor
 * - In-memory and localStorage conversation persistence
 * - Zero-dependency Markdown parser (paragraphs, lists, bold, italics, inline code, fenced code blocks)
 * - Code syntax container with language label and clipboard copy button
 * - Thinking indicator while waiting for the model
 * - Interrupted-stream detection and preservation
 * - Clear Chat with confirmation and UI restoration
 * - Export Chat to downloadable plain-text file
 * - Robust error handling (Ollama offline, backend offline, model timeout, empty input)
 */

// 1. Grab references to the HTML elements
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const sendBtn = document.getElementById('send-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const exportChatBtn = document.getElementById('export-chat-btn');

// Preserve the initial welcome message UI for restoration
const initialWelcomeHtml = chatMessages.innerHTML;

// Backend API URL and Storage Configuration
const BACKEND_URL = 'http://127.0.0.1:8000/chat';
const STORAGE_KEY = 'aiMentorConversationHistory';

// In-memory conversation history
// Format: [{ role: 'user' | 'assistant', content: string }]
const conversationHistory = [];

/**
 * Saves conversation history to browser localStorage.
 */
function saveConversationHistory() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversationHistory)
    );
  } catch (error) {
    console.warn('Could not save conversation history:', error);
  }
}

/**
 * Loads conversation history from localStorage and restores it in UI and memory.
 */
function loadConversationHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      console.warn('Invalid conversation history format in localStorage. Resetting storage.');
      conversationHistory.length = 0;
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (parsed.length === 0) {
      return;
    }

    // Clear default welcome messages from the DOM
    chatMessages.innerHTML = '';

    // Clear in-memory history
    conversationHistory.length = 0;

    // Restore and render each saved message
    parsed.forEach((msg) => {
      conversationHistory.push({
        role: msg.role,
        content: msg.content
      });

      const sender = msg.role === 'assistant' ? 'mentor' : 'user';
      appendMessage(msg.content, sender);
    });
  } catch (error) {
    console.warn('Could not load or parse conversation history from localStorage:', error);
    conversationHistory.length = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // Ignore removal failure if localStorage is inaccessible
    }
  }
}

/**
 * Clears conversation history from memory and localStorage,
 * and restores the initial welcome UI.
 */
function clearConversation() {
  const confirmed = window.confirm('Are you sure you want to clear your conversation history? This cannot be undone.');
  if (!confirmed) {
    return;
  }

  // 1. Clear in-memory conversation history
  conversationHistory.length = 0;

  // 2. Remove saved history from localStorage
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Could not remove conversation history from localStorage:', error);
  }

  // 3. Clean up thinking indicator if currently active
  removeThinkingIndicator();

  // 4. Restore original welcome messages in the DOM
  chatMessages.innerHTML = initialWelcomeHtml;

  // 5. Re-enable input and return focus to message input
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.focus();
}

/**
 * Exports the current conversation history as a downloadable plain-text file.
 */
function exportConversation() {
  if (!conversationHistory || conversationHistory.length === 0) {
    alert('There is no conversation history to export.');
    return;
  }

  // Convert conversation to readable plain text
  const formattedMessages = conversationHistory.map((item) => {
    const sender = item.role === 'assistant' ? 'AI Mentor' : 'You';
    return `${sender}:\n${item.content}`;
  });

  const textContent = formattedMessages.join('\n\n') + '\n';

  // Trigger browser download via Blob and Object URL
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl;
  downloadLink.download = 'ai-mentor-chat.txt';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Escapes HTML special characters to prevent XSS injection.
 * @param {string} str - Raw text to escape
 * @returns {string} Safe HTML string with entities
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats inline Markdown elements (inline code, bold text, italics).
 * @param {string} text - HTML-escaped string
 * @returns {string} String with inline HTML tags
 */
function formatInline(text) {
  // 1. Extract and protect inline code `code` from subsequent regexes
  const inlineCodes = [];
  let formatted = text.replace(/`([^`\n]+)`/g, function (_match, code) {
    const idx = inlineCodes.length;
    inlineCodes.push(code);
    return `__INLINE_CODE_${idx}__`;
  });

  // 2. Format bold text **text**
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 3. Format italics *text* (single asterisk)
  formatted = formatted.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');

  // 4. Re-insert inline code with proper styling class
  formatted = formatted.replace(/__INLINE_CODE_(\d+)__/g, function (_match, idx) {
    return `<code class="inline-code">${inlineCodes[idx]}</code>`;
  });

  return formatted;
}

/**
 * Custom lightweight Markdown parser for AI responses.
 * Supports fenced code blocks, inline code, bold text, italics, headings,
 * bullet/numbered lists, and paragraphs.
 * Completely zero-dependency and strictly sanitizes input before generating elements.
 * 
 * @param {string} rawText - Unescaped text
 * @returns {string} Formatted HTML string
 */
function renderMarkdown(rawText) {
  if (!rawText) return '';

  // 1. Strictly sanitize raw input characters to prevent XSS
  let escaped = escapeHtml(rawText);

  // 2. Auto-close unclosed code block if odd number of triple backticks (e.g. streaming chunks)
  const fenceCount = (escaped.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) {
    escaped += '\n```';
  }

  // 3. Extract fenced code blocks and replace with placeholders
  const codeBlocks = [];
  const processed = escaped.replace(/```([a-zA-Z0-9_+-]*)[^\n]*\r?\n([\s\S]*?)\r?\n?```/g, function (_match, lang, code) {
    const index = codeBlocks.length;
    codeBlocks.push({
      lang: lang ? lang.trim().toLowerCase() : 'code',
      code: code.replace(/^\n+|\n+$/g, '')
    });
    return `\n__CODE_BLOCK_${index}__\n`;
  });

  // 4. Split into lines and parse block elements (headings, paragraphs, lists, code placeholders)
  const lines = processed.split(/\r?\n/);
  let html = '';
  let inUl = false;
  let inOl = false;
  let paragraphLines = [];

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      const pText = paragraphLines.join('<br>');
      html += `<p>${formatInline(pText)}</p>`;
      paragraphLines = [];
    }
  }

  function closeLists() {
    if (inUl) {
      html += '</ul>';
      inUl = false;
    }
    if (inOl) {
      html += '</ol>';
      inOl = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for code block placeholder
    const codeMatch = trimmed.match(/^__CODE_BLOCK_(\d+)__$/);
    if (codeMatch) {
      flushParagraph();
      closeLists();
      const blockIdx = parseInt(codeMatch[1], 10);
      const block = codeBlocks[blockIdx];
      if (block) {
        html += `
          <div class="code-block-wrapper">
            <div class="code-block-header">
              <span class="code-lang">${block.lang}</span>
              <button type="button" class="code-copy-btn" aria-label="Copy code to clipboard">
                <svg class="copy-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <pre><code class="code-content language-${block.lang}">${block.code}</code></pre>
          </div>
        `;
      }
      continue;
    }

    // Check for blank line
    if (trimmed === '') {
      flushParagraph();
      closeLists();
      continue;
    }

    // Check for markdown headings (# H1, ## H2, ### H3, #### H4)
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeLists();
      const level = headingMatch[1].length;
      const headingContent = formatInline(headingMatch[2]);
      html += `<h${level}>${headingContent}</h${level}>`;
      continue;
    }

    // Check for bullet list item (- item or * item)
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (inOl) {
        html += '</ol>';
        inOl = false;
      }
      if (!inUl) {
        html += '<ul>';
        inUl = true;
      }
      html += `<li>${formatInline(ulMatch[1])}</li>`;
      continue;
    }

    // Check for numbered list item (1. item, 2. item, etc.)
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (inUl) {
        html += '</ul>';
        inUl = false;
      }
      if (!inOl) {
        html += '<ol>';
        inOl = true;
      }
      html += `<li>${formatInline(olMatch[1])}</li>`;
      continue;
    }

    // Normal paragraph text line
    closeLists();
    paragraphLines.push(line);
  }

  flushParagraph();
  closeLists();

  return html;
}

/**
 * Creates and appends a message bubble into the chat area.
 * @param {string} text - The message text
 * @param {'user' | 'mentor'} sender - Who sent the message
 * @param {boolean} [isError=false] - Whether this message represents a system error/notice
 */
function appendMessage(text, sender, isError = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${sender}${isError ? ' error' : ''}`;

  const isUser = sender === 'user';
  let avatarEmoji = isUser ? '👤' : '🤖';
  if (isError) {
    avatarEmoji = '⚠️';
  }

  let displayName = isUser ? 'You' : 'AI Mentor';
  if (isError) {
    displayName = 'AI Mentor (Notice)';
  }

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  wrapper.innerHTML = `
    <div class="message-avatar">${avatarEmoji}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="sender-name">${displayName}</span>
        <span class="timestamp">${timeString}</span>
      </div>
      <div class="message-bubble${isError ? ' error-bubble' : ''}"></div>
    </div>
  `;

  // Render Markdown safely into the message bubble
  const bubble = wrapper.querySelector('.message-bubble');
  bubble.innerHTML = renderMarkdown(text);

  // Append to the chat container
  chatMessages.appendChild(wrapper);

  // Smoothly scroll to the newest message at the bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Displays a temporary "Thinking... ⏳" indicator message in the chat
 * while waiting for the AI backend to respond.
 */
function showThinkingIndicator() {
  if (document.getElementById('thinking-indicator')) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'thinking-indicator';
  wrapper.className = 'message-wrapper mentor';

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  wrapper.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content">
      <div class="message-header">
        <span class="sender-name">AI Mentor</span>
        <span class="timestamp">${timeString}</span>
      </div>
      <div class="message-bubble">
        <p>Thinking... ⏳</p>
      </div>
    </div>
  `;

  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Removes the temporary "Thinking... ⏳" indicator message from the chat.
 */
function removeThinkingIndicator() {
  const indicator = document.getElementById('thinking-indicator');
  if (indicator) {
    indicator.remove();
  }
}

/**
 * Creates and appends an empty mentor message bubble in the chat container for streaming.
 * @returns {HTMLElement} The .message-bubble container element
 */
function createStreamingMentorBubble() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper mentor';

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  wrapper.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content">
      <div class="message-header">
        <span class="sender-name">AI Mentor</span>
        <span class="timestamp">${timeString}</span>
      </div>
      <div class="message-bubble"></div>
    </div>
  `;

  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrapper.querySelector('.message-bubble');
}

// Delegated event listener for copying code blocks to clipboard
chatMessages.addEventListener('click', async function (event) {
  const copyBtn = event.target.closest('.code-copy-btn');
  if (!copyBtn) return;

  const wrapper = copyBtn.closest('.code-block-wrapper');
  if (!wrapper) return;

  const codeEl = wrapper.querySelector('code.code-content');
  if (!codeEl) return;

  try {
    await navigator.clipboard.writeText(codeEl.textContent);
    const labelSpan = copyBtn.querySelector('span');
    const originalText = labelSpan ? labelSpan.textContent : 'Copy';

    copyBtn.classList.add('copied');
    if (labelSpan) labelSpan.textContent = 'Copied!';

    setTimeout(function () {
      copyBtn.classList.remove('copied');
      if (labelSpan) labelSpan.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy code to clipboard:', err);
  }
});

/**
 * Handle form submit (Send button click or Enter key)
 */
chatForm.addEventListener('submit', async function (event) {
  event.preventDefault();

  // 1. Read input and trim whitespace
  const userText = messageInput.value.trim();

  // 2. Ignore empty messages
  if (!userText) return;

  // 3. Display user message in UI immediately
  appendMessage(userText, 'user');

  // 4. Add user message to in-memory conversation history
  conversationHistory.push({
    role: 'user',
    content: userText
  });

  // 5. Clear the input field
  messageInput.value = '';

  // 6. Temporarily disable input & action buttons while waiting for backend
  messageInput.disabled = true;
  sendBtn.disabled = true;
  clearChatBtn.disabled = true;
  exportChatBtn.disabled = true;

  // Show "AI is thinking..." indicator
  showThinkingIndicator();

  try {
    // 7. Send POST request with message & conversation history to FastAPI backend
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userText,
        history: conversationHistory
      }),
    });

    // Check if the server responded with an HTTP error status (e.g. 503, 504, 502, 500)
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMsg = errorData?.detail || `Server returned error status: ${response.status}`;
      throw new Error(errorMsg);
    }

    // 8. Consume the streamed NDJSON response
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';
    let bubbleElement = null;
    let ollamaCompleted = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = jsonParseSafe(trimmed);
            if (!data) continue;

            if (data.content) {
              accumulatedText += data.content;
              // Remove thinking indicator and create bubble on first text chunk
              if (!bubbleElement) {
                removeThinkingIndicator();
                bubbleElement = createStreamingMentorBubble();
              }
              // Render with streaming cursor while active
              bubbleElement.innerHTML = renderMarkdown(accumulatedText) + '<span class="streaming-cursor"></span>';
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            if (data.done === true) {
              ollamaCompleted = true;
            }
          } catch (lineErr) {
            console.warn('Could not parse streaming line:', trimmed, lineErr);
          }
        }
      }

      // Process any trailing line in buffer
      if (buffer.trim()) {
        const data = jsonParseSafe(buffer.trim());
        if (data && data.content) {
          accumulatedText += data.content;
          if (!bubbleElement) {
            removeThinkingIndicator();
            bubbleElement = createStreamingMentorBubble();
          }
          bubbleElement.innerHTML = renderMarkdown(accumulatedText) + '<span class="streaming-cursor"></span>';
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        if (data && data.done === true) {
          ollamaCompleted = true;
        }
      }
    } catch (streamReadErr) {
      console.error('Error while reading response stream:', streamReadErr);
    }

    // Clean up thinking indicator
    removeThinkingIndicator();

    // 9. Verify completion & save history
    if (ollamaCompleted && accumulatedText.trim()) {
      // Completed normally: re-render final HTML without cursor
      if (bubbleElement) {
        bubbleElement.innerHTML = renderMarkdown(accumulatedText);
      }
      conversationHistory.push({
        role: 'assistant',
        content: accumulatedText
      });
      saveConversationHistory();
    } else if (accumulatedText.trim()) {
      // Interrupted stream after AI text arrived: preserve partial text and flag interruption
      if (bubbleElement) {
        bubbleElement.innerHTML = renderMarkdown(
          accumulatedText + '\n\n*(⚠️ Response was interrupted)*'
        );
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
      conversationHistory.push({
        role: 'assistant',
        content: accumulatedText + ' [Response was interrupted]'
      });
      saveConversationHistory();
    } else {
      // Stream failed or closed before any AI text was produced
      throw new Error('Connection closed before AI response could be generated.');
    }

  } catch (error) {
    // Remove the unsent/unanswered user prompt from in-memory history
    conversationHistory.pop();

    // Remove thinking indicator before displaying error
    removeThinkingIndicator();

    // Provide clear, actionable messages for network/backend failures
    let userFacingMessage = error.message || 'Could not communicate with the AI server.';
    if (
      error.name === 'TypeError' &&
      (userFacingMessage.includes('fetch') ||
       userFacingMessage.includes('NetworkError') ||
       userFacingMessage.includes('Failed to fetch'))
    ) {
      userFacingMessage = 'Cannot connect to the AI Mentor backend. Please ensure the FastAPI server is running on http://127.0.0.1:8000.';
    }

    console.error('Failed to communicate with backend/AI:', error);
    appendMessage(
      `⚠️ ${userFacingMessage}`,
      'mentor',
      true
    );
  } finally {
    // Ensure thinking indicator is cleaned up under all conditions
    removeThinkingIndicator();

    // Re-enable input and action buttons, return focus
    messageInput.disabled = false;
    sendBtn.disabled = false;
    clearChatBtn.disabled = false;
    exportChatBtn.disabled = false;
    messageInput.focus();
  }
});

/**
 * Safely parses a JSON string, returns null on failure.
 * @param {string} str - JSON string to parse
 * @returns {object|null} Parsed object or null
 */
function jsonParseSafe(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// Initialize: load saved conversation history on app startup
loadConversationHistory();

// Handle Clear Chat button click
if (clearChatBtn) {
  clearChatBtn.addEventListener('click', clearConversation);
}

// Handle Export Chat button click
if (exportChatBtn) {
  exportChatBtn.addEventListener('click', exportConversation);
}




