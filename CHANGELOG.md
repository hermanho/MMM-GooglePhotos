# MMM-GooglePhotos Change Log

**`[2.1.7] - 2024/03/16`**
- Fixed: update axios to 1.7.4 [CVE-2024-39338](https://security.snyk.io/vuln/SNYK-JS-AXIOS-7361793) 
- Fixed: depedencies packages update
- Fixed: albumn info did not show when startup caching 

**`[2.1.6] - 2024/03/16`**
- Fixed: [#187](https://github.com/hermanho/MMM-GooglePhotos/issues/187) fix pageSize parameter 
- Fixed: update follow-redirects to 1.15.6 [CVE-2024-28849](https://github.com/advisories/GHSA-cxjh-pqwp-8mfp) 

**`[2.1.5] - 2024/03/08`**
- Added: Allow regular expression ([RE2 engine](https://github.com/google/re2)) in album names [#179](https://github.com/hermanho/MMM-GooglePhotos/issues/179)

**`[2.1.4] - 2024/01/28`**
- Changed: Update README.md and INSTALL.md
- Changed: Enrich error message display

**`[2.1.2] - 2023/07/17`**

- Changed: Update dependency packages to fix vulnerability [SNYK-JS-AXIOS-6032459](https://snyk.io/vuln/SNYK-JS-AXIOS-6032459)
- Changed: Move installation guideline to [INSTALL.md](INSTALL.md)
- Changed: Use shuffle algorithm to do random sorting.
- Changed: Use native async await instead of promise syntax.
- Changed: Photo index will be included in logging and fine tune the logging data and messages.
- Removed: remove generate_token.js (v1)
- Fixed: [#170](https://github.com/hermanho/MMM-GooglePhotos/issues/170) fix photo showing when GPHOTO_PREVIOUS is triggered

**`[2.1.1] - 2023/07/17`**

- Changed: Update dependency packages to fix vulnerability.

**`[2.1.0] - 2023/01/19`**

- Changed: Update dependency packages to fix vulnerability.
- Fixed: Change mkdirp to promise syntax ([#156](https://github.com/hermanho/MMM-GooglePhotos/issues/156))

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
