// Function to decrypt a string based on the method passed in (either 'Salsa20' or 'AES')
function uniqueDecryptString(string, method, cipher) {
    let decryptedValue = '';
    switch (method) {
        case 'Salsa20':
            for (let i = 0; i < string.length; i += 2) {
                const hexByte = string.substr(i, 2);

                const byteValue = parseInt(hexByte, 16);
                const encryptedUint8Array = new Uint8Array([byteValue]);
                // Decrypt the single byte
                const decryptedBytes = cipher.decrypt(encryptedUint8Array);
                // Convert decrypted byte to a UTF-8 string
                const decryptedChar = new TextDecoder().decode(new Uint8Array(decryptedBytes));
                decryptedValue += decryptedChar;
            }
            return decryptedValue;
        case 'AES':
            for (let i = 0; i < string.length; i += 2) {
                // Get the hex byte from the encrypted value
                const hexByte = string.substr(i, 2);
                const byteValue = parseInt(hexByte, 16);
                // Decrypt the byte using AES-CTR
                const decryptedBytes = cipher.decrypt([byteValue]);
                // Convert decrypted byte to UTF-8 character
                const decryptedChar = aesjs.utils.utf8.fromBytes(decryptedBytes);
                decryptedValue += decryptedChar;
            }
            return decryptedValue;
    }
}

async function getFromStorage(inputLabel) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage('gckojjjdhfedindcgikpdjgegmhpfdcj', { action: "getFromStorage", field: inputLabel }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError));
            } else {
                console.log(response);
                resolve(response[inputLabel]);
            }
        });
    });
}

async function replaceInputs(data, method, cipher) {
    // Check if data exists and is an instance of FormData
    if (data && data instanceof FormData) {
        // Iterate through each key-value pair in the FormData
        for (var pair of data.entries()) {
            if (method === 'storage')
                data.set(pair[0], await getFromStorage(pair[0])); // If method is 'storage', replace value with data from storage
            else
                data.set(pair[0], uniqueDecryptString(pair[1], method, cipher));  //replace value with decrypted string
        }
        // Check if data exists, is a string and is not empty
    } else if (data && typeof data === 'string' && data.trim() !== "") { 
        try {
            // Try to parse the data as JSON
            var jsonBody = JSON.parse(data);
            // Iterate through each key-value pair in the JSON object
            for (var key in jsonBody)
                if (method === 'storage')
                    jsonBody[key] = await getFromStorage(key);
                else
                    jsonBody[key] = uniqueDecryptString(jsonBody[key], method, cipher);
            data = JSON.stringify(jsonBody);
        } catch (e) {
            console.error('Error parsing JSON body:', e);
        }
    }
    return data;
}

// Save references to the original XMLHttpRequest and fetch functions
var originalOpen = XMLHttpRequest.prototype.open;
var originalSend = XMLHttpRequest.prototype.send;
var originalFetch = window.fetch;

function uniqueOverrideRequests(method, keys) {
    let cipher;

    switch (method) {
        case 'Salsa20':
            cipher = new JSSalsa20(new Uint8Array(keys.key), new Uint8Array(keys.nonce));
            break;
        case 'AES':
            cipher = new aesjs.ModeOfOperation.ctr(keys.key, new aesjs.Counter(keys.iv));
            break;
        case 'storage':
            cipher = null;
            break;
        default:
            cipher = null;
            XMLHttpRequest.prototype.open = originalOpen;
            XMLHttpRequest.prototype.send = originalSend;
            window.fetch = originalFetch;
            return;
    }

    // Override the open method of XMLHttpRequest to log the arguments and add a listener to log state changes
    XMLHttpRequest.prototype.open = function () {
        console.log('Intercepted open arguments:', arguments);
        this.addEventListener('readystatechange', async function () {
            console.log('Ready state changed:', this.readyState);
        }, false);
        originalOpen.apply(this, arguments);
    };

    // Override the send method of XMLHttpRequest to replace inputs in the data object before sending
    XMLHttpRequest.prototype.send = async function (data) {  //cite
        console.log('Intercepted send arguments:', arguments);
        data = await replaceInputs(data, method, cipher);
        originalSend.apply(this, arguments);
    };

    // Override the fetch function to replace inputs in the body of the request before sending
    window.fetch = function (input, init) {
        return new Promise(async function (resolve, reject) {
            console.log('Intercepted fetch arguments:', arguments);
            init.body = await replaceInputs(init.body, method, cipher);
            console.log(init.body);
            originalFetch(input, init).then(resolve).catch(reject);
        });
    };
}