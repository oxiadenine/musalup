import { useState } from "react";
import { useLoaderData, Link, useNavigate } from "react-router";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "../lib/intl";
import { AudioRecorder } from "./components/audio-recorder";
import "./home.css";

const messages = {
  es: {
    button: {
      create: "Registrarse",
      auth: "Iniciar sesión",
      revoke: "Cerrar sesión"
    }
  },
  en: {
    button: {
      create: "Sign up",
      auth: "Sign in",
      revoke: "Sign out"
    }
  }
};

export function Home() {
  const [translate, translation] = useTranslation("home", messages);

  const navigate = useNavigate();

  const data = useLoaderData();

  const [user, setUser] = useState(data.user);

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

  function selectLanguage(event) {
    const language = event.target.value;

    localStorage.setItem("lang", language);

    navigate(`/${language}`, { replace: true });
  }

  return (
    <div className="home">
      <Helmet>
        <title>{process.env.PUBLIC_SITE_NAME}</title>
      </Helmet>
      <div>
        <h1>{process.env.PUBLIC_SITE_NAME}</h1>
        <div>
          <select name="language" onChange={selectLanguage} value={translation.language}>
            {data.languages.map((language, index) => (
              <option key={index} value={language}>{language.toUpperCase()}</option>
            ))}
          </select>
          <Link to={"users/create"}>
            <button type="button">{translate("home:button.create")}</button>
          </Link>
          {user && (
            <button type="button" onClick={revokeUserAuth}>
              {translate("home:button.revoke")}
            </button>
          )}
          {!user && (
            <Link to={"users/auth"}>
              <button type="button">{translate("home:button.auth")}</button>
            </Link>
          )}
        </div>
      </div>
      <div>
        <AudioRecorder />
      </div>
    </div>
  );
}
