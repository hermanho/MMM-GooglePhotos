'use strict';

const EventEmitter = require('events')
const util = require('util')
const opn = require('open')
const readline = require('readline')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const {OAuth2Client} = require('google-auth-library')
const Axios = require('axios')
const moment = require('moment')

function sleep(ms=1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
function Auth(config, debug=false) {
  const log = (debug) ? (...args)=>{console.log("[GPHOTOS:AUTH]", ...args)} : ()=>{}
  if (config === undefined) config = {}
  if (config.keyFilePath === undefined) {
    throw new Error('Missing "keyFilePath" from config (This should be where your Credential file is)')
  }
  if (config.savedTokensPath === undefined) {
    throw new Error('Missing "savedTokensPath" from config (this should be where your OAuth2 access tokens will be saved)')
    return;
  }
  var creds = path.resolve(__dirname, config.keyFilePath)
  if (!fs.existsSync(creds)) {
    throw new Error('Missing Credentials.')
    return
  }
  const key = require(config.keyFilePath).installed
  const oauthClient = new OAuth2Client(key.client_id, key.client_secret, key.redirect_uris[0])
  let tokens
  const saveTokens = (first = false) => {
    oauthClient.setCredentials(tokens)
    var expired = false
    var now = Date.now()
    if (tokens.expiry_date < Date.now()) {
      expired = true
      log("Token is expired.")
    }
    if (expired || first) {
      oauthClient.refreshAccessToken().then((tk)=>{
        tokens = tk.credentials
        var tp = path.resolve(__dirname, config.savedTokensPath)
        mkdirp(path.dirname(tp), () => {
          fs.writeFileSync(tp, JSON.stringify(tokens))
          log("Token is refreshed.")
          this.emit('ready', oauthClient)
        })
      })
    } else {
      log("Token is alive.")
      this.emit('ready', oauthClient)
    }
  }

  const getTokens = () => {
    const url = oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: [config.scope],
    })
    log('Opening OAuth URL.\n\n' + url + '\n\nReturn here with your code.')
    opn(url).catch(() => {
      log('Failed to automatically open the URL. Copy/paste this in your browser:\n', url)
    })
    if (typeof config.tokenInput === 'function') {
      config.tokenInput(processTokens);
      return;
    }
    const reader = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    })
    reader.question('> Paste your code: ', processTokens)
  }
  const processTokens = (oauthCode) => {
    if (!oauthCode) process.exit(-1)
    oauthClient.getToken(oauthCode, (error, tkns) => {
      if (error) throw new Error('Error getting tokens:', error)
      tokens = tkns
      saveTokens(true)
    })
  }
  process.nextTick(() => {
    if (config.savedTokensPath) {
      try {
        var file = path.resolve(__dirname, config.savedTokensPath)
        const tokensFile = fs.readFileSync(file)
        tokens = JSON.parse(tokensFile)
      } catch(error) {
        getTokens()
      } finally {
        if (tokens !== undefined) saveTokens()
      }
    }
  })
  return this
}
util.inherits(Auth, EventEmitter);



class GPhotos {
  constructor(options) {
    this.debug = false
    if (!options.hasOwnProperty("authOption")) {
      throw new Error("Invalid auth information.")
      return false
    }
    this.options = options
    this.debug = (options.debug) ? options.debug : this.debug
    this.albums = {
      album: [],
      shared: [],
    }
  }

  log(...args) {
    if (this.debug) console.log("[GPHOTOS:CORE]", ...args)
  }

  onAuthReady(job=()=>{}) {
    var auth = null
    try {
      auth = new Auth(this.options.authOption, this.debug)
    } catch (e) {
      this.log(e.toString())
      throw e
    }
    auth.on("ready", (client)=>{
      job(client)
    })
  }

