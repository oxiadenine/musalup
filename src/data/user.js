import { randomUUIDv7 } from "bun";
import { Database } from "./database";
import { UserPassword } from "../lib/user-password";

export class User {
  static async create(user) {
    const id = randomUUIDv7();
    const password = await UserPassword.hash(user.password);

    const result = await Database.client`
      INSERT INTO users (id, nickname, password)
      VALUES (${id}, ${user.nickname}, ${password})
      RETURNING id, nickname
    `;

    return result[0];
  }

  static async verify(user) {
    const isValidPassword = await UserPassword.verify(user.plainPassword, user.password);

    if (!isValidPassword) {
      throw Error(`Invalid user password`);
    }
  }

  static async read(user) {
    let result;

    if (user.id) {
      result = await Database.client`SELECT * FROM users WHERE id = ${user.id}`;
    }
    
    if (user.nickname) {
      result = await Database.client`SELECT * FROM users WHERE nickname = ${user.nickname}`;
    }

    return result[0];
  }
}
