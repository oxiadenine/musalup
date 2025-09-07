import { redirect } from "react-router";
import { UserCreate } from "./user-create";
import { UserAuth } from "./user-auth";
import { translation } from "../lib/intl";

export const userRoutes = [
  { path: "users/create", Component: UserCreate },
  {
    path: "users/auth",
    loader: async () => {
      const userId = localStorage.getItem("userId");

      if (userId) {
        const response = await fetch(`/api/users/${userId}`, {
          method: "GET",
          headers: { "Accept": "application/json" }
        });

        if (response.ok) {
          return redirect(`/${translation.language}`);
        } else {
          localStorage.removeItem("userId");
        }
      }
    },
    Component: UserAuth
  }
]
