# MMM-GooglePhotos
Display your photos from album of Google Photos on MagicMirror

### Screenshot
[[PlaceHolder]]

### Installation

1. Install Module
```sh
git clone https://github.com/eouia/MMM-GooglePhotos.git
cd MMM-GooglePhotos
npm install
```

If you doubt errors are caused by different `node.JS` version, you can try to compile it by yourself.
In that case, you need to rebuild some binaries to match with Electron version.
```sh
cd ~/MagicMirror/modules/MMM-GooglePhotos
npm install --save-dev electron-rebuild
./node_modules/.bin/electron-rebuild   # It could takes dozens sec.
```

### Get `Auth` and `AlbumId`
1. Go to [Google API Console](https://console.developers.google.com/)
2. From the menu bar, select a project or create a new project.
3. To open the Google API Library, from the Navigation menu, select `APIs & Services > Library`.
4. Search for "Google Photos Library API". Select the correct result and click Enable. (You may need to enable "Google Plus" also.)
5. Then, from the menu, select `APIs & Services > Credentials`.
6. On the Credentials page, click `Create Credentials > OAuth client ID`.
7. Select your Application type as `Other` and submit. (Before or After that, you might be asked for making consent screen. do that.)
8. Then, you can download your credential json file from list. Downloaded file name would be `client_secret_xxxx...xxx.json`. rename it as `credentials.json` and save it to your `MMM-GooglePhotos` directory.
9. Now, open your termial(not via SSH, directly in your RPI).
```shell
cd ~/MagicMirror/modules/MMM-GooglePhotos
node auth_and_test.js
```
10. At first execution, It will open a browser and will ask you to login google account and to consent your allowance.
11. After consent, some code (`4/ABCD1234xxxx...`) will be appeared. copy it and return to your terminal. paste it for answer of prompt in console.
12. Now you can get list of your Google Photos albums. like these;
```
<ALBUM_NAME> : <ALBUM_ID>
travel to paris : AGj1epU5VMNoBGK9GDX3k_zDQaPT16Fe56o0N93eN6aXn-f21M98
...
```
13. Remember the id of album to show.
14. now set your `config.js`


### Configuration
```javascript
{
  module: "MMM-GooglePhotos",
  position: "top_right",
  config: {
    albumId: "YOUR_GOOGLE_PHOTOS_ALBUM_ID", // your album id from result of `auth_and_test.js`
    refreshInterval: 1000*60,  
    scanInterval: 1000*60*10, // too many scans might cause API quota limit also.
    //note(2018-07-29). It is some weird. API documents said temporal image url would live for 1 hour, but it might be broken shorter. So, per 10 min scanning could prevent dead url.

    sort: "time", //'time', 'reverse', 'random'
    showWidth: "800px", // how large the photo will be shown as. (e.g;'100%' for fullscreen)
    showHeight: "600px",
    originalWidthPx: 800, // original size of loaded image. (related with image quality)
    originalHeightPx: 600, // Bigger size gives you better quality, but can give you network burden.
    mode: "cover", // "cover" or "contain" (https://www.w3schools.com/cssref/css3_pr_background-size.asp)
  }
},
```

### Last Tested;
- MagicMirror : v2.4.1
- node.js : 8.11.3 & 10.x


### Update
#### [2018-07-29]
- Fix the issue of dead url.
(It seems also the problem of API. documents said temporal url would live for 1 hour, but it might be broken shorter.)

#### [2018-07-22]
- Fix the issue of photos shared from others.
(I think it was the problem of API, because `mediaItem:search` can access shared photos but `mediaItem/Id` cannot. That is out of sense.)
