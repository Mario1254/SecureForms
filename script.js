// Import the libraries
import JSSalsa20 from "js-salsa20";
import aesjs from "aes-js"

// Initialize the Salsa20 cipher with random key and nonce
const key = new Uint8Array(32); // Create a Uint8Array with 32 bytes (256 bits) for the key
const nonce = new Uint8Array(8); // Create a Uint8Array with 8 bytes (64 bits) for the nonce
// Generate random values for key and nonce using Web Crypto API
crypto.getRandomValues(key);
crypto.getRandomValues(nonce);
// Create instances of Salsa20 cipher for encryption and decryption
const encrCipher = new JSSalsa20(key, nonce);
const decrCipher = new JSSalsa20(key, nonce);

//ENCRYPTION CTR
// Generate random key and IV (nonce) using the Web Crypto API
//const keyCTR = new Uint8Array(16); // Create a Uint8Array of length 16 bytes (128 bits)
const keyCTR = new Uint8Array(32); // 16 bytes (256 bits)
const iv = new Uint8Array(16); // 16 bytes (128 bits)
crypto.getRandomValues(keyCTR);
crypto.getRandomValues(iv);
const counter = new aesjs.Counter(iv);
// Create the AES-CTR mode instance
const aesCtr = new aesjs.ModeOfOperation.ctr(keyCTR, counter);

let encryptionMethod = 'None';
chrome.storage.local.set({method: encryptionMethod});

function encryptChar(inputChar) {
  let encryptedHex;
  let startTime;
  let endTime;
  let timeTaken;
  console.log('Typed Character:', inputChar);
  switch (encryptionMethod) {
    case 'Salsa20':
      // Encode the input character to UTF-8 bytes using TextEncoder
      const textEncoder = new TextEncoder();
      const utf8Array = textEncoder.encode(inputChar);
      startTime = performance.now(); // Record start time
      // Encrypt the UTF-8 bytes
      const encryptedByte = encrCipher.encrypt(utf8Array);

      endTime = performance.now(); // End timer
      timeTaken = endTime - startTime; // Calculate time taken in milliseconds
      console.log('Time taken for encryption (ms):', timeTaken.toFixed(2));

      // Convert the encrypted bytes to a hex string
      encryptedHex = Array.from(encryptedByte)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      break;
    case 'AES':
      // Encrypt the character's bytes using AES-CTR
      const inputBytes = aesjs.utils.utf8.toBytes(inputChar);
      startTime = performance.now(); // Record start time
      const encryptedBytes = aesCtr.encrypt(inputBytes);

      endTime = performance.now(); // End timer
      timeTaken = endTime - startTime; // Calculate time taken in milliseconds
      console.log('Time taken for encryption (ms):', timeTaken.toFixed(2));

      // Convert encrypted bytes to hex
      encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
      break;
    default:
      encryptedHex = inputChar;
      break;
  }
  return encryptedHex;
}

function addCharToInput(textbox, event) {
  if (event.key === 'Backspace') {
    textbox.value = textbox.value.slice(0, -2);
   } else if (event.key.match(/^[\w\s@.,+!]*$/) && event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
    // Append the encrypted hex string to the encryptedValue
    let encryptedHex = encryptChar(event.key);
    textbox.value += encryptedHex;
    console.log('Encrypted Character:', encryptedHex);
  }
  textbox.dispatchEvent(new Event('input', { bubbles: true }));
  textbox.dispatchEvent(new Event('change', { bubbles: true }));
  textbox.dispatchEvent(new Event('blur', { bubbles: true }));
}


//ENCRYPTION 
// Content script message listener
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'startEncryption') {
    console.log('Starting encryption');

    // Listen for keydown event in textboxes for real-time encryption
    const textboxes = document.querySelectorAll('input[type="text"], input[type="password"]');
    console.log('Detected textboxes:', textboxes);

    textboxes.forEach(textbox => {
      textbox.addEventListener('keydown', function (event) {
        event.preventDefault(); // Prevent the default character input
        addCharToInput(textbox, event);
      });
    });
  }
});

