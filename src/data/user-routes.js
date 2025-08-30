import { User, UserError } from "./user";
import { UserSessionError } from "./user-session";
import { UserSessionCookie, UserSessionCookieError } from "./user-session-cookie";

export const userRoutes = {
  "/api/users/create": {
    POST: async request => handleRoute(async () => {
      let user = await request.json();

      user = await User.create(user);

      return Response.json({ user }, { status: 201 });
    })
  },
  "/api/users/auth": {
    POST: async request => handleRoute(async () => {
      let user = await request.json();

      user = await User.verify(user);

      await UserSessionCookie.create(user, request.cookies);

      delete user.password;

      return Response.json({ user });
    })
  },
  "/api/users/:userId/auth/revoke": {
    POST: async request => handleRoute(async () => {
      let user = { id: request.params.userId };

      user = await User.read(user);

      await UserSessionCookie.revoke(user, request.cookies);

      delete user.password;

      return Response.json({ user });
    })
  },
  "/api/users/:userId": {
    GET: async request => handleRoute(async () => {
      let user = { id: request.params.userId };

      user = await User.read(user);

      await UserSessionCookie.verify(user, request.cookies);

      delete user.password;

      return Response.json({ user });
    })
  }
};

async function handleRoute(block) {
  try {
    return await block();
  } catch (error) {
    if (error instanceof UserError) {
      if (error.cause.code === UserError.Code.empty) {
        return new Response(error.message, { status: 400 });
      } else if (error.cause.code === UserError.Code.validity) {
        return new Response(error.message, { status: 401 });
      } else if (error.cause.code === UserError.Code.duplicate) {
        return new Response(error.message, { status: 409 });
      } else if (error.cause.code === UserError.Code.none) {
        return new Response(error.message, { status: 403 });
      }
    } else if (error instanceof UserSessionError) {
      if (error.cause.code === UserSessionError.Code.none) {
        return new Response(error.message, { status: 403 });
      } else if (error.cause.code === UserSessionError.Code.validity) {
        return new Response(error.message, { status: 401 });
      }
    } else if (error instanceof UserSessionCookieError) {
      if (error.cause.code === UserSessionCookieError.Code.missing) {
        return new Response(error.message, { status: 403 });
      } else if (error.cause.code === UserSessionCookieError.Code.expiration) {
        return new Response(error.message, { status: 401 });
      }
    }

    return new Response("Internal server error", { status: 500 });
  }
}
