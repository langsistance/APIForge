/**
 * 多语言管理器
 * 负责语言切换和翻译功能
 */

import zhLocale from './locales/zh.js';
import enLocale from './locales/en.js';

class I18nManager {
  constructor() {
    // 支持的语言
    this.supportedLanguages = {
      zh: {
        code: 'zh',
        name: '中文',
        locale: zhLocale
      },
      en: {
        code: 'en', 
        name: 'English',
        locale: enLocale
      }
    };

    // 当前语言，默认中文
    this.currentLanguage = 'zh';
    
    // 语言变更监听器
    this.listeners = [];

    // 初始化语言
    this.init();
  }

  /**
   * 初始化多语言系统
   */
  init() {
    // 从本地存储读取语言设置
    const savedLanguage = this.loadLanguageFromStorage();
    if (savedLanguage && this.supportedLanguages[savedLanguage]) {
      this.currentLanguage = savedLanguage;
    } else {
      // 尝试从浏览器语言自动检测
      const detectedLanguage = this.detectLanguage();
      if (detectedLanguage) {
        this.currentLanguage = detectedLanguage;
      }
    }

    console.log(`🌍 I18n initialized with language: ${this.currentLanguage}`);
  }

  /**
   * 自动检测系统语言
   */
  detectLanguage() {
    try {
      // 获取浏览器/系统语言
      const systemLanguage = navigator.language || navigator.languages?.[0];
      console.log(`🌍 Detected system language: ${systemLanguage}`);

      // 简单的语言映射
      if (systemLanguage?.startsWith('zh')) {
        return 'zh';
      } else if (systemLanguage?.startsWith('en')) {
        return 'en';
      }
    } catch (error) {
      console.warn('🌍 Failed to detect system language:', error);
    }
    
    return 'zh'; // 默认中文
  }

  /**
   * 从本地存储加载语言设置
   */
  loadLanguageFromStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('apiforge-language');
      }
    } catch (error) {
      console.warn('🌍 Failed to load language from localStorage:', error);
    }
    return null;
  }

  /**
   * 保存语言设置到本地存储
   */
  saveLanguageToStorage(language) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('apiforge-language', language);
        console.log(`🌍 Language preference saved: ${language}`);
      }
    } catch (error) {
      console.warn('🌍 Failed to save language to localStorage:', error);
    }
  }

  /**
   * 切换语言
   */
  setLanguage(language) {
    if (!this.supportedLanguages[language]) {
      console.error(`🌍 Unsupported language: ${language}`);
      return false;
    }

    const oldLanguage = this.currentLanguage;
    this.currentLanguage = language;
    
    // 保存到本地存储
    this.saveLanguageToStorage(language);

    console.log(`🌍 Language changed from ${oldLanguage} to ${language}`);

    // 通知所有监听器
    this.notifyLanguageChange(language, oldLanguage);

    return true;
  }

  /**
   * 获取当前语言
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * 获取当前语言信息
   */
  getCurrentLanguageInfo() {
    return this.supportedLanguages[this.currentLanguage];
  }

  /**
   * 获取所有支持的语言
   */
  getSupportedLanguages() {
    return Object.values(this.supportedLanguages).map(lang => ({
      code: lang.code,
      name: lang.name
    }));
  }

  /**
   * 翻译文本
   * @param {string} key - 翻译键，支持点号分隔的嵌套键，如 'api.title'
   * @param {object} params - 参数对象，用于动态替换文本中的占位符
   * @returns {string} 翻译后的文本
   */
  t(key, params = {}) {
    const locale = this.supportedLanguages[this.currentLanguage].locale;
    
    try {
      // 支持嵌套键的访问，如 'api.title'
      const keys = key.split('.');
      let value = locale;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          // 键不存在，返回键本身作为fallback
          console.warn(`🌍 Translation key not found: ${key}`);
          return key;
        }
      }

      // 如果找到的值不是字符串，返回键作为fallback
      if (typeof value !== 'string') {
        console.warn(`🌍 Translation value is not string: ${key}`);
        return key;
      }

      // 参数替换
      let translatedText = value;
      Object.keys(params).forEach(param => {
        const placeholder = `{${param}}`;
        translatedText = translatedText.replace(
          new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 
          params[param]
        );
      });

      return translatedText;
    } catch (error) {
      console.error(`🌍 Translation error for key "${key}":`, error);
      return key;
    }
  }

  /**
   * 添加语言变更监听器
   */
  addLanguageChangeListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  /**
   * 移除语言变更监听器
   */
  removeLanguageChangeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知语言变更
   */
  notifyLanguageChange(newLanguage, oldLanguage) {
    this.listeners.forEach(callback => {
      try {
        callback(newLanguage, oldLanguage);
      } catch (error) {
        console.error('🌍 Error in language change listener:', error);
      }
    });
  }

  /**
   * 获取格式化的日期时间（考虑语言环境）
   */
  formatDateTime(date, options = {}) {
    try {
      const locale = this.currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
      const defaultOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: this.currentLanguage === 'en'
      };
      
      return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(date);
    } catch (error) {
      console.error('🌍 Date formatting error:', error);
      return date.toLocaleString();
    }
  }

  /**
   * 获取格式化的数字（考虑语言环境）
   */
  formatNumber(number, options = {}) {
    try {
      const locale = this.currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
      return new Intl.NumberFormat(locale, options).format(number);
    } catch (error) {
      console.error('🌍 Number formatting error:', error);
      return number.toString();
    }
  }

  /**
   * 快捷方法：检查当前是否为中文
   */
  isZh() {
    return this.currentLanguage === 'zh';
  }

  /**
   * 快捷方法：检查当前是否为英文
   */
  isEn() {
    return this.currentLanguage === 'en';
  }
}

// 创建单例实例
const i18nManager = new I18nManager();

// 全局快捷方法
window.$t = (key, params) => i18nManager.t(key, params);

export default i18nManager;
export { I18nManager };