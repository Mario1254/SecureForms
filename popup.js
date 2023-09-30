let popupWindow = null;

// Function for Encryption button click 
function handleEncryptionButtonClick() {
  console.log('Encryption button clicked');
  // Send a message to the content script to start encryption
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'startEncryption' });
  });
}

// Function for the messages from script.js (content script)
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'startEncryption') {
    // Handle the encrypted text received from the content script
    console.log('Encrypted Text:', message.text);
    const encryptedOutput = document.getElementById('encryptedOutput');
    if (encryptedOutput) {
      encryptedOutput.textContent = message.text;
    }
  }
});


// Function for the Decryption button click for Salsa
function handleDecryptionButtonClick() {
  console.log('Decryption button clicked');
  requestSent = false; // Reset the flag for a new decryption
  // Send a message to the content script to start decryption
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'startDecryption' });
  });
}

// Function for the Decryption button click for AES-CTR
function DecryptionButtonClickWithCTR() {
  console.log('CTR Decryption button clicked');
  requestSent = false; // Reset the flag for a new decryption
  // Send a message to the content script to start decryption
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'startDecryptionWithCTR' });
  });
}



chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'decryptionComplete' || message.action === 'decryptionCompleteCTR') {
    // Listen for the message from script.js
    document.getElementById('decryptedTextbox1').value = message.decryptedValues[0];
    document.getElementById('decryptedTextbox2').value = message.decryptedValues[1];
    console.log('Decrypted Text:', message.decryptedValues);
  } else if (message.action === 'inputCaptured') {
    // Listen for messages from script.js
    console.log('Input captured:', message.inputChar);
  }
});

// Method 2
function startListening() {
  // Send a message to the script.js to start listening to keystrokes
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'startListening' });
  });
}


// Function for the Virtual Keyboard button click
function handleKeyboardButtonClick() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'showKeyboard' });
  });
}
/////////////////////////////////////////////////

// event listeners to the buttons
document.addEventListener('DOMContentLoaded', function () {
  const encryptButton = document.getElementById('encryptSalsa'); // Encrypt button for both Salsa and AES
  encryptButton.addEventListener('click', handleEncryptionButtonClick);

  const enableButton = document.getElementById('decryptSalsa'); // Decrypt for Salsa
  enableButton.addEventListener('click', handleDecryptionButtonClick);

  const decryptButtonCTR = document.getElementById('decryptCTR'); // Decrypt for AES-CTR
  decryptButtonCTR.addEventListener('click', DecryptionButtonClickWithCTR);

  document.getElementById('encryption').addEventListener('click', function (event) { //toggle button
    console.log(document.getElementById('encryption').textContent);
    switch (document.getElementById('encryption').textContent) {
      case 'None':
        document.getElementById('encryption').textContent = 'Salsa20';
        break;
      case 'Salsa20':
        document.getElementById('encryption').textContent = 'AES';
        break;
      case 'AES':
        document.getElementById('encryption').textContent = 'None';
        break;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleMethod', method: document.getElementById('encryption').textContent });
      chrome.storage.local.set({method: document.getElementById('encryption').textContent});
    });
  });

  // Set encryption method button label from storage whenever the extension is opened.
  chrome.storage.local.get("method", function (result) {
    console.log(result);
    if (typeof result.method === 'string') {
      document.getElementById('encryption').textContent = result.method;
    }
  });

  document.getElementById('setToStorageButton').addEventListener('click', function (event) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleMethod', method: 'storage' });
      chrome.storage.local.set({method: "None"});
    });
  });

  // Save the popup window object
  popupWindow = window;

  //METHOD 2
  const startListeningButton = document.getElementById('startMethod2');
  startListeningButton.addEventListener('click', startListening);

  document.getElementById('encryptSalsaM2').addEventListener('click', function () { //Encryption in Method 2 with Salsa
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'encryptSalsaMethod2' });
    });
  });

  document.getElementById('encryptCTRM2').addEventListener('click', function () { //Encryption in Method 2 with AES-CTR
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'encryptCTRMethod2' });
    });
  });

  document.getElementById('decryptSalsaM2').addEventListener('click', function () { //Decryption in Method 2 with Salsa
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'decryptSalsaMethod2' });
    });
  });

  document.getElementById('decryptCTRM2').addEventListener('click', function () { //Decryption in Method 2 with AES-CTR
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'decryptCTRMethod2' });
    });
  });

  document.getElementById('viewCapturedData').addEventListener('click', function () { //View Captured Data Button click that places data from storage in textboxes
    // Retrieve the captured data from chrome.storage.local
    chrome.storage.local.get("formsData", function (result) {
      const formsData = result.formsData
      for (const key in formsData) {
        if (Object.hasOwnProperty.call(formsData, key)) {
          const data = formsData[key].join('');
          if (key.includes('username')) {
            document.getElementById('decryptedTextbox1').value = data;
          } else if (key.includes('password')) {
            document.getElementById('decryptedTextbox2').value = data;
          }
        }
      }
    });
  });

  // Add an event listener to the Virtual Keyboard button to show the virtual keyboard
  document.getElementById('keyboardButton').addEventListener('click', handleKeyboardButtonClick);

});
