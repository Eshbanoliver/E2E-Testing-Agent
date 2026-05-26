import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface RecordedEvent {
  id: string;
  timestamp: number;
  type: 'navigate' | 'click' | 'fill' | 'assert_visible' | 'assert_text' | 'scroll';
  url?: string;
  selector?: string;
  value?: string;
  text?: string;
  role?: string;
  name?: string;
  tagName?: string;
}

let activeBrowser: Browser | null = null;
let activeContext: BrowserContext | null = null;
let activePage: Page | null = null;
let recordedEvents: RecordedEvent[] = [];
let isRecording = false;
let targetUrl = '';

// Injected Script content
const RECORDER_INJECT_SCRIPT = (serverUrl: string) => `
(function() {
  if (window.__E2E_RECORDER_INJECTED__) return;
  window.__E2E_RECORDER_INJECTED__ = true;

  const SERVER_URL = '${serverUrl}';
  let isAssertionMode = false;
  let assertionType = null; // 'visible' | 'text'
  let lastHoveredElement = null;
  let originalBorder = '';

  // Log to console helper
  function log(msg) {
    console.log('[E2E Recorder Script]:', msg);
  }

  // Send event helper
  async function sendEvent(eventData) {
    // If the overlay was removed, stop recording events (unless it's the initial navigation)
    if (eventData.type !== 'navigate' && !document.getElementById('e2e-recorder-overlay')) {
      return;
    }
    try {
      await fetch(SERVER_URL + '/api/record-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
    } catch (e) {
      log('Error sending event: ' + e.message);
    }
  }

  // Get Element Selector Helper
  function getElementSelector(el) {
    if (el.getAttribute('data-testid')) {
      return \`[data-testid="\${el.getAttribute('data-testid')}"]\`;
    }
    if (el.getAttribute('data-qa')) {
      return \`[data-qa="\${el.getAttribute('data-qa')}"]\`;
    }
    if (el.id) {
      return \`#\${el.id}\`;
    }
    if (el.tagName === 'INPUT' && el.name) {
      return \`input[name="\${el.name}"]\`;
    }
    
    // CSS Path generator
    const paths = [];
    for (; el && el.nodeType === 1; el = el.parentNode) {
      if (el.id) {
        paths.unshift('#' + el.id);
        break;
      }
      let tagName = el.tagName.toLowerCase();
      let index = 1;
      let sibling = el.previousSibling;
      while (sibling) {
        if (sibling.nodeType === 1 && sibling.tagName === el.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      const hasSiblings = el.nextSibling || el.previousSibling;
      paths.unshift(tagName + (index > 1 || hasSiblings ? \`:nth-child(\${index})\` : ''));
    }
    return paths.join(' > ');
  }

  // Get Accessibility info
  function getAccessibilityInfo(el) {
    let role = el.getAttribute('role') || '';
    if (!role) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'button') role = 'button';
      else if (tag === 'a') role = 'link';
      else if (tag === 'input') {
        const type = el.type || 'text';
        if (type === 'checkbox') role = 'checkbox';
        else if (type === 'radio') role = 'radio';
        else if (type === 'submit' || type === 'button') role = 'button';
        else role = 'textbox';
      }
      else if (tag === 'textarea') role = 'textbox';
      else if (tag === 'select') role = 'combobox';
    }
    const name = el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || '';
    return { role, name: name.trim().substring(0, 50) };
  }

  // Create UI overlay
  function createOverlay() {
    if (window !== window.top) return; // Guard to only create UI in the main frame!
    const container = document.createElement('div');
    container.id = 'e2e-recorder-overlay';
    container.style.cssText = \`
      position: fixed;
      top: 15px;
      right: 15px;
      z-index: 9999999;
      background: rgba(17, 19, 24, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 240, 255, 0.4);
      box-shadow: 0 4px 24px rgba(0, 240, 255, 0.25), 0 0 10px rgba(0, 240, 255, 0.1);
      border-radius: 8px;
      padding: 10px 14px;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 250px;
      cursor: move;
      user-select: none;
    \`;

    const header = document.createElement('div');
    header.style.cssText = \`
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 6px;
      font-weight: 600;
    \`;

    const statusDot = document.createElement('span');
    statusDot.style.cssText = \`
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
      margin-right: 6px;
      animation: pulse 1.5s infinite;
    \`;
    
    // Inject CSS animations keyframe
    const styleSheet = document.createElement("style");
    styleSheet.innerText = \`
      @keyframes pulse {
        0% { opacity: 0.4; }
        50% { opacity: 1; }
        100% { opacity: 0.4; }
      }
      .e2e-rec-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #ffffff;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      .e2e-rec-btn:hover {
        background: rgba(0, 240, 255, 0.15);
        border-color: #00f0ff;
        box-shadow: 0 0 8px rgba(0, 240, 255, 0.2);
      }
      .e2e-rec-btn.active {
        background: rgba(16, 185, 129, 0.2);
        border-color: #10b981;
        color: #10b981;
        font-weight: bold;
      }
      .e2e-rec-btn-stop {
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid #ef4444;
        color: #ef4444;
      }
      .e2e-rec-btn-stop:hover {
        background: #ef4444;
        color: #ffffff;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
      }
    \`;
    document.head.appendChild(styleSheet);

    const titleContainer = document.createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.alignItems = 'center';
    titleContainer.appendChild(statusDot);
    
    const titleText = document.createTextNode('E2E RECORDER');
    titleContainer.appendChild(titleText);
    header.appendChild(titleContainer);

    const closeIcon = document.createElement('span');
    closeIcon.innerText = '✕';
    closeIcon.style.cursor = 'pointer';
    closeIcon.style.opacity = '0.7';
    closeIcon.addEventListener('click', () => container.remove());
    header.appendChild(closeIcon);

    container.appendChild(header);

    // Info panel
    const infoPanel = document.createElement('div');
    infoPanel.id = 'e2e-recorder-info';
    infoPanel.style.color = '#a0aec0';
    infoPanel.style.fontSize = '11px';
    infoPanel.innerText = 'Actions will be auto-recorded. Click buttons below to add manual assertions.';
    container.appendChild(infoPanel);

    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = \`
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
    \`;

    const btnAssertVisible = document.createElement('button');
    btnAssertVisible.className = 'e2e-rec-btn';
    btnAssertVisible.innerHTML = '🔍 Assert Element Visible';
    btnAssertVisible.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAssertionMode('visible');
    });

    const btnAssertText = document.createElement('button');
    btnAssertText.className = 'e2e-rec-btn';
    btnAssertText.innerHTML = '📝 Assert Element Text';
    btnAssertText.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAssertionMode('text');
    });

    const btnStop = document.createElement('button');
    btnStop.className = 'e2e-rec-btn e2e-rec-btn-stop';
    btnStop.innerHTML = '🛑 Finish Recording';
    btnStop.addEventListener('click', async (e) => {
      e.stopPropagation();
      infoPanel.innerText = 'Saving recording...';
      try {
        await fetch(SERVER_URL + '/api/stop-recording', { method: 'POST' });
      } catch (err) {
        log('Error stopping: ' + err.message);
      }
    });

    buttonsContainer.appendChild(btnAssertVisible);
    buttonsContainer.appendChild(btnAssertText);
    buttonsContainer.appendChild(btnStop);
    container.appendChild(buttonsContainer);

    document.body.appendChild(container);

    // Make Draggable
    let isDragging = false;
    let currentX, currentY, initialX, initialY;
    let xOffset = 0, yOffset = 0;

    container.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      isDragging = true;
    }

    function drag(e) {
      if (!isDragging) return;
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      container.style.transform = \`translate(\${currentX}px, \${currentY}px)\`;
    }

    function dragEnd() {
      isDragging = false;
    }

    function toggleAssertionMode(type) {
      if (isAssertionMode && assertionType === type) {
        // Turn off
        isAssertionMode = false;
        assertionType = null;
        btnAssertVisible.classList.remove('active');
        btnAssertText.classList.remove('active');
        infoPanel.innerText = 'Actions will be auto-recorded. Click buttons below to add manual assertions.';
        document.body.style.cursor = 'default';
        if (lastHoveredElement) {
          lastHoveredElement.style.border = originalBorder;
        }
      } else {
        // Turn on or switch
        isAssertionMode = true;
        assertionType = type;
        btnAssertVisible.classList.toggle('active', type === 'visible');
        btnAssertText.classList.toggle('active', type === 'text');
        infoPanel.innerHTML = \`🎯 Assert Mode [<strong>\${type.toUpperCase()}</strong>] Active. Hover over element and click.\`;
        document.body.style.cursor = 'crosshair';
      }
    }

    // Keep references global so event listeners can use them
    window.__E2E_RECORDER_TOGGLE__ = toggleAssertionMode;
    window.__E2E_RECORDER_UI__ = { btnAssertVisible, btnAssertText, infoPanel };
  }

  // Hover effect during assertion mode
  document.addEventListener('mouseover', (e) => {
    if (!isAssertionMode) return;
    const path = e.composedPath ? e.composedPath() : [];
    const el = path.length > 0 ? path[0] : e.target;
    // Don't highlight overlay UI
    if (el.closest('#e2e-recorder-overlay')) return;

    if (lastHoveredElement && lastHoveredElement !== el) {
      lastHoveredElement.style.border = originalBorder;
    }

    lastHoveredElement = el;
    originalBorder = el.style.border;
    el.style.border = '2px dashed #00f0ff';
  }, true);

  document.addEventListener('mouseout', (e) => {
    if (!isAssertionMode) return;
    const path = e.composedPath ? e.composedPath() : [];
    const el = path.length > 0 ? path[0] : e.target;
    if (el === lastHoveredElement) {
      el.style.border = originalBorder;
      lastHoveredElement = null;
    }
  }, true);

  // Click interceptor (captures clicks and assertions)
  document.addEventListener('click', (e) => {
    const path = e.composedPath ? e.composedPath() : [];
    const el = path.length > 0 ? path[0] : e.target;
    if (el.closest('#e2e-recorder-overlay')) return;

    const selector = getElementSelector(el);
    const text = el.innerText || el.value || '';
    const acc = getAccessibilityInfo(el);

    if (isAssertionMode) {
      e.preventDefault();
      e.stopPropagation();

      // Send assertion event
      const type = assertionType === 'visible' ? 'assert_visible' : 'assert_text';
      sendEvent({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        type,
        selector,
        text: text.trim(),
        role: acc.role,
        name: acc.name,
        tagName: el.tagName
      });

      // Exit assertion mode
      if (window.__E2E_RECORDER_TOGGLE__) {
        window.__E2E_RECORDER_TOGGLE__(assertionType);
      }
      return;
    }

    // Capture standard click
    sendEvent({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      type: 'click',
      selector,
      text: text.trim(),
      role: acc.role,
      name: acc.name,
      tagName: el.tagName
    });
  }, true);

  // Input changes interceptor
  document.addEventListener('change', (e) => {
    const path = e.composedPath ? e.composedPath() : [];
    const el = path.length > 0 ? path[0] : e.target;
    if (el.closest('#e2e-recorder-overlay')) return;

    // Ignore checkboxes and radio buttons to prevent duplicate click/fill events
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
      return;
    }

    const selector = getElementSelector(el);
    const acc = getAccessibilityInfo(el);

    sendEvent({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      type: 'fill',
      selector,
      value: el.value,
      role: acc.role,
      name: acc.name,
      tagName: el.tagName
    });
  }, true);

  // Load handler (for recording initial navigation)
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    createOverlay();
    // Record page navigation
    sendEvent({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      type: 'navigate',
      url: window.location.href
    });
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      createOverlay();
      sendEvent({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        type: 'navigate',
        url: window.location.href
      });
    });
  }

  // SPA routing interceptor
  let lastUrl = window.location.href;
  function checkUrlChange() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      sendEvent({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        type: 'navigate',
        url: lastUrl
      });
    }
  }

  window.addEventListener('popstate', checkUrlChange);
  window.addEventListener('hashchange', checkUrlChange);

  // Monkey-patch pushState and replaceState
  const originalPushState = window.history.pushState;
  if (originalPushState) {
    window.history.pushState = function(...args) {
      const res = originalPushState.apply(this, args);
      checkUrlChange();
      return res;
    };
  }
  const originalReplaceState = window.history.replaceState;
  if (originalReplaceState) {
    window.history.replaceState = function(...args) {
      const res = originalReplaceState.apply(this, args);
      checkUrlChange();
      return res;
    };
  }
})();
`;

