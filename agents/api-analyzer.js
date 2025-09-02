const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { StateGraph } = require('@langchain/langgraph');
const { HumanMessage } = require('@langchain/core/messages');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');

// API分析结果的数据结构
const APIAnalysisSchema = z.object({
  name: z.string().describe("API名称，简洁描述功能"),
  description: z.string().describe("API功能详细描述"),
  category: z.string().describe("API分类（如：用户管理、支付、数据查询等）"),
  purpose: z.string().describe("API用途和业务场景"),
  parameters: z.object({
    path: z.record(z.any()).describe("路径参数"),
    query: z.record(z.any()).describe("查询参数"),
    headers: z.record(z.any()).describe("请求头参数"),
    body: z.record(z.any()).describe("请求体参数")
  }),
  response: z.object({
    structure: z.record(z.any()).describe("响应数据结构"),
    fields: z.record(z.string()).describe("响应字段说明")
  }),
  examples: z.object({
    request: z.any().describe("请求示例"),
    response: z.any().describe("响应示例")
  }),
  usage: z.string().describe("在聊天中如何使用这个API")
});

class APIAnalyzer {
  constructor(apiKey, baseURL) {
    this.llm = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash",
      temperature: 0.1,
      apiKey: apiKey,
      maxOutputTokens: 4000,
    });
    
    this.analysisPrompt = ChatPromptTemplate.fromTemplate(`
你是一个专业的API分析专家。请分析以下API调用信息，并生成详细的API文档。

**API调用信息：**
- URL: {url}
- Method: {method}
- Headers: {headers}
- Request Body: {requestBody}
- Response Status: {responseStatus}
- Response Headers: {responseHeaders}
- Response Body: {responseBody}

**分析要求：**
1. 根据URL路径、请求参数和响应数据，推断API的功能和用途
2. 分析参数结构和数据类型
3. 理解响应数据的含义和结构
4. 预测这个API在实际应用中的使用场景
5. 生成易懂的API文档

请以JSON格式返回分析结果，包含以下字段：
- name: API名称（简洁描述功能）
- description: API功能详细描述
- category: API分类（如：用户管理、支付、数据查询等）
- purpose: API用途和业务场景
- parameters: 参数信息（path, query, headers, body）
- response: 响应信息（structure, fields）
- examples: 示例（request, response）
- usage: 在聊天中如何使用这个API

确保分析准确、实用，便于后续的智能调用。
    `);
  }

  // 定义Agent状态
  createState() {
    return {
      apiData: null,
      analysis: null,
      error: null,
      step: 'init'
    };
  }

  // 分析API的节点
  async analyzeAPI(state) {
    try {
      const { apiData } = state;
      
      // 构造分析提示
      const prompt = await this.analysisPrompt.format({
        url: apiData.url,
        method: apiData.method,
        headers: JSON.stringify(apiData.headers || {}, null, 2),
        requestBody: apiData.body ? JSON.stringify(apiData.body, null, 2) : 'None',
        responseStatus: apiData.statusCode || 'Unknown',
        responseHeaders: JSON.stringify(apiData.responseHeaders || {}, null, 2),
        responseBody: apiData.responseBody ? JSON.stringify(apiData.responseBody, null, 2) : 'None'
      });

      // 调用LLM进行分析
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      
      // 尝试解析JSON响应
      let analysis;
      try {
        const content = response.content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        analysis = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', parseError);
        // 如果JSON解析失败，创建基本的分析结果
        analysis = {
          name: this.extractAPIName(apiData.url),
          description: `API endpoint: ${apiData.method} ${apiData.url}`,
          category: 'Unknown',
          purpose: 'API functionality analysis failed',
          parameters: {
            path: {},
            query: {},
            headers: apiData.headers || {},
            body: apiData.body || {}
          },
          response: {
            structure: apiData.responseBody || {},
            fields: {}
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
          usage: `Call ${apiData.method} ${apiData.url} API`
        };
      }

      return {
        ...state,
        analysis,
        step: 'completed'
      };
    } catch (error) {
      console.error('API analysis error:', error);
      return {
        ...state,
        error: error.message,
        step: 'error'
      };
    }
  }

  // 从URL中提取API名称
  extractAPIName(url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      
      if (pathParts.length === 0) return 'Root API';
      
      // 取最后一个有意义的路径部分
      const lastPart = pathParts[pathParts.length - 1];
      
      // 如果是数字ID，取倒数第二个部分
      if (/^\d+$/.test(lastPart) && pathParts.length > 1) {
        return this.formatAPIName(pathParts[pathParts.length - 2]);
      }
      
      return this.formatAPIName(lastPart);
    } catch (error) {
      return 'Unknown API';
    }
  }

  // 格式化API名称
  formatAPIName(name) {
    return name
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' API';
  }

  // 创建LangGraph工作流
  createWorkflow() {
    const workflow = new StateGraph({
      channels: this.createState()
    });

    // 添加节点
    workflow.addNode("analyze", this.analyzeAPI.bind(this));
    
    // 添加边
    workflow.addEdge("__start__", "analyze");
    workflow.addEdge("analyze", "__end__");
    
    return workflow.compile();
  }

  // 分析API的主方法
  async analyze(apiData) {
    try {
      const workflow = this.createWorkflow();
      
      const result = await workflow.invoke({
        apiData,
        analysis: null,
        error: null,
        step: 'init'
      });

      return result.analysis;
    } catch (error) {
      console.error('Workflow execution error:', error);
      throw error;
    }
  }
}

module.exports = { APIAnalyzer };