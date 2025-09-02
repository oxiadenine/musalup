import { describe, test, expect } from "bun:test";
import { UserValidation } from "../data/user-validation";
import { UserError } from "../data/user-error";

describe("User validation", () => {
  const messages = {
    nickname: {
      empty: "User nickname is empty",
      length: "User nickname is less than 3 or greater than 16 characters",
      format: "User nickname is not in a valid format"
    },
    password: {
      empty: "User password is empty",
      length: "User password is less than 12 or greater than 32 characters",
      format: "User password is not in a valid format"
    }
  };
  const errorMessage = "User is not valid";

  describe("Base functionality", () => {
    const validation = new UserValidation();
    
    test("should initialize correctly", () => {
      expect(validation.errors).toEqual({ nickname: [], password: [] });
      expect(validation.hasErrors).toBe(false);
    });

    test("should throw UserError if errors", () => {
      validation.errors.nickname.push({});
      validation.errors.password.push({});
        
      expect(() => validation.throwIfErrors(errorMessage)).toThrow(UserError);
        
      try {
        validation.throwIfErrors(errorMessage);
      } catch (error) {
        expect(error.message).toBe(errorMessage);
        expect(error.cause.code).toBe(UserError.Code.validity);
        expect(error.cause.errors).toEqual(validation.errors);
      }
    });

    test("should not throw UserError if no errors", () => {
      validation.errors.nickname.length = 0;
      validation.errors.password.length = 0;

      expect(() => validation.throwIfErrors(errorMessage)).not.toThrow();
    });
  });

  describe("Nickname", () => {
    let data = [
      "abc",
      "user123",
      "User123",
      "USER123",
      "user_123",
      "User-123",
      "test_user",
      "Test-User",
      "demo123",
      "Demo_User",
      "abcdefghijklmnop"
    ];

    test.each(data)("should not set errors for valid nicknames", (nickname) => {
      const validation = UserValidation.validate({ nickname }, messages);

      expect(validation.errors.nickname).toHaveLength(0);
    });

    data = [
      ["", ["empty", "length", "format"]],
      [null, ["empty", "length", "format"]],
      [undefined, ["empty", "length", "format"]],
      ["   ", ["empty", "length", "format"]],
      ["ab", ["length"]],
      ["abcdefghijklmnopq", ["length"]],
      ["user@123", ["format"]],
      ["user 123", ["format"]],
      ["@#$%", ["format"]]
    ];

    test.each(data)("should set errors for invalid nicknames", (nickname, errorTypes) => {
      const validation = UserValidation.validate({ nickname }, messages);
        
      expect(validation.hasErrors).toBe(true);
      expect(validation.errors.nickname).toHaveLength(errorTypes.length);

      errorTypes.forEach(errorType => {
        const error = validation.errors.nickname.find(error => error.type === errorType);
        
        expect(error.type).toBe(errorType);
      });

      expect(() => validation.throwIfErrors(errorMessage)).toThrow(UserError);

      try {
        validation.throwIfErrors(errorMessage);
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect(error.cause.code).toBe(UserError.Code.validity);
        expect(error.cause.errors).toBeDefined();
        expect(error.cause.errors.nickname).toHaveLength(errorTypes.length);
        expect(error.cause.errors.password).toHaveLength(3);
      }
    });
  });

  describe("Password", () => {
    let data = [
      "ValidPass123!",
      "MySecureP@ss1",
      "Test123#Password",
      "Complex$Pass123",
      "StrongP@ss123",
      "Secure#Pass123",
      "ValidPass123!VeryLongPassword32"
    ];

    test.each(data)("should not set errors for valid passwords", (password) => {
      const validation = UserValidation.validate({ password }, messages);

      expect(validation.errors.password).toHaveLength(0);
    });

    data = [
      ["", ["empty", "length", "format"]],
      [null, ["empty", "length", "format"]],
      [undefined, ["empty", "length", "format"]],
      ["   ", ["empty", "length", "format"]],
      ["Short1!", ["length"]],
      ["VeryLongPassword123!ThatExceeds32Characters", ["length"]],
      ["ValidPass!@#", ["format"]],
      ["ValidPass123", ["format"]],
      ["validpass123!", ["format"]],
      ["VALIDPASS123!", ["format"]]
    ];

    test.each(data)("should set errors for invalid passwords", (password, errorTypes) => {
      const validation = UserValidation.validate({ password }, messages);
        
      expect(validation.hasErrors).toBe(true);
      expect(validation.errors.password).toHaveLength(errorTypes.length);

      errorTypes.forEach(errorType => {
        const error = validation.errors.password.find(error => error.type === errorType);
        
        expect(error.type).toBe(errorType);
      });

      expect(() => validation.throwIfErrors(errorMessage)).toThrow(UserError);

      try {
        validation.throwIfErrors(errorMessage);
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect(error.cause.code).toBe(UserError.Code.validity);
        expect(error.cause.errors).toBeDefined();
        expect(error.cause.errors.nickname).toHaveLength(3);
        expect(error.cause.errors.password).toHaveLength(errorTypes.length);
      }
    });
  });

  describe("Nickname and password", () => {
    const data = [
      [{ nickname: "user123", password: "ValidPass123!" }, false, [], []],
      [{ nickname: "User_123", password: "MySecureP@ss1" }, false, [], []],
      [{ nickname: "test-user", password: "Test123#Password" }, false, [], []],
      [{ nickname: "", password: "ValidPass123!" }, true, ["empty", "length", "format"], []],
      [{ nickname: "ab", password: "ValidPass123!" }, true, ["length"], []],
      [{ nickname: "validuser", password: "" }, true, [], ["empty", "length", "format"]],
      [{ nickname: "validuser", password: "abcdf" }, true, [], ["length", "format"]],
      [{ nickname: "a", password: "abcdf" }, true, ["length"], ["length", "format"]],
      [{ nickname: "user@123", password: "VALIDPASS123!" }, true, ["format"], ["format"]]
    ];

    test.each(data)("should validate correctly", (
      user, hasErrors, nicknameErrorTypes, passwordErrorTypes
    ) => {
      const validation = UserValidation.validate(user, messages);
        
      expect(validation.hasErrors).toBe(hasErrors);
        
      if (hasErrors) {
        expect(validation.errors.nickname).toHaveLength(nicknameErrorTypes.length);
        
        nicknameErrorTypes.forEach(errorType => {
          const error = validation.errors.nickname.find(error => error.type === errorType);
          
          expect(error.type).toBe(errorType);
        });

        expect(validation.errors.password).toHaveLength(passwordErrorTypes.length);

        passwordErrorTypes.forEach(errorType => {
          const error = validation.errors.password.find(error => error.type === errorType);
          
          expect(error.type).toBe(errorType);
        });
      } else {
        expect(validation.errors.nickname).toHaveLength(0);
        expect(validation.errors.password).toHaveLength(0);
      }

      if (hasErrors) {
        expect(() => validation.throwIfErrors(errorMessage)).toThrow(UserError);
      } else {
        expect(() => validation.throwIfErrors(errorMessage)).not.toThrow();
      }

      try {
        validation.throwIfErrors(errorMessage);
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect(error.cause.code).toBe(UserError.Code.validity);
        expect(error.cause.errors).toBeDefined();
        expect(error.cause.errors.nickname).toHaveLength(nicknameErrorTypes.length);
        expect(error.cause.errors.password).toHaveLength(passwordErrorTypes.length);
      }
    });
  });

  describe("Nickname and password (edge cases)", () => {
    const data = [
      [{ nickname: "a".repeat(1000), password: "a5D$".repeat(1000) }, "length", "length"],
      [{ nickname: "user🚀123", password: "ValidPass123!" }, "format", undefined],
      [{ nickname: "user123", password: "password123!" }, undefined, "format"],
      [{ nickname: null, password: undefined }, "empty", "empty"],
      [{ nickname: undefined, password: null }, "empty", "empty"],
      [{}, "empty", "empty"]
    ];

    test.each(data)("should validate correctly", (user, nicknameErrorType, passwordErrorType) => {
      const validation = UserValidation.validate(user, messages);
        
      expect(validation.hasErrors).toBe(true);
        
      if (nicknameErrorType) {
        expect(validation.errors.nickname[0].type).toBe(nicknameErrorType);
      } else {
        expect(validation.errors.nickname[0]?.type).toBe(nicknameErrorType);
      }
        
      if (passwordErrorType) {
        expect(validation.errors.password[0].type).toBe(passwordErrorType);
      } else {
        expect(validation.errors.password[0]?.type).toBe(passwordErrorType);
      }

      expect(() => validation.throwIfErrors(errorMessage)).toThrow(UserError);

      try {
        validation.throwIfErrors(errorMessage);
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect(error.cause.code).toBe(UserError.Code.validity);
        expect(error.cause.errors).toBeDefined();

        if (nicknameErrorType) {
          expect(error.cause.errors.nickname.length).toBeGreaterThanOrEqual(1);
        }
        
        if (passwordErrorType) {
          expect(error.cause.errors.password.length).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });
});
