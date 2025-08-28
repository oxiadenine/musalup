import { User } from "../data/user";
import { UserSessionCookie } from "../lib/user-session-cookie";

export const userRoutes = {
  "/api/users/create": {
    POST: async request => {
      const { nickname, password } = await request.json();

      if (!nickname) {
        return new Response("Nickname is empty", { status: 400 });
      }

      if (!password) {
        return new Response("Password is empty", { status: 400 });
      }

      let user = await User.read({ nickname });

      if (user) {
        return new Response(`User ${user.nickname} already exists`, { status: 403 });
      }

      user = await User.create({ nickname, password });

      return Response.json({ user }, { status: 201 });
    }
  },
  "/api/users/auth": {
    POST: async request => {
      const { nickname, password } = await request.json();

      if (!nickname) {
        return new Response("Nickname is empty", { status: 400 });
      }

      if (!password) {
        return new Response("Password is empty", { status: 400 });
      }

      const user = await User.read({ nickname });

      if (!user) {
        return new Response(`User ${nickname} does not exists`, { status: 403 });
      }

      try {
        await User.verify({ plainPassword: password, password: user.password });
      } catch (error) {
        return new Response(error.message, { status: 401 });
      }

      return await UserSessionCookie.create(user, request.cookies);
    }
  },
  "/api/users/:userId/auth/revoke": {
    POST: async request => {
      const { userId } = request.params;
    
      const user = await User.read({ id: userId });

      if (!user) {
        return new Response(`User ${userId} does not exists`, { status: 403 });
      }

      return await UserSessionCookie.revoke(user, request.cookies);
    }
  },
  "/api/users/:userId": {
    GET: async request => {
      const { userId } = request.params;
    
      const user = await User.read({ id: userId });

      if (!user) {
        return new Response(`User ${userId} does not exists`, { status: 403 });
      }

      return await UserSessionCookie.verify(user, request.cookies);
    }
  }
};
