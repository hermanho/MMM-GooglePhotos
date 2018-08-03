'use strict';

const EventEmitter = require('events');
const util = require('util');
//const grpc = require('grpc');
const opn = require('opn');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
//const {auth} = require('google-auth-library')
const {OAuth2Client} = require('google-auth-library');
//const OAuth2 = auth.OAuth2;




function Auth(config) {
  if (config === undefined) config = {};

  // make sure we have a key file to read from
  if (config.keyFilePath === undefined) {
    throw new Error('Missing "keyFilePath" from config (should be where your JSON file is)');
  }

  if (config.savedTokensPath === undefined) {
    throw new Error('Missing "savedTokensPath" from config (this is where your OAuth2 access tokens will be saved)');
    return;
  }

  const key = require(config.keyFilePath).installed
  const oauthClient = new OAuth2Client(key.client_id, key.client_secret, key.redirect_uris[0]);
  let tokens;

  const saveTokens = (first = false) => {
    oauthClient.setCredentials(tokens);

    var expired = false
    var now = Date.now()

    if (tokens.expiry_date < Date.now()) {
      expired = true
    }

    if (expired || first) {
      oauthClient.refreshAccessToken().then((tk)=>{
        tokens = tk.credentials
        // save them for later
        mkdirp(path.dirname(config.savedTokensPath), () => {
          fs.writeFile(config.savedTokensPath, JSON.stringify(tokens), () => {});
          this.emit('ready', oauthClient)
        })
      })
    } else {
      this.emit('ready', oauthClient);
    }
  };

  const getTokens = () => {
    const url = oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: [config.scope],
    });

    // open the URL
    console.log('Opening OAuth URL.(' + url + ') Return here with your code.');
    opn(url).catch(() => {
      console.log('Failed to automatically open the URL. Copy/paste this in your browser:\n', url);
    });

    // if tokenInput is configured
    // run the tokenInput function to accept the token code
    if (typeof config.tokenInput === 'function') {
      config.tokenInput(processTokens);
      return;
    }

    // create the interface to accept the code
    const reader = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    reader.question('Paste your code: ', processTokens);
  };

  const processTokens = (oauthCode) => {
    if (!oauthCode) process.exit(-1);
    // get our tokens to save
    oauthClient.getToken(oauthCode, (error, tkns) => {
      // if we didn't have an error, save the tokens
      if (error) throw new Error('Error getting tokens:', error);
      tokens = tkns;
      saveTokens(true);
    });
  };

  // if the tokens are already saved, we can skip having to get the code for now
  process.nextTick(() => {
    if (config.savedTokensPath) {
      try {
        const tokensFile = fs.readFileSync(config.savedTokensPath);
        tokens = JSON.parse(tokensFile);
      } catch(error) {
        // we need to get the tokens
        getTokens();
      } finally {
        if (tokens !== undefined) saveTokens();
      }
    }
  });

  return this;
};

util.inherits(Auth, EventEmitter);
module.exports = Auth;
