/**
 * WebSight远程API客户端
 * 负责与远程服务器通信
 */

import authService from "./auth-service.js";
import { CONFIG } from "../utils/config.js";

class WebSightAPIClient {
  constructor() {
    this.baseURL = "http://52.53.129.41:7777";
    this.defaultTimeout = 30000;
    this.pollingInterval = CONFIG.CHAT.POLL_INTERVAL; // 使用配置文件中的轮询间隔
    this.maxPollingAttempts = CONFIG.CHAT.MAX_POLL_ATTEMPTS; // 使用配置文件中的最大轮询次数
  }

  /**
   * 发送HTTP请求
   */
  async request(method, endpoint, data = null, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const fetchOptions = {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-APIForge-Request": "true", // 标识我们自己的请求
        ...authService.getAuthHeaders(), // 添加认证请求头
        ...options.headers,
      },
      timeout: options.timeout || this.defaultTimeout,
    };

    if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
      fetchOptions.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, fetchOptions);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || `HTTP ${response.status}`);
      }

      return responseData;
    } catch (error) {
      console.error(`API request failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * 创建工具和知识
   */
  async createToolAndKnowledge(data) {
    const payload = {
      tool_userId: data.userId,
      tool_title: data.toolTitle,
      tool_description: data.toolDescription,
      tool_url: data.toolUrl,
      tool_push: data.toolPush || 1,
      tool_public: data.toolPublic ? "1" : "2",
      tool_timeout: data.toolTimeout || 30,
      tool_params:
        typeof data.toolParams === "object"
          ? JSON.stringify(data.toolParams)
          : data.toolParams,

      knowledge_userId: data.userId,
      knowledge_question: data.knowledgeQuestion,
      knowledge_description: data.knowledgeDescription,
      knowledge_answer: data.knowledgeAnswer,
      knowledge_public: data.knowledgePublic ? "1" : "2",
      knowledge_embeddingId: data.embeddingId || 1,
      knowledge_model_name: data.modelName || "gpt-3.5-turbo",
      knowledge_params:
        typeof data.knowledgeParams === "object"
          ? JSON.stringify(data.knowledgeParams)
          : data.knowledgeParams,
    };

    const result = await this.request(
      "POST",
      "/create_tool_and_knowledge",
      payload
    );

    return {
      success: result.success,
      toolId: result.tool_id,
      knowledgeId: result.knowledge_id,
      message: result.message,
    };
  }

  /**
   * 创建知识条目
   */
  async createKnowledge(data) {
    const payload = {
      userId: data.userId,
      question: data.question,
      description: data.description,
      answer: data.answer,
      public: data.public ? "1" : "2",
      embeddingId: data.embeddingId || 1,
      modelName: data.modelName || "gpt-3.5-turbo",
      toolId: data.toolId,
      params:
        typeof data.params === "object"
          ? JSON.stringify(data.params)
          : data.params || "{}",
    };

    const result = await this.request("POST", "/create_knowledge", payload);

    return {
      success: result.success,
      knowledge_id: result.knowledge_id,
      message: result.message,
    };
  }

  /**
   * 查询工具
   */
  async queryTools(userId, query, limit = 10, offset = 0) {
    const params = new URLSearchParams({
      userId,
      query: query || "",
      limit,
      offset,
    });

    const result = await this.request("GET", `/query_tools?${params}`);

    return {
      success: result.success,
      tools: result.data || [],
      total: result.total || 0,
      message: result.message,
    };
  }

  /**
   * 查询知识库
   */
  async queryKnowledge(userId, query, limit = 10, offset = 0) {
    const params = new URLSearchParams({
      userId,
      query: query || "",
      limit,
      offset,
    });

    const result = await this.request("GET", `/query_knowledge?${params}`);

    return {
      success: result.success,
      knowledge: result.data || [],
      total: result.total || 0,
      message: result.message,
    };
  }

  /**
   * 查找相关知识和工具
   */
  async findKnowledgeTool(
    userId,
    question,
    topK = 3,
    similarityThreshold = 0.5
  ) {
    // 如果启用了mock，返回mock数据
    if (CONFIG.DEV.MOCK_GET_TOOL_REQUEST) {
      console.log("🔍 [MOCK] 使用mock数据 - find_knowledge_tool");

      // 模拟延迟
      await this.sleep(500);

      return {
        success: true,
        message: "Knowledge and tool found successfully",
        knowledge: {
          userId: "11111111",
        },
        tool: {
          id: 1,
          title: "get_langchain_discussion_count",
          description:
            "通过GET方法调用https://www.github.com/search/count?q=langchain&type=discussions的API工具",
          url: "https://github.com/search/count?q=langchain&type=discussions",
        },
      };
    }

    const payload = {
      userId,
      question,
      top_k: topK,
      similarity_threshold: similarityThreshold,
    };

    return await this.request("POST", "/find_knowledge_tool", payload);
  }

  /**
   * 发送查询请求
   */
  async sendQuery(query, queryId) {
    const payload = {
      query,
      query_id: queryId || this.generateQueryId(),
    };

    const result = await this.request("POST", "/query", payload);

    console.log("sendQuery 原始响应:", result);

    return {
      success: result.success !== false,
      queryId: payload.query_id,
      uid: result.uid,
      status: result.status,
      answer: result.answer,
      reasoning: result.reasoning,
      agentName: result.agent_name,
      done: result.done === "true" || result.done === true,
    };
  }

  /**
   * 发送非阻塞查询请求（用于启动查询流程）
   */
  async sendQueryNonBlocking(query, queryId) {
    console.log("🔥 [DEBUG] 进入 sendQueryNonBlocking");

    const payload = {
      query,
      query_id: queryId || this.generateQueryId(),
    };

    console.log("🔥 [DEBUG] 发送非阻塞查询请求:", payload);

    // 发送请求但不等待响应（因为服务器会hold住）
    console.log("🔥 [DEBUG] 开始发送 fetch 请求...");
    fetch(`${this.baseURL}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-APIForge-Request": "true",
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    }).catch((error) => {
      console.error("🔥 [DEBUG] 非阻塞查询请求失败:", error);
    });

    console.log("🔥 [DEBUG] fetch 请求已发送，立即返回");
    return {
      success: true,
      queryId: payload.query_id,
    };
  }

  /**
   * 获取查询状态（不发送新查询）
   */
  async getQueryStatus(queryId) {
    const params = new URLSearchParams({
      query_id: queryId,
    });

    const result = await this.request("GET", `/query_status?${params}`);

    return {
      success: result.success !== false,
      queryId: queryId,
      uid: result.uid,
      status: result.status,
      answer: result.answer,
      reasoning: result.reasoning,
      agentName: result.agent_name,
      done: result.done === "true" || result.done === true,
    };
  }

  /**
   * 获取工具请求（轮询用）
   */
  async getToolRequest(userId, queryId) {
    // 如果启用了mock，直接返回mock数据
    if (CONFIG.DEV.MOCK_GET_TOOL_REQUEST) {
      console.log("使用mock数据 - get_tool_request");

      // 模拟延迟，让轮询看起来更真实
      await this.sleep(1000);

      // 返回mock数据
      return {
        success: true,
        message: "Tool retrieved successfully",
        tool_request: true, // 表示有工具请求
        tool: {
          origin_params: {
            method: "GET",
            contentType: "application/json",
          },
        },
      };
    }

    const payload = {
      userId,
      query_id: queryId,
    };

    try {
      return await this.request("POST", "/get_tool_request", payload);
    } catch (error) {
      console.error("get_tool_request 接口调用失败:", error.message);
      // 直接抛出错误，不使用fallback mock
      throw error;
    }
  }

  /**
   * 保存工具响应
   */
  async saveToolResponse(userId, queryId, toolResponse) {
    const payload = {
      userId,
      query_id: queryId,
      tool_response: toolResponse,
    };

    return await this.request("POST", "/save_tool_response", payload);
  }

  /**
   * 轮询获取查询结果
   */
  async pollQueryResult(userId, queryId, onUpdate) {
    let attempts = 0;
    let lastStatus = null;
    let toolRequestProcessed = false; // 添加标志跟踪工具请求是否已处理

    const poll = async () => {
      if (attempts >= this.maxPollingAttempts) {
        throw new Error("Polling timeout: No response received");
      }

      attempts++;

      try {
        // 只在未处理工具请求时才检查
        if (!toolRequestProcessed) {
          // 尝试获取工具请求
          console.log(`[轮询 ${attempts}] 获取工具请求:`, { userId, queryId });
          const toolRequest = await this.getToolRequest(userId, queryId);
          console.log(`[轮询 ${attempts}] 工具请求结果:`, toolRequest);

          if (toolRequest.success && toolRequest.tool) {
            // 有工具请求需要处理
            console.log(`[轮询 ${attempts}] 发现工具请求，触发回调`);
            toolRequestProcessed = true; // 标记为已处理

            if (onUpdate) {
              onUpdate({
                type: "tool_request",
                data: toolRequest,
              });
            }

            // 工具请求已触发，停止轮询，等待原始query接口返回最终结果
            console.log(
              `[轮询 ${attempts}] 工具请求已处理，停止轮询，等待query接口返回最终结果`
            );
            return {
              success: true,
              message: "工具请求已处理，等待最终结果",
            };
          }
        }

        // 工具请求未处理时，继续轮询
        console.log(`[轮询 ${attempts}] 工具请求未处理，继续轮询`);
        await this.sleep(this.pollingInterval);
        return await poll();
      } catch (error) {
        console.error(`[轮询 ${attempts}] 轮询出错:`, error.message);

        // 如果是404错误，说明还没有工具请求，这是正常情况，继续轮询
        if (error.message && error.message.includes("404")) {
          console.log(`[轮询 ${attempts}] 404错误，继续轮询等待工具请求`);
          await this.sleep(this.pollingInterval);
          return await poll();
        }

        // 其他错误也继续轮询，直到达到最大次数
        console.log(`[轮询 ${attempts}] 出现错误但继续轮询:`, error.message);
        await this.sleep(this.pollingInterval);
        return await poll();
      }
    };

    return await poll();
  }

  /**
   * 更新工具
   */
  async updateTool(userId, toolId, updates) {
    const payload = {
      userId,
      toolId: String(toolId),
      title: updates.title,
      description: updates.description,
      public: updates.public ? "1" : "2",
    };

    return await this.request("POST", "/update_tool", payload);
  }

  /**
   * 删除工具
   */
  async deleteTool(userId, toolId) {
    const payload = {
      userId,
      toolId: String(toolId),
    };

    return await this.request("POST", "/delete_tool", payload);
  }

  /**
   * 更新知识
   */
  async updateKnowledge(userId, knowledgeId, updates) {
    const payload = {
      userId,
      knowledgeId: String(knowledgeId),
      question: updates.question,
      answer: updates.answer,
      description: updates.description,
    };

    return await this.request("POST", "/update_knowledge", payload);
  }

  /**
   * 删除知识
   */
  async deleteKnowledge(userId, knowledgeId) {
    const payload = {
      userId,
      knowledgeId: String(knowledgeId),
    };

    return await this.request("POST", "/delete_knowledge", payload);
  }

  /**
   * 执行工具调用
   */
  async executeTool(toolData, params) {
    try {
      // 解析工具URL和参数
      const url = new URL(toolData.url);

      // 构建请求
      const response = await fetch(toolData.url, {
        method: "GET", // 可以根据工具配置调整
        headers: {
          Accept: "application/json",
        },
        timeout: (toolData.timeout || 30) * 1000,
      });

      const data = await response.json();

      return {
        success: true,
        data,
        statusCode: response.status,
      };
    } catch (error) {
      console.error("Tool execution failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 生成查询ID
   */
  generateQueryId() {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 睡眠函数
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 批量创建工具和知识
   */
  async batchCreateToolsAndKnowledge(userId, items) {
    const results = [];

    for (const item of items) {
      try {
        const result = await this.createToolAndKnowledge({
          userId,
          ...item,
        });
        results.push(result);

        // 避免触发频率限制
        await this.sleep(500);
      } catch (error) {
        console.error("Failed to create tool and knowledge:", error);
        results.push({
          success: false,
          error: error.message,
          item,
        });
      }
    }

    return results;
  }

  /**
   * 搜索并执行工具
   */
  async searchAndExecuteTool(userId, query, params) {
    try {
      // 1. 搜索相关工具
      const searchResult = await this.findKnowledgeTool(userId, query);

      if (
        !searchResult.success ||
        !searchResult.tools ||
        searchResult.tools.length === 0
      ) {
        return {
          success: false,
          message: "No matching tools found",
        };
      }

      // 2. 使用第一个匹配的工具
      const tool = searchResult.tools[0];

      // 3. 执行工具
      const executionResult = await this.executeTool(tool, params);

      return {
        success: executionResult.success,
        tool,
        result: executionResult.data,
        error: executionResult.error,
      };
    } catch (error) {
      console.error("Search and execute tool failed:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// 创建单例实例
const apiClient = new WebSightAPIClient();

export default apiClient;
export { WebSightAPIClient };
