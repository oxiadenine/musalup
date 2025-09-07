import { redirect } from "react-router";
import { translationContext } from "../lib/intl";
import { UserAuth } from "./user-auth";

export const userAuthRoute = {
  path: "users/auth",
  loader: async ({ context }) => {
    const translation = context.get(translationContext);

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
};
