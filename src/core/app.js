/**
 * APIForge 主应用类 - 负责协调各个域模块
 */

import { BrowserManager } from '../domains/browser/browser-manager.js';
import { APIManager } from '../domains/api/api-manager.js';
import { KnowledgeManager } from '../domains/knowledge/knowledge-manager.js';
import { ChatManager } from '../domains/chat/chat-manager.js';
import { UIManager } from '../ui/ui-manager.js';
import { StorageUtil } from '../utils/storage-util.js';

class APIForgeApp {
  constructor() {
    // userId统一通过authService管理，不在app层存储
    
    // 初始化各个管理器
    this.uiManager = new UIManager();
    this.storageUtil = new StorageUtil();
    this.browserManager = new BrowserManager(this.uiManager);
    this.apiManager = new APIManager(this.uiManager);
    this.knowledgeManager = new KnowledgeManager(this.uiManager, this.apiManager);
    this.chatManager = new ChatManager(this.uiManager, this.apiManager, this.knowledgeManager);
  }

  async init() {
    console.log('🚀 APIForge App 启动中...');
    
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