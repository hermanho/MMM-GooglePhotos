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

  showImage: function(payload) {
    var url = payload.url
    var image = document.getElementById("GPHOTO")
    image.style.opacity = 0
    setTimeout(()=>{
      image.style.backgroundImage = "unset"
      image.style.backgroundImage = "url('" + url + "')"
      image.style.opacity = 1
      if (this.config.mode == "hybrid") {
        var rect = image.getBoundingClientRect()
        var rr = ((rect.width / rect.height) > 1) ? "h" : "v"
        var ir = ((payload.width / payload.height) > 1) ? "h" : "v"
        image.style.backgroundSize = (rr == ir) ? "cover" : "contain"
      } else {
        image.style.backgroundSize = this.config.mode
      }
    }, 2000)

  },

  socketNotificationReceived: function(notification, payload) {
    switch(notification) {
      case "NEW_IMAGE":
        this.showImage(payload)
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
