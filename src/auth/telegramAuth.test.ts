/**
 * Tests for Telegram authentication
 */

import crypto from 'crypto';
import { TelegramAuth } from './telegramAuth';
import { TelegramUser } from '../types';

describe('TelegramAuth', () => {
  let telegramAuth: TelegramAuth;
  const botToken = 'test_bot_token';

  beforeEach(() => {
    telegramAuth = new TelegramAuth(botToken);
  });

  describe('validateInitData', () => {
    const mockUser: TelegramUser = {
      id: 123456789,
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe',
      language_code: 'en'
    };

    function createValidInitData(user: TelegramUser): string {
      const authDate = Math.floor(Date.now() / 1000);
      const userStr = JSON.stringify(user);
      
      // Create data check string
      const dataCheckString = [
        `auth_date=${authDate}`,
        `user=${userStr}`
      ].join('\n');
      
      // Create secret key and hash
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      
      return `auth_date=${authDate}&user=${encodeURIComponent(userStr)}&hash=${hash}`;
    }

    it('should validate correct init data', () => {
      const initData = createValidInitData(mockUser);
      const result = telegramAuth.validateInitData(initData);
      
      expect(result.valid).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeUndefined();
    });

    it('should reject init data without hash', () => {
      const initData = `auth_date=${Math.floor(Date.now() / 1000)}&user=${JSON.stringify(mockUser)}`;
      const result = telegramAuth.validateInitData(initData);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No hash provided');
    });

    it('should reject init data with invalid hash', () => {
      const authDate = Math.floor(Date.now() / 1000);
      const userStr = JSON.stringify(mockUser);
      const initData = `auth_date=${authDate}&user=${encodeURIComponent(userStr)}&hash=invalid_hash`;
      
      const result = telegramAuth.validateInitData(initData);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid hash');
    });

    it('should reject old auth data', () => {
      const oldAuthDate = Math.floor(Date.now() / 1000) - 86401; // 24 hours + 1 second ago
      const userStr = JSON.stringify(mockUser);
      
      const dataCheckString = [
        `auth_date=${oldAuthDate}`,
        `user=${userStr}`
      ].join('\n');
      
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      
      const initData = `auth_date=${oldAuthDate}&user=${encodeURIComponent(userStr)}&hash=${hash}`;
      const result = telegramAuth.validateInitData(initData);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Auth data is too old');
    });

    it('should reject init data without user', () => {
      const authDate = Math.floor(Date.now() / 1000);
      const dataCheckString = `auth_date=${authDate}`;
      
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      
      const initData = `auth_date=${authDate}&hash=${hash}`;
      const result = telegramAuth.validateInitData(initData);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No user data provided');
    });

    it('should reject init data with invalid user data', () => {
      const invalidUser = { invalid: 'data' };
      const initData = createValidInitData(invalidUser as any);
      const result = telegramAuth.validateInitData(initData);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid user data');
    });

    it('should handle malformed init data', () => {
      const result = telegramAuth.validateInitData('invalid_init_data');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Failed to validate init data');
    });
  });

  describe('extractUser', () => {
    it('should extract user from valid init data', () => {
      const mockUser: TelegramUser = {
        id: 123456789,
        first_name: 'John',
        username: 'johndoe'
      };
      
      // Mock validateInitData to return valid result
      jest.spyOn(telegramAuth, 'validateInitData').mockReturnValue({
        valid: true,
        user: mockUser
      });
      
      const user = telegramAuth.extractUser('mock_init_data');
      
      expect(user).toEqual(mockUser);
    });

    it('should return null for invalid init data', () => {
      jest.spyOn(telegramAuth, 'validateInitData').mockReturnValue({
        valid: false,
        error: 'Invalid data'
      });
      
      const user = telegramAuth.extractUser('invalid_init_data');
      
      expect(user).toBeNull();
    });
  });

  describe('validateUserPermissions', () => {
    it('should validate user with correct data', () => {
      const user: TelegramUser = {
        id: 123456789,
        first_name: 'John',
        username: 'johndoe'
      };
      
      const result = telegramAuth.validateUserPermissions(user);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject user with invalid ID', () => {
      const user: TelegramUser = {
        id: 0,
        first_name: 'John'
      };
      
      const result = telegramAuth.validateUserPermissions(user);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid user ID');
    });

    it('should reject user without first name', () => {
      const user: TelegramUser = {
        id: 123456789,
        first_name: ''
      };
      
      const result = telegramAuth.validateUserPermissions(user);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid user name');
    });

    it('should reject bot users', () => {
      const user: TelegramUser = {
        id: 123456789,
        first_name: 'TestBot'
      };
      
      const result = telegramAuth.validateUserPermissions(user);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Bot users are not allowed');
    });
  });

  describe('generateSessionToken', () => {
    it('should generate session token for user', () => {
      const user: TelegramUser = {
        id: 123456789,
        first_name: 'John',
        username: 'johndoe'
      };
      
      const token = telegramAuth.generateSessionToken(user);
      
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate different tokens for different users', () => {
      const user1: TelegramUser = {
        id: 123456789,
        first_name: 'John',
        username: 'johndoe'
      };
      
      const user2: TelegramUser = {
        id: 987654321,
        first_name: 'Jane',
        username: 'janedoe'
      };
      
      const token1 = telegramAuth.generateSessionToken(user1);
      const token2 = telegramAuth.generateSessionToken(user2);
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('validateSessionToken', () => {
    it('should validate correct session token', () => {
      const user: TelegramUser = {
        id: 123456789,
        first_name: 'John',
        username: 'johndoe'
      };
      
      const token = telegramAuth.generateSessionToken(user);
      const isValid = telegramAuth.validateSessionToken(token, user);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid session token', () => {
      const user: TelegramUser = {
        id: 123456789,
        first_name: 'John',
        username: 'johndoe'
      };
      
      const isValid = telegramAuth.validateSessionToken('invalid_token', user);
      
      expect(isValid).toBe(false);
    });

    it('should reject token for different user', () => {
      const user1: TelegramUser = {
        id: 123456789,
        first_name: 'John',
        username: 'johndoe'
      };
      
      const user2: TelegramUser = {
        id: 987654321,
        first_name: 'Jane',
        username: 'janedoe'
      };
      
      const token = telegramAuth.generateSessionToken(user1);
      const isValid = telegramAuth.validateSessionToken(token, user2);
      
      expect(isValid).toBe(false);
    });
  });
});