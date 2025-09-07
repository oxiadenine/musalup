import { useActionState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router";
import { useTranslation } from "../lib/intl";
import { UserValidation } from "../data/user-validation";
import "./user-create.css";

const messages = {
  es: {
    meta: { title: "Usuario | Registro" },
    title: "Usuario",
    input: { nickname: "Apodo", password: "Contraseña" },
    button: "Registrarse",
    error: {
      nickname: {
        empty: "El apodo está en blanco",
        length: "El apodo tiene menos de 3 o más de 16 caracteres",
        format: "El apodo no tiene un formato válido",
        duplicate: "El apodo ya existe"
      },
      password: {
        empty: "La contraseña está en blanco",
        length: "La contraseña tiene menos de 12 o más de 32 caracteres",
        format: "La contraseña no tiene un formato válido"
      }
    }
  },
  en: {
    meta: { title: "User | Sign up" },
    title: "User",
    input: { nickname: "Nickname", password: "Password" },
    button: "Sign up",
    error: {
      nickname: {
        empty: "Nickname is empty",
        length: "Nickname is less than 3 or greater than 16 characters",
        format: "Nickname is not in a valid format",
        duplicate: "Nickname already exist"
      },
      password: {
        empty: "Password is empty",
        length: "Password is less than 12 or greater than 32 characters",
        format: "Password is not in a valid format"
      }
    }
  }
};

export function UserCreate() {
  const [translate, translation] = useTranslation("user-create", messages);
  
  const navigate = useNavigate();

  async function createUser(data, formData) {
    const user = {
      nickname: formData.get("nickname"),
      password: formData.get("password")
    };

    const validation = UserValidation.validate(user, {
      nickname: {
        empty: translate("error.nickname.empty"),
        length: translate("error.nickname.length"),
        format: translate("error.nickname.format")
      },
      password: {
        empty: translate("error.password.empty"),
        length: translate("error.password.length"),
        format: translate("error.password.format")
      }
    });

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
      navigate(`/${translation.language}/users/auth`);
    } else {
      if (response.status === 409) {
        errors.nickname.push({ message: translate("error.nickname.duplicate") });
      }

      return { user, errors };
    }
  }

  const [data, action, isPending] = useActionState(createUser, { nickname: "", password: "" });

  return (
    <div className="user-create">
      <Helmet>
        <title>{translate("meta.title")}</title>
      </Helmet>
      <h1>{translate("title")}</h1>
      <form action={action}>
        <input
          name="nickname"
          type="text"
          placeholder={translate("input.nickname")}
          defaultValue={data.user?.nickname}
        />
        {data.errors && data.errors.nickname[0] && <p>{data.errors.nickname[0].message}</p>}
        <input
          name="password"
          type="password"
          placeholder={translate("input.password")}
          defaultValue={data.user?.password}
        />
        {data.errors && data.errors.password[0] && <p>{data.errors.password[0].message}</p>}
        <button type="submit" disabled={isPending}>{translate("button")}</button>
      </form>
    </div>
  );
}

export default UserCreate;
