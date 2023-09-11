"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const moment = require("moment");
const GP = require("./GPhotos.js");
const authOption = require("./google_auth.json");

/**
 * @type {GP}
 */
let GPhotos = null;

let NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
  start: function () {
    this.scanInterval = 1000 * 60 * 55; // fixed. no longer needs to be fixed
    this.config = {};
    this.scanTimer = null;
    this.albums = [];
    this.photos = [];
    this.localPhotoList = [];
    this.localPhotoPntr = 0;
    this.queue = null;
    this.uploadAlbumId;
    this.initializeTimer = null;
  },

  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "INIT":
        this.initializeAfterLoading(payload);
        break;
      case "UPLOAD":
        this.upload(payload);
        break;
      case "IMAGE_LOAD_FAIL":
        {
          const { url, event, source, lineno, colno, error } = payload;
          this.log("[GPHOTO] hidden.onerror", { event, source, lineno, colno });
          if (error) {
            this.log("[GPHOTO] hidden.onerror error", error.message, error.name, error.stack);
          }
          this.log("Image loading fails. Check your network.:", url);
          this.prepAndSendChunk(Math.ceil((20 * 60 * 1000) / this.config.updateInterval)); // 20min * 60s * 1000ms / updateinterval in ms
        }
        break;
      case "IMAGE_LOADED":
        this.log("Image loaded:", payload);
        break;
      case "NEED_MORE_PICS":
        this.log("Used last pic in list");
        this.prepAndSendChunk(Math.ceil((20 * 60 * 1000) / this.config.updateInterval)); // 20min * 60s * 1000ms / updateinterval in ms
        break;
      case "MODULE_SUSPENDED_SKIP_UPDATE":
        this.log("Module is suspended so skip the UI update");
        break;
    }
  },

  log: function (...args) {
    if (this.debug) console.log("[GPHOTOS]", ...args);
  },

  upload: function (path) {
    if (!this.uploadAlbumId) {
      this.log("No uploadable album exists.");
      return;
    }
    const step = async () => {
      let uploadToken = await GPhotos.upload(path);
      if (uploadToken) {
        let result = await GPhotos.create(uploadToken, this.uploadAlbumId);
        this.log("Upload completed.");
      } else {
        this.log("Upload Fails.");
      }
    };
    step();
  },

  initializeAfterLoading: function (config) {
    this.config = config;
    this.debug = config.debug ? config.debug : false;
    if (!this.config.scanInterval || this.config.scanInterval < 1000 * 60 * 10) this.config.scanInterval = 1000 * 60 * 10;
    GPhotos = new GP({
      authOption: authOption,
      debug: this.debug,
    });
    this.tryToIntitialize();
  },

  tryToIntitialize: async function () {
    //set timer, in case if fails to retry in 1 min
    clearTimeout(this.initializeTimer);
    this.initializeTimer = setTimeout(
      () => {
        this.tryToIntitialize();
      },
      1 * 60 * 1000,
    );

    this.log("Starting Initialization");
    this.log("Getting album list");
    let albums = await this.getAlbums();
    if (config.uploadAlbum) {
      let uploadAlbum = albums.find((a) => {
        return a.title === config.uploadAlbum ? true : false;
      });
      if (uploadAlbum) {
        if (uploadAlbum.hasOwnProperty("shareInfo") && uploadAlbum.isWriteable) {
          this.log("Confirmed Uploadable album:", config.uploadAlbum, uploadAlbum.id);
          this.uploadAlbumId = uploadAlbum.id;
          this.sendSocketNotification("UPLOADABLE_ALBUM", config.uploadAlbum);
        } else {
          this.log("This album is not uploadable:", config.uploadAlbum);
        }
      } else {
        this.log("Can't find uploadable album :", config.uploadAlbum);
      }
    }
    for (let ta of this.config.albums) {
      let matched = albums.find((a) => {
        if (ta === a.title) return true;
        return false;
      });
      let exists = function (albums, album) {
        return albums.some((expected) => album.id === expected.id);
      };
      if (!matched) {
        this.log(`Can't find "${ta}" in your album list.`);
      } else if (!exists(this.albums, matched)) {
        this.albums.push(matched);
      }
    }
    this.log("Finish Album scanning. Properly scanned :", this.albums.length);
    for (let a of this.albums) {
      let url = a.coverPhotoBaseUrl + "=w160-h160-c";
      let fpath = path.resolve(__dirname, "cache", a.id);
      let file = fs.createWriteStream(fpath);
      const request = https.get(url, (response) => {
        response.pipe(file);
      });
    }
    this.log("Initialized");
    this.sendSocketNotification("INITIALIZED", this.albums);

    //load cached list - if available
    fs.readFile(this.path + "/cache/photoListCache.json", "utf-8", (err, data) => {
      if (err) {
        this.log("unable to load cache", err);
      } else {
        this.localPhotoList = JSON.parse(data.toString());
        this.log("successfully loaded cache of ", this.localPhotoList.length, " photos");
        this.prepAndSendChunk(5); //only 5 for extra fast startup
      }
    });

    this.log("Initialization complete!");
    clearTimeout(this.initializeTimer);
    this.log("Start first scanning.");
    this.startScanning();
  },

  prepAndSendChunk: async function (desiredChunk = 50) {
    try {
      //find which ones to refresh
      if (this.localPhotoPntr < 0 || this.localPhotoPntr >= this.localPhotoList.length) {
        this.localPhotoPntr = 0;
      }
      let numItemsToRefresh = Math.min(desiredChunk, this.localPhotoList.length - this.localPhotoPntr, 50); //50 is api limit
      this.log("num to ref: ", numItemsToRefresh, ", DesChunk: ", desiredChunk, ", totalLength: ", this.localPhotoList.length, ", Pntr: ", this.localPhotoPntr);

      // refresh them
      let list = [];
      if (numItemsToRefresh > 0) {
        list = await GPhotos.updateTheseMediaItems(this.localPhotoList.slice(this.localPhotoPntr, this.localPhotoPntr + numItemsToRefresh));
      }

      if (list.length > 0) {
        // update the localList
        this.localPhotoList.splice(this.localPhotoPntr, list.length, ...list);

        // send updated pics
        this.sendSocketNotification("MORE_PICS", list);

        // update pointer
        this.localPhotoPntr = this.localPhotoPntr + list.length;
        this.log("refreshed: ", list.length, ", totalLength: ", this.localPhotoList.length, ", Pntr: ", this.localPhotoPntr);

        this.log("just sent ", list.length, " more pics");
      } else {
        this.log("couldn't send ", list.length, " pics");
      }
    } catch (err) {
      this.log("failed to refresh and send chunk: ", err);
    }
  },

  getAlbums: function () {
    return new Promise((resolve) => {
      const step = async () => {
        try {
          let r = await GPhotos.getAlbums();
          resolve(r);
        } catch (err) {
          this.log(err.toString());
          console.log(err);
        }
      };
      step();
    });
  },

  startScanning: function () {
    // set up interval, then 1 fail won't stop future scans
    this.scanTimer = setInterval(() => {
      this.scanJob();
    }, this.scanInterval);

    // call for first time
    this.scanJob();
  },

  scanJob: function () {
    return new Promise((resolve) => {
      this.log("Start Album scanning");
      this.queue = null;
      const step = async () => {
        try {
          if (this.albums.length > 0) {
            this.photos = await this.getImageList();
            resolve(true);
          } else {
            this.log("There is no album to get photos.");
            resolve(false);
          }
        } catch (err) {
          this.log(err.toString());
          console.log(err);
        }
      };
      step();
    });
  },

  getImageList: function () {
    let condition = this.config.condition;
    let photoCondition = (photo) => {
      if (!photo.hasOwnProperty("mediaMetadata")) return false;
      let data = photo.mediaMetadata;
      if (data.hasOwnProperty("video")) return false;
      if (!data.hasOwnProperty("photo")) return false;
      let ct = moment(data.creationTime);
      if (condition.fromDate && moment(condition.fromDate).isAfter(ct)) return false;
      if (condition.toDate && moment(condition.toDate).isBefore(ct)) return false;
      if (condition.minWidth && Number(condition.minWidth) > Number(data.width)) return false;
      if (condition.minHeight && Number(condition.minHeight) > Number(data.height)) return false;
      if (condition.maxWidth && Number(condition.maxWidth) < Number(data.width)) return false;
      if (condition.maxHeight && Number(condition.maxHeight) < Number(data.height)) return false;
      let whr = Number(data.width) / Number(data.height);
      if (condition.minWHRatio && Number(condition.minWHRatio) > whr) return false;
      if (condition.maxWHRatio && Number(condition.maxWHRatio) < whr) return false;
      return true;
    };
    let sort = (a, b) => {
      let at = moment(a.mediaMetadata.creationTime);
      let bt = moment(b.mediaMetadata.creationTime);
      if (at.isBefore(bt) && this.config.sort === "new") return 1;
      if (at.isAfter(bt) && this.config.sort === "old") return 1;
      return -1;
    };
    return new Promise((resolve) => {
      const step = async () => {
        let photos = [];
        try {
          for (let album of this.albums) {
            this.log(`Prepping to get photo list from '${album.title}'`);
            let list = await GPhotos.getImageFromAlbum(album.id, photoCondition);
            this.log(`Got ${list.length} photo(s) from '${album.title}'`);
            photos = photos.concat(list);
          }
          if (photos.length > 0) {
            if (this.config.sort === "new" || this.config.sort === "old") {
              photos.sort((a, b) => {
                let at = moment(a.mediaMetadata.creationTime);
                let bt = moment(b.mediaMetadata.creationTime);
                if (at.isBefore(bt) && this.config.sort === "new") return 1;
                if (at.isAfter(bt) && this.config.sort === "old") return 1;
                return -1;
              });
            } else {
              for (let i = photos.length - 1; i > 0; i--) {
                let j = Math.floor(Math.random() * (i + 1));
                let t = photos[i];
                photos[i] = photos[j];
                photos[j] = t;
              }
            }
            this.log(`Total indexed photos: ${photos.length}`);
            this.localPhotoList = photos;
            fs.writeFile(this.path + "/cache/photoListCache.json", JSON.stringify(this.localPhotoList, null, 4), (err) => {
              if (err) {
                this.log(err);
              } else {
                this.log("Photo list cache saved");
              }
            });
          }

          return photos;
        } catch (err) {
          this.log(err.toString());
          console.log(err);
        }
      };
      resolve(step());
    });
  },

  stop: function () {
    clearInterval(this.scanTimer);
  },
});