//Decryption with SALSA
// Content script message listener for decryption
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'startDecryption' && !window.decryptionStarted) {
    console.log('Starting decryption...');

    const textboxes = document.querySelectorAll('input[type="text"], input[type="password"]');
    const decryptedStrings = []; // Array to store decrypted values

    textboxes.forEach(textbox => {
      const encryptedValue = textbox.value.trim(); // Get the encrypted value from the textbox

      let decryptedValue = '';


      for (let i = 0; i < encryptedValue.length; i += 2) {
        const hexByte = encryptedValue.substr(i, 2);

        const byteValue = parseInt(hexByte, 16);
        const encryptedUint8Array = new Uint8Array([byteValue]);
        const startTime = performance.now(); // Record the start time
        // Decrypt the single byte
        const decryptedBytes = decrCipher.decrypt(encryptedUint8Array);

        const endTime = performance.now(); // Record the end time
        const timeTaken = endTime - startTime; // Calculate the total time taken for decryption
        console.log('Time taken for decryption (ms):', timeTaken.toFixed(2)); // Display the time taken
        
        // Convert decrypted byte to a UTF-8 string
        const utf8String = new TextDecoder().decode(new Uint8Array(decryptedBytes));
        decryptedValue += utf8String;
      }
      decryptedStrings.push(decryptedValue);
    });

    // Send decrypted values back to the plugin
    console.log(decryptedStrings);
    chrome.runtime.sendMessage({ action: 'decryptionComplete', decryptedValues: decryptedStrings });
  }
});

/////////////////////////////////////////////////////////////////////////////
// DECRYPTION CTR BUTTON
// Content script message listener for decryption
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'startDecryptionWithCTR' && !window.decryptionStarted) {
    console.log('Starting decryption using AES CTR');

    const counter = new aesjs.Counter(iv);
    const aesCtr = new aesjs.ModeOfOperation.ctr(keyCTR, counter);

    const textboxes = document.querySelectorAll('input[type="text"], input[type="password"]');
    const decryptedValues = []; // Array to store decrypted values


    textboxes.forEach(textbox => {
      const encryptedValue = textbox.value.trim(); // Get the encrypted value from the textbox

      let decryptedValue = '';
      for (let i = 0; i < encryptedValue.length; i += 2) {
        // Get the hex byte from the encrypted value
        const hexByte = encryptedValue.substr(i, 2);
        const byteValue = parseInt(hexByte, 16);
        const startTime = performance.now(); // Record the start time

        // Decrypt the byte using AES-CTR
        const decryptedBytes = aesCtr.decrypt([byteValue]);

        const endTime = performance.now(); // Record the end time
        const timeTaken = endTime - startTime; // Calculate the total time taken for decryption
        console.log('Time taken for decryption (ms):', timeTaken.toFixed(2)); // Display the time taken

        // Convert decrypted byte to UTF-8 character
        const decryptedChar = aesjs.utils.utf8.fromBytes(decryptedBytes);


        decryptedValue += decryptedChar;
      }
      decryptedValues.push(decryptedValue);
    });
    // Send decrypted values back to the plugin
    console.log(decryptedValues);
    chrome.runtime.sendMessage({ action: 'decryptionCompleteCTR', decryptedValues });
  }
});

////////////////////////////////////////////////////////////////////////////////////////////
//METHOD 2
// Initialize separate arrays for each textbox
let capturedInputs = {};

const forms = document.querySelectorAll('form');

// Variable to track if the user is typing for the first time
let isTyping = false;

// Function to handle key presses and store captured input
function handleKeyPress(event) {
  event.preventDefault(); // Prevent the default character input
  const inputChar = event.key; // Get the pressed key

  // Check if this is the first keypress
  if (!isTyping) {
    // Clear the entire storage when the user starts typing for the first time
    chrome.storage.local.clear(function () {
      console.log('Storage cleared');
    });
    isTyping = true;
  }

  forms.forEach(form => {
    for (let index = 0; index < form.elements.length; index++) {
      const element = form.elements[index];
      if (element instanceof HTMLInputElement && event.target === element) {
        const identifier = form.id + "#" + element.id;
        typeof capturedInputs[identifier] === 'undefined' ? capturedInputs[identifier] = [] : null ;
        if (inputChar !== 'Backspace') {
          capturedInputs[identifier].push(inputChar);
          console.log('Input captured and stored:', inputChar);
        } else {
          capturedInputs[identifier].pop();
        }
        chrome.storage.local.set({formsData: capturedInputs}, function () {
          console.log('Updated array in storage:', identifier, capturedInputs[identifier]);
        });
      }
    }
  });

  // Clear the textbox value to prevent data display
  if (event.target) {
    event.target.value = 'a';
    event.target.dispatchEvent(new Event('input', { bubbles: true })); // Trigger an input event
  }
}

