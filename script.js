// Import the libraries
import JSSalsa20 from "js-salsa20";
import aesjs from "aes-js"

// Key and nonce for Salsa20
const key = new Uint8Array(32); // Uint8Array with 32 bytes (256 bits) for the key
const nonce = new Uint8Array(8); //  Uint8Array with 8 bytes (64 bits) for the nonce
// random values for key and nonce using Web Crypto API
crypto.getRandomValues(key);
crypto.getRandomValues(nonce);
// instances of Salsa20 cipher for encryption and decryption
const encrCipher = new JSSalsa20(key, nonce);
const decrCipher = new JSSalsa20(key, nonce);

//Key and IV for AES-CTR
const keyCTR = new Uint8Array(16); // 16 bytes (128 bits)
//const keyCTR = new Uint8Array(32); // 32 bytes (256 bits)
const iv = new Uint8Array(16); // 16 bytes (128 bits)
// random key and IV using the Web Crypto API
crypto.getRandomValues(keyCTR);
crypto.getRandomValues(iv);
const counter = new aesjs.Counter(iv);
const aesCtr = new aesjs.ModeOfOperation.ctr(keyCTR, counter); // AES-CTR mode instance

let encryptionMethod = 'None';
chrome.storage.local.set({method: encryptionMethod});

function encryptChar(inputChar) {
  let encryptedHex;
  let startTime;
  let endTime;
  let timeTaken;
  console.log('Typed Character:', inputChar);
  switch (encryptionMethod) {
    case 'Salsa20':  // encryption when the toggle button is on Salsa20 
      // Encode the input character to UTF-8 byte using TextEncoder
      const textEncoder = new TextEncoder();
      const utf8Byte = textEncoder.encode(inputChar);
      startTime = performance.now(); // Record start time

      const encryptedByte = encrCipher.encrypt(utf8Byte); //Encrypt the byte

      endTime = performance.now(); // End timer
      timeTaken = endTime - startTime; // Calculate time  
      console.log('Time taken for encryption (ms):', timeTaken.toFixed(8));

      encryptedHex = Array.from(encryptedByte)    // Convert the encrypted bytes to a hex 
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      break;

    case 'AES':
      // Encode the input character to UTF-8 byte
      const inputBytes = aesjs.utils.utf8.toBytes(inputChar);
      startTime = performance.now(); // Record start time

      const encryptedBytes = aesCtr.encrypt(inputBytes); //Encrypt

      endTime = performance.now(); // End timer
      timeTaken = endTime - startTime; // Calculate time 
      console.log('Time taken for encryption (ms):', timeTaken.toFixed(2));

      encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);   // Convert encrypted bytes to hex
      break;
    default:
      encryptedHex = inputChar;
      break;
  }
  return encryptedHex;
}

function addCharToInput(textbox, event) {
  if (event.key === 'Backspace') {
    textbox.value = textbox.value.slice(0, -2); //remove the last two characters (2 hex)
    // Check if pressed key is alphanumeric or one of the symbols and no modifier keys are pressed
   } else if (event.key.match(/^[\w\s@.,+!]*$/) && event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
    // add the encrypted hex string to the encryptedValue
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

    // Listen for keydown event in textboxes 
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

//DECRYPTION with SALSA
// Content script message listener for decryption with Salsa
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'startDecryption' && !window.decryptionStarted) {
    console.log('Starting decryption...');

    const textboxes = document.querySelectorAll('input[type="text"], input[type="password"]');
    const decryptedStrings = []; // Array to store decrypted values

    textboxes.forEach(textbox => {
      const encryptedValue = textbox.value.trim(); // Get the encrypted value from the textbox

      let decryptedValue = '';

      for (let i = 0; i < encryptedValue.length; i += 2) { 
        const hexByte = encryptedValue.substr(i, 2); //extract two hex characters

        const byteValue = parseInt(hexByte, 16);
        const encryptedUint8Array = new Uint8Array([byteValue]); //convert and int to a Unit8Array
        const startTime = performance.now(); // Record the start time

        const decryptedBytes = decrCipher.decrypt(encryptedUint8Array);    // Decrypt the single byte

        const endTime = performance.now(); // Record the end time
        const timeTaken = endTime - startTime; // Calculate the time 
        console.log('Time taken for decryption (ms):', timeTaken.toFixed(2)); 
        
        // Convert decrypted byte to a UTF-8 
        const utf8String = new TextDecoder().decode(new Uint8Array(decryptedBytes));
        decryptedValue += utf8String; // add the decrypted character to the string
      }
      decryptedStrings.push(decryptedValue);
    });

    // Send decrypted values back to popup.js
    console.log(decryptedStrings);
    chrome.runtime.sendMessage({ action: 'decryptionComplete', decryptedValues: decryptedStrings });
  }
});

