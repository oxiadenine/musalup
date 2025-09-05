import { randomUUIDv7 } from "bun";
import { Database } from "./database";
import { UserError } from "./user-error";
import { UserValidation } from "./user-validation";
import { UserPassword } from "../lib/user-password";

export class User {
  static async create(user) {
    this.#validate(user);

    let result = await Database.client`SELECT EXISTS (SELECT 1 FROM users WHERE nickname = ${user.nickname})`;

    if (result[0].exists) {
      throw new UserError("User nickname already exist", {
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
    this.#validate(user);

    let result = await Database.client`SELECT * FROM users WHERE nickname = ${user.nickname}`;

    if (!result[0]) {
      throw new UserError("User nickname does not exist", {
        cause: { code: UserError.Code.none }
      });
    }

    const password = result[0].password;
    const { password: plainPassword } = user;

    const isValidPassword = await UserPassword.verify(plainPassword, password);

    if (!isValidPassword) {
      throw new UserError("User password is not valid", {
        cause: { code: UserError.Code.verification }
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

  static #validate(user) {
    const validation = UserValidation.validate(user, {
      nickname: {
        empty: "User nickname is empty",
        length: "User nickname is less than 3 or greater than 16 characters",
        format: "User nickname is not in a valid format"
      },
      password: {
        empty: "User password is empty",
        length: "User password is less than 12 or greater than 32 characters",
        format: "User password is not in a valid format"
      }
    });

    validation.throwIfErrors("User is not valid");
  }
}
