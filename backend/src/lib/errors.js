// Throw these from any route; the router turns them into a JSON { error } response.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class ValidationError extends HttpError {
  constructor(message) {
    super(400, message);
  }
}
