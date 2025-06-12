// content/content.js

// Detect copy-paste blocking styles and context menu restrictions
function detectCopyBlocking() {
  const styles = window.getComputedStyle(document.body);
  const userSelectBlocked = styles.userSelect === 'none';

  if (userSelectBlocked) {
    chrome.runtime.sendMessage({ type: 'BLOCKED_COPY' });
  }

  let contextBlocked = false;
  document.addEventListener('contextmenu', (e) => {
    if (!contextBlocked) {
      contextBlocked = true;
      chrome.runtime.sendMessage({ type: 'BLOCKED_CONTEXT' });
    }
  }, { once: true });
}

detectCopyBlocking();

// Detect if the website is monitoring copy or paste events
function detectCopySurveillance() {
  const inlineCopyHandler = !!document.body.oncopy;
  const inlinePasteHandler = !!document.body.onpaste;

  if (inlineCopyHandler || inlinePasteHandler) {
    chrome.runtime.sendMessage({
      type: 'COPY_TRACKING',
      detail: inlineCopyHandler ? 'copy' : 'paste',
      source: 'inline'
    });
  }

  // Global event listener interception
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (type === 'copy' || type === 'paste') {
      chrome.runtime.sendMessage({
        type: 'COPY_TRACKING',
        detail: type,
        source: 'listener'
      });
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
}

detectCopySurveillance();

// Enable copy-paste functionality by resetting styles and event listeners
function enableCopyFix() {
  document.body.style.userSelect = 'text';
  document.body.style.webkitUserSelect = 'text';
  document.body.style.msUserSelect = 'text';
  document.body.oncontextmenu = null;
  document.body.onselectstart = null;
  document.body.oncopy = null;

  document.querySelectorAll("*").forEach(el => {
    el.oncontextmenu = null;
    el.onselectstart = null;
    el.style.userSelect = 'text';
  });

  chrome.runtime.sendMessage({
    type: 'STATUS_UPDATE',
    message: '✅ Copy restrictions removed.'
  });
}

// Message listener for popup interactions
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ENABLE_COPY') {
    enableCopyFix();
  }
});
