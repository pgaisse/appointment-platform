// src/helpers/httpErrors.js
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function badRequest(msg) { return new HttpError(400, msg); }
function unauthorized(msg) { return new HttpError(401, msg); }
function forbidden(msg) { return new HttpError(403, msg); }
function notFound(msg) { return new HttpError(404, msg); }
function conflict(msg) { return new HttpError(409, msg); }
function unprocessable(msg) { return new HttpError(422, msg); }
function serverError(msg) { return new HttpError(500, msg); }

module.exports = {
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  serverError,
};
