import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { HelmetProvider } from "react-helmet-async";
import { Intl, IntlContext, rewritePath, setLanguage } from "./lib/intl";
import { Home } from "./pages/home";
import { userRoutes } from "./pages/user-routes";
import { NotFound } from "./pages/not-found";
import "./index.css";

const intl = Intl.initialize(navigator.language);

intl.on(Intl.events[0], () => {
  document.documentElement.lang = intl.language;
});

const router = createBrowserRouter([
  ...["", ...Intl.languages].map(language => {
    return {
      path: `${language}`,
      loader: rewritePath,
      children: [
        {
          index: true,
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
      ]
    }
  }),
  { path: "*", loader: setLanguage, Component: NotFound }
]);

const app = (
  <HelmetProvider>
    <IntlContext value={intl}>
      <RouterProvider router={router} />
    </IntlContext>
  </HelmetProvider>
);

const root = document.getElementById("root");

document.addEventListener("DOMContentLoaded", () => {
  if (import.meta.hot) {
    (import.meta.hot.data.root ??= createRoot(root).render(app));
  } else {
    createRoot(root).render(app);
  }
});
