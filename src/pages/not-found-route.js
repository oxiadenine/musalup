import { translationContext } from "../lib/intl";
import { NotFound } from "./not-found";

export const notFoundRoute = {
  path: "*",
  loader: async ({ context }) => {
    const translation = context.get(translationContext);
  
    const language = localStorage.getItem("lang") ?? translation.options.fallbackLng[0];

    await translation.changeLanguage(language);
  },
  Component: NotFound
};
