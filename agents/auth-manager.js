const jwt = require('jsonwebtoken');

class AuthManager {
  constructor() {
    // 存储不同域名的授权信息
    this.authStore = new Map(); // domain -> authInfo
    
    // 授权信息结构
    this.authSchema = {
      domain: '',
      authType: '', // bearer, apikey, cookie, basic
      token: '',
      refreshToken: '',
      expiresAt: null,
      cookies: {},
      headers: {},
      lastUpdate: null,
      isActive: true
    };
    
    // token刷新回调
    this.refreshCallbacks = new Map(); // domain -> callback function
    
    // 定期检查token过期
    this.startTokenExpirationChecker();
    
    // 设置常见服务的刷新逻辑
    this.setupCommonRefreshLogics();
  }

  // 从拦截到的API中提取授权信息
  extractAuthFromAPI(apiData) {
    const domain = this.extractDomain(apiData.url);
    const headers = apiData.headers || {};
    
    let authInfo = this.authStore.get(domain) || {
      domain,
      authType: 'unknown',
      token: '',
      refreshToken: '',
      expiresAt: null,
      cookies: {},
      headers: {},
      lastUpdate: Date.now(),
      isActive: true
    };

    // 提取Authorization头
    if (headers.Authorization || headers.authorization) {
      const authHeader = headers.Authorization || headers.authorization;
      
      if (authHeader.startsWith('Bearer ')) {
        authInfo.authType = 'bearer';
        authInfo.token = authHeader.substring(7);
        
        // 尝试解析JWT token
        try {
          const decoded = this.decodeJWT(authInfo.token);
          if (decoded && decoded.exp) {
            authInfo.expiresAt = decoded.exp * 1000; // 转换为毫秒
            authInfo.tokenPayload = decoded;
          }
        } catch (error) {
          console.log('Failed to decode JWT:', error.message);
        }
      } else if (authHeader.startsWith('Basic ')) {
        authInfo.authType = 'basic';
        authInfo.token = authHeader.substring(6);
      } else {
        authInfo.authType = 'custom';
        authInfo.token = authHeader;
      }
    }

    // 提取API Key相关头
    const apiKeyHeaders = [
      'X-API-Key', 'x-api-key', 'ApiKey', 'apikey',
      'X-Auth-Token', 'x-auth-token',
      'X-Access-Token', 'x-access-token'
    ];
    
    for (const keyHeader of apiKeyHeaders) {
      if (headers[keyHeader]) {
        authInfo.authType = 'apikey';
        authInfo.token = headers[keyHeader];
        authInfo.headers[keyHeader] = headers[keyHeader];
        break;
      }
    }

    // 提取Cookies
    if (headers.Cookie) {
      authInfo.cookies = this.parseCookies(headers.Cookie);
      
      // 检查是否包含认证相关的cookie
      const authCookies = ['access_token', 'auth_token', 'session', 'jwt', 'token'];
      for (const cookieName of authCookies) {
        if (authInfo.cookies[cookieName]) {
          if (authInfo.authType === 'unknown') {
            authInfo.authType = 'cookie';
            authInfo.token = authInfo.cookies[cookieName];
          }
        }
      }
    }

    // 提取其他可能的授权头
    const possibleAuthHeaders = [
      'X-User-ID', 'X-Session-ID', 'X-Client-ID',
      'X-Device-ID', 'X-App-ID', 'X-Tenant-ID'
    ];
    
    for (const header of possibleAuthHeaders) {
      if (headers[header]) {
        authInfo.headers[header] = headers[header];
      }
    }

    authInfo.lastUpdate = Date.now();
    
    // 保存到存储中
    this.authStore.set(domain, authInfo);
    
    console.log(`Updated auth info for ${domain}:`, {
      authType: authInfo.authType,
      hasToken: !!authInfo.token,
      expiresAt: authInfo.expiresAt ? new Date(authInfo.expiresAt) : null,
      headersCount: Object.keys(authInfo.headers).length,
      cookiesCount: Object.keys(authInfo.cookies).length
    });

    return authInfo;
  }

  // 检查token是否即将过期或已过期
  checkTokenExpiration(domain) {
    const authInfo = this.authStore.get(domain);
    if (!authInfo || !authInfo.expiresAt) return null;

    const now = Date.now();
    const expiresAt = authInfo.expiresAt;
    const timeUntilExpiry = expiresAt - now;
    
    const status = {
      domain,
      isExpired: timeUntilExpiry <= 0,
      willExpireSoon: timeUntilExpiry > 0 && timeUntilExpiry < 5 * 60 * 1000, // 5分钟内过期
      timeUntilExpiry,
      expiresAt: new Date(expiresAt)
    };

    return status;
  }

