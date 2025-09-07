import { createContext, useContext, useEffect, useState } from "react";
import i18next from "i18next";
import { matchPath, replace, unstable_createContext } from "react-router";

export const languages = ["es", "en"];
export const defaultLanguage = languages[0];

export { i18next as translation };

export const TranslationContext = createContext(i18next);

export function useTranslation(namespace, messages) {
  const translation = useContext(TranslationContext);

  const getTranslate = () => translation.getFixedT(null);

  const [translate, setTranslate] = useState(getTranslate);

  const events = ["languageChanged"];

  useEffect(() => {
    async function loadTranslations() {
      await translation.loadNamespaces(namespace);

      translation.setDefaultNamespace(namespace);

      Object.keys(messages).forEach(language => {
        translation.addResourceBundle(language, namespace, messages[language]);
      });

      await translation.reloadResources(null, [namespace], () => {
        setTranslate(getTranslate);
      });
    }

    if (translation.isInitialized) {
      loadTranslations();
    }

    const resetTranslate = () => setTranslate(getTranslate);

    events.forEach(event => translation.on(event, resetTranslate));

    return () => {
      Object.keys(messages).forEach(language => {
        translation.removeResourceBundle(language, namespace);
      });

      events.forEach(event => translation.off(event, resetTranslate));
    };
  }, [translation]);

  return [translate, translation];
}

export const translationContext = unstable_createContext(i18next);

export async function rewritePath({ context, request }) {
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
}

export async function setLanguage({ context }) {
  const translation = context.get(translationContext);
  
  const language = localStorage.getItem("lang") ?? translation.options.fallbackLng[0];

  await translation.changeLanguage(language);
}
