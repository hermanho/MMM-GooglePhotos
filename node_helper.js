
//
// Module : MMM-Hotword
//

'use strict'

const path = require("path")
const request = require('request')
const Auth = require('./auth.js')


var NodeHelper = require("node_helper")

module.exports = NodeHelper.create({
  start: function() {
    console.log(this.name + " started")
    this.config = {}
    this.items = []
    this.tempItems = []
    this.accessToken = ""
    this.authConfig = {}
    this.started = false
    this.index = 0
    //this.auth = null
  },

  initializeAfterLoading: function (config) {
    this.config = config
    console.log(this.name + " initialized after loading.")
    this.authConfig = {
      keyFilePath : path.resolve(__dirname, "credentials.json"),
      savedTokensPath : path.resolve(__dirname, "token.json"),
      scope: "https://www.googleapis.com/auth/photoslibrary.readonly"
    }
    this.scanPhotos()
    this.scanTimer = setInterval(()=>{
      this.scanPhotos()
    },this.config.scanInterval)
  },

  scanPhotos: function() {
    this.tempItems = []
    var auth = new Auth(this.authConfig)
    auth.on('ready', (client) => {
      this.accessToken = client.credentials.access_token
      this.getPhotos()
    })

  },

  socketNotificationReceived: function (notification, payload) {
    switch(notification) {
      case 'INIT':
        this.initializeAfterLoading(payload)
        this.sendSocketNotification('INITIALIZED')
        break
    }
  },

  getPhotos: function() {
    const options = {
      url: "https://photoslibrary.googleapis.com/v1/mediaItems:search",
      method: "POST",
      form: {
        'albumId': this.config.albumId,
        'pageSize': 50,
        'pageToken': "",
      },
      json: true,
      auth: {
        "bearer": this.accessToken
      }
    }
    var self = this
    function getItems(options) {
      request.post(options, (err, res, body) => {
        if (err) {
          console.log("Error:", err)
          return
        }
        var mediaItems = body.mediaItems
        var found = 0
        if (mediaItems) {
          found = mediaItems.length
        }
        for (var i in mediaItems) {
          if ("photo" in mediaItems[i].mediaMetadata) {
            var item = {
              "id": mediaItems[i].id,
              "creationTime": Date.parse(mediaItems[i].mediaMetadata.creationTime),
            }
            self.tempItems.push(item)
          }
        }
        if (found > 0 && body.nextPageToken) {
          options.form.pageToken = body.nextPageToken
          getItems(options)
        } else {
          self.finishedScan()
        }
      })
    }
    getItems(options)
  },

  finishedScan: function() {
    switch(this.config.sort) {
      case "time":
        this.tempItems.sort((a, b)=>{
          return b.creationTime - a.creationTime
        })
        break
      case "reverse":
        this.tempItems.sort((a, b)=>{
          return a.creationTime - b.creationTime
        })
        break
      case "random":
        var currentIndex = this.tempItems.length, temporaryValue, randomIndex
        while (0 !== currentIndex) {
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;
          temporaryValue = this.tempItems[currentIndex];
          this.tempItems[currentIndex] = this.tempItems[randomIndex];
          this.tempItems[randomIndex] = temporaryValue;
        }
        break
    }
    console.log("[GPHOTO] Scan finished :", this.tempItems.length)
    //this.sendSocketNotification("IMAGE_LIST", this.items)
    this.items = this.tempItems
    if (this.started == false) {
      this.started = true
      this.broadcast()
    }
  },

  getPhoto: function() {
    var photoId = this.items[this.index].id
    const options = {
      url: "https://photoslibrary.googleapis.com/v1/mediaItems/" + photoId,
      method: "GET",
      json: true,
      auth: {
        "bearer": this.accessToken
      }
    }
    request.get(options, (err, res, body) => {
      if (err) {
        console.log("Error:", err)
        return
      }
      this.index++
      if (this.index >= this.items.length) {
        this.index = 0
      }
      var payload = {
        "id":body.id,
        "url":body.baseUrl + "=w" + this.config.originalHeightPx + "-h" + this.config.originalHeightPx,
        "time": Date.parse(body.mediaMetadata.creationTime),
        //more metadata will be provided later.
      }
      this.sendSocketNotification("NEW_IMAGE", payload)
    })
  },

  broadcast: function() {
    var auth = new Auth(this.authConfig)
    auth.on('ready', (client) => {
      this.accessToken = client.credentials.access_token
      this.getPhoto()
    })
    var timer = setTimeout(()=>{
      this.broadcast()
    }, this.config.refreshInterval)
  }
})