/////////////////////////////////////////////////////////////////////////////
// DECRYPTION with AES-CTR
// Content script message listener for decryption with AES-CTR
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
        const hexByte = encryptedValue.substr(i, 2);   // Get the hex from the encrypted value
        const byteValue = parseInt(hexByte, 16);
        const startTime = performance.now(); // Record the start time

        // Decrypt the byte using AES-CTR
        const decryptedBytes = aesCtr.decrypt([byteValue]);

        const endTime = performance.now(); // Record the end time
        const timeTaken = endTime - startTime; // Calculate the time 
        console.log('Time taken for decryption (ms):', timeTaken.toFixed(2)); 

        // Convert decrypted byte to UTF-8 character
        const decryptedChar = aesjs.utils.utf8.fromBytes(decryptedBytes);
        decryptedValue += decryptedChar;
      }
      decryptedValues.push(decryptedValue);
    });
    // Send decrypted values to popup.js
    console.log(decryptedValues);
    chrome.runtime.sendMessage({ action: 'decryptionCompleteCTR', decryptedValues });
  }
});

////////////////////////////////////////////////////////////////////////////////////////////
//METHOD 2
// Initialize separate arrays for each textbox
let capturedInputs = {};

const forms = document.querySelectorAll('form');
//console.log(forms);

// Variable to monitor if the user is typing for the first time
let isTyping = false;

// Function for key presses and store captured input
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
    //go through each elemnt inside the form
    for (let index = 0; index < form.elements.length; index++) {
      const element = form.elements[index];
      // Check if the current element is an input field and if it is the target of the keypress event
      if (element instanceof HTMLInputElement && event.target === element) {
        const identifier = form.id + "#" + element.id;
        typeof capturedInputs[identifier] === 'undefined' ? capturedInputs[identifier] = [] : null ; // Initialize the storage array for this input field 
        if (inputChar !== 'Backspace') {
          capturedInputs[identifier].push(inputChar);
          console.log('Input captured and stored:', inputChar);
        } else {
          capturedInputs[identifier].pop(); // remove the last character from the storage array if Backspace is pressed
        }
        chrome.storage.local.set({formsData: capturedInputs}, function () {
          console.log('Updated array in storage:', identifier, capturedInputs[identifier]);
        });
      }
    }
  });

  // Clear the textbox value to prevent data display
  if (event.target) {
    event.target.value = 'a'; // add "a"
    event.target.dispatchEvent(new Event('input', { bubbles: true })); // Trigger an input event
  }
}

function uint8ArrayToBase64(uint8Array) {
  return btoa(String.fromCharCode(...uint8Array)); //encode the string into base64
}

function base64ToUint8Array(base64) {
  //decode base64, split into an array, map each character to its char code, convert to Unit8Array
  return new Uint8Array(atob(base64).split("").map(char => char.charCodeAt(0))); 
}

//Method 2. Encryption with Salsa20
function encryptSalsaMethod2() {
  chrome.storage.local.get("formsData", function (result) {
    const formsData = result.formsData;
    const capturedTextbox1 = formsData['loginForm#username'].join(''); //extract and join data from storage
    const capturedTextbox2 = formsData['loginForm#password'].join('');

    const startTime = performance.now(); // Start the timer

    const encodedTextbox1 = new TextEncoder().encode(capturedTextbox1); // to utf8
    const encodedTextbox2 = new TextEncoder().encode(capturedTextbox2);

    const encryptedTextbox1 = encrCipher.encrypt(encodedTextbox1); //encrypt
    const encryptedTextbox2 = encrCipher.encrypt(encodedTextbox2);

    const endTime = performance.now(); // Stop the timer
    const timeTaken = endTime - startTime;
    console.log('Encryption Time (ms):', timeTaken.toFixed(2));

    const encryptedTextbox1Base64 = uint8ArrayToBase64(encryptedTextbox1); //converts to base64
    const encryptedTextbox2Base64 = uint8ArrayToBase64(encryptedTextbox2);

    chrome.storage.local.set({formsData: {
      ['loginForm#username']: encryptedTextbox1Base64,  //store back in storage
      ['loginForm#password']: encryptedTextbox2Base64
    }}, function () {
      console.log('Encrypted using Salsa20:');
      console.log(encryptedTextbox1Base64, encryptedTextbox2Base64);
    });
  });
}

function encryptCTRMethod2() {
  chrome.storage.local.get("formsData", function (result) {
    const formsData = result.formsData;
    const capturedTextbox1 = formsData['loginForm#username'].join('');  //extract and join data from storage
    const capturedTextbox2 = formsData['loginForm#password'].join('');

    const textBytes1 = aesjs.utils.utf8.toBytes(capturedTextbox1); //to utf8
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
      console.log('Encrypted using AES-CTR');
      console.log(encryptedText1, encryptedText2);
    });
  });
}

