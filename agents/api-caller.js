const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { StateGraph } = require('@langchain/langgraph');
const { HumanMessage } = require('@langchain/core/messages');
const axios = require('axios');
const { KnowledgeBase } = require('./knowledge-base');

class APICaller {
  constructor(apiKey, baseURL, authManager = null) {
    this.llm = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      temperature: 0.1,
      apiKey: apiKey,
      maxOutputTokens: 4000,
    });
    
    this.knowledgeBase = new KnowledgeBase();
    this.authManager = authManager;
    
    // 用于理解用户意图和匹配API的提示模板
    this.intentPrompt = ChatPromptTemplate.fromTemplate(`
你是一个智能API助手。用户询问了一个问题，请分析用户的意图并从可用的API中选择最合适的来回答用户的问题。

用户问题: {userQuestion}

可用的API列表:
{apiList}

请分析用户意图并返回JSON格式的响应：
{{
  "intent": "用户意图描述",
  "selectedAPI": {{
    "id": "选中的API ID",
    "name": "API名称",
    "reason": "选择这个API的理由"
  }},
  "parameters": {{
    "需要的参数名": "参数值或从用户问题中提取的值"
  }},
  "needsUserInput": false,
  "missingParams": []
}}

如果没有合适的API，请设置selectedAPI为null。
如果需要用户提供更多参数，请设置needsUserInput为true，并在missingParams中列出缺少的参数。
    `);

    // 用于解释API响应的提示模板  
    this.responsePrompt = ChatPromptTemplate.fromTemplate(`
用户询问: {userQuestion}
API调用结果: {apiResponse}
API名称: {apiName}
API描述: {apiDescription}

请将API的响应结果转换为对用户友好的回答。要求：
1. 用自然语言回答用户的问题
2. 如果有具体的数据，请清晰地展示
3. 如果是错误响应，请友好地解释问题
4. 保持回答简洁明了

回答:
    `);
  }

  // 创建Agent状态
  createState() {
    return {
      userQuestion: '',
      availableAPIs: [],
      selectedAPI: null,
      parameters: {},
      apiResponse: null,
      finalAnswer: '',
      error: null,
      step: 'init'
    };
  }

  // 理解用户意图并选择API
  async analyzeIntent(state) {
    try {
      const { userQuestion, availableAPIs } = state;
      
      if (!availableAPIs || availableAPIs.length === 0) {
        return {
          ...state,
          error: '没有可用的API来处理您的请求。',
          step: 'error'
        };
      }

      // 格式化API列表用于提示
      const apiListText = availableAPIs.map(api => 
        `ID: ${api.id}
名称: ${api.name}
描述: ${api.description}
分类: ${api.category}
用途: ${api.purpose}
方法: ${api.method} ${api.url}
`
      ).join('\n---\n');

      const prompt = await this.intentPrompt.format({
        userQuestion,
        apiList: apiListText
      });

      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      
      let analysis;
      try {
        const content = response.content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        analysis = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse intent analysis:', parseError);
        return {
          ...state,
          error: '无法理解您的请求，请尝试更具体的描述。',
          step: 'error'
        };
      }

      if (!analysis.selectedAPI) {
        return {
          ...state,
          error: '很抱歉，我找不到合适的API来处理您的请求。',
          step: 'error'
        };
      }

      // 查找选中的API
      const selectedAPI = availableAPIs.find(api => api.id === analysis.selectedAPI.id);
      if (!selectedAPI) {
        return {
          ...state,
          error: '选中的API不存在。',
          step: 'error'
        };
      }

      if (analysis.needsUserInput) {
        return {
          ...state,
          selectedAPI,
          error: `需要更多信息来调用API: ${analysis.missingParams.join(', ')}`,
          step: 'needs_input'
        };
      }

      return {
        ...state,
        selectedAPI,
        parameters: analysis.parameters || {},
        step: 'call_api'
      };

    } catch (error) {
      console.error('Intent analysis error:', error);
      return {
        ...state,
        error: error.message,
        step: 'error'
      };
    }
  }

  // 调用API
  async callAPI(state) {
    try {
      const { selectedAPI, parameters } = state;
      
      if (!selectedAPI) {
        return {
          ...state,
          error: '没有选中的API',
          step: 'error'
        };
      }

      // 构建API请求
      const requestConfig = {
        method: selectedAPI.method.toLowerCase(),
        url: selectedAPI.url,
        timeout: 10000
      };

      // 处理参数
      if (selectedAPI.method.toLowerCase() === 'get') {
        if (parameters && Object.keys(parameters).length > 0) {
          requestConfig.params = parameters;
        }
      } else {
        if (parameters && Object.keys(parameters).length > 0) {
          requestConfig.data = parameters;
        }
      }

      // 添加必要的头信息
      requestConfig.headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'AI API Assistant'
      };

      // 如果有授权管理器，尝试获取授权信息
      if (this.authManager) {
        try {
          const apiUrl = new URL(selectedAPI.url);
          const domain = apiUrl.hostname;
          
          // 检查token是否过期
          const expirationStatus = this.authManager.checkTokenExpiration(domain);
          if (expirationStatus && expirationStatus.isExpired) {
            console.warn(`Token for ${domain} is expired, attempting refresh...`);
            await this.authManager.tryRefreshToken(domain);
          }
          
          // 获取授权头信息
          const authHeaders = this.authManager.getAuthHeaders(domain);
          const authCookies = this.authManager.getAuthCookies(domain);
          
          // 合并授权头
          Object.assign(requestConfig.headers, authHeaders);
          
          // 添加Cookies
          if (authCookies) {
            requestConfig.headers.Cookie = authCookies;
          }
          
          console.log(`Added auth info for ${domain}:`, {
            hasAuthHeaders: Object.keys(authHeaders).length > 0,
            hasCookies: !!authCookies
          });
          
        } catch (authError) {
          console.warn('Failed to apply auth info:', authError.message);
        }
      }

      // 如果API文档中有示例头信息，尝试使用
      if (selectedAPI.examples && selectedAPI.examples.request && selectedAPI.examples.request.headers) {
        const exampleHeaders = selectedAPI.examples.request.headers;
        // 复制一些重要的头信息，但不复制敏感信息
        ['Authorization', 'X-API-Key', 'Accept'].forEach(headerName => {
          if (exampleHeaders[headerName] && !exampleHeaders[headerName].includes('Bearer')) {
            requestConfig.headers[headerName] = exampleHeaders[headerName];
          }
        });
      }

      console.log('Calling API:', requestConfig);

      // 发起API请求
      const response = await axios(requestConfig);

      // 记录成功的API调用
      await this.knowledgeBase.recordAPICall(
        selectedAPI.id,
        { method: selectedAPI.method, url: selectedAPI.url, params: parameters },
        response.data,
        response.status,
        true
      );

      return {
        ...state,
        apiResponse: {
          success: true,
          status: response.status,
          data: response.data,
          headers: response.headers
        },
        step: 'format_response'
      };

    } catch (error) {
      console.error('API call error:', error);
      
      // 记录失败的API调用
      if (state.selectedAPI) {
        await this.knowledgeBase.recordAPICall(
          state.selectedAPI.id,
          { method: state.selectedAPI.method, url: state.selectedAPI.url, params: state.parameters },
          null,
          error.response?.status || 0,
          false,
          error.message
        );
      }

      return {
        ...state,
        apiResponse: {
          success: false,
          error: error.message,
          status: error.response?.status || 0,
          data: error.response?.data || null
        },
        step: 'format_response'
      };
    }
  }

  // 格式化API响应为用户友好的回答
  async formatResponse(state) {
    try {
      const { userQuestion, selectedAPI, apiResponse } = state;

      const prompt = await this.responsePrompt.format({
        userQuestion,
        apiResponse: JSON.stringify(apiResponse, null, 2),
        apiName: selectedAPI.name,
        apiDescription: selectedAPI.description
      });

      const response = await this.llm.invoke([new HumanMessage(prompt)]);

      return {
        ...state,
        finalAnswer: response.content,
        step: 'completed'
      };

    } catch (error) {
      console.error('Response formatting error:', error);
      
      // 如果格式化失败，返回原始API响应
      let fallbackAnswer;
      if (state.apiResponse.success) {
        fallbackAnswer = `API调用成功！\n结果：${JSON.stringify(state.apiResponse.data, null, 2)}`;
      } else {
        fallbackAnswer = `API调用失败：${state.apiResponse.error}`;
      }

      return {
        ...state,
        finalAnswer: fallbackAnswer,
        step: 'completed'
      };
    }
  }

  // 创建LangGraph工作流
  createWorkflow() {
    const workflow = new StateGraph({
      channels: this.createState()
    });

    // 添加节点
    workflow.addNode("analyze_intent", this.analyzeIntent.bind(this));
    workflow.addNode("call_api", this.callAPI.bind(this));
    workflow.addNode("format_response", this.formatResponse.bind(this));
    
    // 添加条件边
    workflow.addEdge("__start__", "analyze_intent");
    
    workflow.addConditionalEdges(
      "analyze_intent",
      (state) => state.step,
      {
        "call_api": "call_api",
        "error": "__end__",
        "needs_input": "__end__"
      }
    );
    
    workflow.addEdge("call_api", "format_response");
    workflow.addEdge("format_response", "__end__");
    
    return workflow.compile();
  }

  // 处理用户问题的主方法
  async handleUserQuestion(userQuestion, searchQuery = null) {
    try {
      // 搜索相关的API
      const query = searchQuery || this.extractKeywordsFromQuestion(userQuestion);
      const availableAPIs = await this.knowledgeBase.searchAPIs(query, 5);

      if (availableAPIs.length === 0) {
        return {
          success: false,
          answer: '很抱歉，我没有找到相关的API来处理您的请求。请确保已经拦截并分析了相关的API。',
          apis: []
        };
      }

      const workflow = this.createWorkflow();
      
      const result = await workflow.invoke({
        userQuestion,
        availableAPIs,
        selectedAPI: null,
        parameters: {},
        apiResponse: null,
        finalAnswer: '',
        error: null,
        step: 'init'
      });

      if (result.error) {
        return {
          success: false,
          answer: result.error,
          apis: availableAPIs
        };
      }

      return {
        success: true,
        answer: result.finalAnswer,
        selectedAPI: result.selectedAPI,
        apiResponse: result.apiResponse,
        apis: availableAPIs
      };

    } catch (error) {
      console.error('Handle user question error:', error);
      return {
        success: false,
        answer: `处理您的请求时发生错误: ${error.message}`,
        apis: []
      };
    }
  }

  // 从用户问题中提取关键词
  extractKeywordsFromQuestion(question) {
    // 简单的关键词提取，实际应用中可以使用更复杂的NLP技术
    const keywords = question
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留中文和英文字母数字
      .split(/\s+/)
      .filter(word => word.length > 1)
      .filter(word => !['我', '的', '是', '有', '这', '那', '什么', 'what', 'how', 'is', 'my', 'the', 'a', 'an'].includes(word));

    return keywords.join(' ') || question;
  }
}

module.exports = { APICaller };