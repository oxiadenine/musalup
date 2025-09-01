// Test setup file
// This file runs before all tests

// Set test environment
process.env.NODE_ENV = 'test';

// Global test utilities
global.testUtils = {
  // Helper to create a valid user object
  createValidUser: (overrides = {}) => ({
    nickname: "testuser123",
    password: "ValidPassword123!",
    ...overrides
  }),

  // Helper to create validation messages
  createValidationMessages: () => ({
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
  }),

  // Helper to create a user with specific validation errors
  createUserWithErrors: (errorTypes = []) => {
    const user = { nickname: "testuser", password: "ValidPass123!" };
    
    errorTypes.forEach(type => {
      switch (type) {
        case 'nickname_empty':
          user.nickname = '';
          break;
        case 'nickname_short':
          user.nickname = 'ab';
          break;
        case 'nickname_long':
          user.nickname = 'verylongnickname123';
          break;
        case 'nickname_invalid':
          user.nickname = 'user@123';
          break;
        case 'password_empty':
          user.password = '';
          break;
        case 'password_short':
          user.password = 'Short1!';
          break;
        case 'password_long':
          user.password = 'VeryLongPassword123!ThatExceeds32Characters';
          break;
        case 'password_no_uppercase':
          user.password = 'validpass123!';
          break;
        case 'password_no_lowercase':
          user.password = 'VALIDPASS123!';
          break;
        case 'password_no_numbers':
          user.password = 'ValidPass!';
          break;
        case 'password_no_special':
          user.password = 'ValidPass123';
          break;
      }
    });
    
    return user;
  }
};

console.log('🧪 Test environment configured');