function decryptSalsaMethod2() {
  chrome.storage.local.get("formsData", function (result) {
    const formsData = result.formsData;
    const encryptedTextbox1Base64 = formsData['loginForm#username'];
    const encryptedTextbox2Base64 = formsData['loginForm#password'];

    const startTime = performance.now(); // start the timer

    const encryptedTextbox1 = base64ToUint8Array(encryptedTextbox1Base64); //decode from base64 to Unit8Array
    const encryptedTextbox2 = base64ToUint8Array(encryptedTextbox2Base64);

    const decryptedTextbox1 = decrCipher.decrypt(encryptedTextbox1); //decrypt
    const decryptedTextbox2 = decrCipher.decrypt(encryptedTextbox2);

    const endTime = performance.now(); // stop the timer
    const timeTaken = endTime - startTime; // Calculate the difference
    console.log('Decryption Time (ms):', timeTaken.toFixed(2)); 

    const decryptedTextbox1String = new TextDecoder().decode(decryptedTextbox1);  // convert decrypted data back to string format
    const decryptedTextbox2String = new TextDecoder().decode(decryptedTextbox2);

    chrome.storage.local.set({formsData: {
      ['loginForm#username']: Array.from(decryptedTextbox1String),
      ['loginForm#password']: Array.from(decryptedTextbox2String)
    }}, function () {
      console.log('Decrypted using Salsa20:');
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

    const encryptedBytes1 = base64ToUint8Array(encryptedTextbox1); //decode from base64 to Unit8Array
    const encryptedBytes2 = base64ToUint8Array(encryptedTextbox2);

    const aesCtr1 = new aesjs.ModeOfOperation.ctr(keyCTR, new aesjs.Counter(iv));
    const aesCtr2 = new aesjs.ModeOfOperation.ctr(keyCTR, new aesjs.Counter(iv));

    const decryptedBytes1 = aesCtr1.decrypt(encryptedBytes1);
    const decryptedBytes2 = aesCtr2.decrypt(encryptedBytes2);

    const endTime = performance.now(); // stop the timer
    const timeTaken = endTime - startTime; // salculate the difference
    console.log('Decryption Time (ms):', timeTaken.toFixed(2)); 

    const decryptedText1 = aesjs.utils.utf8.fromBytes(decryptedBytes1); // convert decrypted bytes to string format
    const decryptedText2 = aesjs.utils.utf8.fromBytes(decryptedBytes2);

    chrome.storage.local.set({formsData: {
      ['loginForm#username']: Array.from(decryptedText1),
      ['loginForm#password']: Array.from(decryptedText2)
    }}, function () {
      console.log('Decrypted using AES-CTR:');
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
let focusedInput = null; //currently focused input field
let originalKeyValues = []; //array to keep original values of keys

document.addEventListener('focusin', (event) => { //to detect when an input field is focused
  if (event.target.tagName.toLowerCase() === 'input') {
    focusedInput = event.target;
  }
});

//listen for a message from popup.js to show the keyboard
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'showKeyboard') {
    injectVirtualKeyboard();
  }
});

//function to inject virtual keyboard into the webpage
function injectVirtualKeyboard() {
  // check if virtual keyboard in on the screen 
  if (!document.querySelector('#virtual-keyboard-container')) {
    const container = document.createElement('div');
    container.id = 'virtual-keyboard-container';
    document.body.appendChild(container);

     // attach a shadow root to the container in mode:closed
    const shadow = container.attachShadow({ mode: 'closed' });

    // inject virtual-keyboard.html content in DOM shadow
    fetch(chrome.extension.getURL('virtual-keyboard.html'))
      .then(response => response.text())
      .then(html => {
        shadow.innerHTML = html;
        addKeyboardClickHandlers(shadow); // click handlers 
      });
  } else {
    // toggle visibility if the keyboard is already present in the page
    const container = document.querySelector('#virtual-keyboard-container');
    const virtualKeyboard = container.shadowRoot.querySelector('#virtual-keyboard');
    virtualKeyboard.style.display = virtualKeyboard.style.display === 'none' ? 'block' : 'none';
  }
}

//Fucntion to add click handlers 
function addKeyboardClickHandlers(shadow) {
  const keys = shadow.querySelectorAll('.keyboard-key');
  keys.forEach(key => {
    key.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation(); // Prevent events from propagating to the webpage

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

//reset keys to their original values
function resetKeyboardKeys(shadow) {
  var keys = shadow.querySelectorAll('.keyboard-key');
  keys.forEach(function (key, index) {
    key.textContent = originalKeyValues[index];
  });
}

//shuffle the order of the virtual keyboard keys
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

//////////////////////////////////////////////////////////////////////////////////////
// Create a div and attach a shadow root to isolate the scripts that will be injected
const div = document.createElement('div');
const shadowRoot = div.attachShadow({ mode: "closed" });
document.body.appendChild(div);
// Create script elements for the Salsa20, AES libraries and injected script and add them to the shadow root
const salsaLib = document.createElement('script');
salsaLib.src = chrome.runtime.getURL('jssalsa20.js'); 
salsaLib.onload = () => {
  const aesLib = document.createElement('script');
  aesLib.src = chrome.runtime.getURL('aes-js.js'); 
  aesLib.onload = () => {
    const injected = document.createElement('script');
    injected.src = chrome.runtime.getURL('injected.js');
    shadowRoot.appendChild(injected);
  }
  shadowRoot.appendChild(aesLib);
}
shadowRoot.appendChild(salsaLib);

// initialize the ciphers with keys and call uniqueOverrideRequests from the injected script
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'toggleMethod') {  //listener from popup.js
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