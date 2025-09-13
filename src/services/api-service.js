/**
 * API服务层 - 处理API相关的业务逻辑
 */

class APIService {
  constructor(storageUtil) {
    this.storageUtil = storageUtil;
    this.apis = new Map();
    this.tools = new Map();
  }

  /**
   * 初始化服务
   */
  async init() {
    console.log('Initializing API Service...');
    this.loadFromStorage();
  }

  /**
   * 从存储加载数据
   */
  loadFromStorage() {
    const data = this.storageUtil.get('apis', []);
    data.forEach(api => {
      this.apis.set(api.id, api);
    });

    const tools = this.storageUtil.get('tools', []);
    tools.forEach(tool => {
      this.tools.set(tool.id, tool);
    });
  }

  /**
   * 保存到存储
   */
  saveToStorage() {
    this.storageUtil.set('apis', Array.from(this.apis.values()));
    this.storageUtil.set('tools', Array.from(this.tools.values()));
  }

  /**
   * 添加API记录
   */
  addAPI(apiData) {
    const api = {
      ...apiData,
      id: apiData.id || this.generateId(),
      createdAt: new Date().toISOString()
    };
    
    this.apis.set(api.id, api);
    this.saveToStorage();
    return api;
  }

  /**
   * 生成工具
   */
  generateTool(apiData) {
    const tool = {
      id: this.generateId(),
      name: this.generateToolName(apiData),
      description: `Auto-generated tool for ${apiData.method} ${apiData.url}`,
      api: apiData,
      parameters: this.extractParameters(apiData),
      responseSchema: this.generateResponseSchema(apiData),
      createdAt: new Date().toISOString()
    };

    this.tools.set(tool.id, tool);
    this.saveToStorage();
    return tool;
  }

  /**
   * 提取参数
   */
  extractParameters(apiData) {
    const params = [];

    // 从URL提取参数
    try {
      const url = new URL(apiData.url);
      url.searchParams.forEach((value, key) => {
        params.push({
          name: key,
          type: 'string',
          location: 'query',
          required: false,
          defaultValue: value
        });
      });
    } catch (e) {}

    // 从请求体提取参数
    if (apiData.body) {
      try {
        // 先尝试解析JSON格式的body
        const bodyData = JSON.parse(apiData.body);
        Object.entries(bodyData).forEach(([key, value]) => {
          params.push({
            name: key,
            type: typeof value,
            location: 'body',
            required: true,
            example: value
          });
        });
      } catch (e) {
        // 如果JSON解析失败，尝试解析表单数据
        try {
          if (typeof apiData.body === 'string') {
            // 解析 application/x-www-form-urlencoded 格式
            const searchParams = new URLSearchParams(apiData.body);
            searchParams.forEach((value, key) => {
              params.push({
                name: key,
                type: 'string',
                location: 'form',
                required: true,
                example: value
              });
            });
          }
        } catch (formError) {
          // 如果都解析不了，添加原始body参数
          params.push({
            name: '_rawBody',
            type: 'raw',
            location: 'body',
            required: true,
            example: apiData.body
          });
        }
      }
    }

    return params;
  }

  /**
   * 生成响应模式
   */
  generateResponseSchema(apiData) {
    if (!apiData.responseBody) return null;

    try {
      const response = JSON.parse(apiData.responseBody);
      return this.inferSchema(response);
    } catch (e) {
      return { type: 'string' };
    }
  }

  /**
   * 推断数据模式
   */
  inferSchema(data) {
    if (Array.isArray(data)) {
      return {
        type: 'array',
        items: data.length > 0 ? this.inferSchema(data[0]) : {}
      };
    }

    if (typeof data === 'object' && data !== null) {
      const properties = {};
      Object.entries(data).forEach(([key, value]) => {
        properties[key] = this.inferSchema(value);
      });
      return { type: 'object', properties };
    }

    return { type: typeof data };
  }

  /**
   * 生成工具名称
   */
  generateToolName(apiData) {
    const urlParts = apiData.url.split('/').filter(Boolean);
    const lastPart = urlParts[urlParts.length - 1] || 'api';
    return `${apiData.method.toLowerCase()}_${lastPart.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取所有APIs
   */
  getAPIs() {
    return Array.from(this.apis.values());
  }

  /**
   * 获取所有工具
   */
  getTools() {
    return Array.from(this.tools.values());
  }

  /**
   * 通过ID获取API
   */
  getAPIById(id) {
    return this.apis.get(id);
  }

  /**
   * 通过ID获取工具
   */
  getToolById(id) {
    return this.tools.get(id);
  }

  /**
   * 删除API
   */
  deleteAPI(id) {
    const result = this.apis.delete(id);
    if (result) {
      this.saveToStorage();
    }
    return result;
  }

  /**
   * 删除工具
   */
  deleteTool(id) {
    const result = this.tools.delete(id);
    if (result) {
      this.saveToStorage();
    }
    return result;
  }

  /**
   * 搜索APIs
   */
  searchAPIs(query) {
    const lowerQuery = query.toLowerCase();
    return this.getAPIs().filter(api => 
      api.url.toLowerCase().includes(lowerQuery) ||
      api.method.toLowerCase().includes(lowerQuery) ||
      (api.description && api.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 搜索工具
   */
  searchTools(query) {
    const lowerQuery = query.toLowerCase();
    return this.getTools().filter(tool =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery)
    );
  }
}

export default APIService;