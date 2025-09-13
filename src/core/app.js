/**
 * APIForge 主应用类 - 负责协调各个域模块
 */

import { BrowserManager } from '../domains/browser/browser-manager.js';
import { APIManager } from '../domains/api/api-manager.js';
import { KnowledgeManager } from '../domains/knowledge/knowledge-manager.js';
import { ChatManager } from '../domains/chat/chat-manager.js';
import { UIManager } from '../ui/ui-manager.js';
import { StorageUtil } from '../utils/storage-util.js';
import i18nManager from '../i18n/i18n-manager.js';
import UIUpdater from '../utils/ui-updater.js';

class APIForgeApp {
  constructor() {
    // userId统一通过authService管理，不在app层存储
    
    // 初始化多语言和UI更新器
    this.i18n = i18nManager;
    this.uiUpdater = new UIUpdater(this.i18n);
    
    // 监听语言变更，更新工具栏显示
    this.i18n.addLanguageChangeListener(() => {
      this.updateLanguageDisplay();
    });
    
    // 初始化各个管理器
    this.uiManager = new UIManager(this.i18n, this.uiUpdater);
    this.storageUtil = new StorageUtil();
    this.browserManager = new BrowserManager(this.uiManager);
    this.apiManager = new APIManager(this.uiManager);
    this.knowledgeManager = new KnowledgeManager(this.uiManager, this.apiManager);
    this.chatManager = new ChatManager(this.uiManager, this.apiManager, this.knowledgeManager);
  }

  async init() {
    console.log('🚀 APIForge App 启动中...');
    
    // 初始化多语言系统
    this.setupLanguageSelector();
    
    // 初始化UI
    this.uiManager.init();
    
    // 加载本地数据
    this.loadLocalData();
    
    // 初始化各个模块
    await this.browserManager.init();
    await this.apiManager.init();
    await this.knowledgeManager.init();
    await this.chatManager.init();
    
    console.log('✅ APIForge App 启动完成');
  }

  /**
   * 设置语言选择器
   */
  setupLanguageSelector() {
    // 设置工具栏语言切换按钮
    this.setupLanguageToggle();
    
    console.log('🌍 Language selector initialized');
  }

  /**
   * 设置工具栏语言切换按钮
   */
  setupLanguageToggle() {
    const languageToggle = document.getElementById('languageToggle');
    
    if (languageToggle) {
      // 更新显示
      this.updateLanguageDisplay();
      
      // 点击切换语言
      languageToggle.addEventListener('click', () => {
        const currentLang = this.i18n.getCurrentLanguage();
        const newLang = currentLang === 'zh' ? 'en' : 'zh';
        this.i18n.setLanguage(newLang);
      });
    }
  }

  /**
   * 更新语言显示
   */
  updateLanguageDisplay() {
    const currentLanguageIcon = document.getElementById('currentLanguageIcon');
    const currentLanguageText = document.getElementById('currentLanguageText');
    const toggleBtn = document.getElementById('languageToggle');
    
    if (currentLanguageIcon && currentLanguageText && toggleBtn) {
      const currentLang = this.i18n.getCurrentLanguage();
      
      if (currentLang === 'zh') {
        currentLanguageIcon.textContent = '🇨🇳';
        currentLanguageText.textContent = '中文';
        toggleBtn.title = 'Switch to English';
      } else {
        currentLanguageIcon.textContent = '🇺🇸';
        currentLanguageText.textContent = 'English';
        toggleBtn.title = '切换到中文';
      }
    }
  }

  // generateUserId方法已移除，统一使用authService

  loadLocalData() {
    const data = this.storageUtil.loadAll();
    
    // 分发数据到各个管理器
    if (data.interceptedAPIs) {
      this.apiManager.loadAPIs(data.interceptedAPIs);
    }
    
    if (data.generatedTools) {
      this.apiManager.loadTools(data.generatedTools);
    }
    
    // 知识库不再从本地加载，直接从服务器获取
    // if (data.knowledgeItems) {
    //   this.knowledgeManager.loadKnowledge(data.knowledgeItems);
    // }
    
    if (data.chatHistory) {
      this.chatManager.loadHistory(data.chatHistory);
    }
  }

  saveLocalData() {
    const data = {
      interceptedAPIs: this.apiManager.getAPIs(),
      generatedTools: this.apiManager.getTools(),
      // 知识库不再本地存储
      // knowledgeItems: this.knowledgeManager.getKnowledge(),
      chatHistory: this.chatManager.getHistory(),
      // userId由各管理器自行通过authService获取
      lastSaved: new Date().toISOString()
    };
    
    this.storageUtil.saveAll(data);
  }
}

// 创建全局应用实例
const app = new APIForgeApp();

// 导出给全局使用
window.app = app;

export default app;