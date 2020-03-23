'use strict'
const GP = require("./GPhotos.js")
const authOption = require("./google_auth.json")

var GPhotos = new GP({
  authOption: authOption,
  debug: true
})

GPhotos.generateToken(
  function success () {
    console.log ("Token is generated. check it. (ls -al)")
    process.exit()
  },
  function fail() {
    console.log("Token file doesn't exist. Check the permission.")
    process.exit()
  }
)
