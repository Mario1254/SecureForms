//first one
let interceptionInProgress = false; // Flag to track interception status
let modifiedData = null; // Object to store modified data
let mutex = false;

// Listen for messages from the popup.js
chrome.runtime.onMessageExternal.addListener(function (message, sender, sendResponse) {
  console.log(sender.tab ?
    "from a content script:" + sender.tab.url :
    "from the extension");
  if (message.action === 'getFromStorage') {
    console.log('getFromStorage')
    chrome.storage.local.get("formsData", function (result) {
      const formsData = result.formsData;
      for (const key in formsData) {
        if (Object.hasOwnProperty.call(formsData, key)) {
          if (key.includes(message.field)) {
            sendResponse({ [message.field]: formsData[key].join('') });
          }
        }
      }
    });
  }
});

// Function to initiate interception and modification
function initiateInterception(modifiedRequestBody) {
  console.log('initiate interception');
  // Intercept POST requests using the webRequest API
  chrome.webRequest.onBeforeRequest.addListener(
    function (details) {
      if (mutex == true) {
        mutex = false;
        return { cancel: false };
      }
      mutex = true;
      console.log('nested intercept function');
    if (details.method === 'POST') {
        // Initiate a new request with the modified data
        fetch(details.url, {
          method: 'POST',
          body: JSON.stringify(modifiedRequestBody),
          headers: {
            'Content-Type': 'application/json'
       // 'X-Custom-Header': 'YourCustomHeaderValue' // custom header
         }
        })
        .then(response => {
          console.log('req success');
          //console.log('Request successful:', response);
        })
        .catch(error => {
          console.log('req fail');
          //console.error('Request error:', error);
        });

        // Cancel the original request
        return { cancel: true };
      }
    },
    {
      urls: ['<all_urls>'],
      types: ['xmlhttprequest']
    },
    ['blocking', 'requestBody']
  );
}

// let interceptionInProgress = false; 
// let modifiedData = null; 
// let interceptedRequestIds = new Set();

// chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
//   console.log('start background');
//   if (message.action === 'startInterception' && message.modifiedRequestBody) {
//     modifiedData = message.modifiedRequestBody;
//     console.log('start background conditional', modifiedData);
//     if (!interceptionInProgress) {
//       interceptionInProgress = true;
//       initiateInterception(modifiedData);
//     }
//   }
// });

// function initiateInterception(modifiedRequestBody) {
//   console.log('initiate interception');

//   chrome.webRequest.onBeforeRequest.addListener(
//     function (details) {
//       if (details.method === 'POST' && !interceptedRequestIds.has(details.requestId)) {
//         console.log('Intercepting original request');

//         interceptedRequestIds.add(details.requestId);

//         fetch(details.url, {
//           method: 'POST',
//           body: JSON.stringify(modifiedRequestBody),
//           headers: {
//             'Content-Type': 'application/json',
//             'X-Custom-Header': 'YourCustomHeaderValue'
//           }
//         })
//         .then(response => {
//           console.log('req success');
//         })
//         .catch(error => {
//           console.log('req fail');
//         });

//         return { cancel: true };
//       } else {
//         console.log('Allowing request to proceed');
//         return { cancel: false };
//       }
//     },
//     {
//       urls: ['<all_urls>'],
//       types: ['xmlhttprequest']
//     },
//     ['blocking', 'requestBody']
//   );
// }


