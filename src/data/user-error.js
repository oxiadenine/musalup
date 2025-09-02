export class UserError extends Error {
  constructor(message, options) {
    super(message, options);
  }

  static Code = Object.freeze({
    validity: 1,
    duplicate: 2,
    verification: 3,
    none: 4
  });
}
