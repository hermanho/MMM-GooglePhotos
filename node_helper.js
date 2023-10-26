"use strict";

const fs = require("fs");
const { writeFile, readFile } = require("fs/promises");
const path = require("path");
const moment = require("moment");
const GP = require("./GPhotos.js");
const authOption = require("./google_auth.json");
const { Readable } = require("stream");
const { finished } = require("stream/promises");

/**
 * @type {GP}
 */
let GPhotos = null;

let NodeHelper = require("node_helper");
const { shuffle } = require("./shuffle.js");

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
    this.log("notification received", notification);
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
          console.error("[GPHOTO] hidden.onerror", { event, source, lineno, colno });
          if (error) {
            console.error("[GPHOTO] hidden.onerror error", error.message, error.name, error.stack);
          }
          console.error("Image loading fails. Check your network.:", url);
          this.prepAndSendChunk(Math.ceil((20 * 60 * 1000) / this.config.updateInterval)).then(); // 20min * 60s * 1000ms / updateinterval in ms
        }
        break;
      case "IMAGE_LOADED":
        {
          const { id, index } = payload;
          this.log("Image loaded:", index, id);
        }
        break;
      case "NEED_MORE_PICS":
        {
          this.log("Used last pic in list");
          this.prepAndSendChunk(Math.ceil((20 * 60 * 1000) / this.config.updateInterval)).then(); // 20min * 60s * 1000ms / updateinterval in ms
        }
        break;
      case "MODULE_SUSPENDED_SKIP_UPDATE":
        this.log("Module is suspended so skip the UI update");
        break;
    }
  },

  log: function (...args) {
    if (this.debug) console.log("[GPHOTOS] [node_helper]", ...args);
  },

  upload: async function (path) {
    if (!this.uploadAlbumId) {
      this.log("No uploadable album exists.");
      return;
    }
    let uploadToken = await GPhotos.upload(path);
    if (uploadToken) {
      let result = await GPhotos.create(uploadToken, this.uploadAlbumId);
      this.log("Upload completed.");
    } else {
      this.log("Upload Fails.");
    }
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
      const response = await fetch(url);
      await finished(Readable.fromWeb(response.body).pipe(file));
    }
    this.log("Initialized");
    this.sendSocketNotification("INITIALIZED", this.albums);

    //load cached list - if available
    try {
      const data = await readFile(this.path + "/cache/photoListCache.json", "utf-8");
      this.localPhotoList = JSON.parse(data.toString());
      if (this.config.sort === "random") {
        shuffle(this.localPhotoList);
      }
      this.log("successfully loaded cache of ", this.localPhotoList.length, " photos");
      await this.prepAndSendChunk(5); //only 5 for extra fast startup
    } catch (err) {
      this.log("unable to load cache", err);
    }

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

  getAlbums: async function () {
    try {
      let r = await GPhotos.getAlbums();
      return r;
    } catch (err) {
      this.log(err.toString());
      console.log(err);
    }
  },

  startScanning: function () {
    // set up interval, then 1 fail won't stop future scans
    this.scanTimer = setInterval(() => {
      this.scanJob();
    }, this.scanInterval);

    // call for first time
    this.scanJob();
  },

  scanJob: async function () {
    this.log("Start Album scanning");
    this.queue = null;
    try {
      if (this.albums.length > 0) {
        this.photos = await this.getImageList();
        return true;
      } else {
        this.log("There is no album to get photos.");
        return false;
      }
    } catch (err) {
      this.log(err.toString());
      console.log(err);
    }
  },

  getImageList: async function () {
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
    // let sort = (a, b) => {
    //   let at = moment(a.mediaMetadata.creationTime);
    //   let bt = moment(b.mediaMetadata.creationTime);
    //   if (at.isBefore(bt) && this.config.sort === "new") return 1;
    //   if (at.isAfter(bt) && this.config.sort === "old") return 1;
    //   return -1;
    // };
    let photos = [];
    try {
      for (let album of this.albums) {
        this.log(`Prepare to get photo list from '${album.title}'`);
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
          shuffle(photos);
        }
        this.log(`Total indexed photos: ${photos.length}`);
        this.localPhotoList = [...photos];
        this.localPhotoPntr = 0;
        this.prepAndSendChunk(50).then();
        try {
          await writeFile(this.path + "/cache/photoListCache.json", JSON.stringify(photos, null, 4));
          this.log("Photo list cache saved");
        } catch (err) {
          this.log(err);
        }
      }

      return photos;
    } catch (err) {
      this.log(err.toString());
      console.log(err);
    }
  },

  stop: function () {
    clearInterval(this.scanTimer);
  },
});