/**
 * Launches a headful browser session and injects the recorder script.
 */
export async function startRecording(url: string, serverPort: number): Promise<void> {
  if (isRecording) {
    throw new Error('Recording session already active.');
  }

  recordedEvents = [];
  targetUrl = url;
  isRecording = true;

  try {
    activeBrowser = await chromium.launch({
      headless: false,
      args: ['--start-maximized']
    });

    activeContext = await activeBrowser.newContext({
      viewport: null // Takes full size
    });

    activePage = await activeContext.newPage();

    // Inject recorder script on every frame / navigation across ALL pages/tabs in context
    const serverUrl = `http://localhost:${serverPort}`;
    await activeContext.addInitScript(RECORDER_INJECT_SCRIPT(serverUrl));

    // Navigate to target
    await activePage.goto(url);
  } catch (error) {
    await stopRecording();
    throw error;
  }
}

/**
 * Add event to the in-memory recorded events queue
 */
export function recordEvent(event: RecordedEvent): void {
  if (!isRecording) return;
  
  // Clean up duplicate navigations or back-to-back duplicate inputs
  if (event.type === 'navigate') {
    const lastEvent = recordedEvents[recordedEvents.length - 1];
    if (lastEvent && lastEvent.type === 'navigate' && lastEvent.url === event.url) {
      return; // Skip duplicate initial navigation
    }
  } else if (event.type === 'fill') {
    // If we've recorded a fill for the same selector previously, update it instead of making a new action
    const lastFillIndex = [...recordedEvents].reverse().findIndex(e => e.selector === event.selector && e.type === 'fill');
    if (lastFillIndex !== -1) {
      const index = recordedEvents.length - 1 - lastFillIndex;
      recordedEvents[index].value = event.value;
      recordedEvents[index].timestamp = event.timestamp;
      return;
    }
  }

  recordedEvents.push(event);
}

/**
 * Returns currently recorded events
 */
export function getRecordedEvents(): RecordedEvent[] {
  return recordedEvents;
}

/**
 * Safely tear down active recording session
 */
export async function stopRecording(): Promise<RecordedEvent[]> {
  isRecording = false;
  
  if (activeBrowser) {
    try {
      await activeBrowser.close();
    } catch (e) {
      console.error('Error closing browser:', e);
    }
  }

  activeBrowser = null;
  activeContext = null;
  activePage = null;

  return recordedEvents;
}

/**
 * Checks if a session is currently active
 */
export function getRecordingStatus() {
  return {
    isRecording,
    targetUrl,
    eventCount: recordedEvents.length
  };
}
