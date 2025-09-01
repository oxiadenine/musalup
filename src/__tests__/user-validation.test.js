import { describe, test, expect, beforeEach } from "bun:test";
import { UserValidation } from "../data/user-validation.js";
import { UserError } from "../data/user-error.js";

describe("UserValidation", () => {
  let validation;
  let messages;

  beforeEach(() => {
    validation = new UserValidation();
    messages = {
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
  });

  // ============================================================================
  // BASIC FUNCTIONALITY TESTS
  // ============================================================================

  describe("Basic Functionality", () => {
    test("should initialize correctly and handle errors", () => {
      // Test constructor and initial state
      expect(validation.errors).toEqual({ nickname: [], password: [] });
      expect(validation.hasErrors).toBe(false);

      // Test hasErrors property
      validation.errors.nickname.push({ type: "empty", message: "test" });
      expect(validation.hasErrors).toBe(true);

      validation.errors.password.push({ type: "empty", message: "test" });
      expect(validation.hasErrors).toBe(true);
    });

    test("should throw UserError correctly", () => {
      validation.errors.nickname.push({ type: "empty", message: "test" });
      
      expect(() => validation.throwIfErrors("test message")).toThrow(UserError);
      
      try {
        validation.throwIfErrors("User is not valid");
      } catch (error) {
        expect(error.message).toBe("User is not valid");
        expect(error.cause.code).toBe(UserError.Code.validity);
        expect(error.cause.errors).toEqual(validation.errors);
      }
    });

    test("should not throw when no errors exist", () => {
      expect(() => validation.throwIfErrors("test message")).not.toThrow();
    });
  });

  // ============================================================================
  // NICKNAME VALIDATION TESTS
  // ============================================================================

  describe("Nickname Validation", () => {
    test("should validate valid nicknames", () => {
      const validNicknames = [
        "abc", "user123", "User123", "USER123", "user_123", "User-123",
        "test_user", "Test-User", "demo123", "Demo_User", "abcdefghijklmnop"
      ];

      validNicknames.forEach(nickname => {
        const user = { nickname, password: "ValidPass123!" };
        const result = UserValidation.validate(user, messages);
        expect(result.hasErrors).toBe(false);
        expect(result.errors.nickname).toHaveLength(0);
      });
    });

    test("should reject invalid nicknames", () => {
      const invalidCases = [
        // Empty cases
        { nickname: "", expectedType: "empty" },
        { nickname: null, expectedType: "empty" },
        { nickname: undefined, expectedType: "empty" },
        { nickname: "   ", expectedType: "empty" },
        
        // Length cases
        { nickname: "ab", expectedType: "length" },
        { nickname: "abcdefghijklmnopq", expectedType: "length" },
        
        // Format cases
        { nickname: "user@123", expectedType: "format" },
        { nickname: "user 123", expectedType: "format" },
        { nickname: "@#$%", expectedType: "format" }
      ];

      invalidCases.forEach(({ nickname, expectedType }) => {
        const user = { nickname, password: "ValidPass123!" };
        const result = UserValidation.validate(user, messages);
        
        expect(result.hasErrors).toBe(true);
        expect(result.errors.nickname).toHaveLength(1);
        expect(result.errors.nickname[0].type).toBe(expectedType);
      });
    });

    test("should collect multiple errors for complex invalid nicknames", () => {
      const complexInvalidNicknames = [
        "a", // too short + invalid format
        "verylongnickname123" // too long + invalid format
      ];

      complexInvalidNicknames.forEach(nickname => {
        const user = { nickname, password: "ValidPass123!" };
        const result = UserValidation.validate(user, messages);
        
        expect(result.hasErrors).toBe(true);
        expect(result.errors.nickname.length).toBeGreaterThanOrEqual(1);
        
        // Should have at least length error
        const hasLengthError = result.errors.nickname.some(e => e.type === "length");
        expect(hasLengthError).toBe(true);
      });
    });
  });

  // ============================================================================
  // PASSWORD VALIDATION TESTS
  // ============================================================================

  describe("Password Validation", () => {
    test("should validate valid passwords", () => {
      const validPasswords = [
        "ValidPass123!", "MySecureP@ss1", "Test123#Password",
        "Complex$Pass123", "StrongP@ss123", "Secure#Pass123",
        "ValidPass123!VeryLongPassword32"
      ];

      validPasswords.forEach(password => {
        const user = { nickname: "validuser", password };
        const result = UserValidation.validate(user, messages);
        expect(result.hasErrors).toBe(false);
        expect(result.errors.password).toHaveLength(0);
      });
    });

    test("should reject invalid passwords", () => {
      const invalidCases = [
        // Empty cases
        { password: "", expectedType: "empty" },
        { password: null, expectedType: "empty" },
        { password: undefined, expectedType: "empty" },
        { password: "   ", expectedType: "empty" },
        
        // Length cases
        { password: "Short1!", expectedType: "length" },
        { password: "VeryLongPassword123!ThatExceeds32Characters", expectedType: "length" },
        
        // Format cases (passwords with correct length but missing requirements)
        { password: "ValidPass!@#", expectedType: "format" }, // missing numbers
        { password: "ValidPass123", expectedType: "format" }, // missing special chars
        { password: "validpass123!", expectedType: "format" }, // missing uppercase
        { password: "VALIDPASS123!", expectedType: "format" }  // missing lowercase
      ];

      invalidCases.forEach(({ password, expectedType }) => {
        const user = { nickname: "validuser", password };
        const result = UserValidation.validate(user, messages);
        
        expect(result.hasErrors).toBe(true);
        expect(result.errors.password).toHaveLength(1);
        expect(result.errors.password[0].type).toBe(expectedType);
      });
    });

    test("should collect multiple errors for complex invalid passwords", () => {
      const complexInvalidPasswords = [
        "short", // too short + missing requirements
        "ValidPass!" // missing numbers + missing special chars
      ];

      complexInvalidPasswords.forEach(password => {
        const user = { nickname: "validuser", password };
        const result = UserValidation.validate(user, messages);
        
        expect(result.hasErrors).toBe(true);
        expect(result.errors.password.length).toBeGreaterThanOrEqual(1);
        
        // Should have at least length error for short passwords
        if (password.length < 12) {
          const hasLengthError = result.errors.password.some(e => e.type === "length");
          expect(hasLengthError).toBe(true);
        }
      });
    });
  });

  // ============================================================================
  // COMPREHENSIVE VALIDATION SCENARIOS
  // ============================================================================

  describe("Comprehensive Validation", () => {
    test("should handle various user combinations", () => {
      const testCases = [
        // Valid users
        { user: { nickname: "user123", password: "ValidPass123!" }, shouldPass: true },
        { user: { nickname: "User_123", password: "MySecureP@ss1" }, shouldPass: true },
        { user: { nickname: "test-user", password: "Test123#Password" }, shouldPass: true },
        
        // Users with nickname errors only
        { user: { nickname: "", password: "ValidPass123!" }, shouldPass: false, nicknameErrors: 1, passwordErrors: 0 },
        { user: { nickname: "ab", password: "ValidPass123!" }, shouldPass: false, nicknameErrors: 1, passwordErrors: 0 },
        
        // Users with password errors only
        { user: { nickname: "validuser", password: "" }, shouldPass: false, nicknameErrors: 0, passwordErrors: 1 },
        { user: { nickname: "validuser", password: "short" }, shouldPass: false, nicknameErrors: 0, passwordErrors: 1 },
        
        // Users with both errors
        { user: { nickname: "a", password: "short" }, shouldPass: false, nicknameErrors: 1, passwordErrors: 1 },
        { user: { nickname: "user@123", password: "VALIDPASS123!" }, shouldPass: false, nicknameErrors: 1, passwordErrors: 1 }
      ];

      testCases.forEach(({ user, shouldPass, nicknameErrors = 0, passwordErrors = 0 }) => {
        const result = UserValidation.validate(user, messages);
        
        expect(result.hasErrors).toBe(!shouldPass);
        
        if (!shouldPass) {
          expect(result.errors.nickname).toHaveLength(nicknameErrors);
          expect(result.errors.password).toHaveLength(passwordErrors);
        } else {
          expect(result.errors.nickname).toHaveLength(0);
          expect(result.errors.password).toHaveLength(0);
        }
      });
    });

    test("should maintain error message consistency", () => {
      const testCases = [
        { user: { nickname: "", password: "ValidPass123!" }, expectedNicknameType: "empty", expectedPasswordType: null },
        { user: { nickname: "ab", password: "ValidPass123!" }, expectedNicknameType: "length", expectedPasswordType: null },
        { user: { nickname: "user@123", password: "ValidPass123!" }, expectedNicknameType: "format", expectedPasswordType: null },
        { user: { nickname: "validuser", password: "" }, expectedNicknameType: null, expectedPasswordType: "empty" },
        { user: { nickname: "validuser", password: "short" }, expectedNicknameType: null, expectedPasswordType: "length" }
      ];

      testCases.forEach(({ user, expectedNicknameType, expectedPasswordType }) => {
        const result = UserValidation.validate(user, messages);
        
        if (expectedNicknameType) {
          expect(result.errors.nickname[0].type).toBe(expectedNicknameType);
          expect(result.errors.nickname[0].message).toBe(messages.nickname[expectedNicknameType]);
        }
        
        if (expectedPasswordType) {
          expect(result.errors.password[0].type).toBe(expectedPasswordType);
          expect(result.errors.password[0].message).toBe(messages.password[expectedPasswordType]);
        }
      });
    });
  });

  // ============================================================================
  // EDGE CASES AND PERFORMANCE
  // ============================================================================

  describe("Edge Cases and Performance", () => {
    test("should handle extreme input cases", () => {
      const edgeCases = [
        // Very long strings
        { user: { nickname: "a".repeat(1000), password: "a".repeat(1000) }, expectedNicknameType: "length", expectedPasswordType: "length" },
        
        // Unicode characters
        { user: { nickname: "user🚀123", password: "ValidPass123!" }, expectedNicknameType: "format", expectedPasswordType: null },
        
        // Null/undefined cases
        { user: { nickname: null, password: undefined }, expectedNicknameType: "empty", expectedPasswordType: "empty" },
        
        // Empty object
        { user: {}, expectedNicknameType: "empty", expectedPasswordType: "empty" }
      ];

      edgeCases.forEach(({ user, expectedNicknameType, expectedPasswordType }) => {
        const result = UserValidation.validate(user, messages);
        
        expect(result.hasErrors).toBe(true);
        
        if (expectedNicknameType) {
          expect(result.errors.nickname[0].type).toBe(expectedNicknameType);
        }
        
        if (expectedPasswordType) {
          expect(result.errors.password[0].type).toBe(expectedPasswordType);
        }
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe("Integration with Error Handling", () => {
    test("should integrate correctly with UserError system", () => {
      const user = { nickname: "a", password: "short" };
      const result = UserValidation.validate(user, messages);
      
      expect(() => result.throwIfErrors("User is not valid")).toThrow(UserError);
      
      try {
        result.throwIfErrors("User is not valid");
      } catch (error) {
        expect(error).toBeInstanceOf(UserError);
        expect(error.cause.code).toBe(UserError.Code.validity);
        expect(error.cause.errors).toBeDefined();
        expect(error.cause.errors.nickname).toHaveLength(1);
        expect(error.cause.errors.password).toHaveLength(1);
      }
    });
  });
});