  // 获取用于API调用的授权头
  getAuthHeaders(domain, apiUrl = null) {
    const authInfo = this.authStore.get(domain);
    if (!authInfo || !authInfo.isActive) return {};

    // 检查token是否过期
    const expirationStatus = this.checkTokenExpiration(domain);
    if (expirationStatus && expirationStatus.isExpired) {
      console.warn(`Token for ${domain} is expired`);
      // 可以在这里触发token刷新逻辑
      return {};
    }

    const headers = {};

    // 添加授权头
    switch (authInfo.authType) {
      case 'bearer':
        if (authInfo.token) {
          headers.Authorization = `Bearer ${authInfo.token}`;
        }
        break;
      case 'basic':
        if (authInfo.token) {
          headers.Authorization = `Basic ${authInfo.token}`;
        }
        break;
      case 'apikey':
        // 添加API Key头
        Object.assign(headers, authInfo.headers);
        break;
      case 'custom':
        if (authInfo.token) {
          headers.Authorization = authInfo.token;
        }
        break;
    }

    // 添加其他必要的头
    Object.assign(headers, authInfo.headers);

    return headers;
  }

  // 获取用于API调用的Cookies
  getAuthCookies(domain) {
    const authInfo = this.authStore.get(domain);
    if (!authInfo || !authInfo.isActive) return '';

    const cookies = [];
    for (const [name, value] of Object.entries(authInfo.cookies)) {
      cookies.push(`${name}=${value}`);
    }

    return cookies.join('; ');
  }

  // 更新授权信息（例如刷新token后）
  updateAuthInfo(domain, updates) {
    const authInfo = this.authStore.get(domain);
    if (!authInfo) {
      console.warn(`No auth info found for domain: ${domain}`);
      return false;
    }

    Object.assign(authInfo, updates, {
      lastUpdate: Date.now()
    });

    this.authStore.set(domain, authInfo);
    console.log(`Auth info updated for ${domain}`);
    return true;
  }

  // 禁用某个域名的授权信息
  disableAuth(domain) {
    const authInfo = this.authStore.get(domain);
    if (authInfo) {
      authInfo.isActive = false;
      this.authStore.set(domain, authInfo);
    }
  }

  // 启用某个域名的授权信息
  enableAuth(domain) {
    const authInfo = this.authStore.get(domain);
    if (authInfo) {
      authInfo.isActive = true;
      this.authStore.set(domain, authInfo);
    }
  }

  // 获取所有授权信息的摘要
  getAuthSummary() {
    const summary = [];
    
    for (const [domain, authInfo] of this.authStore.entries()) {
      const expirationStatus = this.checkTokenExpiration(domain);
      
      summary.push({
        domain,
        authType: authInfo.authType,
        hasToken: !!authInfo.token,
        isActive: authInfo.isActive,
        lastUpdate: new Date(authInfo.lastUpdate),
        expiration: expirationStatus,
        headersCount: Object.keys(authInfo.headers).length,
        cookiesCount: Object.keys(authInfo.cookies).length
      });
    }

    return summary;
  }

  // 注册token刷新回调
  registerRefreshCallback(domain, callback) {
    this.refreshCallbacks.set(domain, callback);
  }

  // 尝试刷新token
  async tryRefreshToken(domain) {
    const callback = this.refreshCallbacks.get(domain);
    if (callback) {
      try {
        const newAuthData = await callback(domain);
        if (newAuthData) {
          this.updateAuthInfo(domain, newAuthData);
          return true;
        }
      } catch (error) {
        console.error(`Failed to refresh token for ${domain}:`, error);
      }
    }
    
    // 如果没有注册刷新回调，尝试默认刷新逻辑
    return await this.attemptDefaultRefresh(domain);
  }

  // 默认token刷新逻辑
  async attemptDefaultRefresh(domain) {
    const authInfo = this.authStore.get(domain);
    if (!authInfo || !authInfo.refreshToken) {
      console.log(`No refresh token available for ${domain}`);
      return false;
    }

    try {
      console.log(`Attempting default token refresh for ${domain}`);
      
      // 常见的token刷新端点
      const commonRefreshEndpoints = [
        `/auth/refresh`,
        `/api/auth/refresh`,
        `/v1/auth/refresh`,
        `/api/v1/auth/refresh`,
        `/refresh`,
        `/token/refresh`
      ];
      
      for (const endpoint of commonRefreshEndpoints) {
        try {
          const refreshUrl = `https://${domain}${endpoint}`;
          console.log(`Trying refresh endpoint: ${refreshUrl}`);
          
          const response = await this.makeRefreshRequest(refreshUrl, authInfo.refreshToken, authInfo.authType);
          if (response && response.success) {
            console.log(`Token refresh successful for ${domain}`);
            
            // 更新授权信息
            const updates = {
              token: response.access_token || response.token,
              lastUpdate: Date.now()
            };
            
            if (response.refresh_token) {
              updates.refreshToken = response.refresh_token;
            }
            
            if (response.expires_in) {
              updates.expiresAt = Date.now() + (response.expires_in * 1000);
            }
            
            this.updateAuthInfo(domain, updates);
            return true;
          }
        } catch (endpointError) {
          console.log(`Refresh endpoint ${endpoint} failed:`, endpointError.message);
          continue;
        }
      }
      
      console.log(`All refresh attempts failed for ${domain}`);
      return false;
      
    } catch (error) {
      console.error(`Default refresh failed for ${domain}:`, error);
      return false;
    }
  }