  generateToken(success=()=>{}, fail=()=>{}) {
    this.onAuthReady((client)=>{
      const isTokenFileExist = () => {
        var fp = path.resolve(__dirname, this.options.authOption.savedTokensPath)
        if (fs.existsSync(fp)) return true
        return false
      }
      if (isTokenFileExist()) success()
      fail()
    })
  }

  request (token, endPoint="", method="get", params=null, data=null) {
    return new Promise((resolve)=>{
      try {
        var url = endPoint
        var config = {
          method: method,
          url: url,
          baseURL: 'https://photoslibrary.googleapis.com/v1/',
          headers: {
            Authorization: 'Bearer ' + token
          },
        }
        if (params) config.params = params
        if (data) config.data = data
        Axios(config).then((ret)=>{
          resolve(ret)
        }).catch((e)=>{
          this.log(e.toString())
          throw e
        })
      } catch (error) {
        this.log(error.toString())
        throw error
      }
    })
  }

  getAlbums() {
    return new Promise((resolve)=>{
      const step = async () =>{
        try {
          var albums = await this.getAlbumType("albums")
          var shared = await this.getAlbumType("sharedAlbums")
          for (var s of shared) {
            var isExist = albums.find((a)=>{
              if (a.id === s.id) return true
              return false
            })
            if (!isExist) albums.push(s)
          }
          resolve(albums)
        } catch (e) {
          throw e
        }
      }
      step()
    })
  }


  getAlbumType(type="albums") {
    if (type !== "albums" && type !== "sharedAlbums") throw new Error("Invalid parameter for .getAlbumType()", type)
    return new Promise((resolve)=>{
      this.onAuthReady((client)=>{
        var token = client.credentials.access_token
        var list = []
        var found = 0
        const getAlbum = async (pageSize=50, pageToken="") => {
          this.log("Getting Album info chunks.")
          var params = {
            pageSize: pageSize,
            pageToken: pageToken,
          }
          try {
            var response = await this.request(token, type, "get", params, null)
            var body = response.data
            if (body[type] && Array.isArray(body[type])) {
              found += body[type].length
              list = list.concat(body[type])
            }
            if (body.nextPageToken) {
              const generous = async () => {
                await sleep(500)
                getAlbum(pageSize, body.nextPageToken)
              }
              generous()
            } else {
              this.albums[type] = list
              resolve(list)
            }
          } catch(err) {
            this.log(err.toString())
            throw err
          }
        }
        getAlbum()
      })
    })
  }

  getImageFromAlbum(albumId, isValid=null, maxNum=99999) {
    return new Promise((resolve)=>{
      this.onAuthReady((client)=>{
        var token = client.credentials.access_token
        var list = []
        const getImage = async (pageSize=50, pageToken="") => {
          this.log("Indexing photos now. total: ", list.length)
          try {
            var data = {
              "albumId": albumId,
              "pageSize": pageSize,
              "pageToken": pageToken,
            }
            var response = await this.request(token, 'mediaItems:search', 'post', null, data)
            if (response.data.hasOwnProperty("mediaItems") && Array.isArray(response.data.mediaItems)) {
              for (var item of response.data.mediaItems) {
                if (list.length < maxNum) {
                  item._albumId = albumId
                  if (typeof isValid == "function") {
                    if (isValid(item)) list.push(item)
                  } else {
                    list.push(item)
                  }
                }
              }
              if (list.length >= maxNum) {
                resolve(list) // full with maxNum
              } else {
                if (response.data.nextPageToken) {
                  const generous = async () => {
                    await sleep(500)
                    getImage(50, response.data.nextPageToken)
                  }
                  generous()
                } else {
                  resolve(list) // all found but lesser than maxNum
                }
              }
            } else {
              resolve(list) // empty
            }
          } catch(err) {
            this.log(".getImageFromAlbum()", err.toString())
            this.log(err)
            throw err
          }
        }
        getImage()
      })
    })
  }


