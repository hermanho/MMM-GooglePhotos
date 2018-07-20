//
// MMM-GooglePhotos
//
Module.register("MMM-GooglePhotos", {
	defaults: {
    albumId: "", // your album id from result of `auth_and_test.js`
    refreshInterval: 1000*60,  // too short refreshing might cause API quota limit. Under 10sec will exhaust your quota(usually total <25000 per day).
		scanInterval: 1000*60*60, // too many scans might cause API quota limit also.
    sort: "time", //'time', 'reverse', 'random'
    showWidth: "800px", // how large the photo will be shown as.
    showHeight: "600px",
		originalWidthPx: 800, // original size of loaded image. (related with image quality)
		originalHeightPx: 600,
		mode: "cover", // "cover" or "contain" (https://www.w3schools.com/cssref/css3_pr_background-size.asp)
  },

	getStyles: function () {
		return ["MMM-GooglePhotos.css"]
	},

  start: function() {
    this.sendSocketNotification("INIT", this.config)
  },

  getDom: function() {
    var wrapper = document.createElement("div")
    wrapper.id = "GPHOTO"
		wrapper.style.width = this.config.showWidth
		wrapper.style.height = this.config.showHeight
		wrapper.style.minWidth = this.config.showWidth
		wrapper.style.minHeight = this.config.showHeight
		wrapper.style.backgroundSize = this.config.mode
    return wrapper
  },

	showImage: function(url) {
		var h1 = document.getElementById("GPHOTO")
		h1.style.backgroundImage = "url('" + url + "')"
	},

  socketNotificationReceived: function(notification, payload) {
    switch(notification) {
      case "NEW_IMAGE":
				this.showImage(payload.url)
        break
    }
  },

  notificationReceived: function(sender, notification, payload) {
    switch(notification) {
      case "DOM_OBJECTS_CREATED":
      //  this.initialize()
        break
    }
  }
})
