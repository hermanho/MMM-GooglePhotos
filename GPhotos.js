"use strict";

const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const { mkdirp } = require("mkdirp");
const { OAuth2Client } = require("google-auth-library");

/**
 * @type {import("axios").AxiosStatic}
 */
const Axios = require("axios");
const moment = require("moment");
const { error_to_string } = require("./error_to_string");
const { ConfigFileError, AuthError } = require("./Errors");

/**
 *
 * @param {number} ms ms
 */
function sleep(ms = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class Auth extends EventEmitter {
  #config;
  #debug = {};

  constructor(config, debug = false) {
    super();
    this.#config = config;
    this.#debug = debug;
    this.init().then(
      () => { },
      (err) => this.emit("error", err),
    );
  }

  async init() {
    const log = this.#debug
      ? (...args) => {
        console.log("[GPHOTOS:AUTH]", ...args);
      }
      : () => { };
    if (this.#config === undefined) this.#config = {};
    if (this.#config.keyFilePath === undefined) {
      throw new ConfigFileError('Missing "keyFilePath" from config (This should be where your Credential file is)');
    }
    if (this.#config.savedTokensPath === undefined) {
      throw new ConfigFileError('Missing "savedTokensPath" from config (this should be where your OAuth2 access tokens will be saved)');
    }
    let file = path.resolve(__dirname, this.#config.savedTokensPath);
    if (!fs.existsSync(file)) {
      throw new AuthError("No OAuth token genreated. Please execute generate_token_v2.js before start.");
    }
    let creds = path.resolve(__dirname, this.#config.keyFilePath);
    if (!fs.existsSync(creds)) {
      throw new AuthError("Missing Credentials.");
    }
    const key = require(this.#config.keyFilePath).installed;
    const oauthClient = new OAuth2Client(key.client_id, key.client_secret, key.redirect_uris[0]);
    let tokensCred;
    const saveTokens = async (first = false) => {
      oauthClient.setCredentials(tokensCred);
      let expired = false;
      if (tokensCred.expiry_date < Date.now()) {
        expired = true;
        log("Token is expired.");
      }
      if (expired || first) {
        const tk = await oauthClient.refreshAccessToken();
        tokensCred = tk.credentials;
        let tp = path.resolve(__dirname, this.#config.savedTokensPath);
        await mkdirp(path.dirname(tp));
        fs.writeFileSync(tp, JSON.stringify(tokensCred));
        log("Token is refreshed.");
        this.emit("ready", oauthClient);
      } else {
        log("Token is alive.");
        this.emit("ready", oauthClient);
      }
    };

    process.nextTick(() => {
      if (this.#config.savedTokensPath) {
        try {
          let file = path.resolve(__dirname, this.#config.savedTokensPath);
          if (fs.existsSync(file)) {
            const tokensFile = fs.readFileSync(file);
            tokensCred = JSON.parse(tokensFile);
          }
        } catch (error) {
          console.error("[GPHOTOS:AUTH]", error);
        } finally {
          if (tokensCred !== undefined) saveTokens();
        }
      }
    });
  }
}

class GPhotos {
  constructor(options) {
    this.debug = false;
    if (!options.hasOwnProperty("authOption")) {
      throw new Error("Invalid auth information.");
    }
    this.options = options;
    this.debug = options.debug ? options.debug : this.debug;
    this.albums = {
      album: [],
      shared: [],
    };
  }

  log(...args) {
    console.info("[GPHOTOS:CORE]", ...args);
  }

  logError(...args) {
    console.error("[GPHOTOS:CORE]", ...args);
  }

  logTrace(...args) {
    console.trace("[GPHOTOS:CORE]", ...args);
  }

  /**
   *
   * @returns {Promise<OAuth2Client>} OAuth2Client
   */
  async onAuthReady() {
    let auth = null;
    try {
      auth = new Auth(this.options.authOption, this.debug);
    } catch (e) {
      this.log(e.toString());
      throw e;
    }
    return new Promise((resolve, reject) => {
      auth.on("ready", (client) => {
        resolve(client);
      });
      auth.on("error", (error) => {
        reject(error);
      });
    });
  }

  async request(token, endPoint = "", method = "get", params = null, data = null) {
    let url = endPoint;
    try {
      let config = {
        method: method,
        url: url,
        baseURL: "https://photoslibrary.googleapis.com/v1/",
        headers: {
          Authorization: "Bearer " + token,
        },
      };
      if (params) config.params = params;
      if (data) config.data = data;
      const ret = await Axios(config);
      return ret;
    } catch (error) {
      this.logTrace("request fail with URL", url);
      this.logTrace("params", JSON.stringify(params));
      this.logTrace("data", JSON.stringify(data));
      this.logError(error_to_string(error));
      throw error;
    }
  }

  /**
   * @returns {Promise<GooglePhotos.Album[]>}
   */
  async getAlbums() {
    let albums = await this.getAlbumType("albums");
    let shared = await this.getAlbumType("sharedAlbums");
    for (let s of shared) {
      let isExist = albums.find((a) => {
        if (a.id === s.id) return true;
        return false;
      });
      if (!isExist) albums.push(s);
    }
    return albums;
  }

  /**
   * @param {string} type "albums" or "sharedAlbums"
   * @returns {Promise<GooglePhotos.Album[]>}
   */
  async getAlbumType(type = "albums") {
    if (type !== "albums" && type !== "sharedAlbums") throw new Error("Invalid parameter for .getAlbumType()", type);
    const client = await this.onAuthReady();
    let token = client.credentials.access_token;
    let list = [];
    const getAlbum = async (pageSize = 50, pageToken = "") => {
      this.log("Getting Album info chunks.");
      let params = {
        pageSize: pageSize,
        pageToken: pageToken,
      };
      try {
        let response = await this.request(token, type, "get", params, null);
        let body = response.data;
        if (body[type] && Array.isArray(body[type])) {
          list = list.concat(body[type]);
        }
        if (body.nextPageToken) {
          await sleep(500);
          return getAlbum(pageSize, body.nextPageToken);
        } else {
          this.albums[type] = list;
          return list;
        }
      } catch (err) {
        this.logError(err.toString());
        throw err;
      }
    };
    return getAlbum();
  }

  async getImageFromAlbum(albumId, isValid = null, maxNum = 99999) {
    const client = await this.onAuthReady();
    let token = client.credentials.access_token;
    /**
     * @type {MediaItem[]}
     */
    let list = [];
    /**
     *
     * @param {number} pageSize
     * @param {string} pageToken
     * @returns {Promise<MediaItem[]>} MediaItem
     */
    const getImage = async (pageSize = 50, pageToken = "") => {
      // this.log("Indexing photos now. total: ", list.length);
      try {
        let data = {
          albumId: albumId,
          pageSize: pageSize,
          pageToken: pageToken,
        };
        let response = await this.request(token, "mediaItems:search", "post", null, data);
        if (response.data.hasOwnProperty("mediaItems") && Array.isArray(response.data.mediaItems)) {
          for (let item of response.data.mediaItems) {
            if (list.length < maxNum) {
              item._albumId = albumId;
              if (typeof isValid === "function") {
                if (isValid(item)) list.push(item);
              } else {
                list.push(item);
              }
            }
          }
          if (list.length >= maxNum) {
            return list; // full with maxNum
          } else {
            if (response.data.nextPageToken) {
              await sleep(500);
              return getImage(pageSize, response.data.nextPageToken);
            } else {
              return list; // all found but lesser than maxNum
            }
          }
        } else {
          return list; // empty
        }
      } catch (err) {
        this.logError(".getImageFromAlbum()", err.toString());
        this.logError(err);
        throw err;
      }
    };
    return getImage();
  }

  async updateTheseMediaItems(items) {
    if (items.length <= 0) {
      return [];
    }
    const client = await this.onAuthReady();
    let token = client.credentials.access_token;
    this.log("received: ", items.length, " to refresh"); //
    let params = new URLSearchParams();
    const uniqueIds = new Set(items.map((i) => i.id));
    for (let id of uniqueIds) {
      params.append("mediaItemIds", id);
    }

    let response = await this.request(token, "mediaItems:batchGet", "get", params, null);

    if (response.data.hasOwnProperty("mediaItemResults") && Array.isArray(response.data.mediaItemResults)) {
      for (let i = 0; i < response.data.mediaItemResults.length; i++) {
        if (response.data.mediaItemResults[i].hasOwnProperty("mediaItem")) {
          items[i].baseUrl = response.data.mediaItemResults[i].mediaItem.baseUrl;
        }
      }

      return items;
    }

    return [];
  }

  async createAlbum(albumName) {
    const client = await this.onAuthReady();
    let token = client.credentials.access_token;
    try {
      let created = await this.request(token, "albums", "post", null, {
        album: {
          title: albumName,
        },
      });
      return created.data;
    } catch (err) {
      this.logError(".createAlbum() ", err.toString());
      this.logError(err);
      throw err;
    }
  }

  async shareAlbum(albumId) {
    const client = await this.onAuthReady();
    let token = client.credentials.access_token;
    try {
      let shareInfo = await this.request(token, "albums/" + albumId + ":share", "post", null, {
        sharedAlbumOptions: {
          isCollaborative: true,
          isCommentable: true,
        },
      });
      return shareInfo.data;
    } catch (err) {
      this.logError(".shareAlbum()", err.toString());
      this.logError(err);
      throw err;
    }
  }

  async upload(path) {
    const client = await this.onAuthReady();
    let token = client.credentials.access_token;
    try {
      let newFile = fs.createReadStream(path);
      let url = "uploads";
      let option = {
        method: "post",
        url: url,
        baseURL: "https://photoslibrary.googleapis.com/v1/",
        headers: {
          Authorization: "Bearer " + token,
          "Content-type": "application/octet-stream",
          //X-Goog-Upload-Content-Type: mime-type
          "X-Goog-Upload-Protocol": "raw",
        },
      };
      option.data = newFile;
      const ret = await Axios(option);
      return ret.data;
    } catch (err) {
      this.logError(".upload()", err.toString());
      this.logError(err);
      throw err;
    }
  }

  async create(uploadToken, albumId) {
    const client = await this.onAuthReady();
    let token = client.credentials.access_token;
    try {
      let fileName = moment().format("[MM_]YYYYMMDD_HHmm");
      let result = await this.request(token, "mediaItems:batchCreate", "post", null, {
        albumId: albumId,
        newMediaItems: [
          {
            description: "Uploaded by MMM-GooglePhotos",
            simpleMediaItem: {
              uploadToken: uploadToken,
              fileName: fileName,
            },
          },
        ],
        albumPosition: {
          position: "LAST_IN_ALBUM",
        },
      });
      return result.data;
    } catch (err) {
      this.logError(".create() ", err.toString());
      this.logError(err);
      throw err;
    }
  }
}

module.exports = GPhotos;