// ////////////////////////////////////////////////////////////////////////////////////////////
// //METHOD 2
// // Initialize separate arrays for each textbox
// let capturedInputsTextbox1 = [];
// let capturedInputsTextbox2 = [];

// const textboxes = document.querySelectorAll('input[type="text"], input[type="password"]');

// // Variable to track if the user is typing for the first time
// let isTyping = false;

// // Function to handle key presses and store captured input
// function handleKeyPress(event) {
//   event.preventDefault(); // Prevent the default character input
//   const inputChar = event.key; // Get the pressed key

//   // Check if this is the first keypress
//   if (!isTyping) {
//     // Clear the entire storage when the user starts typing for the first time
//     chrome.storage.local.clear(function () {
//       console.log('Storage cleared');
//     });
//     isTyping = true;
//   }

//   if (inputChar === 'Backspace') {
//     // Handle Backspace key press: remove the last character from the appropriate array
//     const textboxIndex = Array.from(textboxes).indexOf(event.target);
//     if (textboxIndex === 0) {
//       capturedInputsTextbox1.pop(); // Remove the last character
//       // Update the array in storage
//       updateStorage('capturedInputsTextbox1', capturedInputsTextbox1);
//     } else if (textboxIndex === 1) {
//       capturedInputsTextbox2.pop(); // Remove the last character
//       // Update the array in storage
//       updateStorage('capturedInputsTextbox2', capturedInputsTextbox2);
//     }
//   } else {

//     // Determine which textbox the input belongs to based on its position or any other criteria
//     const textboxIndex = Array.from(textboxes).indexOf(event.target);

//     if (textboxIndex === 0) {
//       capturedInputsTextbox1.push(inputChar);
//       // Update the array in storage
//     } else if (textboxIndex === 1) {
//       capturedInputsTextbox2.push(inputChar);
//       // Update the array in storage
//     }
//   }
//   // Store the captured input in your extension's storage
//   storeCapturedInput(inputChar);

//   // Clear the textbox value to prevent data display
//   if (event.target) {
//     event.target.value = 'a';
//     event.target.dispatchEvent(new Event('input', { bubbles: true })); // Trigger an input event
// }
// }

// // Function to update the array in extension's storage
// function updateStorage(storageKey, updatedArray) {
//   const storageObject = {};
//   storageObject[storageKey] = updatedArray;

//   chrome.storage.local.set(storageObject, function () {
//     console.log('Updated array in storage:', storageKey, updatedArray);
//   });
// }

// // Function to store captured input in extension's storage
// function storeCapturedInput(inputChar) {
//   // store the captured input in your extension's storage
//   const textboxIndex = Array.from(textboxes).indexOf(event.target);

//   if (inputChar !== 'Backspace') { // Skip storing "Backspace"
//     if (textboxIndex === 0) {
//       chrome.storage.local.get({ capturedInputsTextbox1: [] }, function (result) {
//         const capturedInputs = result.capturedInputsTextbox1;
//         capturedInputs.push(inputChar);

//         // Update the 'capturedInputsTextbox1' array in local storage
//         chrome.storage.local.set({ capturedInputsTextbox1: capturedInputs }, function () {
//           console.log('Input captured and stored:', inputChar);
//           console.log('Updated capturedInputsTextbox1 array:', capturedInputs);
//         });
//       });
//     } else if (textboxIndex === 1) {
//       chrome.storage.local.get({ capturedInputsTextbox2: [] }, function (result) {
//         const capturedInputs = result.capturedInputsTextbox2;
//         capturedInputs.push(inputChar);

//         // Update the 'capturedInputsTextbox2' array in local storage
//         chrome.storage.local.set({ capturedInputsTextbox2: capturedInputs }, function () {
//           console.log('Input captured and stored:', inputChar);
//           console.log('Updated capturedInputsTextbox2 array:', capturedInputs);
//         });
//       });
//     }
//   }
// }

