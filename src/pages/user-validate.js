import { UserValidation } from "../data/user-validation";

export function validateUser(user) {
  return UserValidation.validate(user, {
    nickname: {
      empty: "El apodo está en blanco",
      length: "El apodo tiene menos de 3 o más de 16 caracteres",
      format: "El apodo no tiene un formato válido"
    },
    password: {
      empty: "La contraseña está en blanco",
      length: "La contraseña tiene menos de 12 o más de 32 caracteres",
      format: "La contraseña no tiene un formato válido"
    }
  });
}
