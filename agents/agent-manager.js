const { APIAnalyzer } = require('./api-analyzer');
const { KnowledgeBase } = require('./knowledge-base');
const { APICaller } = require('./api-caller');
const { APIKeyValidator } = require('./api-key-validator');

class AgentManager {
  constructor(config = {}) {
    this.config = {
      googleApiKey: config.anthropicApiKey || config.googleApiKey || process.env.GOOGLE_API_KEY,
      authManager: config.authManager,
      enableAIAnalysis: config.enableAIAnalysis !== false, // 默认启用AI分析
      ...config
    };

    // 初始化API密钥验证器
    this.keyValidator = new APIKeyValidator();
    
    // 初始化知识库（总是需要）
    this.knowledgeBase = new KnowledgeBase();
    this.authManager = this.config.authManager;
    
    // 状态管理
    this.isAnalyzing = false;
    this.analysisQueue = [];
    this.aiAnalysisEnabled = false;
    this.apiKeyStatus = null;
    
    // 初始化AI组件（如果配置允许）
    this.initializeAIComponents();
  }

  // 初始化AI组件
  async initializeAIComponents() {
    if (!this.config.enableAIAnalysis) {
      console.log('AI分析已被禁用，使用基础模式');
      return;
    }

    if (!this.config.googleApiKey) {
      console.warn('未提供Google API密钥，AI分析功能不可用');
      return;
    }

    try {
      // 验证API密钥
      console.log('🔑 验证API密钥...');
      this.apiKeyStatus = await this.keyValidator.testAPIKey(this.config.googleApiKey);
      
      if (this.apiKeyStatus.valid) {
        console.log('✅ API密钥验证成功，启用AI分析');
        this.apiAnalyzer = new APIAnalyzer(this.config.googleApiKey);
        this.apiCaller = new APICaller(this.config.googleApiKey, null, this.config.authManager);
        this.aiAnalysisEnabled = true;
      } else {
        console.error('❌ API密钥验证失败:', this.apiKeyStatus.error);
        console.log('💡 建议:', this.apiKeyStatus.suggestion);
        this.initializeFallbackMode();
      }
    } catch (error) {
      console.error('初始化AI组件时出错:', error);
      this.initializeFallbackMode();
    }
  }

  // 初始化回退模式
  initializeFallbackMode() {
    console.log('🔧 启用回退模式 - 将使用基础API分析');
    this.aiAnalysisEnabled = false;
    this.apiAnalyzer = null;
    this.apiCaller = null;
  }

  // 分析拦截到的API并存储到知识库
  async analyzeAndStoreAPI(apiData) {
    try {
      console.log('开始分析API:', apiData.method, apiData.url);
      
      // 检查是否已经分析过这个API
      const existingAPI = await this.knowledgeBase.findAPIByUrlAndMethod(apiData.url, apiData.method);
      if (existingAPI) {
        console.log('API已存在，跳过分析:', existingAPI.name);
        return existingAPI;
      }

      let analysis = null;

      if (this.aiAnalysisEnabled && this.apiAnalyzer) {
        try {
          // 使用AI分析器分析API
          console.log('🤖 使用AI分析API...');
          analysis = await this.apiAnalyzer.analyze(apiData);
        } catch (aiError) {
          console.error('AI分析失败:', aiError.message);
          console.log('🔄 回退到基础分析模式');
        }
      }

      // 如果AI分析失败或未启用，使用基础分析
      if (!analysis) {
        console.log('📊 使用基础API分析...');
        analysis = this.createBasicAnalysis(apiData);
      }
      
      if (!analysis) {
        console.error('API分析失败');
        return null;
      }

      // 保存分析结果到知识库
      const savedAPI = await this.knowledgeBase.saveAPIDoc(analysis, apiData);
      
      console.log('API分析完成并保存:', savedAPI.name);
      return savedAPI;
      
    } catch (error) {
      console.error('分析和存储API时出错:', error);
      return null;
    }
  }