function uint8ArrayToBase64(uint8Array) {
  return btoa(String.fromCharCode(...uint8Array));
}

function base64ToUint8Array(base64) {
  return new Uint8Array(atob(base64).split("").map(char => char.charCodeAt(0)));
}

function encryptSalsaMethod2() {
  chrome.storage.local.get("formsData", function (result) {
    const formsData = result.formsData;
    const capturedTextbox1 = formsData['loginForm#username'].join('');
    const capturedTextbox2 = formsData['loginForm#password'].join('');

    const startTime = performance.now(); // Start the timer

    const encodedTextbox1 = new TextEncoder().encode(capturedTextbox1);
    const encodedTextbox2 = new TextEncoder().encode(capturedTextbox2);

    const encryptedTextbox1 = encrCipher.encrypt(encodedTextbox1);
    const encryptedTextbox2 = encrCipher.encrypt(encodedTextbox2);

    const endTime = performance.now(); // Stop the timer
    const timeTaken = endTime - startTime;
    console.log('Encryption Time (ms):', timeTaken.toFixed(2));

    const encryptedTextbox1Base64 = uint8ArrayToBase64(encryptedTextbox1);
    const encryptedTextbox2Base64 = uint8ArrayToBase64(encryptedTextbox2);

    chrome.storage.local.set({formsData: {
      ['loginForm#username']: encryptedTextbox1Base64,
      ['loginForm#password']: encryptedTextbox2Base64
    }}, function () {
      console.log('Data encrypted and stored back');
      console.log(encryptedTextbox1Base64, encryptedTextbox2Base64);
    });
  });
}

function encryptCTRMethod2() {
  chrome.storage.local.get("formsData", function (result) {
    const formsData = result.formsData;
    const capturedTextbox1 = formsData['loginForm#username'].join('');
    const capturedTextbox2 = formsData['loginForm#password'].join('');

    const textBytes1 = aesjs.utils.utf8.toBytes(capturedTextbox1);
    const textBytes2 = aesjs.utils.utf8.toBytes(capturedTextbox2);

    const startTime = performance.now(); // Start the timer

    const aesCtr1 = new aesjs.ModeOfOperation.ctr(keyCTR, new aesjs.Counter(iv));
    const aesCtr2 = new aesjs.ModeOfOperation.ctr(keyCTR, new aesjs.Counter(iv));

    const encryptedBytes1 = aesCtr1.encrypt(textBytes1);
    const encryptedBytes2 = aesCtr2.encrypt(textBytes2);

    const endTime = performance.now(); // Stop the timer
    const timeTaken = endTime - startTime; // Calculate the time difference
    console.log('Encryption Time (ms):', timeTaken.toFixed(2)); // Log the time taken to encrypt the data

    const encryptedText1 = uint8ArrayToBase64(new Uint8Array(encryptedBytes1));
    const encryptedText2 = uint8ArrayToBase64(new Uint8Array(encryptedBytes2));

    chrome.storage.local.set({formsData: {
      ['loginForm#username']: encryptedText1,
      ['loginForm#password']: encryptedText2
    }}, function () {
      console.log('Data encrypted with AES CTR and stored back');
      console.log(encryptedText1, encryptedText2);
    });
  });
}

function decryptSalsaMethod2() {
  chrome.storage.local.get("formsData", function (result) {
    const formsData = result.formsData;
    const encryptedTextbox1Base64 = formsData['loginForm#username'];
    const encryptedTextbox2Base64 = formsData['loginForm#password'];

    const startTime = performance.now(); // Start the timer

    const encryptedTextbox1 = base64ToUint8Array(encryptedTextbox1Base64);
    const encryptedTextbox2 = base64ToUint8Array(encryptedTextbox2Base64);

    const decryptedTextbox1 = decrCipher.decrypt(encryptedTextbox1);
    const decryptedTextbox2 = decrCipher.decrypt(encryptedTextbox2);

    const endTime = performance.now(); // Stop the timer
    const timeTaken = endTime - startTime; // Calculate the time difference
    console.log('Decryption Time (ms):', timeTaken.toFixed(2)); // Log the time taken to decrypt the data

    const decryptedTextbox1String = new TextDecoder().decode(decryptedTextbox1);
    const decryptedTextbox2String = new TextDecoder().decode(decryptedTextbox2);

    chrome.storage.local.set({formsData: {
      ['loginForm#username']: Array.from(decryptedTextbox1String),
      ['loginForm#password']: Array.from(decryptedTextbox2String)
    }}, function () {
      console.log('Data decrypted and stored back');
      console.log(decryptedTextbox1String, decryptedTextbox2String);
    });
  });
}