  async updateTheseMediaItems(items) {
    return new Promise((resolve)=>{
      
      if (items.length <= 0) {resolve(items)}
      
      this.onAuthReady((client)=>{
        var token = client.credentials.access_token
        this.log("received: ", items.length, " to refresh") //
        var list = []          
        var params = new URLSearchParams();
        var ii
        for (ii in items) {
          params.append("mediaItemIds", items[ii].id)
        }
        
        const refr = async () => { 
          var response = await this.request(token, 'mediaItems:batchGet', 'get', params, null)
                   
          if (response.data.hasOwnProperty("mediaItemResults") && Array.isArray(response.data.mediaItemResults)) {
            for (var i = 0; i< response.data.mediaItemResults.length; i++) {
              if (response.data.mediaItemResults[i].hasOwnProperty("mediaItem")){
                  items[i].baseUrl = response.data.mediaItemResults[i].mediaItem.baseUrl
              }
              
            }
            
            resolve(items)
          }
        }
        refr()
        
      })
      
    })
  }
  
  
  createAlbum(albumName) {
    return new Promise((resolve)=>{
      this.onAuthReady((client)=>{
        var token = client.credentials.access_token
        const create = async () => {
          try {
            var created = await this.request(token, 'albums', 'post', null, {
              album: {
                title: albumName
              }
            })
            resolve(created.data)
          } catch(err) {
            this.log(".createAlbum() ", err.toString())
            this.log(err)
            throw err
          }
        }
        create()
      })
    })
  }

  shareAlbum(albumId) {
    return new Promise((resolve)=>{
      this.onAuthReady((client)=>{
        var token = client.credentials.access_token
        const create = async () => {
          try {
            var shareInfo = await this.request(
              token,
              'albums/' + albumId + ":share",
              'post',
              null,
              {
                sharedAlbumOptions: {
                  isCollaborative: true,
                  isCommentable: true,
                }
              }
            )
            resolve(shareInfo.data)
          } catch(err) {
            this.log(".shareAlbum()", err.toString())
            this.log(err)
            throw err
          }
        }
        create()
      })
    })
  }

  upload(path) {
    return new Promise((resolve)=>{
      this.onAuthReady((client)=>{
        var token = client.credentials.access_token
        const upload = async() => {
          try {
            let newFile = fs.createReadStream(path)
            var url = 'uploads'
            var option = {
              method: 'post',
              url: url,
              baseURL: 'https://photoslibrary.googleapis.com/v1/',
              headers: {
                Authorization: 'Bearer ' + token,
                "Content-type": "application/octet-stream",
                //X-Goog-Upload-Content-Type: mime-type
                "X-Goog-Upload-Protocol": "raw",
              },
            }
            option.data = newFile
            Axios(option).then((ret)=>{
              resolve(ret.data)
            }).catch((e)=>{
              this.log(".upload:resultResolving ", e.toString())
              this.log(e)
              throw e
            })
          } catch(err) {
            this.log(".upload()", err.toString())
            this.log(err)
            throw err
          }
        }
        upload()
      })
    })
  }

  create(uploadToken, albumId) {
    return new Promise((resolve)=>{
      this.onAuthReady((client)=>{
        var token = client.credentials.access_token
        const create = async() => {
          try {
            let fileName = moment().format("[MM_]YYYYMMDD_HHmm")
            var result = await this.request(
              token,
              'mediaItems:batchCreate',
              'post',
              null,
              {
                "albumId": albumId,
                "newMediaItems": [
                  {
                    "description": "Uploaded by MMM-GooglePhotos",
                    "simpleMediaItem": {
                      "uploadToken": uploadToken,
                      "fileName": fileName
                    }
                  }
                ],
                "albumPosition": {
                  "position": "LAST_IN_ALBUM"
                }
              }
            )
            resolve(result.data)
          } catch(err) {
            this.log(".create() ", err.toString())
            this.log(err)
            throw err
          }
        }
        create()
      })
    })
  }

}




module.exports = GPhotos
