/**
 * Telegram WebApp authentication utilities
 */

import crypto from 'crypto';
import { TelegramWebAppInitData, TelegramUser } from '../types/index.js';

export class TelegramAuth {
  private botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  /**
   * Validate Telegram WebApp init data
   */
  public validateInitData(initData: string): { valid: boolean; user?: TelegramUser; error?: string } {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      
      if (!hash) {
        return { valid: false, error: 'No hash provided' };
      }

      // Remove hash from params for validation
      urlParams.delete('hash');
      
      // Create data check string
      const dataCheckArr: string[] = [];
      for (const [key, value] of urlParams.entries()) {
        dataCheckArr.push(`${key}=${value}`);
      }
      dataCheckArr.sort();
      const dataCheckString = dataCheckArr.join('\n');

      // Create secret key
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(this.botToken).digest();
      
      // Calculate hash
      const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      if (calculatedHash !== hash) {
        return { valid: false, error: 'Invalid hash' };
      }

      // Check auth date (should be within 24 hours)
      const authDate = urlParams.get('auth_date');
      if (authDate) {
        const authTimestamp = parseInt(authDate);
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const timeDiff = currentTimestamp - authTimestamp;
        
        if (timeDiff > 86400) { // 24 hours
          return { valid: false, error: 'Auth data is too old' };
        }
      }

      // Parse user data
      const userParam = urlParams.get('user');
      if (!userParam) {
        return { valid: false, error: 'No user data provided' };
      }

      const user: TelegramUser = JSON.parse(userParam);
      
      // Basic validation
      if (!user.id || !user.first_name) {
        return { valid: false, error: 'Invalid user data' };
      }

      return { valid: true, user };
    } catch (error) {
      return { valid: false, error: 'Failed to validate init data' };
    }
  }

  /**
   * Extract user from validated init data
   */
  public extractUser(initData: string): TelegramUser | null {
    const validation = this.validateInitData(initData);
    return validation.valid ? validation.user || null : null;
  }

  /**
   * Validate user permissions
   */
  public validateUserPermissions(user: TelegramUser): { valid: boolean; error?: string } {
    // Basic validation - you can extend this with more checks
    if (!user.id || user.id <= 0) {
      return { valid: false, error: 'Invalid user ID' };
    }

    if (!user.first_name || user.first_name.trim().length === 0) {
      return { valid: false, error: 'Invalid user name' };
    }

    // Check for bot users (optional)
    if (user.first_name.toLowerCase().includes('bot')) {
      return { valid: false, error: 'Bot users are not allowed' };
    }

    return { valid: true };
  }

  /**
   * Generate session token for user
   */
  public generateSessionToken(user: TelegramUser): string {
    const sessionData = {
      userId: user.id,
      username: user.username || user.first_name,
      timestamp: Date.now()
    };

    const sessionString = JSON.stringify(sessionData);
    return crypto.createHmac('sha256', this.botToken).update(sessionString).digest('hex');
  }

  /**
   * Validate session token
   */
  public validateSessionToken(token: string, user: TelegramUser): boolean {
    try {
      const expectedToken = this.generateSessionToken(user);
      return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expectedToken, 'hex'));
    } catch (error) {
      return false;
    }
  }
}