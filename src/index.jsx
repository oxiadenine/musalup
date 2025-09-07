import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { HelmetProvider } from "react-helmet-async";
import { languages, defaultLanguage, translation, TranslationContext, rewritePath, setLanguage } from "./lib/intl";
import { Home } from "./pages/home";
import { userRoutes } from "./pages/user-routes";
import { NotFound } from "./pages/not-found";
import "./index.css";

translation.init({
  lng: new Intl.Locale(navigator.language).language,
  fallbackLng: defaultLanguage,
  supportedLngs: languages,
  ns: [],
  debug: process.env.NODE_ENV === "development" ? true : false
});

translation.on("languageChanged", () => {
  document.documentElement.lang = translation.language;
});

const router = createBrowserRouter([
  ...["", ...languages].map(language => {
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
        ...userRoutes
      ]
    }
  }),
  { path: "*", loader: setLanguage, Component: NotFound }
]);

const app = (
  <HelmetProvider>
    <TranslationContext value={translation}>
      <RouterProvider router={router} />
    </TranslationContext>
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
