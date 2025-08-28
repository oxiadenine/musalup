import { createRoot } from "react-dom/client";
import { createBrowserRouter, redirect } from "react-router";
import { RouterProvider } from "react-router/dom";
import { HelmetProvider } from "react-helmet-async";
import { Home } from "./pages/home";
import { userRoutes } from "./pages/user-routes";
import { NotFound } from "./pages/not-found";
import "./index.css";

const root = document.getElementById("root");

const router = createBrowserRouter([
  {
    path: "/",
    loader: async () => {
      const userId = localStorage.getItem("userId");

      if (userId) {
        const response = await fetch(`/api/users/${userId}`, {
          method: "GET",
          headers: { "Accept": "application/json" }
        });

        if (response.ok) {
          return (await response.json()).user;
        } else {
          localStorage.removeItem("userId");
        }
      }

      return undefined;
    },
    Component: Home
  },
  ...userRoutes,
  { path: "*", Component: NotFound }
]);

const app = (
  <HelmetProvider>
    <RouterProvider router={router} />
  </HelmetProvider>
);

document.addEventListener("DOMContentLoaded", () => {
  if (import.meta.hot) {
    (import.meta.hot.data.root ??= createRoot(root).render(app));
  } else {
    createRoot(root).render(app);
  }
});
