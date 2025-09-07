import { createRoot } from "react-dom/client";
import { createBrowserRouter, matchPath, replace } from "react-router";
import { RouterProvider } from "react-router/dom";
import { HelmetProvider } from "react-helmet-async";
import { translation, TranslationContext, translationContext } from "./lib/intl";
import { homeRoute } from "./pages/home-route";
import { userCreateRoute } from "./pages/user-create-route";
import { userAuthRoute } from "./pages/user-auth-route";
import { notFoundRoute } from "./pages/not-found-route";
import "./index.css";

const languages = ["es", "en"];
const defaultLanguage = languages[0];

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
  ...["", ...languages].map(language => (
    {
      path: `/${language}`,
      loader: async ({ context, request }) => {
        const translation = context.get(translationContext);

        const url = new URL(request.url);

        const params = matchPath("/:lang?/*", url.pathname).params;

        if (!params.lang || !languages.includes(params.lang)) {
          const language = localStorage.getItem("lang") ?? translation.options.fallbackLng[0];

          await translation.changeLanguage(language);

          const pathname = url.pathname === "/" ? "" : url.pathname;

          throw replace(`${url.origin}/${language}${pathname}`);
        }

        await translation.changeLanguage(params.lang);
      },
      children: [homeRoute(languages), userCreateRoute, userAuthRoute]
    }
  )),
  notFoundRoute
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
