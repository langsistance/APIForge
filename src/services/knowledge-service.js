/**
 * 知识库服务层 - 处理知识库相关的业务逻辑
 */

class KnowledgeService {
  constructor(storageUtil, apiService) {
    this.storageUtil = storageUtil;
    this.apiService = apiService;
    this.knowledgeBase = new Map();
    this.embeddings = new Map();
  }

  /**
   * 初始化服务
   */
  async init() {
    console.log('Initializing Knowledge Service...');
    this.loadFromStorage();
  }

  /**
   * 从存储加载数据
   */
  loadFromStorage() {
    const data = this.storageUtil.get('knowledge', []);
    data.forEach(item => {
      this.knowledgeBase.set(item.id, item);
    });

    const embeddings = this.storageUtil.get('embeddings', []);
    embeddings.forEach(item => {
      this.embeddings.set(item.id, item);
    });
  }

  /**
   * 保存到存储
   */
  saveToStorage() {
    this.storageUtil.set('knowledge', Array.from(this.knowledgeBase.values()));
    this.storageUtil.set('embeddings', Array.from(this.embeddings.values()));
  }

  /**
   * 创建知识条目
   */
  async createKnowledgeItem(data) {
    const item = {
      id: this.generateId(),
      title: data.title,
      content: data.content,
      type: data.type || 'text',
      source: data.source,
      metadata: data.metadata || {},
      tags: data.tags || [],
      relatedAPIs: data.relatedAPIs || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 生成嵌入向量（如果有AI服务）
    if (data.generateEmbedding) {
      const embedding = await this.generateEmbedding(item.content);
      if (embedding) {
        this.embeddings.set(item.id, embedding);
      }
    }

    this.knowledgeBase.set(item.id, item);
    this.saveToStorage();
    return item;
  }

  /**
   * 从API生成知识
   */
  async createFromAPI(apiId, options = {}) {
    const api = this.apiService.getAPIById(apiId);
    if (!api) {
      throw new Error(`API with id ${apiId} not found`);
    }

    const knowledge = {
      title: options.title || `API: ${api.method} ${api.url}`,
      content: this.formatAPIContent(api),
      type: 'api',
      source: api.url,
      metadata: {
        method: api.method,
        statusCode: api.statusCode,
        contentType: api.contentType
      },
      relatedAPIs: [apiId],
      tags: this.extractTags(api)
    };

    return await this.createKnowledgeItem(knowledge);
  }

  /**
   * 格式化API内容
   */
  formatAPIContent(api) {
    let content = `# ${api.method} ${api.url}\n\n`;
    
    if (api.description) {
      content += `## Description\n${api.description}\n\n`;
    }

    if (api.headers && Object.keys(api.headers).length > 0) {
      content += `## Headers\n\`\`\`json\n${JSON.stringify(api.headers, null, 2)}\n\`\`\`\n\n`;
    }

    if (api.body) {
      content += `## Request Body\n\`\`\`json\n${api.body}\n\`\`\`\n\n`;
    }

    if (api.responseBody) {
      content += `## Response\n\`\`\`json\n${JSON.stringify(api.responseBody, null, 2)}\n\`\`\`\n\n`;
    }

    return content;
  }

  /**
   * 提取标签
   */
  extractTags(api) {
    const tags = [];
    
    // 从URL提取
    const urlParts = api.url.split('/').filter(Boolean);
    urlParts.forEach(part => {
      if (!part.includes('.') && !part.includes('?') && part.length > 2) {
        tags.push(part.toLowerCase());
      }
    });

    // 添加方法标签
    tags.push(api.method.toLowerCase());

    // 添加内容类型标签
    if (api.contentType) {
      if (api.contentType.includes('json')) tags.push('json');
      if (api.contentType.includes('xml')) tags.push('xml');
      if (api.contentType.includes('html')) tags.push('html');
    }

    return [...new Set(tags)]; // 去重
  }

  /**
   * 搜索知识库
   */
  async search(query, options = {}) {
    const { limit = 10, useEmbedding = false } = options;

    if (useEmbedding && this.embeddings.size > 0) {
      return await this.semanticSearch(query, limit);
    }

    return this.keywordSearch(query, limit);
  }

  /**
   * 关键词搜索
   */
  keywordSearch(query, limit) {
    const lowerQuery = query.toLowerCase();
    const results = [];

    this.knowledgeBase.forEach(item => {
      let score = 0;

      // 标题匹配
      if (item.title.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }

      // 内容匹配
      const contentMatches = (item.content.toLowerCase().match(new RegExp(lowerQuery, 'g')) || []).length;
      score += contentMatches * 2;

      // 标签匹配
      item.tags.forEach(tag => {
        if (tag.includes(lowerQuery)) {
          score += 5;
        }
      });

      if (score > 0) {
        results.push({ ...item, score });
      }
    });

    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, limit);
  }

