import { password } from "bun";

export class UserPassword {
  static async hash(plaintext) {
    return await password.hash(plaintext, {
      algorithm: "argon2id",
      memoryCost: 32000,
      timeCost: 8
    });
  }

  static async verify(plaintext, hash) {
    return await password.verify(plaintext, hash, "argon2id");
  }
}
