import { createContext, useContext, useEffect, useState } from "react";
import i18n from "i18next";
import { matchPath, replace } from "react-router";

export class Intl {
  static instance = i18n;
  static languages = ["es", "en"];
  static events = ["languageChanged"];

  static initialize(language) {
    i18n.init({
      lng: language.split("-")[0],
      fallbackLng: this.languages[0],
      supportedLngs: this.languages,
      ns: [],
      debug: process.env.NODE_ENV === "development" ? true : false
    });

    return i18n;
  }
}

export const IntlContext = createContext(Intl.instance);

export function useTranslation(namespace, messages) {
  const intl = useContext(IntlContext);

  const getTranslate = () => intl.getFixedT(null);

  const [translate, setTranslate] = useState(getTranslate);

  useEffect(() => {
    if (intl.isInitialized) {
      intl.loadNamespaces(namespace).then(() => {
        intl.setDefaultNamespace(namespace);

        Object.keys(messages).forEach(lang => {
          intl.addResourceBundle(lang, namespace, messages[lang]);
        });

        intl.reloadResources(null, [namespace], () => {
          setTranslate(getTranslate);
        });
      });
    }

    const resetTranslate = () => setTranslate(getTranslate);

    Intl.events.forEach(event => intl.on(event, resetTranslate));

    return () => {
      Object.keys(messages).forEach(lang => {
        intl.removeResourceBundle(lang, namespace);
      });

      Intl.events.forEach(event => intl.off(event, resetTranslate));
    };
  }, [intl]);

  return [translate, intl];
}

export function rewritePath({ request }) {
  const intl = Intl.instance;
  
  const url = new URL(request.url);

  const defaultLanguage = intl.options.fallbackLng[0];

  const params = matchPath("/:lang?/*", url.pathname).params;

  if (!params.lang || !Intl.languages.includes(params.lang)) {
    const language = localStorage.getItem("lang") ?? defaultLanguage;

    intl.changeLanguage(language);

    const pathname = url.pathname === "/" ? "" : url.pathname;

    return replace(`${url.origin}/${language}${pathname}`);
  }

  intl.changeLanguage(params.lang);
}

export function setLanguage() {
  const intl = Intl.instance;
  
  const defaultLanguage = intl.options.fallbackLng[0];

  const language = localStorage.getItem("lang") ?? defaultLanguage;

  intl.changeLanguage(language);
}
