import { useActionState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router";
import { validateUser } from "./user-validate";
import "./user-auth.css";


export function UserAuth() {
  const navigate = useNavigate();

  async function authUser(data, formData) {
    const user = {
      nickname: formData.get("nickname"),
      password: formData.get("password")
    };

    const validation = validateUser(user);

    const errors = validation.errors;

    if (validation.hasErrors) {
      return { user, errors };
    }

    const response = await fetch("/api/users/auth", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(user)
    });

    if (response.ok) {
      const { id: userId } = (await response.json()).user;

      localStorage.setItem("userId", userId);

      navigate("/");
    } else {
      if (response.status === 403) {
        errors.nickname.push({ message: "El apodo no existe" });
      } else if (response.status === 401) {
        errors.password.push({ message: "La contraseña no es válida" });
      }

      return { user, errors };
    }
    
    return { user };
  }

  const user = { nickname: "", password: "" };

  const [data, action, isPending] = useActionState(authUser, { user });

  return (
    <div className="user-auth">
      <Helmet>
        <title>Usuario | Inicio de sesión</title>
      </Helmet>
      <h1>Usuario</h1>
      <form action={action}>
        <input name="nickname" type="text" placeholder="Apodo" defaultValue={data.user?.nickname} />
        {data.errors && data.errors.nickname[0] && <p>{data.errors.nickname[0].message}</p>}
        <input name="password" type="password" placeholder="Contraseña" defaultValue={data.user?.password} />
        {data.errors && data.errors.password[0] && <p>{data.errors.password[0].message}</p>}
        <button type="submit" disabled={isPending}>Iniciar sesión</button>
      </form>
    </div>
  );
}

export default UserAuth;
