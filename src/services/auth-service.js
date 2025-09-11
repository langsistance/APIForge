/**
 * 认证服务模块
 * 管理用户认证和会话
 */

import eventBus, { Events } from '../shared/event-bus.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.isAuthenticated = false;
    
    // 初始化时尝试恢复会话
    this.restoreSession();
  }

  /**
   * 获取当前用户ID
   */
  getUserId() {
    // 如果已登录，返回真实用户ID
    if (this.currentUser && this.currentUser.userId) {
      return this.currentUser.userId;
    }
    
    // 否则返回默认/临时用户ID
    return this.getDefaultUserId();
  }

  /**
   * 获取默认用户ID（开发/测试阶段使用）
   */
  getDefaultUserId() {
    // 现阶段固定返回测试用户ID
    return '11111111';
    
    // 后续可以改为生成临时ID
    // return this.getOrCreateTempUserId();
  }

  /**
   * 获取或创建临时用户ID
   */
  getOrCreateTempUserId() {
    let tempUserId = localStorage.getItem('apiforge_temp_user_id');
    if (!tempUserId) {
      tempUserId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('apiforge_temp_user_id', tempUserId);
    }
    return tempUserId;
  }

  /**
   * 用户登录
   */
  async login(username, password) {
    try {
      // TODO: 调用真实的登录API
      // const response = await apiClient.login(username, password);
      
      // 模拟登录成功
      const mockUser = {
        userId: '11111111',  // 固定使用测试用户ID
        username: username,
        email: `${username}@apiforge.io`,
        role: username === 'admin' ? 'admin' : 'user',
        permissions: ['read', 'write']
      };

      this.currentUser = mockUser;
      this.token = `mock_token_${Date.now()}`;
      this.isAuthenticated = true;

      // 保存会话
      this.saveSession();

      // 触发登录成功事件
      eventBus.emit('auth:login:success', this.currentUser);

      return {
        success: true,
        user: this.currentUser,
        token: this.token
      };
    } catch (error) {
      eventBus.emit('auth:login:failed', error);
      throw error;
    }
  }

  /**
   * 用户登出
   */
  async logout() {
    try {
      // TODO: 调用登出API使token失效
      // await apiClient.logout(this.token);

      this.currentUser = null;
      this.token = null;
      this.isAuthenticated = false;

      // 清除会话
      this.clearSession();

      // 触发登出事件
      eventBus.emit('auth:logout');

      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      // 即使API调用失败，也清除本地会话
      this.clearSession();
      return { success: false, error: error.message };
    }
  }

  /**
   * 用户注册
   */
  async register(userData) {
    try {
      // TODO: 调用注册API
      // const response = await apiClient.register(userData);
      
      // 模拟注册
      const newUser = {
        userId: '11111111',  // 固定使用测试用户ID
        username: userData.username,
        email: userData.email,
        role: 'user',
        createdAt: new Date().toISOString()
      };

      eventBus.emit('auth:register:success', newUser);

      // 注册成功后自动登录
      return await this.login(userData.username, userData.password);
    } catch (error) {
      eventBus.emit('auth:register:failed', error);
      throw error;
    }
  }

  /**
   * 刷新认证令牌
   */
  async refreshToken() {
    try {
      // TODO: 调用刷新token的API
      // const response = await apiClient.refreshToken(this.token);
      
      // 模拟刷新
      this.token = `refreshed_token_${Date.now()}`;
      this.saveSession();
      
      return { success: true, token: this.token };
    } catch (error) {
      console.error('Token refresh failed:', error);
      // 刷新失败，可能需要重新登录
      this.logout();
      throw error;
    }
  }

  /**
   * 检查是否已认证
   */
  isUserAuthenticated() {
    return this.isAuthenticated && this.currentUser !== null;
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * 获取认证令牌
   */
  getToken() {
    return this.token;
  }

  /**
   * 获取认证请求头
   */
  getAuthHeaders() {
    const headers = {};
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    // 添加用户ID头（某些API可能需要）
    headers['X-User-Id'] = this.getUserId();
    
    return headers;
  }

  /**
   * 检查用户权限
   */
  hasPermission(permission) {
    if (!this.currentUser || !this.currentUser.permissions) {
      return false;
    }
    return this.currentUser.permissions.includes(permission);
  }

  /**
   * 检查用户角色
   */
  hasRole(role) {
    if (!this.currentUser) {
      return false;
    }
    return this.currentUser.role === role;
  }

  /**
   * 保存会话到本地存储
   */
  saveSession() {
    const session = {
      user: this.currentUser,
      token: this.token,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时后过期
    };
    
    localStorage.setItem('apiforge_session', JSON.stringify(session));
  }

  /**
   * 从本地存储恢复会话
   */
  restoreSession() {
    try {
      const sessionStr = localStorage.getItem('apiforge_session');
      if (!sessionStr) return false;

      const session = JSON.parse(sessionStr);
      
      // 检查会话是否过期
      if (session.expiresAt && session.expiresAt < Date.now()) {
        this.clearSession();
        return false;
      }

      this.currentUser = session.user;
      this.token = session.token;
      this.isAuthenticated = true;

      eventBus.emit('auth:session:restored', this.currentUser);
      
      return true;
    } catch (error) {
      console.error('Failed to restore session:', error);
      this.clearSession();
      return false;
    }
  }

  /**
   * 清除本地会话
   */
  clearSession() {
    localStorage.removeItem('apiforge_session');
    // 保留临时用户ID
    // localStorage.removeItem('apiforge_temp_user_id');
  }

  /**
   * 更新用户信息
   */
  async updateUserProfile(updates) {
    try {
      // TODO: 调用更新用户信息的API
      // const response = await apiClient.updateProfile(this.getUserId(), updates);
      
      // 模拟更新
      this.currentUser = {
        ...this.currentUser,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      this.saveSession();
      eventBus.emit('auth:profile:updated', this.currentUser);

      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  }

  /**
   * 修改密码
   */
  async changePassword(oldPassword, newPassword) {
    try {
      // TODO: 调用修改密码的API
      // const response = await apiClient.changePassword(this.getUserId(), oldPassword, newPassword);
      
      eventBus.emit('auth:password:changed');
      
      return { success: true, message: '密码修改成功' };
    } catch (error) {
      console.error('Password change failed:', error);
      throw error;
    }
  }

  /**
   * 重置密码（忘记密码）
   */
  async resetPassword(email) {
    try {
      // TODO: 调用重置密码的API
      // const response = await apiClient.resetPassword(email);
      
      eventBus.emit('auth:password:reset:requested', email);
      
      return { 
        success: true, 
        message: `重置密码链接已发送到 ${email}` 
      };
    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(token) {
    try {
      // TODO: 调用验证邮箱的API
      // const response = await apiClient.verifyEmail(token);
      
      eventBus.emit('auth:email:verified');
      
      return { success: true, message: '邮箱验证成功' };
    } catch (error) {
      console.error('Email verification failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户统计信息
   */
  getUserStats() {
    return {
      isAuthenticated: this.isAuthenticated,
      userId: this.getUserId(),
      username: this.currentUser?.username || 'Guest',
      role: this.currentUser?.role || 'guest',
      loginTime: this.currentUser?.loginTime,
      lastActivity: new Date().toISOString()
    };
  }
}

// 创建单例实例
const authService = new AuthService();

// 定义认证相关事件
export const AuthEvents = {
  LOGIN_SUCCESS: 'auth:login:success',
  LOGIN_FAILED: 'auth:login:failed',
  LOGOUT: 'auth:logout',
  REGISTER_SUCCESS: 'auth:register:success',
  REGISTER_FAILED: 'auth:register:failed',
  SESSION_RESTORED: 'auth:session:restored',
  SESSION_EXPIRED: 'auth:session:expired',
  PROFILE_UPDATED: 'auth:profile:updated',
  PASSWORD_CHANGED: 'auth:password:changed',
  PASSWORD_RESET_REQUESTED: 'auth:password:reset:requested',
  EMAIL_VERIFIED: 'auth:email:verified',
  PERMISSION_DENIED: 'auth:permission:denied'
};

export default authService;
export { AuthService };