  // 发起token刷新请求
  async makeRefreshRequest(url, refreshToken, authType) {
    const axios = require('axios');
    
    let requestConfig = {
      method: 'POST',
      url: url,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ElectronInterceptor/1.0'
      }
    };

    // 根据认证类型设置刷新请求
    if (authType === 'bearer') {
      requestConfig.headers.Authorization = `Bearer ${refreshToken}`;
      requestConfig.data = { grant_type: 'refresh_token', refresh_token: refreshToken };
    } else {
      requestConfig.data = { refresh_token: refreshToken };
    }

    try {
      const response = await axios(requestConfig);
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      if (error.response) {
        console.log('Refresh request failed with status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
      throw error;
    }
  }

  // 注册域名特定的刷新逻辑
  registerDomainRefreshLogic(domain, refreshLogic) {
    this.refreshCallbacks.set(domain, refreshLogic);
    console.log(`Registered refresh logic for ${domain}`);
  }

  // 为常见服务注册刷新逻辑
  setupCommonRefreshLogics() {
    // JWT Bearer token刷新逻辑
    this.registerDomainRefreshLogic('api.openai.com', async (domain) => {
      // OpenAI API使用API Key，通常不需要刷新
      return null;
    });

    // 通用OAuth2刷新逻辑
    const oauth2Refresh = async (domain) => {
      const authInfo = this.authStore.get(domain);
      if (!authInfo || !authInfo.refreshToken) return null;

      try {
        const response = await this.makeRefreshRequest(
          `https://${domain}/oauth2/token`,
          authInfo.refreshToken,
          authInfo.authType
        );
        return response;
      } catch (error) {
        return null;
      }
    };

    // 可以为更多已知域名添加特定的刷新逻辑
    this.registerDomainRefreshLogic('graph.microsoft.com', oauth2Refresh);
    this.registerDomainRefreshLogic('api.github.com', oauth2Refresh);
  }

  // 解码JWT token
  decodeJWT(token) {
    try {
      // 不验证签名，只解码payload
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  // 解析Cookies字符串
  parseCookies(cookieString) {
    const cookies = {};
    if (!cookieString) return cookies;

    cookieString.split(';').forEach(cookie => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        cookies[parts[0]] = decodeURIComponent(parts[1]);
      }
    });

    return cookies;
  }

  // 提取域名
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return 'unknown';
    }
  }

  // 定期检查token过期状态
  startTokenExpirationChecker() {
    setInterval(() => {
      for (const domain of this.authStore.keys()) {
        const status = this.checkTokenExpiration(domain);
        if (status) {
          if (status.isExpired) {
            console.warn(`Token expired for ${domain}`);
            // 可以触发通知或自动刷新
          } else if (status.willExpireSoon) {
            console.info(`Token for ${domain} will expire in ${Math.round(status.timeUntilExpiry / 60000)} minutes`);
            // 可以预先刷新token
            this.tryRefreshToken(domain);
          }
        }
      }
    }, 60000); // 每分钟检查一次
  }

  // 导出授权信息（用于备份或转移）
  exportAuthData() {
    const exportData = {};
    for (const [domain, authInfo] of this.authStore.entries()) {
      exportData[domain] = {
        ...authInfo,
        // 为安全起见，可以选择不导出敏感的token信息
        token: authInfo.token ? '[REDACTED]' : '',
        refreshToken: authInfo.refreshToken ? '[REDACTED]' : ''
      };
    }
    return exportData;
  }

  // 导入授权信息
  importAuthData(data) {
    for (const [domain, authInfo] of Object.entries(data)) {
      this.authStore.set(domain, {
        ...this.authSchema,
        ...authInfo,
        lastUpdate: Date.now()
      });
    }
  }

  // 清除所有授权信息
  clearAll() {
    this.authStore.clear();
  }

  // 清除特定域名的授权信息
  clearDomain(domain) {
    this.authStore.delete(domain);
  }
}

module.exports = { AuthManager };