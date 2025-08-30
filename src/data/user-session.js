import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { env } from "bun";
import { Database } from "./database";

export class UserSession {
  static async create(user) {
    const sessionId = randomBytes(16).toHex();
    
    const hash = user.password.split("$")[5];
    const iv = randomBytes(16);
    
    const cipher = createCipheriv("aes-256-gcm", Uint8Array.fromBase64(hash), iv);
  
    const encryptedSessionId = Buffer.concat([
      cipher.update(Uint8Array.fromHex(sessionId)),
      cipher.final()
    ]);
  
    const authTag = cipher.getAuthTag();
  
    const session = {
      id: encryptedSessionId.toHex(),
      time: parseInt(env.USER_SESSION_TIME),
      expiresAt: new Date(Date.now() + parseInt(env.USER_SESSION_TIME) * 1000).toISOString(),
      iv: iv.toHex(),
      authTag: authTag.toHex()
    };

    const result = await Database.client`
      INSERT INTO user_sessions (user_id, id, time, expires_at, iv, auth_tag)
      VALUES (${user.id}, ${session.id}, ${session.time}, ${session.expiresAt}, ${session.iv}, ${session.authTag})
      RETURNING id, time, expires_at AS "expiresAt"
    `;

    return result[0];
  }

  static async verify(user, session) {
    const hash = user.password.split("$")[5];
  
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Uint8Array.fromBase64(hash),
      Uint8Array.fromHex(session.iv)
    );
    decipher.setAuthTag(Uint8Array.fromHex(session.authTag));
  
    try {
      Buffer.concat([
        decipher.update(Uint8Array.fromHex(session.id)),
        decipher.final()
      ]);
    } catch (error) {
      throw new UserSessionError("User session is not valid", {
        cause: { code: UserSessionError.Code.validity }
      });
    }
  }

  static async read(user, session) {
    const result = await Database.client`
      SELECT id, time, expires_at AS "expiresAt", iv, auth_tag AS "authTag" FROM user_sessions 
      WHERE user_id = ${user.id} AND id = ${session.id}
    `;

    if (!result[0]) {
      throw new UserSessionError("User session does not exists", {
        cause: { code: UserSessionError.Code.none }
      });
    }

    return result[0];
  }

  static async revoke(user, session) {
    if (session) {
      await Database.client`
        DELETE FROM user_sessions
        WHERE user_id = ${user.id} AND id = ${session.id}
      `;
    } else {
      await Database.client`DELETE FROM user_sessions WHERE user_id = ${user.id}`;
    }
  }
}

export class UserSessionError extends Error {
  constructor(message, options) {
    super(message, options);
  }

  static Code = Object.freeze({
    none: 0,
    validity: 1
  });
}
