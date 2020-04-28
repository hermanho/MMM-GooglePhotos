//
//
// MMM-GooglePhotos
//
Module.register("MMM-GooglePhotos", {
  defaults: {
    albums: [],
    updateInterval: 1000 * 30, // minimum 10 seconds.
    sort: "new", // "old", "random"
    uploadAlbum: null, // Only for created by `create_uploadable_album.js`
    condition: {
      fromDate: null, // Or "2018-03", RFC ... format available
      toDate: null, // Or "2019-12-25",
      minWidth: null, // Or 400
      maxWidth: null, // Or 8000
      minHeight: null, // Or 400
      maxHeight: null, // Or 8000
      minWHRatio: null,
      maxWHRatio: null,
      // WHRatio = Width/Height ratio ( ==1 : Squared Photo,   < 1 : Portraited Photo, > 1 : Landscaped Photo)
    },
    showWidth: 1080, // These values will be used for quality of downloaded photos to show. real size to show in your MagicMirror region is recommended.
    showHeight: 1920,
    timeFormat: "YYYY/MM/DD HH:mm",
    autoInfoPosition: false,
  },

  getStyles: function() {
    return ["MMM-GooglePhotos.css"]
  },

  start: function() {
    this.uploadableAlbum = null
    this.albums = null
    this.scanned = []
    this.updateTimer = null
    this.index = 0
    this.firstScan = true
    if (this.config.updateInterval < 1000 * 10) this.config.updateInterval = 1000 * 10
    this.config.condition = Object.assign({}, this.defaults.condition, this.config.condition)
    this.sendSocketNotification("INIT", this.config)
    this.dynamicPosition = 0
  },

  socketNotificationReceived: function(noti, payload) {
    if (noti == "UPLOADABLE_ALBUM") {
      this.uploadableAlbum = payload
    }
    if (noti == "INITIALIZED") {
      this.albums = payload
    }
    if (noti == "SCANNED") {
      if (payload && Array.isArray(payload) && payload.length > 0)
      this.scanned = payload
      if (this.firstScan) {
        this.firstScan == false
        this.updatePhotos()
      }

    }
  },

  notificationReceived: function(noti, payload, sender) {
    if (noti == "GPHOTO_NEXT") {
      this.updatePhotos()
    }
    if (noti == "GPHOTO_PREVIOUS") {
      this.updatePhotos(-2)
    }
    if (noti == "GPHOTO_UPLOAD") {
      this.sendSocketNotification("UPLOAD", payload)
    }
  },

  updatePhotos: function(dir=0) {
    clearTimeout(this.updateTimer)
    if (this.scanned.length == 0) return
    this.index = this.index + dir
    if (this.index < 0) this.index = 0
    if (this.index >= this.scanned.length) {
      this.index = 0
      if (this.config.sort == "random") {
        for (var i = this.scanned.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1))
          var t = this.scanned[i]
          this.scanned[i] = this.scanned[j]
          this.scanned[j] = t
        }
      }
    }
    var target = this.scanned[this.index]
    var url = target.baseUrl + `=w${this.config.showWidth}-h${this.config.showHeight}`
    this.ready(url, target)
    this.index++
    this.updateTimer = setTimeout(()=>{
      this.updatePhotos()
    }, this.config.updateInterval)
  },

  ready: function(url, target) {
    var hidden = document.createElement("img")
    hidden.onerror = () => {
      console.log("[GPHOTO] Image load fails.")
      this.sendSocketNotification("IMAGE_LOAD_FAIL", url)
    }
    hidden.onload = () => {
      var back = document.getElementById("GPHOTO_BACK")
      var current = document.getElementById("GPHOTO_CURRENT")
      //current.classList.remove("animated")
      var dom = document.getElementById("GPHOTO")
      back.style.backgroundImage = `url(${url})`
      current.style.backgroundImage = `url(${url})`
      current.classList.add("animated")
      var info = document.getElementById("GPHOTO_INFO")
      var album = this.albums.find((a)=>{
        if (a.id == target._albumId) return true
        return false
      })
      if (this.config.autoInfoPosition) {
        var op = (album, target) => {
          var now = new Date()
          var q = Math.floor(now.getMinutes() / 15)
          var r = [
            [0,       'none',   'none',   0     ],
            ['none',  'none',   0,        0     ],
            ['none',  0,        0,        'none'],
            [0,       0,        'none',   'none'],
          ]
          return r[q]
        }
        if (typeof this.config.autoInfoPosition == 'function') {
          op = this.config.autoInfoPosition
        }
        let [top, left, bottom, right] = op(album, target)
        info.style.setProperty('--top', top)
        info.style.setProperty('--left', left)
        info.style.setProperty('--bottom', bottom)
        info.style.setProperty('--right', right)
      }
      info.innerHTML = ""
      var albumCover = document.createElement("div")
      albumCover.classList.add("albumCover")
      albumCover.style.backgroundImage = `url(modules/MMM-GooglePhotos/cache/${album.id})`
      var albumTitle = document.createElement("div")
      albumTitle.classList.add("albumTitle")
      albumTitle.innerHTML = album.title
      var photoTime = document.createElement("div")
      photoTime.classList.add("photoTime")
      photoTime.innerHTML = (this.config.timeFormat == "relative")
        ? moment(target.mediaMetadata.creationTime).fromNow()
        : moment(target.mediaMetadata.creationTime).format(this.config.timeFormat)
      var infoText = document.createElement("div")
      infoText.classList.add("infoText")

      info.appendChild(albumCover)
      infoText.appendChild(albumTitle)
      infoText.appendChild(photoTime)
      info.appendChild(infoText)
      console.log("[GPHOTO] Image loaded:", url)
      this.sendSocketNotification("IMAGE_LOADED", url)
    }
    hidden.src = url
  },


  getDom: function() {
    var wrapper = document.createElement("div")
    wrapper.id = "GPHOTO"
    var back = document.createElement("div")
    back.id = "GPHOTO_BACK"
    var current = document.createElement("div")
    current.id = "GPHOTO_CURRENT"
    if (this.data.position.search("fullscreen") == -1) {
      if (this.config.showWidth) wrapper.style.width = this.config.showWidth + "px"
      if (this.config.showHeight) wrapper.style.height = this.config.showHeight + "px"
    }
    current.addEventListener('animationend', ()=>{
      current.classList.remove("animated")
    })
    var info = document.createElement("div")
    info.id = "GPHOTO_INFO"
    info.innerHTML = "Loading..."
    wrapper.appendChild(back)
    wrapper.appendChild(current)
    wrapper.appendChild(info)
    console.log("updated!")
    return wrapper
  },
})