  // 创建基础API分析（不依赖AI）
  createBasicAnalysis(apiData) {
    try {
      const url = new URL(apiData.url);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      // 基础名称生成
      let name = 'Unknown API';
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (/^\d+$/.test(lastPart) && pathParts.length > 1) {
          name = `${pathParts[pathParts.length - 2]} API`;
        } else {
          name = `${lastPart} API`;
        }
      }
      
      // 基础分类
      let category = 'General';
      const pathStr = url.pathname.toLowerCase();
      if (pathStr.includes('user') || pathStr.includes('account') || pathStr.includes('profile')) {
        category = 'User Management';
      } else if (pathStr.includes('order') || pathStr.includes('payment') || pathStr.includes('transaction')) {
        category = 'Commerce';
      } else if (pathStr.includes('data') || pathStr.includes('query') || pathStr.includes('search')) {
        category = 'Data Query';
      } else if (pathStr.includes('auth') || pathStr.includes('login') || pathStr.includes('token')) {
        category = 'Authentication';
      }

      return {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        description: `${apiData.method} request to ${apiData.url}`,
        category: category,
        purpose: `Handle ${apiData.method} operations for ${url.hostname}`,
        parameters: {
          path: this.extractPathParameters(url.pathname),
          query: this.parseUrlParameters(url.search),
          headers: apiData.headers || {},
          body: apiData.body || {}
        },
        response: {
          structure: apiData.responseBody || {},
          fields: this.analyzeResponseFields(apiData.responseBody)
        },
        examples: {
          request: {
            method: apiData.method,
            url: apiData.url,
            headers: apiData.headers,
            body: apiData.body
          },
          response: apiData.responseBody
        },
        usage: `Call ${apiData.method} ${apiData.url} to interact with ${url.hostname} service`,
        analysisMode: 'basic' // 标记为基础分析
      };
    } catch (error) {
      console.error('基础分析创建失败:', error);
      return null;
    }
  }

  // 提取路径参数
  extractPathParameters(pathname) {
    const pathParams = {};
    const parts = pathname.split('/').filter(part => part.length > 0);
    
    parts.forEach((part, index) => {
      if (/^\d+$/.test(part)) {
        pathParams[`param${index}`] = { type: 'number', example: part, description: 'ID parameter' };
      } else if (part.includes('{') && part.includes('}')) {
        const paramName = part.replace(/[{}]/g, '');
        pathParams[paramName] = { type: 'string', description: 'Path parameter' };
      }
    });
    
    return pathParams;
  }

  // 解析URL参数
  parseUrlParameters(search) {
    const params = {};
    if (search) {
      const urlParams = new URLSearchParams(search);
      for (const [key, value] of urlParams.entries()) {
        params[key] = { 
          type: isNaN(value) ? 'string' : 'number',
          example: value,
          description: `Query parameter: ${key}`
        };
      }
    }
    return params;
  }

  // 分析响应字段
  analyzeResponseFields(responseBody) {
    const fields = {};
    
    if (responseBody && typeof responseBody === 'object') {
      Object.keys(responseBody).forEach(key => {
        const value = responseBody[key];
        let type = typeof value;
        
        if (Array.isArray(value)) {
          type = 'array';
        } else if (value === null) {
          type = 'null';
        }
        
        fields[key] = `${type} - Response field`;
      });
    }
    
    return fields;
  }

  // 批量分析多个API（防止重复分析）
  async batchAnalyzeAPIs(apiDataList) {
    const results = [];
    
    for (const apiData of apiDataList) {
      // 添加延迟避免API调用过于频繁
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const result = await this.analyzeAndStoreAPI(apiData);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  // 处理用户的聊天消息
  async handleChatMessage(message) {
    try {
      console.log('处理用户消息:', message);
      
      if (this.aiAnalysisEnabled && this.apiCaller) {
        try {
          // 使用AI调用器处理用户问题
          console.log('🤖 使用AI处理用户消息...');
          const result = await this.apiCaller.handleUserQuestion(message);
          return result;
        } catch (aiError) {
          console.error('AI聊天处理失败:', aiError.message);
          console.log('🔄 回退到基础聊天模式');
        }
      }

      // 回退到基础聊天处理
      console.log('📊 使用基础聊天模式...');
      return await this.handleBasicChat(message);
      
    } catch (error) {
      console.error('处理聊天消息时出错:', error);
      return {
        success: false,
        answer: '处理您的消息时发生错误，请稍后重试。',
        apis: []
      };
    }
  }

  // 基础聊天处理（不依赖AI）
  async handleBasicChat(message) {
    try {
      // 搜索相关API
      const searchResults = await this.knowledgeBase.searchAPIs(message, 5);
      
      if (searchResults.length === 0) {
        return {
          success: false,
          answer: '很抱歉，我没有找到与您的问题相关的API。请确保已经拦截并分析了相关的API，或者尝试更具体的问题。',
          apis: []
        };
      }

      // 生成基础回答
      let answer = `我找到了 ${searchResults.length} 个相关的API：\n\n`;
      
      searchResults.forEach((api, index) => {
        answer += `${index + 1}. **${api.name}**\n`;
        answer += `   - 描述：${api.description}\n`;
        answer += `   - 分类：${api.category}\n`;
        answer += `   - 方法：${api.method} ${api.url}\n`;
        if (api.analysisMode === 'basic') {
          answer += `   - ⚠️ 使用基础分析模式\n`;
        }
        answer += '\n';
      });

      answer += '您可以点击具体的API查看详细信息，或者询问关于特定API的问题。';

      return {
        success: true,
        answer: answer,
        selectedAPI: null,
        apiResponse: null,
        apis: searchResults,
        mode: 'basic'
      };
      
    } catch (error) {
      console.error('基础聊天处理错误:', error);
      return {
        success: false,
        answer: '处理您的问题时发生错误，请稍后重试。',
        apis: []
      };
    }
  }

  // 获取知识库统计信息
  async getKnowledgeBaseStats() {
    try {
      const stats = await this.knowledgeBase.getStats();
      const popularAPIs = await this.knowledgeBase.getPopularAPIs(5);
      
      return {
        ...stats,
        popularAPIs
      };
    } catch (error) {
      console.error('获取统计信息时出错:', error);
      return null;
    }
  }

  // 搜索API文档
  async searchAPIs(query, limit = 10) {
    try {
      return await this.knowledgeBase.searchAPIs(query, limit);
    } catch (error) {
      console.error('搜索API时出错:', error);
      return [];
    }
  }

  // 获取API分类
  async getAPIsByCategory(category, limit = 10) {
    try {
      return await this.knowledgeBase.getAPIsByCategory(category, limit);
    } catch (error) {
      console.error('获取分类API时出错:', error);
      return [];
    }
  }

  // 获取热门API
  async getPopularAPIs(limit = 10) {
    try {
      return await this.knowledgeBase.getPopularAPIs(limit);
    } catch (error) {
      console.error('获取热门API时出错:', error);
      return [];
    }
  }

  // 导出知识库数据
  async exportKnowledgeBase() {
    try {
      const apis = await this.knowledgeBase.searchAPIs('', 1000); // 获取所有API
      return {
        timestamp: new Date().toISOString(),
        apis,
        stats: await this.getKnowledgeBaseStats()
      };
    } catch (error) {
      console.error('导出知识库时出错:', error);
      return null;
    }
  }

  // 关闭Agent管理器
  async close() {
    if (this.knowledgeBase) {
      this.knowledgeBase.close();
    }
  }

  // 检查配置是否完整
  checkConfiguration() {
    const issues = [];
    
    if (!this.config.googleApiKey) {
      issues.push('Missing Google API Key');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  // 获取系统状态
  getSystemStatus() {
    const keyInfo = this.config.googleApiKey ? 
      this.keyValidator.getKeyInfo(this.config.googleApiKey) : 
      { masked: '[未设置]' };

    return {
      aiAnalysisEnabled: this.aiAnalysisEnabled,
      apiKeyConfigured: !!this.config.googleApiKey,
      apiKeyStatus: this.apiKeyStatus,
      apiKeyMasked: keyInfo.masked,
      components: {
        knowledgeBase: !!this.knowledgeBase,
        apiAnalyzer: !!this.apiAnalyzer,
        apiCaller: !!this.apiCaller,
        authManager: !!this.authManager
      },
      mode: this.aiAnalysisEnabled ? 'AI-Enhanced' : 'Basic',
      version: '1.0.0'
    };
  }

  // 测试API密钥
  async testAPIKey(newApiKey = null) {
    const keyToTest = newApiKey || this.config.googleApiKey;
    
    if (!keyToTest) {
      return {
        valid: false,
        error: '没有提供API密钥',
        suggestion: '请设置有效的Google API密钥'
      };
    }

    try {
      const result = await this.keyValidator.testAPIKey(keyToTest);
      
      if (newApiKey && result.valid) {
        // 如果测试新密钥成功，更新配置
        this.config.googleApiKey = newApiKey;
        await this.initializeAIComponents();
      }
      
      return result;
    } catch (error) {
      return {
        valid: false,
        error: `测试失败: ${error.message}`,
        suggestion: '请检查网络连接和API密钥的有效性'
      };
    }
  }

  // 获取API密钥设置说明
  getAPIKeySetupInstructions() {
    return this.keyValidator.getSetupInstructions();
  }
}

module.exports = { AgentManager };