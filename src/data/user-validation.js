import { UserError } from "./user-error";

export class UserValidation {
  errors = { nickname: [], password: []};
  
  get hasErrors() {
    return this.errors.nickname.length > 0 || this.errors.password.length > 0;
  }

  throwIfErrors(message) {
    if (this.hasErrors) {
      throw new UserError(message, {
        cause: { code: UserError.Code.validity, errors: this.errors }
      });
    }
  }

  static validate(user, messages) {
    const validation = new UserValidation();

    const nickname = user.nickname?.trim() ?? "";

    if (nickname === "") {
      validation.errors.nickname.push({ type: "empty", message: messages.nickname.empty });
    }
    if (nickname.length < 3 || nickname.length > 16) {
      validation.errors.nickname.push({ type: "length", message: messages.nickname.length });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(nickname)) {
      validation.errors.nickname.push({ type: "format", message: messages.nickname.format });
    }

    const password = user.password?.trim() ?? "";

    if (password === "") {
      validation.errors.password.push({ type: "empty", message: messages.password.empty });
    }
    if (password.length < 12 || password.length > 32) {
      validation.errors.password.push({ type: "length", message: messages.password.length });
    }
    if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^\w\s]).+$/.test(password)) {
      validation.errors.password.push({ type: "format", message: messages.password.format });
    }

    return validation;
  }
}
