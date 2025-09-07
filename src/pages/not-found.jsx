import { Helmet } from "react-helmet-async";
import { Link } from "react-router";
import { useTranslation } from "../lib/intl";
import "./not-found.css";

const messages = {
  es: {
    title: "Página no encontrada",
    link: "Volver a la página de inicio"
  },
  en: {
    title: "Page not found",
    link: "Return to home page"
  }
};

export function NotFound() {
  const [translate, translation] = useTranslation("not-found", messages);

  return (
    <div className="not-found">
      <Helmet>
        <title>{process.env.PUBLIC_SITE_NAME} | 404</title>
      </Helmet>
      <h1>{translate("title")}</h1>
      <Link to={`/${translation.language}`}>{translate("link")}</Link>
    </div>
  );
}

export default NotFound;
