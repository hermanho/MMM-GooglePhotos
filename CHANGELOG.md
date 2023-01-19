# MMM-GooglePhotos Change Log

**`[2.1.0] - 2023/01/19`**
- Changed: Update dependency packages to fix vulnerability.
- Fixed: Change mkdirp to promise syntax (#156)

**`[2.0.3] - 2022/10/18`**
- Changed: Update dependency packages to fix vulnerability.

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

