const error_to_string = (error) => {
  const logMessage = [];
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    logMessage.push("response.data:", JSON.stringify(error.response.data), "response.status:", JSON.stringify(error.response.status), "headers:", JSON.stringify(error.response.headers));
  } else if (error.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    logMessage.push("request:", JSON.stringify(error.request));
  } else {
    // Something happened in setting up the request that triggered an Error
    logMessage.push(error.message);
    logMessage.push("stack:", error.stack);
  }
  if (error.config) {
    logMessage.push("config:", JSON.stringify(error.config));
  }
  return logMessage.join("\n");
};

module.exports = { error_to_string };
