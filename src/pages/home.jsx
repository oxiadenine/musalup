import { useState } from "react";
import { useLoaderData, Link } from "react-router";
import { Helmet } from "react-helmet-async";
import "./home.css";


export function Home() {
  const [user, setUser] = useState(useLoaderData());

  async function revokeUserAuth() {
    const response = await fetch(`/api/users/${user.id}/auth/revoke`, {
      method: "POST",
      headers: { "Accept": "application/json" }
    });

    if (response.ok) {
      localStorage.removeItem("userId");

      setUser(undefined);
    }
  }

  return (
    <div className="home">
      <Helmet>
        <title>{process.env.PUBLIC_SITE_NAME}</title>
      </Helmet>
      <h1>{process.env.PUBLIC_SITE_NAME}</h1>
      <div>
        <Link to={"/users/create"}>
          <button type="button">Registrarse</button>
        </Link>
        {user && <button type="button" onClick={revokeUserAuth}>Cerrar sesión</button>}
        {!user && (
          <Link to={"/users/auth"}>
            <button type="button">Iniciar sesión</button>
          </Link>
        )}
      </div>
    </div>
  );
}

export default Home;
