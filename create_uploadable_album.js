"use strict";
const GP = require("./GPhotos.js");
const authOption = require("./google_auth.json");

let GPhotos = new GP({
  authOption: authOption,
  debug: true,
});

let args = process.argv.slice(2)[0];
if (!args) {
  console.log("Give an album name. (e.g:> node create_uploadable_album.js MagicMirrorAlbum )");
  process.exit();
}

const steps = async () => {
  try {
    let albums = await GPhotos.getAlbums();
    let matched = albums.find((a) => {
      if (a.title === args) return true;
      return false;
    });
    if (matched) {
      console.log(`Album "${args}" is already existing.`);
      //console.log(matched)
    } else {
      console.log(`Album "${args}" will be created.`);
      let r = await GPhotos.createAlbum(args);
      //console.log(r)
      let s = await GPhotos.shareAlbum(r.id);
      //console.log(s)
      console.log(`Album "${args}" is created.`);
    }
    process.exit();
  } catch (err) {
    console.log(err);
    process.exit();
  }
};
steps();
