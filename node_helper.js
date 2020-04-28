'use strict'

const fs = require('fs')
const path = require('path')
const https = require('https')
const moment = require('moment')
const GP = require("./GPhotos.js")
const authOption = require("./google_auth.json")


var GPhotos = null

var NodeHelper = require("node_helper")

module.exports = NodeHelper.create({
  start: function() {
    this.scanInterval = 1000 * 60 * 55 // fixed.
    this.config = {}
    this.scanTimer = null
    this.albums = []
    this.photos = []
    this.queue = null
    this.uploadAlbumId
  },

  socketNotificationReceived: function(notification, payload) {
    switch(notification) {
      case 'INIT':
        this.initializeAfterLoading(payload)
        break
      case 'UPLOAD':
        this.upload(payload)
        break
      case 'IMAGE_LOAD_FAIL':
        this.log("Image loading fails. Check your network.:", payload)
        break
      case 'IMAGE_LOADED':
        this.log("Image loaded:", payload)
        break
    }
  },

  log: function(...args) {
    if (this.debug) console.log("[GPHOTOS]", ...args)
  },

  upload: function(path) {
    if (!this.uploadAlbumId) {
      this.log("No uploadable album exists.")
      return
    }
    const step = async ()=> {
      var uploadToken = await GPhotos.upload(path)
      if (uploadToken) {
        var result = await GPhotos.create(uploadToken, this.uploadAlbumId)
        this.log("Upload completed.")
      } else {
        this.log("Upload Fails.")
      }
    }
    step()
  },

  initializeAfterLoading: function(config) {
    this.config = config
    this.debug = (config.debug) ? config.debug : false
    if (!this.config.scanInterval || this.config.scanInterval < 1000 * 60 * 10) this.config.scanInterval = 1000 * 60 * 10
    GPhotos = new GP({
      authOption: authOption,
      debug:this.debug
    })
    const step = async () => {
      this.log("Getting album list")
      var albums = await this.getAlbums()
      if (config.uploadAlbum) {
        var uploadAlbum = albums.find((a)=>{
          return (a.title == config.uploadAlbum) ? true : false
        })
        if (uploadAlbum) {
          if (uploadAlbum.hasOwnProperty("shareInfo") && uploadAlbum.isWriteable) {
            this.log("Confirmed Uploadable album:", config.uploadAlbum, uploadAlbum.id)
            this.uploadAlbumId = uploadAlbum.id
            this.sendSocketNotification("UPLOADABLE_ALBUM", config.uploadAlbum)
          } else {
            this.log("This album is not uploadable:", config.uploadAlbum)
          }
        } else {
          this.log("Can't find uploadable album :", config.uploadAlbum)
        }
      }
      for (var ta of this.config.albums) {
        var matched = albums.find((a)=>{
          if (ta == a.title) return true
          return false
        })
        var exists = function (albums, album) {
          return albums.some(expected => album.id === expected.id)
        }
        if (!matched) {
          this.log(`Can't find "${ta}" in your album list.`)
        } else if (!exists(this.albums, matched)) {
          this.albums.push(matched)
        }
      }
      this.log("Finish Album scanning. Properly scanned :", this.albums.length)
      for (var a of this.albums) {
        var url = a.coverPhotoBaseUrl + "=w160-h160-c"
        var fpath = path.resolve(__dirname, "cache", a.id)
        let file = fs.createWriteStream(fpath)
        const request = https.get(url, (response)=>{
          response.pipe(file)
        })
      }
      this.log("Initialized")
      this.sendSocketNotification("INITIALIZED", this.albums)
      this.log("Start first scanning.")
      this.scan()
    }
    step()
  },

  getAlbums: function() {
    return new Promise((resolve)=>{
      const step = async ()=> {
        try {
          var r = await GPhotos.getAlbums()
          resolve(r)
        } catch (err) {
          this.log(err.toString())
          console.log(err)
        }
      }
      step()
    })
  },

  scan: function() {
    clearTimeout(this.scanTimer)
    this.scanTimer = null
    this.scanJob().then(()=>{
      this.scanTimer = setTimeout(()=>{
        this.scan()
      }, this.scanInterval)
    })
  },

  scanJob: function() {
    return new Promise((resolve)=>{
      this.log("Start Album scanning")
      this.queue = null
      const step = async ()=> {
        try {
          if (this.albums.length > 0) {
            this.photos = await this.getImageList()
            resolve(true)
          } else {
            this.log("There is no album to get photos.")
            resolve(false)
          }
        } catch (err) {
          this.log(err.toString())
          console.log(err)
        }
      }
      step()
    })
  },

  getImageList: function() {
    var condition = this.config.condition
    var photoCondition = (photo) => {
      if (!photo.hasOwnProperty("mediaMetadata")) return false
      var data = photo.mediaMetadata
      if (data.hasOwnProperty("video")) return false
      if (!data.hasOwnProperty("photo")) return false
      var ct = moment(data.creationTime)
      if (condition.fromDate && moment(condition.fromDate).isAfter(ct)) return false
      if (condition.toDate && moment(condition.toDate).isBefore(ct)) return false
      if (condition.minWidth && (Number(condition.minWidth) > Number(data.width))) return false
      if (condition.minHeight && (Number(condition.minHeight) > Number(data.height))) return false
      if (condition.maxWidth && (Number(condition.maxWidth) < Number(data.width))) return false
      if (condition.maxHeight && (Number(condition.maxHeight) < Number(data.height))) return false
      var whr = Number(data.width) / Number(data.height)
      if (condition.minWHRatio && (Number(condition.minWHRatio) > whr)) return false
      if (condition.maxWHRatio && (Number(condition.maxWHRatio) < whr)) return false
      return true
    }
    var sort = (a, b) => {
      var at = moment(a.mediaMetadata.creationTime)
      var bt = moment(b.mediaMetadata.creationTime)
      if (at.isBefore(bt) && this.config.sort == "new") return 1
      if (at.isAfter(bt) && this.config.sort == "old") return 1
      return -1
    }
    return new Promise((resolve)=>{
      const step = async () => {
        var photos = []
        try {
          for (var album of this.albums) {
            var list = await GPhotos.getImageFromAlbum(album.id, photoCondition)
            this.log(`Getting ${list.length} photo(s) list from '${album.title}'`)
            photos = photos.concat(list)
          }
          if (this.config.sort == "new" || this.config.sort == "old") {
            photos.sort((a, b) => {
              var at = moment(a.mediaMetadata.creationTime)
              var bt = moment(b.mediaMetadata.creationTime)
              if (at.isBefore(bt) && this.config.sort == "new") return 1
              if (at.isAfter(bt) && this.config.sort == "old") return 1
              return -1
            })
          } else {
            for (var i = photos.length - 1; i > 0; i--) {
              var j = Math.floor(Math.random() * (i + 1))
              var t = photos[i]
              photos[i] = photos[j]
              photos[j] = t
            }
          }
          this.log(`Total indexed photos: ${photos.length}`)
          this.sendSocketNotification("SCANNED", photos)
          return(photos)
        } catch (err) {
          this.log(err.toString())
          console.log(err)
        }
      }
      resolve(step())
    })
  },
})
