# MMM-GooglePhotos
Display your photos from album of Google Photos on MagicMirror

## Screenshot
![](https://raw.githubusercontent.com/eouia/MMM-GooglePhotos/master/sc.png)

![](https://raw.githubusercontent.com/eouia/MMM-GooglePhotos/master/sc2.png)

## New Updates
**`[2.0.2] - 2020/04/01`**
- Added: `autoInfoPosition` - For preventing LCD burning, Photo info can be relocated by condition.
    - `true` : automatically change position to each corner per 15 minutes.
		- `false` : not using.
		- callbackfunction (album, photo) : User can make his own position.

**`[2.0.1] - 2020/03/31`**
- Fixed: 503 error from too often/many requests. (Thanks to @olafnorge)

**`[2.0.0] - 2020/03/23`**
- Notice: Whole new build from scratch. new installation and configuration is needed.
- Removed: deprecated dependency `request`. Instead, using `Axios` and `https`
- Changed: More stable displaying photos
- Changed: New looks.
- Changed: Access album by name not by id.
- Added: You can filter photos by condition.
- Added: `GPHOTO_NEXT`, `GPHOTO_PREVIOUS` notifications are supported.
- Added: `GPHOTO_UPLOAD` notification is supported. Now `MMM-Selfieshot` and `MMM-TelegramBot` can upload pictures with this module.
- Removed: `mode`, `scanInterval`, `opacity` is removed because no more necessary.


## Regular installation
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

2. If you are using Docker
```sh
cd ~/magic_mirror/modules
git clone https://github.com/eouia/MMM-GooglePhotos.git
docker exec -it -w /opt/magic_mirror/modules/MMM-GooglePhotos magic_mirror npm install
```


### Get `token.json`
1. Go to [Google API Console](https://console.developers.google.com/)
2. From the menu bar, select a project or create a new project.
3. To open the Google API Library, from the Navigation menu, select `APIs & Services > Library`.
	 Don't forget to enble the Google API Services.
4. Search for "Google Photos Library API". Select the correct result and click Enable. (You may need to enable "Google Plus" also.)
5. Then, from the menu, select `APIs & Services > Credentials`.
6. On the Credentials page, click `Create Credentials > OAuth client ID`.
7. Select your Application type as **`Other`**(IMPORTANT!!!) and submit. (Before or After that, you might be asked for making consent screen. do that.)
> Google might change the menu name. So current this would work;
![](https://user-images.githubusercontent.com/1720610/77527670-d9fdff00-6e8c-11ea-9e9f-59c7eabc6db9.png)

8. Then, you can download your credential json file from list. Downloaded file name would be `client_secret_xxxx...xxx.json`. rename it as `credentials.json` and save it to your `MMM-GooglePhotos` directory.
9. Now, open your termial(not via SSH, directly in your RPI).
```shell
cd ~/MagicMirror/modules/MMM-GooglePhotos
node generate_token.js
```
10. At first execution, It will open a browser and will ask you to login google account and to consent your allowance.
11. After consent, some code (`4/ABCD1234xxxx...`) will be appeared. copy it and return to your terminal. paste it for answer of prompt in console.
12. Check whether `token.json` is created in your `MMM-`




## Configuration
```javascript
{
  module: "MMM-GooglePhotos",
  position: "top_right",
  config: {
		albums: [], // Set your album name. like ["My wedding", "family share", "Travle to Paris"]
		updateInterval: 1000 * 60, // minimum 10 seconds.
		sort: "new", // "old", "random"
		uploadAlbum: null, // Only album created by `create_uploadable_album.js`.
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
		timeFormat: "YYYY/MM/DD HH:mm", // Or `relative` can be used.
  }
},
```

## Usage
#### **`albums`**
Now this module can access not only your owns but also shared. You can specify album title like this.
```js
albums: ["My wedding", "family share", "Travle to Paris", "from Tom"],
```
- Caution. Too many albums and photos could make long bootup delay.
- Remember this. You can only show max 8640 photos in a day. Manage your album what to show, it will make better performance.

#### **`updateInterval`**
- Minimum `updateInterval` is 10 seconds. Too often update could makes API quota drains or network burden.

#### **`sort`**
- `new`, `old`, `random` are supported.

#### **`uploadAlbum`**
- If you set this, you can upload pictures from MagicMirror to Google Photos through `GPHOTO_UPLOAD` notification.
```js
this.sendNotification('GPHOTO_UPLOAD', path)
```
- This album **SHOULD** be created by `create_uploadable_album.js`.
```sh
node create_uploadable_album.js MyMagicMirrorAlbum
```
- At this moment, `MMM-Selfieshot` and `MMM-TelegramBot` can upload their pictures through this feature.

#### **`condition`**
- You can filter photos by this object.
- `fromDate` : If set, The photos which was created after this value will be loaded. (e.g: `fromDate:"2015-12-25"` or `fromDate:"6 Mar 17 21:22 UT"`)
- `toDate` : If set, The photos which was created before this value will be loaded. (e.g: `toDate:"Mon 06 Mar 2017 21:22:23 z"` or `toDate:"20130208"`)
- ISO 8601 and RFC 2822 is supported for `fromDate` and `toDate`.
- `minWidth`, `maxWidth`, `minHeight`, `maxHeight` : If set, the photos have these value as original dimensiont will be loaded. You can use these values to avoid too big or too small pictures(like icons)
- `minWHRatio`, `maxWHRatio` : With these values, you can get only portrait photos(or landscaped, or squared)
- **WHRatio** is `width / height`. So `=1` will be squared dimension. `>1` will be landscaped. `<1` will be portrait.
- Example:
```js
condition: {
	fromDate: "2018-01-01", // I don't want older photos than this.
	minWidth: 600, // I don't want to display some icons or meme-pictures from my garbage collecting albums.
	maxWHRatio: 1, // I want to display photos which are portrait.
}
```

#### **`showWidth`, `showHeight`**
- Specify your real resolution to show.

#### **`timeFormat`**
- Specify time format for photo info. You can also use `relative` to show more humanized.

#### **`debug`**
- If set, more detailed info will be logged.

#### **`autoInfoPosition`**
- For preventing LCD burning, Photo info can be relocated by condition.
  	- `true` : automatically change position to each corner per 15 minutes.
		- `false` : not using.
		- callbackfunction (album, photo) : User can make his own position. It should return `[top, left, bottom, right]`
```js
autoInfoPosition: true, // or false

// User custom callback
autoInfoPosition: (album, photo)=> {
 return ['10px', '10px', 'none', 'none'] // This will show photo info top-left corner.
}

```



## Tip.
- Not to show photo info : Add this into your `css/custom.css`.
```css
#GPHOTO_INFO {
	display:none;
}
```

- To move photo info to other position (e.g: top-left corner): Add this into your `css/custom.css`.
```css
#GPHOTO_INFO {
  top: 10px;
  left: 10px;
  bottom: inherit;
  right: inherit;
}
```

- Not to show blurred Background : Add this into your `css/custom.css`.
```css
#GPHOTO_BACK {
	display:none;
}
```

- To cover whole region with image : Add this into your `css/custom.css`.
```css
#GPHOTO_CURRENT {
	background-size:cover;
}
```

- To display `clock` more clearly on showing in `fullscreen_below` : Add this into your `css/custom.css`.
```css
.clock {
  padding: 10px;
	background-color: rgba(0, 0, 0, 0.5);
}
```

- To give opacity to photos:
```CSS
@keyframes trans {
  from {opacity: 0}
  to {opacity: 0.5}
}
#GPHOTO_CURRENT {
  background-size:cover;
  opacity:0.5;
}
```

## Notice
- First scanning will take a few (~dozens) seconds. Don't panic.


## Last Tested;
- MagicMirror : v2.10.0
- node.js : required over v8.
