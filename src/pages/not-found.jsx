import { Helmet } from "react-helmet-async";
import { Link } from "react-router";
import "./not-found.css";

export function NotFound() {
  return (
    <div className="not-found">
      <Helmet>
        <title>{process.env.PUBLIC_SITE_NAME} | 404</title>
      </Helmet>
      <h1>Página no encontrada</h1>
      <Link to="/">Volver a la página de inicio</Link>
    </div>
  );
}

export default NotFound;
