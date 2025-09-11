/**
 * APIForge 主应用类 - 使用服务层和事件总线
 */

import { BrowserManager } from '../domains/browser/browser-manager.js';
import { APIManager } from '../domains/api/api-manager.js';
import { KnowledgeManager } from '../domains/knowledge/knowledge-manager.js';
import { ChatManager } from '../domains/chat/chat-manager.js';
import { UIManager } from '../ui/ui-manager.js';
import { StorageUtil } from '../utils/storage-util.js';

// 导入服务层
import APIService from '../services/api-service.js';
import KnowledgeService from '../services/knowledge-service.js';

// 导入事件总线
import eventBus, { Events } from '../shared/event-bus.js';

class APIForgeApp {
  constructor() {
    this.userId = this.generateUserId();
    
    // 初始化工具类
    this.storageUtil = new StorageUtil();
    
    // 初始化服务层
    this.apiService = new APIService(this.storageUtil);
    this.knowledgeService = new KnowledgeService(this.storageUtil, this.apiService);
    
    // 初始化UI管理器
    this.uiManager = new UIManager();
    
    // 初始化域管理器（使用服务层）
    this.browserManager = new BrowserManager(this.uiManager);
    this.apiManager = new APIManager(this.uiManager, this.apiService);
    this.knowledgeManager = new KnowledgeManager(this.uiManager, this.knowledgeService);
    this.chatManager = new ChatManager(this.uiManager, this.apiService, this.knowledgeService);
    
    // 设置事件监听
    this.setupEventListeners();
  }

  async init() {
    console.log('🚀 APIForge App 启动中...');
    
    try {
      // 初始化UI
      this.uiManager.init();
      
      // 初始化服务层
      await this.apiService.init();
      await this.knowledgeService.init();
      
      // 加载本地数据
      this.loadLocalData();
      
      // 初始化各个域管理器
      await this.browserManager.init();
      await this.apiManager.init();
      await this.knowledgeManager.init();
      await this.chatManager.init();
      
      // 触发系统就绪事件
      eventBus.emit(Events.SYSTEM_READY);
      
      console.log('✅ APIForge App 启动完成');
    } catch (error) {
      console.error('❌ App initialization failed:', error);
      eventBus.emit(Events.SYSTEM_ERROR, error);
      throw error;
    }
  }

  setupEventListeners() {
    // 监听API拦截事件
    eventBus.on(Events.API_INTERCEPTED, (apiData) => {
      console.log('API intercepted:', apiData.method, apiData.url);
      this.apiService.addAPI(apiData);
    });

    // 监听工具生成事件
    eventBus.on(Events.API_TOOL_GENERATED, (apiData) => {
      console.log('Generating tool from API:', apiData.url);
      const tool = this.apiService.generateTool(apiData);
      this.uiManager.showNotification(`工具已生成: ${tool.name}`);
    });

    // 监听知识库创建事件
    eventBus.on(Events.KNOWLEDGE_CREATED, (knowledge) => {
      console.log('Knowledge created:', knowledge.title);
      this.uiManager.showNotification(`知识已创建: ${knowledge.title}`);
    });

    // 监听系统保存事件
    eventBus.on(Events.SYSTEM_SAVE, () => {
      this.saveLocalData();
    });

    // 监听系统恢复事件
    eventBus.on(Events.SYSTEM_RESTORE, () => {
      this.loadLocalData();
    });

    // 监听UI通知事件
    eventBus.on(Events.UI_NOTIFICATION, (message, type) => {
      this.uiManager.showNotification(message, type);
    });

    // 监听系统错误事件
    eventBus.on(Events.SYSTEM_ERROR, (error) => {
      console.error('System error:', error);
      this.uiManager.showNotification(`系统错误: ${error.message}`, 'error');
    });
  }

  generateUserId() {
    const stored = localStorage.getItem('apiforge_user_id');
    if (stored) return stored;
    
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('apiforge_user_id', userId);
    return userId;
  }