function decryptCTRMethod2() {
  chrome.storage.local.get("formsData", function (result) {
    const formsData = result.formsData;
    const encryptedTextbox1 = formsData['loginForm#username'];
    const encryptedTextbox2 = formsData['loginForm#password'];

    const startTime = performance.now(); // Start the timer

    const encryptedBytes1 = base64ToUint8Array(encryptedTextbox1);
    const encryptedBytes2 = base64ToUint8Array(encryptedTextbox2);

    const aesCtr1 = new aesjs.ModeOfOperation.ctr(keyCTR, new aesjs.Counter(iv));
    const aesCtr2 = new aesjs.ModeOfOperation.ctr(keyCTR, new aesjs.Counter(iv));

    const decryptedBytes1 = aesCtr1.decrypt(encryptedBytes1);
    const decryptedBytes2 = aesCtr2.decrypt(encryptedBytes2);

    const endTime = performance.now(); // Stop the timer
    const timeTaken = endTime - startTime; // Calculate the time difference
    console.log('Decryption Time (ms):', timeTaken.toFixed(2)); // Log the time taken to decrypt the data

    const decryptedText1 = aesjs.utils.utf8.fromBytes(decryptedBytes1);
    const decryptedText2 = aesjs.utils.utf8.fromBytes(decryptedBytes2);

    chrome.storage.local.set({formsData: {
      ['loginForm#username']: Array.from(decryptedText1),
      ['loginForm#password']: Array.from(decryptedText2)
    }}, function () {
      console.log('Data decrypted with AES CTR and stored back');
      console.log(decryptedText1, decryptedText2);
    });
  });
}


// Content script message listener
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'startListening') {
    console.log('Starting listening to keystrokes');

    const textboxes = document.querySelectorAll('input[type="text"], input[type="password"]');
    textboxes.forEach(textbox => {
      textbox.addEventListener('keydown', handleKeyPress);
    });
  } else if (message.action === 'encryptSalsaMethod2') {
    encryptSalsaMethod2();
  } else if (message.action === 'encryptCTRMethod2') {
    encryptCTRMethod2();
  }
  else if (message.action === 'decryptSalsaMethod2') {
    decryptSalsaMethod2();
  }
  else if (message.action === 'decryptCTRMethod2') {
    decryptCTRMethod2();
  }
});

///////////////////////////////////////////////////////////////////////////////////////////
// VIRTUAL KEYBOARD
let focusedInput = null;
let originalKeyValues = [];

document.addEventListener('focusin', (event) => {
  if (event.target.tagName.toLowerCase() === 'input') {
    focusedInput = event.target;
  }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'showKeyboard') {
    injectVirtualKeyboard();
  }
});

function injectVirtualKeyboard() {
  // Check if the virtual keyboard shadow DOM is already added to the page
  if (!document.querySelector('#virtual-keyboard-container')) {
    const container = document.createElement('div');
    container.id = 'virtual-keyboard-container';
    document.body.appendChild(container);

    const shadow = container.attachShadow({ mode: 'closed' });

    // Load the virtual-keyboard.html content
    fetch(chrome.extension.getURL('virtual-keyboard.html'))
      .then(response => response.text())
      .then(html => {
        shadow.innerHTML = html;
        addKeyboardClickHandlers(shadow); // Add click handlers after injecting the keyboard
        preventEventPropagation(shadow); // Prevent events from propagating to the webpage
      });
  } else {
    // Toggle visibility if the keyboard is already present in the page
    const container = document.querySelector('#virtual-keyboard-container');
    const virtualKeyboard = container.shadowRoot.querySelector('#virtual-keyboard');
    virtualKeyboard.style.display = virtualKeyboard.style.display === 'none' ? 'block' : 'none';
  }
}

