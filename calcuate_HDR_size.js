
const GOOGLE_PHOTO_MIN_HDR_DIMENSION = 1602;

// HDR photo require width and height at least 160px for the smallest side
const calculateHDRSize = (width, height) => {
  if (width >= GOOGLE_PHOTO_MIN_HDR_DIMENSION && height >= GOOGLE_PHOTO_MIN_HDR_DIMENSION) {
    return { width, height };
  }
  let newWidth = GOOGLE_PHOTO_MIN_HDR_DIMENSION, newHeight = GOOGLE_PHOTO_MIN_HDR_DIMENSION;
  if (width < height) {
    const scaleFactor = GOOGLE_PHOTO_MIN_HDR_DIMENSION / width;
    newHeight = Math.round(height * scaleFactor);
    return { width: newWidth, height: newHeight };
  } else {
    const scaleFactor = GOOGLE_PHOTO_MIN_HDR_DIMENSION / height;
    newWidth = Math.round(width * scaleFactor);
  }
  return { width: newWidth, height: newHeight };
};

(function (root, factory) {
  if (typeof exports === "object") {
    // Node, CommonJS-like
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.GPhotoCalculateHDRSize = factory();
  }
}(this, function () {
  return calculateHDRSize;
}));