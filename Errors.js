class ConfigFileError extends Error {
  get name() {
    return this.constructor.name;
  }
}

class AuthError extends Error {
  get name() {
    return this.constructor.name;
  }
}

module.exports = {
  ConfigFileError,
  AuthError,
};
