"use strict";
const fs = require("fs");
const path = require("path");
const { mkdirp } = require("mkdirp");
const { authenticate } = require("@google-cloud/local-auth");
const config = require("./google_auth.json");

/**
 * @param {string} keyFilePath a path of the GCP credential keyfile
 */
function testKeyFile(keyFilePath) {
  if (!fs.existsSync(keyFilePath)) {
    throw new Error(`keyfile ${keyFilePath} does not exists`);
  }
  try {
    const keyFile = JSON.parse(fs.readFileSync(keyFilePath, "utf8"));
    const keys = keyFile.installed || keyFile.web;
    if (!keys) {
      throw new Error();
    }
  } catch {
    throw new Error(`keyfile ${keyFilePath} is not a valid GCP credential keyfile`);
  }
}

/**
 *
 */
async function generate() {
  const keyFilePath = path.resolve(__dirname, config.keyFilePath);
  testKeyFile(keyFilePath);
  const client = await authenticate({
    keyfilePath: keyFilePath,
    scopes: [config.scope],
  });

  if (client.credentials && config.savedTokensPath) {
    if (config.savedTokensPath) {
      const tp = path.resolve(__dirname, config.savedTokensPath);
      await mkdirp(path.dirname(tp));
      fs.writeFileSync(tp, JSON.stringify(client.credentials));
      console.log("Token is generated. check it. (ls -al)");
    }
  }
}
generate();
