/**
 * 请求头配置管理器
 * 用于存储和管理域名特定的请求头规则
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class HeadersConfigManager {
  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'headers-config.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load headers config:', error);
    }
    
    // 默认配置
    return {
      rules: [],
      globalRules: {
        autoFixSecFetchSite: true,
        autoAddReferer: true,
        standardizeHeaders: true
      }
    };
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      console.log('✅ Headers config saved');
    } catch (error) {
      console.error('Failed to save headers config:', error);
    }
  }

  addRule(domain, headers) {
    const existingIndex = this.config.rules.findIndex(r => r.domain === domain);
    
    if (existingIndex >= 0) {
      // 更新现有规则
      this.config.rules[existingIndex].headers = {
        ...this.config.rules[existingIndex].headers,
        ...headers
      };
    } else {
      // 添加新规则
      this.config.rules.push({
        domain,
        headers,
        enabled: true,
        createdAt: new Date().toISOString()
      });
    }
    
    this.saveConfig();
  }

  removeRule(domain) {
    this.config.rules = this.config.rules.filter(r => r.domain !== domain);
    this.saveConfig();
  }

  getRuleForDomain(domain) {
    return this.config.rules.find(r => 
      r.enabled && domain.includes(r.domain)
    );
  }

  getAllRules() {
    return this.config.rules;
  }

  updateGlobalRules(rules) {
    this.config.globalRules = {
      ...this.config.globalRules,
      ...rules
    };
    this.saveConfig();
  }

  getGlobalRules() {
    return this.config.globalRules;
  }

  // 应用配置的规则到请求头
  applyRules(url, headers) {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // 查找匹配的域名规则
    const rule = this.getRuleForDomain(domain);
    
    if (rule && rule.headers) {
      // 应用域名特定的头部
      Object.entries(rule.headers).forEach(([key, value]) => {
        if (value) {
          // 支持动态替换
          const processedValue = value
            .replace('{origin}', urlObj.origin)
            .replace('{hostname}', urlObj.hostname)
            .replace('{pathname}', urlObj.pathname);
          
          headers[key] = processedValue;
          console.log(`📝 Applied rule for ${domain}: ${key} = ${processedValue}`);
        }
      });
    }
    
    return headers;
  }
}

module.exports = HeadersConfigManager;