/*
let interceptionInProgress = false;
let modifiedData = null;
let mutex = false;
let originalRequestDetails = null;

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  console.log('start background');
  if (message.action === 'startInterception' && message.modifiedRequestBody) {
    modifiedData = message.modifiedRequestBody;
    console.log('start background conditional', modifiedData);
    if (!interceptionInProgress) {
      interceptionInProgress = true;
      initiateInterception(modifiedData);
    }
  }
});

function initiateInterception(modifiedRequestBody) {
  console.log('initiate interception');

  chrome.webRequest.onBeforeRequest.addListener(
    function (details) {
      if (mutex === true) {
        mutex = false;
        return { cancel: false };
      }
      mutex = true;
      console.log('nested intercept function');

      if (details.method === 'POST') {
        originalRequestDetails = details;
        fetch(details.url, {
          method: 'POST',
          body: JSON.stringify(modifiedRequestBody),
          headers: {
            'Content-Type': 'application/json'
          }
        })
        .then(response => response.json())
        .then(jsonResponse => {
          console.log('Request successful:', jsonResponse);
          
          chrome.tabs.sendMessage(originalRequestDetails.tabId, {
            action: 'modifiedResponse',
            response: jsonResponse,
            url: originalRequestDetails.url
          });
        })
        .catch(error => {
          console.error('Request error:', error);
        });

        return { cancel: true };
      }
    },
    {
      urls: ['<all_urls>'],
      types: ['xmlhttprequest']
    },
    ['blocking', 'requestBody']
  );
}

*/



/*
let interceptionInProgress = false; // Flag to track interception status
let mutex=false;

// Listen for messages from the content script
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'decryptionComplete') {
    // Store the decrypted values received from the content script
    const decryptedValues = message.decryptedValues;

    // Check if interception is already in progress
    if (!interceptionInProgress) {
      interceptionInProgress = true;

      // Intercept POST requests using the webRequest API
      chrome.webRequest.onBeforeRequest.addListener(
        function (details) {
          if (mutex == true) {
            mutex = false;
            return { cancel: false };
          }
          mutex = true;
          if (details.method === 'POST') {
            // Modify the intercepted request data with the decrypted values
            const modifiedRequestBody = {
              username: decryptedValues[0],
              password: decryptedValues[1]
              // Add more fields as needed
            };
            console.log('modified data:', modifiedRequestBody);

            // Initiate a new request with the modified data
            initiateModifiedRequest(details.url, modifiedRequestBody);

            // Cancel the original request
            return { cancel: true };
          }
        },
        {
          urls: ['<all_urls>'],
          types: ['xmlhttprequest']
        },
        ['requestBody']
      );
    }

    // Set the flag to indicate that the request has been sent
  }
});

// Function to initiate a new request with modified data
function initiateModifiedRequest(url, modifiedData) {
  console.log('Initiating request to:', url);

  fetch(url, {
    method: 'POST',
    body: JSON.stringify(modifiedData),
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    console.log('Request successful:', response);
  })
  .catch(error => {
    console.error('Request error:', error);
  });
}
*/

/*let interceptionInProgress = false; // Flag to track interception status
let decryptedValues = []; // Array to store decrypted values
let mutex = false;

// Listen for messages from the content script
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'decryptionComplete') {
    // Store the decrypted values received from the content script
    decryptedValues = message.decryptedValues;

    // Check if interception is already in progress
    if (!interceptionInProgress) {
      interceptionInProgress = true;

      // Intercept POST requests using the webRequest API
      chrome.webRequest.onBeforeRequest.addListener(
        function (details) {
           if (mutex == true) {
           mutex = false;
            return { cancel: false };
          }
          mutex = true;
          if (details.method === 'POST') {
            // Modify the intercepted request data with the decrypted values
            const modifiedRequestBody = {
              username: decryptedValues[0],
              password: decryptedValues[1]
              // Add more fields as needed
            };
            console.log('modified data:', modifiedRequestBody);
            // Initiate a new request with the modified data
            initiateModifiedRequest(details.url, modifiedRequestBody);

            // Cancel the original request
            return { cancel: true };
          }
        },
        {
          urls: ['<all_urls>'],
          types: ['xmlhttprequest']
        },
        ['requestBody']
      );
    }
  }
});

// Function to initiate a new request with modified data
function initiateModifiedRequest(url, modifiedData) {
  fetch(url, {
    method: 'POST',
    body: JSON.stringify(modifiedData),
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    console.log('Request successful:', response);
  })
  .catch(error => {
    console.error('Request error:', error);
  });
}
*/