import { Cookie } from "bun";
import { UserSession } from "../data/user-session";

const SESSION_COOKIE_NAME = "user_session";
const SESSION_COOKIE_PATH = "/api/users";

export class UserSessionCookie {
  static async create(user, cookies) {
    const session = await UserSession.create(user);

    delete user.password;

    const cookie = new Cookie(SESSION_COOKIE_NAME, session.id, {
      httpOnly: true,
      secure: true,
      maxAge: session.time,
      expires: new Date(session.expiresAt),
      sameSite: "strict",
      path: SESSION_COOKIE_PATH
    });

    cookies.set(cookie);

    return Response.json({ user });
  }

  static async verify(user, cookies) {
    if (!cookies.has(SESSION_COOKIE_NAME)) {
      return new Response(`Missing cookie ${SESSION_COOKIE_NAME}`, { status: 403 });
    }

    const sessionId = cookies.get(SESSION_COOKIE_NAME);

    const session = await UserSession.read(user, { id: sessionId });

    if (!session) {
      return new Response(`Invalid session id`, { status: 403 });
    }

    const cookie = new Cookie(SESSION_COOKIE_NAME, session.id, {
      maxAge: session.time,
      expires: new Date(session.expiresAt)
    });
          
    if (cookie.isExpired()) {
      await UserSession.revoke(user, session);

      cookies.delete({ name: SESSION_COOKIE_NAME, path: SESSION_COOKIE_PATH });

      return new Response((`Cookie ${cookie.name}=${cookie.value} has expired`), { status: 401 });
    }

    try {
      await UserSession.verify(user, session);
    } catch (error) {
      return new Response(error.message, { status: 403 });
    }

    delete user.password;

    return Response.json({ user });
  }

  static async revoke(user, cookies) {
    if (!cookies.has(SESSION_COOKIE_NAME)) {
      return new Response(`Missing cookie ${SESSION_COOKIE_NAME}`, { status: 403 });
    }

    const sessionId = cookies.get(SESSION_COOKIE_NAME);

    const session = await UserSession.read(user, { id: sessionId });

    if (!session) {
      return new Response(`Invalid session id`, { status: 403 });
    }

    try {
      await UserSession.verify(user, session);
    } catch (error) {
      return new Response(error.message, { status: 403 });
    }

    delete user.password;
    
    await UserSession.revoke(user);

    cookies.delete({ name: SESSION_COOKIE_NAME, path: SESSION_COOKIE_PATH });

    return Response.json({ user });
  }
}
