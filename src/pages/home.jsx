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
        <button type="button">
          <Link to={"/users/create"}>Registrarse</Link>
        </button>
        {user && <button type="button" onClick={revokeUserAuth}>Cerrar sesión</button>}
        {!user && (
          <button type="button">
            <Link to={"/users/auth"}>Iniciar sesión</Link>
          </button>
        )}
      </div>
    </div>
  );
}

export default Home;
