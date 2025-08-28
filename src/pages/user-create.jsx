import { useActionState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router";
import "./user-create.css";

export function UserCreate() {
  const navigate = useNavigate();

  async function createUser(data, formData) {
    const user = {
      nickname: formData.get("nickname"),
      password: formData.get("password")
    };

    const response = await fetch("/api/users/create", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(user)
    });

    if (response.ok) {
      navigate("/users/auth");
    } else return user;
  }

  const [data, action, isPending] = useActionState(createUser, { nickname: "", password: "" });

  return (
    <div className="user-create">
      <Helmet>
        <title>Usuario | Registro</title>
      </Helmet>
      <h1>Usuario</h1>
      <form action={action}>
        <input name="nickname" type="text" placeholder="Apodo" defaultValue={data?.nickname} />
        <input name="password" type="password" placeholder="Contraseña" defaultValue={data?.password} />
        <button type="submit" disabled={isPending}>Registrarse</button>
      </form>
    </div>
  );
}

export default UserCreate;
