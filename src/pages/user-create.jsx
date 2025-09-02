import { useActionState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router";
import { validateUser } from "./user-validate";
import "./user-create.css";

export function UserCreate() {
  const navigate = useNavigate();

  async function createUser(data, formData) {
    const user = {
      nickname: formData.get("nickname"),
      password: formData.get("password")
    };

    const validation = validateUser(user);

    const errors = validation.errors;
    
    if (validation.hasErrors) {
      return { user, errors };
    }

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
    } else {
      if (response.status === 409) {
        errors.nickname.push({ message: "El apodo ya existe" });
      }

      return { user, errors };
    }
  }

  const [data, action, isPending] = useActionState(createUser, { nickname: "", password: "" });

  return (
    <div className="user-create">
      <Helmet>
        <title>Usuario | Registro</title>
      </Helmet>
      <h1>Usuario</h1>
      <form action={action}>
        <input name="nickname" type="text" placeholder="Apodo" defaultValue={data.user?.nickname} />
        {data.errors && data.errors.nickname[0] && <p>{data.errors.nickname[0].message}</p>}
        <input name="password" type="password" placeholder="Contraseña" defaultValue={data.user?.password} />
        {data.errors && data.errors.password[0] && <p>{data.errors.password[0].message}</p>}
        <button type="submit" disabled={isPending}>Registrarse</button>
      </form>
    </div>
  );
}

export default UserCreate;
