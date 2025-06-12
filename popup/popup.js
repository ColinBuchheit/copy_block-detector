document.getElementById("enableCopy").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "ENABLE_COPY" });
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATUS_UPDATE") {
    document.getElementById("status").innerText = msg.message;
  }
});
