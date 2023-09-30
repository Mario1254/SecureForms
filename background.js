
chrome.runtime.onMessageExternal.addListener(function (message, sender, sendResponse) {
  console.log(sender.tab ?
    "from a content script:" + sender.tab.url :
    "from the extension");
  if (message.action === 'getFromStorage') {
    console.log('getFromStorage')
    chrome.storage.local.get("formsData", function (result) { //gets formsData from storage
      const formsData = result.formsData;    
      // loop through each key-value pair in formsData
      for (const key in formsData) {
        if (Object.hasOwnProperty.call(formsData, key)) {
          // If the key matches the field specified in the message, send the value back
          if (key.includes(message.field)) {
            sendResponse({ [message.field]: formsData[key].join('') });
          }
        }
      }
    });
  }
});
