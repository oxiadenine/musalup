import { useActionState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router";
import "./user-auth.css";

export function UserAuth() {
  const navigate = useNavigate();

  const authUser = async (data, formData) => {
    const user = {
      nickname: formData.get("nickname"),
      password: formData.get("password")
    };

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
    } else return user;
  }

  const [data, action, isPending] = useActionState(authUser, { nickname: "", password: "" });

  return (
    <div className="user-auth">
      <Helmet>
        <title>Usuario | Inicio de sesión</title>
      </Helmet>
      <h1>Usuario</h1>
      <form action={action}>
        <input name="nickname" type="text" placeholder="Apodo" defaultValue={data?.nickname} />
        <input name="password" type="password" placeholder="Contraseña" defaultValue={data?.password} />
        <button type="submit" disabled={isPending}>Iniciar sesión</button>
      </form>
    </div>
  );
}

export default UserAuth;