  loadLocalData() {
    try {
      const data = this.storageUtil.loadAll();
      
      // 使用服务层加载数据
      if (data.apis) {
        data.apis.forEach(api => this.apiService.addAPI(api));
      }
      
      if (data.knowledge) {
        data.knowledge.forEach(item => 
          this.knowledgeService.knowledgeBase.set(item.id, item)
        );
      }
      
      // 通知管理器数据已加载
      if (data.chatHistory) {
        this.chatManager.loadHistory(data.chatHistory);
      }
      
      eventBus.emit(Events.CHAT_HISTORY_LOADED, data.chatHistory);
      
      console.log('✅ Local data loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load local data:', error);
      eventBus.emit(Events.SYSTEM_ERROR, error);
    }
  }

  saveLocalData() {
    try {
      const data = {
        apis: this.apiService.getAPIs(),
        tools: this.apiService.getTools(),
        knowledge: this.knowledgeService.getAllKnowledge(),
        chatHistory: this.chatManager.getHistory(),
        userId: this.userId,
        lastSaved: new Date().toISOString()
      };
      
      this.storageUtil.saveAll(data);
      
      console.log('✅ Local data saved successfully');
    } catch (error) {
      console.error('❌ Failed to save local data:', error);
      eventBus.emit(Events.SYSTEM_ERROR, error);
    }
  }

  // 公共API方法
  
  /**
   * 搜索知识库
   */
  async searchKnowledge(query, options) {
    return await this.knowledgeService.search(query, options);
  }

  /**
   * 获取API统计信息
   */
  getAPIStatistics() {
    const apis = this.apiService.getAPIs();
    const tools = this.apiService.getTools();
    
    return {
      totalAPIs: apis.length,
      totalTools: tools.length,
      methodBreakdown: this.getMethodBreakdown(apis),
      domainBreakdown: this.getDomainBreakdown(apis)
    };
  }

  getMethodBreakdown(apis) {
    const breakdown = {};
    apis.forEach(api => {
      breakdown[api.method] = (breakdown[api.method] || 0) + 1;
    });
    return breakdown;
  }

  getDomainBreakdown(apis) {
    const breakdown = {};
    apis.forEach(api => {
      try {
        const url = new URL(api.url);
        const domain = url.hostname;
        breakdown[domain] = (breakdown[domain] || 0) + 1;
      } catch (e) {}
    });
    return breakdown;
  }

  /**
   * 导出数据
   */
  exportData(format = 'json') {
    const data = {
      apis: this.apiService.getAPIs(),
      tools: this.apiService.getTools(),
      knowledge: this.knowledgeService.getAllKnowledge(),
      chatHistory: this.chatManager.getHistory(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * 导入数据
   */
  importData(data, format = 'json') {
    try {
      let parsedData;
      
      if (format === 'json') {
        parsedData = JSON.parse(data);
      } else {
        throw new Error(`Unsupported import format: ${format}`);
      }

      // 导入APIs
      if (parsedData.apis) {
        parsedData.apis.forEach(api => this.apiService.addAPI(api));
      }

      // 导入知识库
      if (parsedData.knowledge) {
        parsedData.knowledge.forEach(item => 
          this.knowledgeService.createKnowledgeItem(item)
        );
      }

      // 导入聊天历史
      if (parsedData.chatHistory) {
        this.chatManager.loadHistory(parsedData.chatHistory);
      }

      this.saveLocalData();
      
      eventBus.emit(Events.SYSTEM_RESTORE);
      
      return {
        success: true,
        imported: {
          apis: parsedData.apis?.length || 0,
          knowledge: parsedData.knowledge?.length || 0,
          chatHistory: parsedData.chatHistory?.length || 0
        }
      };
    } catch (error) {
      console.error('Import failed:', error);
      eventBus.emit(Events.SYSTEM_ERROR, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 清理数据
   */
  clearData(type = 'all') {
    const types = type === 'all' ? ['apis', 'tools', 'knowledge', 'chat'] : [type];
    
    types.forEach(t => {
      switch (t) {
        case 'apis':
          this.apiService.apis.clear();
          break;
        case 'tools':
          this.apiService.tools.clear();
          break;
        case 'knowledge':
          this.knowledgeService.knowledgeBase.clear();
          break;
        case 'chat':
          this.chatManager.clearHistory();
          break;
      }
    });

    this.saveLocalData();
    eventBus.emit(Events.SYSTEM_RESTORE);
  }
}

// 创建全局应用实例
const app = new APIForgeApp();

// 导出给全局使用
window.APIForgeApp = app;

export default app;