import { Cookie } from "bun";
import { UserSession } from "../data/user-session";

const SESSION_COOKIE_NAME = "user_session";
const SESSION_COOKIE_PATH = "/api/users";

export class UserSessionCookie {
  static async create(user, cookies) {
    const userSession = await UserSession.create(user);

    const cookie = new Cookie(SESSION_COOKIE_NAME, userSession.id, {
      httpOnly: true,
      secure: true,
      maxAge: userSession.time,
      expires: new Date(userSession.expiresAt),
      sameSite: "strict",
      path: SESSION_COOKIE_PATH
    });

    cookies.set(cookie);
  }

  static async verify(user, cookies) {
    if (!cookies.has(SESSION_COOKIE_NAME)) {
      throw new UserSessionCookieError(`Missing cookie ${SESSION_COOKIE_NAME}`, {
        cause: { code: UserSessionCookieError.Code.missing }
      });
    }

    const sessionId = cookies.get(SESSION_COOKIE_NAME);

    const userSession = await UserSession.read(user, { id: sessionId });

    const cookie = new Cookie(SESSION_COOKIE_NAME, userSession.id, {
      maxAge: userSession.time,
      expires: new Date(userSession.expiresAt)
    });
          
    if (cookie.isExpired()) {
      await UserSession.revoke(user, userSession);

      cookies.delete({ name: SESSION_COOKIE_NAME, path: SESSION_COOKIE_PATH });

      throw new UserSessionCookieError((`Cookie ${SESSION_COOKIE_NAME} has expired`), {
        cause: { code: UserSessionError.Code.expiration }
      });
    }

    await UserSession.verify(user, userSession);
  }

  static async revoke(user, cookies) {
    if (!cookies.has(SESSION_COOKIE_NAME)) {
      throw new UserSessionCookieError(`Missing cookie ${SESSION_COOKIE_NAME}`, {
        cause: { code: UserSessionCookieError.Code.missing }
      });
    }

    const sessionId = cookies.get(SESSION_COOKIE_NAME);

    const userSession = await UserSession.read(user, { id: sessionId });

    await UserSession.verify(user, userSession);
    
    await UserSession.revoke(user);

    cookies.delete({ name: SESSION_COOKIE_NAME, path: SESSION_COOKIE_PATH });
  }
}

export class UserSessionCookieError extends Error {
  constructor(message, options) {
    super(message, options);
  }

  static Code = Object.freeze({
    missing: 0,
    expiration: 1
  });
}
