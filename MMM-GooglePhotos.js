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
  requiresVersion: "2.24.0",

  suspended: false,

  getStyles: function () {
    return ["MMM-GooglePhotos.css"];
  },

  start: function () {
    this.uploadableAlbum = null;
    this.albums = null;
    this.scanned = [];
    this.updateTimer = null;
    this.index = 0;
    this.needMorePicsFlag = true;
    this.firstScan = true;
    if (this.config.updateInterval < 1000 * 10) this.config.updateInterval = 1000 * 10;
    this.config.condition = Object.assign({}, this.defaults.condition, this.config.condition);

    const config = { ...this.config };
    for (let i = 0; i < config.albums.length; i++) {
      const album = config.albums[i];
      if (album instanceof RegExp) {
        config.albums[i] = {
          source: album.source,
          flags: album.flags,
        };
      }
    }

    this.sendSocketNotification("INIT", config);
    this.dynamicPosition = 0;
  },

  socketNotificationReceived: function (noti, payload) {
    if (noti === "UPLOADABLE_ALBUM") {
      this.uploadableAlbum = payload;
    }
    if (noti === "INITIALIZED") {
      this.albums = payload;
      //set up timer once initialized, more robust against faults
      if (!this.updateTimer || this.updateTimer === null) {
        Log.info("Start timer for updating photos.");
        this.updateTimer = setInterval(() => {
          this.updatePhotos();
        }, this.config.updateInterval);
      }
    }
    if (noti === "UPDATE_ALBUMS") {
      this.albums = payload;
    }
    if (noti === "MORE_PICS") {
      if (payload && Array.isArray(payload) && payload.length > 0) this.needMorePicsFlag = false;
      this.scanned = payload;
      this.index = 0;
      if (this.firstScan) {
        this.updatePhotos(); //little faster starting
      }
    }
    if (noti === "ERROR") {
      const current = document.getElementById("GPHOTO_CURRENT");
      const errMsgDiv = document.createElement("div");
      errMsgDiv.style.textAlign = "center";
      errMsgDiv.style.lineHeight = "80vh";
      errMsgDiv.style.fontSize = "1.5em";
      errMsgDiv.style.verticalAlign = "middle";
      errMsgDiv.textContent = payload;
      current.appendChild(errMsgDiv);
    }
    if (noti === "CLEAR_ERROR") {
      const current = document.getElementById("GPHOTO_CURRENT");
      current.textContent = "";
    }
    if (noti === "UPDATE_STATUS") {
      let info = document.getElementById("GPHOTO_INFO");
      info.innerHTML = String(payload);
    }
  },

  notificationReceived: function (noti, payload, sender) {
    if (noti === "GPHOTO_NEXT") {
      this.updatePhotos();
    }
    if (noti === "GPHOTO_PREVIOUS") {
      this.updatePhotos(-2);
    }
    if (noti === "GPHOTO_UPLOAD") {
      this.sendSocketNotification("UPLOAD", payload);
    }
  },

  updatePhotos: function (dir = 0) {
    Log.debug("Updating photos..");
    this.firstScan = false;

    if (this.scanned.length === 0) {
      this.sendSocketNotification("NEED_MORE_PICS", []);
      return;
    }
    if (this.suspended) {
      this.sendSocketNotification("MODULE_SUSPENDED_SKIP_UPDATE");
      let info = document.getElementById("GPHOTO_INFO");
      info.innerHTML = "";
      return;
    }
    this.index = this.index + dir; //only used for reversing
    if (this.index < 0) this.index = this.scanned.length + this.index;
    if (this.index >= this.scanned.length) {
      this.index -= this.scanned.length;
    }
    let target = this.scanned[this.index];
    let url = target.baseUrl + `=w${this.config.showWidth}-h${this.config.showHeight}`;
    this.ready(url, target);
    this.index++;
    if (this.index >= this.scanned.length) {
      this.index = 0;
      this.needMorePicsFlag = true;
    }
    if (this.needMorePicsFlag) {
      setTimeout(() => {
        this.sendSocketNotification("NEED_MORE_PICS", []);
      }, 2000);
    }
  },

  ready: function (url, target) {
    let hidden = document.createElement("img");
    const _this = this;
    hidden.onerror = (event, source, lineno, colno, error) => {
      const errObj = { url, event, source, lineno, colno, error };
      this.sendSocketNotification("IMAGE_LOAD_FAIL", errObj);
    };
    hidden.onload = () => {
      _this.render(url, target);
    };
    hidden.src = url;
  },

  render: function (url, target) {
    let back = document.getElementById("GPHOTO_BACK");
    let current = document.getElementById("GPHOTO_CURRENT");
    current.textContent = "";
    //current.classList.remove("animated")
    // let dom = document.getElementById("GPHOTO");
    back.style.backgroundImage = `url(${url})`;
    current.style.backgroundImage = `url(${url})`;
    current.classList.add("animated");
    const info = document.getElementById("GPHOTO_INFO");
    const album = Array.isArray(this.albums) ? this.albums.find((a) => a.id === target._albumId) : { id: -1, title: '' };
    if (this.config.autoInfoPosition) {
      let op = (album, target) => {
        let now = new Date();
        let q = Math.floor(now.getMinutes() / 15);
        let r = [
          [0, "none", "none", 0],
          ["none", "none", 0, 0],
          ["none", 0, 0, "none"],
          [0, 0, "none", "none"],
        ];
        return r[q];
      };
      if (typeof this.config.autoInfoPosition === "function") {
        op = this.config.autoInfoPosition;
      }
      const [top, left, bottom, right] = op(album, target);
      info.style.setProperty("--top", top);
      info.style.setProperty("--left", left);
      info.style.setProperty("--bottom", bottom);
      info.style.setProperty("--right", right);
    }
    info.innerHTML = "";
    let albumCover = document.createElement("div");
    albumCover.classList.add("albumCover");
    albumCover.style.backgroundImage = `url(modules/MMM-GooglePhotos/cache/${album.id})`;
    let albumTitle = document.createElement("div");
    albumTitle.classList.add("albumTitle");
    albumTitle.innerHTML = album.title;
    let photoTime = document.createElement("div");
    photoTime.classList.add("photoTime");
    photoTime.innerHTML = this.config.timeFormat === "relative" ? moment(target.mediaMetadata.creationTime).fromNow() : moment(target.mediaMetadata.creationTime).format(this.config.timeFormat);
    let infoText = document.createElement("div");
    infoText.classList.add("infoText");

    info.appendChild(albumCover);
    infoText.appendChild(albumTitle);
    infoText.appendChild(photoTime);
    info.appendChild(infoText);
    this.sendSocketNotification("IMAGE_LOADED", { id: target.id, index: this.index });
  },

  getDom: function () {
    let wrapper = document.createElement("div");
    wrapper.id = "GPHOTO";
    let back = document.createElement("div");
    back.id = "GPHOTO_BACK";
    let current = document.createElement("div");
    current.id = "GPHOTO_CURRENT";
    if (this.data.position.search("fullscreen") === -1) {
      if (this.config.showWidth) wrapper.style.width = this.config.showWidth + "px";
      if (this.config.showHeight) wrapper.style.height = this.config.showHeight + "px";
    }
    current.addEventListener("animationend", () => {
      current.classList.remove("animated");
    });
    let info = document.createElement("div");
    info.id = "GPHOTO_INFO";
    info.innerHTML = "Loading...";
    wrapper.appendChild(back);
    wrapper.appendChild(current);
    wrapper.appendChild(info);
    Log.info("updated!");
    return wrapper;
  },

  suspend() {
    this.suspended = true;
  },

  resume() {
    this.suspended = false;
  },
});