  /**
   * 语义搜索（需要嵌入向量）
   */
  async semanticSearch(query, limit) {
    // TODO: 实现基于向量的语义搜索
    // 需要集成向量数据库或计算相似度
    console.log('Semantic search not yet implemented, falling back to keyword search');
    return this.keywordSearch(query, limit);
  }

  /**
   * 生成嵌入向量
   */
  async generateEmbedding(text) {
    // TODO: 集成AI服务生成嵌入向量
    // 例如使用OpenAI的Embeddings API
    console.log('Embedding generation not yet implemented');
    return null;
  }

  /**
   * 更新知识条目
   */
  updateKnowledgeItem(id, updates) {
    const item = this.knowledgeBase.get(id);
    if (!item) {
      throw new Error(`Knowledge item with id ${id} not found`);
    }

    const updatedItem = {
      ...item,
      ...updates,
      id: item.id, // 保持ID不变
      createdAt: item.createdAt, // 保持创建时间不变
      updatedAt: new Date().toISOString()
    };

    this.knowledgeBase.set(id, updatedItem);
    this.saveToStorage();
    return updatedItem;
  }

  /**
   * 删除知识条目
   */
  deleteKnowledgeItem(id) {
    const result = this.knowledgeBase.delete(id);
    if (result) {
      this.embeddings.delete(id); // 同时删除嵌入向量
      this.saveToStorage();
    }
    return result;
  }

  /**
   * 获取所有知识条目
   */
  getAllKnowledge() {
    return Array.from(this.knowledgeBase.values());
  }

  /**
   * 通过ID获取知识条目
   */
  getKnowledgeById(id) {
    return this.knowledgeBase.get(id);
  }

  /**
   * 获取相关知识
   */
  getRelatedKnowledge(id, limit = 5) {
    const item = this.knowledgeBase.get(id);
    if (!item) return [];

    const related = [];
    
    // 基于标签查找相关内容
    this.knowledgeBase.forEach((otherItem, otherId) => {
      if (otherId === id) return;

      const commonTags = item.tags.filter(tag => otherItem.tags.includes(tag));
      if (commonTags.length > 0) {
        related.push({
          ...otherItem,
          relevanceScore: commonTags.length
        });
      }
    });

    // 按相关性排序
    related.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return related.slice(0, limit);
  }

  /**
   * 生成唯一ID
   */
  generateId() {
    return `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 导出知识库
   */
  exportKnowledge(format = 'json') {
    const data = this.getAllKnowledge();
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'markdown') {
      return this.exportAsMarkdown(data);
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * 导出为Markdown格式
   */
  exportAsMarkdown(data) {
    let markdown = '# Knowledge Base Export\n\n';
    
    data.forEach(item => {
      markdown += `## ${item.title}\n\n`;
      markdown += `**Created:** ${item.createdAt}\n`;
      markdown += `**Tags:** ${item.tags.join(', ')}\n\n`;
      markdown += `${item.content}\n\n`;
      markdown += '---\n\n';
    });
    
    return markdown;
  }

  /**
   * 导入知识库
   */
  importKnowledge(data, format = 'json') {
    let items = [];
    
    if (format === 'json') {
      items = JSON.parse(data);
    } else {
      throw new Error(`Unsupported import format: ${format}`);
    }

    items.forEach(item => {
      this.knowledgeBase.set(item.id || this.generateId(), item);
    });

    this.saveToStorage();
    return items.length;
  }
}

export default KnowledgeService;