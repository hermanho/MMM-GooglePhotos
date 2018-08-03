'use strict';

const request = require('request')

//const EventEmitter = require('events')
//const util = require('util')

const Auth = require('./auth.js')

var authConfig = {
  keyFilePath: "./credentials.json",
  savedTokensPath: "./token.json",
  scope: "https://www.googleapis.com/auth/photoslibrary.readonly"
}

const auth = new Auth(authConfig)

auth.on('ready', (client) => {
  console.log("auth_and_test started.")
  var token = client.credentials.access_token
  function getAlbum(client, pageSize=50, pageToken="") {
    var url = 'https://photoslibrary.googleapis.com/v1/albums'
    url = url + "?pageSize=" + pageSize + "&pageToken=" + pageToken
    request.get(
      url,
      {
        json:true,
        auth: {"bearer": token},
      },

      (err, res, body) => {
        if (err) {
          console.log("Error: ", err)
          process.exit(1);
        }
        var found = 0
        for (var i in body.albums) {
          var album = body.albums[i]
          console.log (album.title, " : ", album.id)
          found++;
        }
        if (body.nextPageToken && found > 0) {
          getAlbum(client, pageSize, body.nextPageToken)
        }
      }
    )
  }
  getAlbum(client, 50)
})