function addKeyboardClickHandlers(shadow) {
  const keys = shadow.querySelectorAll('.keyboard-key');
  keys.forEach(key => {
    key.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (focusedInput) {
        const char = event.target.textContent;
        var encryptedValue = focusedInput.value;
        encryptedValue = addCharToInput(focusedInput, { key: char }, encryptedValue);

        if (originalKeyValues.length === 0) {
          keys.forEach(key => {
            originalKeyValues.push(key.textContent);
          });
        }

        // Change all keys to "*"
        keys.forEach(key => {
          key.textContent = "*";
        });

        // Wait for 0.2 seconds, then reset keys and shuffle
        setTimeout(function () {
          resetKeyboardKeys(shadow);
          shuffleKeyboardKeys(shadow);
        }, 200); // 0.2 seconds
      }
    });
  });
}


function resetKeyboardKeys(shadow) {
  var keys = shadow.querySelectorAll('.keyboard-key');
  keys.forEach(function (key, index) {
    key.textContent = originalKeyValues[index];
  });
}

function shuffleKeyboardKeys(shadow) {
  var rows = shadow.querySelectorAll('#virtual-keyboard .row');
  rows.forEach(function (row) {
    var keys = Array.from(row.children);
    var shuffledKeys = keys.sort(function () {
      return 0.5 - Math.random();
    });
    shuffledKeys.forEach(function (key) {
      return row.appendChild(key);
    });
  });
}

function preventEventPropagation(shadow) {
  shadow.querySelector('#virtual-keyboard').addEventListener('click', function (event) {
    event.stopPropagation();
  });
}
//////////////////////////////////////////////////////////////////////////////////////
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.action === 'serverResponse') {
//     console.log('Server response received:', message.data);


//     const responseDiv = document.getElementById('serverResponse');
//     if (responseDiv) {
//       responseDiv.textContent = JSON.stringify(message.data);
//     } else {
//       // If there is no element with id 'serverResponse', you might want to create one:
//       const newDiv = document.createElement('div');
//       newDiv.id = 'serverResponse';
//       newDiv.textContent = JSON.stringify(message.data);
//       document.body.appendChild(newDiv);
//     }
//   }
// });

// Create a div and attach a shadow root to isolate the scripts that will be injected
const div = document.createElement('div');
const shadowRoot = div.attachShadow({ mode: "closed" });
document.body.appendChild(div);
// Create script elements for the Salsa20 and AES libraries and the injected script and append them to the shadow root
// After the libraries are loaded, initialize the ciphers with keys and call uniqueOverrideRequests from the injected script
const salsaLib = document.createElement('script');
salsaLib.src = chrome.runtime.getURL('jssalsa20.js'); // Replace with the actual URL of the library
salsaLib.onload = () => {
  const aesLib = document.createElement('script');
  aesLib.src = chrome.runtime.getURL('aes-js.js'); // Replace with the actual URL of the library
  aesLib.onload = () => {
    const injected = document.createElement('script');
    injected.src = chrome.runtime.getURL('injected.js');
    shadowRoot.appendChild(injected);
  }
  shadowRoot.appendChild(aesLib);
}
shadowRoot.appendChild(salsaLib);

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'toggleMethod') {
    const overrideScript = document.createElement('script');
    switch (message.method) {
      case 'None':
        encryptionMethod = 'None';
        overrideScript.textContent = 'uniqueOverrideRequests("None");';
        break;
      case 'Salsa20':
        encryptionMethod = 'Salsa20';
        const keysSalsa = {key: Array.from(key), nonce: Array.from(nonce)};
        overrideScript.textContent = 'uniqueOverrideRequests(' + JSON.stringify(encryptionMethod) + ',' + JSON.stringify(keysSalsa) + ');';
        break;
      case 'AES':
        encryptionMethod = 'AES';
        const keysAES = {key: Array.from(keyCTR), iv: Array.from(iv)};
        overrideScript.textContent = 'uniqueOverrideRequests(' + JSON.stringify(encryptionMethod) + ',' + JSON.stringify(keysAES) + ');'; 
        break;
      case 'storage':
        encryptionMethod = 'storage';
        overrideScript.textContent = 'uniqueOverrideRequests(' + JSON.stringify(encryptionMethod) + ');';
        break;
    }
    shadowRoot.appendChild(overrideScript);
    overrideScript.remove();
    console.log(encryptionMethod);
  }
});