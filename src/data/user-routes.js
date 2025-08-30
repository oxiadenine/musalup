import { User, UserError } from "./user";
import { UserSessionError } from "./user-session";
import { UserSessionCookie, UserSessionCookieError } from "./user-session-cookie";

export const userRoutes = {
  "/api/users/create": {
    POST: async request => {
      let user = await request.json();

      try {
        user = await User.create(user);
      } catch (error) {
        if (error instanceof UserError) {
          if (error.cause.code === UserError.Code.empty) {
            return new Response(error.message, { status: 400 });
          } else if (error.cause.code === UserError.Code.duplicate) {
            return new Response(error.message, { status: 409 });
          }
        }

        throw error;
      }

      return Response.json({ user }, { status: 201 });
    }
  },
  "/api/users/auth": {
    POST: async request => {
      let user = await request.json();

      try {
        user = await User.verify(user);

        await UserSessionCookie.create(user, request.cookies);
      } catch (error) {
        if (error instanceof UserError) {
          if (error.cause.code === UserError.Code.empty) {
            return new Response(error.message, { status: 400 });
          } else if (error.cause.code === UserError.Code.none) {
            return new Response(error.message, { status: 403 });
          } else if (error.cause.code === UserError.Code.validity) {
            return new Response(error.message, { status: 401 });
          }
        }

        throw error;
      }

      delete user.password;

      return Response.json({ user });
    }
  },
  "/api/users/:userId/auth/revoke": {
    POST: async request => {
      let user = { id: request.params.userId };

      try {
        user = await User.read(user);

        await UserSessionCookie.revoke(user, request.cookies);
      } catch (error) {
        if (error instanceof UserError) {
          if (error.cause.code === UserError.Code.none) {
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
          }
        }

        throw error;
      }

      delete user.password;

      return Response.json({ user });
    }
  },
  "/api/users/:userId": {
    GET: async request => {
      let user = { id: request.params.userId };

      try {
        user = await User.read(user);

        await UserSessionCookie.verify(user, request.cookies);
      } catch (error) {
        if (error instanceof UserError) {
          if (error.cause.code === UserError.Code.none) {
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

        throw error;
      }

      delete user.password;

      return Response.json({ user });
    }
  }
};
