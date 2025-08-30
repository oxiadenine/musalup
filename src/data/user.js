import { randomUUIDv7 } from "bun";
import { Database } from "./database";
import { UserPassword } from "../lib/user-password";

export class User {
  static async create(user) {
    if (!user.nickname) {
      throw new UserError("User nickname is empty", {
        cause: { code: UserError.Code.empty }
      });
    }

    if (!user.password) {
      throw new UserError("User password is empty", {
        cause: { code: UserError.Code.empty }
      });
    }

    let result = await Database.client`SELECT EXISTS (SELECT 1 FROM users WHERE nickname = ${user.nickname})`;

    if (result[0].exists) {
      throw new UserError("User already exists", {
        cause: { code: UserError.Code.duplicate }
      });
    }

    const id = randomUUIDv7();
    const password = await UserPassword.hash(user.password);

    result = await Database.client`
      INSERT INTO users (id, nickname, password)
      VALUES (${id}, ${user.nickname}, ${password})
      RETURNING id, nickname
    `;

    return result[0];
  }

  static async verify(user) {
    if (!user.nickname) {
      throw new UserError("User nickname is empty", {
        cause: { code: UserError.Code.empty }
      });
    }

    if (!user.password) {
      throw new UserError("User password is empty", {
        cause: { code: UserError.Code.empty }
      });
    }

    let result = await Database.client`SELECT * FROM users WHERE nickname = ${user.nickname}`;

    if (!result[0]) {
      throw new UserError("User does not exists", {
        cause: { code: UserError.Code.none }
      });
    }

    const password = result[0].password;
    const { password: plainPassword } = user;

    const isValidPassword = await UserPassword.verify(plainPassword, password);

    if (!isValidPassword) {
      throw new UserError("User password is not valid", {
        cause: { code: UserError.Code.validity }
      });
    }

    return result[0];
  }

  static async read(user) {
    const result = await Database.client`SELECT * FROM users WHERE id = ${user.id}`;

    if (!result[0]) {
      throw new UserError("User does not exists", {
        cause: { code: UserError.Code.none }
      });
    }

    return result[0];
  }
}

export class UserError extends Error {
  constructor(message, options) {
    super(message, options);
  }

  static Code = Object.freeze({
    empty: 0,
    validity: 1,
    duplicate: 2,
    none: 3
  });
}
