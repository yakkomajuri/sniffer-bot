'use strict';

const config = require('./config.json');
const resuls = require('./results.json');
const wordsToIgnore = config["wordsToIgnore"];
const PCTG_CERTAIN = config["certainMatchPctg"];
const PCTG_POTENTIAL = config["potentialMatchPctg"];

var data = resuls["headlines"];

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
var VERIFY_TOKEN = process.env.VERIFY_TOKEN;




// Imports dependencies and set up http server
const 
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()); // creates express http server



// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));


// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {  

  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    body.entry.forEach(function(entry) {

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);


      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender ID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);        
      } else if (webhook_event.postback) {
        
        handlePostback(sender_psid, webhook_event.postback);
      }
      
    });
    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {
  
  /** UPDATE YOUR VERIFY TOKEN **/
  console.log('here');

  
  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Check if a token and mode were sent
  if (mode && token) {
  
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Respond with 200 OK and challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});

function handleMessage(sender_psid, received_message) {
  let response;
  
  // Checks if the message contains text
  if (received_message.text) {    
    // Create the payload for a basic text message, which
    // will be added to the body of our request to the Send API
    /*
    response = {
      "text": `You sent the message: "${received_message.text}". Now send me an attachment!`
    }
    */
   processInput(received_message.text, sender_psid);
  } else if (received_message.attachments) {
    response = {
      "text": "We cannot process attachments at this point. Sorry :("
    }
    callSendAPI(sender_psid, response);    
  } 
  
  // Send the response message
}

function handlePostback(sender_psid, received_postback) {
  console.log('ok')
   let response;
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'GET_STARTED_PAYLOAD') {
    response = { "text": "Hello! My name is Sniffer and I'm a bot. My job is to identify fake news regarding the COVID-19 pandemic. I'm very young so please be patient with me since I may have bugs.  \n\nTo use me, paste a headline or type a claim that you want to verify and I'll try to inform you if the claim is true or false. Example: Try typing 'sipping water kills coronavirus'. Let's fight fake news together! " }
  } 
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}

function processInput(input, sender_psid) {
    var potentialMatches = [];
    var coverageIndex = [];
    var reply = "I found no headlines matching your search. Sorry :(";;
    var parsedInput = input.toLowerCase()
        .replace(/(~|`|!|@|#|$|%|^|&|\*|\(|\)|{|}|\[|\]|;|:|\"|'|<|,|\.|>|\?|\/|\\|\||-|_|\+|=)/g, " ") // Removes punctuation
        .replace(/\s+/g, ' ') // Strips extra spaces
        .trim() 
        .split(" ")
        .filter(term => !wordsToIgnore.includes(term));
    console.log(parsedInput);
    for (var i = 0; i < data.length; i++) {
        var notInOverlap = parsedInput.filter(term => !data[i][0].includes(term) );
        var coverage = ((parsedInput.length - notInOverlap.length) * 100 / parsedInput.length);
        if (coverage > PCTG_CERTAIN) {
            reply = "Here's the headline I found: '" + data[i][2] + "' - According to Snopes, this headline was marked as *" + data[i][1] + "*. Find out more here: " + data[i][3];
            callSendAPI(sender_psid, {"text": reply});
            break;
        }
        else if (coverage > PCTG_POTENTIAL) {
            coverageIndex.push([coverage, potentialMatches.length])
            potentialMatches.push(data[i]);
        } 
        if (i == data.length-1 && coverage < PCTG_POTENTIAL && potentialMatches.length < 1) {
            reply = "I found no headlines matching your search. Sorry :(";
            callSendAPI(sender_psid, {"text": reply});
            break;
        }
        else if (i == data.length-1) {
            handleMultipleMatches(coverageIndex, potentialMatches, sender_psid);
        }

    }
}

function handleMultipleMatches(coverageIndex, matchesArr, sender_psid) {
    var reply = "I found the following headlines that could be what you are referring to. Are any of them what you are looking for? \n";
    coverageIndex = coverageIndex.sort(function(a,b) {
        return a[0] - b[0];
    });
    for (var i = 0; i < coverageIndex.length; i++) {
        reply += String(i+1) + ": " + matchesArr[coverageIndex[i][1]][2] + " - Marked by Snopes as *" + matchesArr[coverageIndex[i][1]][1] + "*. Find out more here: " + matchesArr[coverageIndex[i][1]][3] + "\n";
        if (i == 3) {
            callSendAPI(sender_psid, {"text": reply});
            break;
        }
        if (i == matchesArr.length-1) {
            console.log(reply);
            callSendAPI(sender_psid, {"text": reply});
            break;
        }
    }
}


// heroku config:set PAGE_TEST_TOKEN=EAAMP8Cf85Q0BAFtBaUdXJbuokjTRgVGJpPSZAZA4uF4swB626ZAiU8BNwdRnzJkEv8rTerB6k8CpkUKwlONnZBPa9ngXLzhTZC2iliXLbcAtQYGYituMTOflkBsMELysS6ktkRSdey1P0ZAuqY5ctUWuGFyNiK2Xr4xZA5WoChtgQZDZD
// heroku config:set VERIFY_TOKEN=bananas