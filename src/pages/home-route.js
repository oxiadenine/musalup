import { Home } from "./home";

export const homeRoute = (languages) => ({
  index: true,
  loader: async () => {
    const userId = localStorage.getItem("userId");

    if (userId) {
      const response = await fetch(`/api/users/${userId}`, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (response.ok) {
        const user = (await response.json()).user;

        return { languages, user };
      } else {
        localStorage.removeItem("userId");
      }
    }

    return { languages };
  },
  Component: Home
});
