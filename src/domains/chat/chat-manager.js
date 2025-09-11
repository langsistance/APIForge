/**
 * 聊天管理器 - 集成远程服务、轮询机制和状态管理
 */

import { CONFIG } from "../../utils/config.js";
import apiClient from "../../services/websight-api-client.js";
import authService from "../../services/auth-service.js";
import eventBus, { Events } from "../../shared/event-bus.js";

export class ChatManager {
  constructor(uiManager, apiManager, knowledgeManager) {
    this.uiManager = uiManager;
    this.apiManager = apiManager;
    this.knowledgeManager = knowledgeManager;
    this.apiClient = apiClient;
    this.authService = authService;
    this.chatHistory = [];
    // userId通过authService.getUserId()动态获取，不存储
    this.activeQueries = new Map(); // 跟踪活动的查询

    // 聊天状态管理
    this.isProcessing = false; // 是否正在处理消息
    this.currentQueryId = null; // 当前查询ID
    this.abortController = null; // 用于取消请求

    // UI元素
    this.chatMessages = null;
    this.chatInput = null;
    this.sendChatBtn = null;
    this.clearChatBtn = null;
  }

  async init() {
    this.initializeElements();
    this.setupEventListeners();
    this.showWelcomeMessage();
    console.log("✅ ChatManager 初始化完成");
  }

  initializeElements() {
    this.chatMessages = document.getElementById("chatMessages");
    this.chatInput = document.getElementById("chatInput");
    this.sendChatBtn = document.getElementById("sendChatBtn");
    this.clearChatBtn = document.getElementById("clearChatBtn");
  }

  setupEventListeners() {
    this.sendChatBtn?.addEventListener("click", () => this.sendMessage());
    this.clearChatBtn?.addEventListener("click", () => this.clearChat());

    this.chatInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // 自动调整输入框高度
    this.chatInput?.addEventListener("input", () => {
      this.chatInput.style.height = "auto";
      this.chatInput.style.height = this.chatInput.scrollHeight + "px";
    });

    // 监听知识创建事件，更新本地缓存
    eventBus.on(Events.KNOWLEDGE_CREATED, () => {
      console.log("知识已创建，可能影响查询结果");
    });
  }

  showWelcomeMessage() {
    this.addChatMessage(
      "assistant",
      "👋 欢迎使用 APIForge 智能助手！\n\n" +
        "我可以帮助您：\n" +
        "• 🔍 查询知识库中的信息\n" +
        "• 🛠️ 调用已配置的工具获取数据\n" +
        "• 💡 回答技术相关问题\n\n" +
        "请输入您的问题，我会尽力帮助您！"
    );
  }

  async sendMessage() {
    // 如果正在处理中，则执行停止操作
    if (this.isProcessing) {
      this.stopCurrentQuery();
      return;
    }

    const message = this.chatInput?.value.trim();
    if (!message) return;

    // 显示用户消息
    this.addChatMessage("user", message);

    // 清空输入框
    this.chatInput.value = "";
    this.chatInput.style.height = "auto";

    // 设置处理状态
    this.isProcessing = true;
    this.setButtonState(false, "停止");

    try {
      // 处理消息
      await this.processChatMessage(message);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("处理消息时出错:", error);
        this.addChatMessage("assistant", "抱歉，处理您的请求时出现了错误。");
      }
    } finally {
      // 重置状态
      this.resetChatState();
    }
  }

  async processChatMessage(message) {
    console.log("处理聊天消息:", message);

    // 创建 AbortController 用于取消请求
    this.abortController = new AbortController();

    try {
      // 检查是否已被中断
      if (this.abortController.signal.aborted) {
        throw new Error("查询已被取消");
      }

      // 直接使用 find_knowledge_tool API，它会同时返回知识和工具
      const searchResult = await this.apiClient.findKnowledgeTool(
        this.authService.getUserId(),
        message,
        5, // top_k
        0.3 // similarity_threshold
      );

      console.log("🔍 [DEBUG] find_knowledge_tool 返回结果:", searchResult);
      console.log("🔍 [DEBUG] searchResult.success:", searchResult?.success);
      console.log("🔍 [DEBUG] searchResult.tools:", searchResult?.tools);
      console.log(
        "🔍 [DEBUG] searchResult.knowledge:",
        searchResult?.knowledge
      );

      // 再次检查是否已被中断
      if (this.abortController.signal.aborted) {
        throw new Error("查询已被取消");
      }

      if (searchResult && searchResult.success) {
        // 检查是否有知识库结果
        if (searchResult.knowledge && searchResult.knowledge.length > 0) {
          // 有知识库结果，直接返回
          const knowledge = searchResult.knowledge[0];
          this.addChatMessage(
            "assistant",
            `📚 从知识库中找到相关信息：\n\n**${knowledge.question}**\n\n${knowledge.answer}`
          );
          return;
        }

        // 检查是否有工具（处理单个tool和tools数组两种情况）
        let tools = [];
        if (searchResult.tools && searchResult.tools.length > 0) {
          tools = searchResult.tools;
        } else if (searchResult.tool) {
          // 如果返回的是单个tool对象，转换为数组
          tools = [searchResult.tool];
        }

        console.log("🔍 [DEBUG] 处理后的工具数组:", tools);

        if (tools.length > 0) {
          await this.handleToolBasedQuery(message, tools);
        } else {
          // 没有找到知识和工具，尝试直接发送查询
          await this.handleDirectQuery(message);
        }
      } else {
        // API调用失败，尝试直接发送查询
        await this.handleDirectQuery(message);
      }
    } catch (error) {
      if (
        error.message === "查询已被取消" ||
        this.abortController.signal.aborted
      ) {
        console.log("查询被用户取消");
        return; // 不显示错误消息，因为是用户主动取消
      }

      console.error("处理消息错误:", error);
      this.addChatMessage(
        "assistant",
        "抱歉，处理您的请求时出现了错误。\n" +
          `错误信息：${error.message}\n\n` +
          "您可以尝试：\n" +
          "1. 重新描述您的问题\n" +
          "2. 检查网络连接\n" +
          "3. 稍后再试"
      );
    }
  }

  async handleToolBasedQuery(message, tools) {
    console.log("🎯 [DEBUG] 进入 handleToolBasedQuery");

    this.addChatMessage(
      "assistant",
      `🔍 找到 ${tools.length} 个相关工具，正在为您查询...`
    );

    const queryId = this.apiClient.generateQueryId();
    this.currentQueryId = queryId; // 设置当前查询ID

    console.log("🎯 [DEBUG] 开始处理工具查询:", {
      queryId,
      message,
      toolCount: tools.length,
      tools: tools.map((t) => ({ id: t.id, name: t.name, url: t.url })),
    });

    // 记录活动查询
    this.activeQueries.set(queryId, {
      message,
      tools,
      startTime: Date.now(),
    });

    try {
      // 检查是否已被中断
      if (this.abortController.signal.aborted) {
        throw new Error("查询已被取消");
      }

      // 发送查询到服务器（使用非阻塞方式）
      console.log("🚀 [DEBUG] 发送查询请求:", { message, queryId });

      // 启动查询请求（会在工具调用完成后返回最终结果）
      console.log("🚀 [DEBUG] 启动query请求...");
      const queryPromise = this.apiClient.sendQuery(message, queryId);

      // 立即开始轮询工具请求
      console.log("🚀 [DEBUG] 立即开始轮询工具请求:", {
        userId: this.authService.getUserId(),
        queryId,
      });

      // 启动轮询，处理工具请求
      const pollResult = await this.pollWithAbort(
        this.authService.getUserId(),
        queryId,
        (update) => this.handlePollingUpdate(queryId, update)
      );
      console.log("🚀 [DEBUG] 轮询结束:", pollResult);

      // 等待原始query接口返回最终结果
      console.log("🚀 [DEBUG] 等待query接口返回最终结果...");
      const finalResult = await queryPromise;
      console.log("🚀 [DEBUG] query接口返回最终结果:", finalResult);

      // 检查是否已被中断
      if (this.abortController.signal.aborted) {
        throw new Error("查询已被取消");
      }

      if (finalResult.success) {
        this.addChatMessage(
          "assistant",
          `✅ 查询完成！\n\n${finalResult.answer || "已获取数据"}\n\n` +
            (finalResult.reasoning
              ? `💭 推理过程：${finalResult.reasoning}`
              : "")
        );
      } else {
        throw new Error(finalResult.error || "查询失败");
      }
    } catch (error) {
      if (
        error.message === "查询已被取消" ||
        this.abortController.signal.aborted
      ) {
        console.log("工具查询被用户取消");
        return; // 不显示错误消息，因为是用户主动取消
      }

      console.error("工具查询失败:", error);
      this.addChatMessage(
        "assistant",
        `❌ 工具查询失败：${error.message}\n\n` + "正在尝试其他方式..."
      );

      // 降级到本地处理
      await this.handleLocalFallback(message, tools);
    } finally {
      this.activeQueries.delete(queryId);
    }
  }

  async handleDirectQuery(message) {
    const queryId = this.apiClient.generateQueryId();
    this.currentQueryId = queryId; // 设置当前查询ID

    try {
      // 检查是否已被中断
      if (this.abortController.signal.aborted) {
        throw new Error("查询已被取消");
      }

      // 直接发送查询，不依赖工具
      const queryResult = await this.apiClient.sendQuery(message, queryId);

      // 检查是否已被中断
      if (this.abortController.signal.aborted) {
        throw new Error("查询已被取消");
      }

      if (queryResult.success && queryResult.answer) {
        this.addChatMessage("assistant", queryResult.answer);
      } else {
        // 使用默认回复
        this.addChatMessage(
          "assistant",
          "抱歉，我没有找到相关的信息来回答您的问题。\n\n" +
            "您可以尝试：\n" +
            "1. 📝 录制相关的API请求作为工具\n" +
            "2. 📚 在知识库中添加相关信息\n" +
            "3. 🔄 用不同的方式描述您的问题"
        );
      }
    } catch (error) {
      if (
        error.message === "查询已被取消" ||
        this.abortController.signal.aborted
      ) {
        console.log("直接查询被用户取消");
        return; // 不显示错误消息，因为是用户主动取消
      }

      console.error("直接查询失败:", error);
      this.addChatMessage(
        "assistant",
        "连接服务器失败，请检查网络连接后重试。"
      );
    }
  }

  handlePollingUpdate(queryId, update) {
    console.log("轮询更新:", { queryId, updateType: update.type, update });

    if (update.type === "tool_request") {
      // 处理工具请求
      console.log("收到工具请求，准备处理:", update.data);
      this.handleToolRequest(queryId, update.data);
    } else if (update.type === "status_change") {
      // 状态更新
      console.log("查询状态变化:", update.status);
      this.updateQueryStatus(queryId, update.status);
    }
  }

  async handleToolRequest(queryId, toolRequest) {
    console.log("处理工具请求:", toolRequest);

    try {
      // 获取当前查询的相关信息
      const queryInfo = this.activeQueries.get(queryId);
      if (!queryInfo || !queryInfo.tools || queryInfo.tools.length === 0) {
        throw new Error("未找到相关工具信息");
      }

      // 从 Find_knowledge_tool 返回的工具中获取 URL
      const tool = queryInfo.tools[0]; // 使用第一个工具
      const toolUrl = tool.url;

      if (!toolUrl) {
        throw new Error("工具URL未找到");
      }

      console.log("Find_knowledge_tool 返回的工具URL:", toolUrl);
      console.log("get_tool_request 返回的数据:", toolRequest);

      // 根据实际返回的数据结构提取 origin_params
      const originParams = toolRequest.tool?.origin_params || {};
      const method = originParams.method || "GET";
      const contentType = originParams.contentType || "application/json";

      console.log("提取的 origin_params:", originParams);
      console.log("合并后的请求参数:", { url: toolUrl, method, contentType });

      // 执行合并后的API调用
      const toolResponse = await this.executeCombinedAPICall(
        toolUrl,
        method,
        contentType
      );

      // 确保工具响应是对象格式
      const formattedResponse = this.formatToolResponse(toolResponse);

      // 保存工具响应
      await this.apiClient.saveToolResponse(
        this.authService.getUserId(),
        queryId,
        formattedResponse
      );

      this.addChatMessage("assistant", "📊 已获取工具数据，正在分析...");
    } catch (error) {
      console.error("工具执行失败:", error);

      // 保存错误响应
      const errorResponse = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };

      await this.apiClient.saveToolResponse(
        this.authService.getUserId(),
        queryId,
        errorResponse
      );
    }
  }

  async executeCombinedAPICall(url, method, contentType) {
    try {
      console.log("执行合并的API调用:", { url, method, contentType });

      // 构建请求配置
      const fetchOptions = {
        method: method,
        headers: {
          "Content-Type": contentType,
          "X-APIForge-Request": "true", // 标识我们自己的请求
        },
      };

      // 发起请求
      const response = await fetch(url, fetchOptions);

      // 获取响应数据
      let responseData;
      const responseContentType = response.headers.get("content-type");

      if (
        responseContentType &&
        responseContentType.includes("application/json")
      ) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      console.log("API调用完成:", responseData);
      return responseData;
    } catch (error) {
      console.error("API调用失败:", error);

      // 返回错误响应
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 格式化工具响应，确保是对象格式
   */
  formatToolResponse(response) {
    // 如果已经是对象，直接返回
    if (typeof response === "object" && response !== null) {
      return response;
    }

    // 如果是字符串，包装成对象
    if (typeof response === "string") {
      return {
        success: true,
        data: response,
        content_type: "text/html", // 假设HTML内容
        timestamp: new Date().toISOString(),
      };
    }

    // 其他类型，包装成对象
    return {
      success: true,
      data: response,
      data_type: typeof response,
      timestamp: new Date().toISOString(),
    };
  }

  async executeToolCall(toolRequest) {
    try {
      // 根据工具类型执行不同的调用
      if (toolRequest.tool_url) {
        // 外部API调用
        return await this.apiClient.executeTool(
          toolRequest,
          toolRequest.tool_params
        );
      } else {
        // 本地工具调用
        return await this.executeLocalTool(toolRequest);
      }
    } catch (error) {
      console.error("工具调用失败:", error);
      throw error;
    }
  }

  async executeLocalTool(toolRequest) {
    // 查找本地工具
    const tools = this.apiManager.getTools();
    const tool = tools.find((t) => t.id === toolRequest.tool_id);

    if (!tool) {
      throw new Error("工具未找到");
    }

    // 执行本地API调用
    try {
      // 从params中提取信息
      let method = "GET";
      let contentType = "application/json";
      let bodyData = {};

      if (tool.params) {
        try {
          const params = JSON.parse(tool.params);
          method = params.method || tool.method || "GET";
          contentType =
            params.contentType || tool.contentType || "application/json";

          // 提取除了method和contentType外的所有参数作为body
          bodyData = { ...params };
          delete bodyData.method;
          delete bodyData.contentType;
        } catch (e) {
          console.error("解析工具参数失败:", e);
        }
      }

      // 构建请求配置
      const fetchOptions = {
        method: method,
        headers: {
          "Content-Type": contentType,
        },
      };

      // 根据请求方式和内容类型设置请求体
      if (method !== "GET" && Object.keys(bodyData).length > 0) {
        if (contentType === "application/json") {
          // JSON格式
          fetchOptions.body = JSON.stringify(bodyData);
        } else if (contentType === "application/x-www-form-urlencoded") {
          // Form格式
          fetchOptions.body = new URLSearchParams(bodyData).toString();
        } else {
          // 其他格式，如果有rawBody字段，使用它
          fetchOptions.body = bodyData.rawBody || JSON.stringify(bodyData);
        }
      }

      const response = await fetch(tool.url, fetchOptions);

      const data = await response.json();
      return data;
    } catch (error) {
      throw new Error(`本地工具执行失败: ${error.message}`);
    }
  }

  async handleLocalFallback(message, tools) {
    // 尝试使用第一个工具直接调用
    if (tools && tools.length > 0) {
      const tool = tools[0];

      try {
        const result = await this.apiClient.executeTool(tool, {});

        if (result.success) {
          this.addChatMessage(
            "assistant",
            `📊 通过备用方式获取到数据：\n\n` +
              `\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\``
          );
        }
      } catch (error) {
        console.error("备用方式失败:", error);
        this.addChatMessage(
          "assistant",
          "抱歉，无法获取相关数据。请确保工具配置正确。"
        );
      }
    }
  }

  updateQueryStatus(queryId, status) {
    const query = this.activeQueries.get(queryId);
    if (!query) return;

    const elapsed = Date.now() - query.startTime;
    const seconds = Math.floor(elapsed / 1000);

    // 根据状态更新UI
    switch (status) {
      case "processing":
        if (seconds % 5 === 0) {
          // 每5秒更新一次
          this.updateLastAssistantMessage(
            `⏳ 正在处理中... (已用时 ${seconds} 秒)`
          );
        }
        break;
      case "waiting_for_tool":
        this.updateLastAssistantMessage("🔧 等待工具响应...");
        break;
      case "completed":
        this.updateLastAssistantMessage("✅ 处理完成！");
        break;
      case "failed":
        this.updateLastAssistantMessage("❌ 处理失败");
        break;
    }
  }

  updateLastAssistantMessage(content) {
    const messages = this.chatMessages?.querySelectorAll(".assistant-message");
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const contentDiv = lastMessage.querySelector(".message-content");
      if (contentDiv) {
        contentDiv.innerHTML = this.formatMessage(content);
      }
    }
  }

  addChatMessage(type, content) {
    if (!this.chatMessages) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = `${type}-message`;

    const timestamp = new Date().toLocaleTimeString();

    if (type === "user") {
      messageDiv.innerHTML = `
        <div class="message-content">${this.formatMessage(content)}</div>
        <div class="message-timestamp">${timestamp}</div>
      `;
    } else {
      messageDiv.innerHTML = `
        <div class="message-icon">🤖</div>
        <div class="message-content">${this.formatMessage(content)}</div>
        <div class="message-timestamp">${timestamp}</div>
      `;
    }

    this.chatMessages.appendChild(messageDiv);

    // 添加到历史记录
    this.chatHistory.push({
      type,
      content,
      timestamp: new Date().toISOString(),
    });

    this.scrollToBottom();
    this.saveData();

    // 触发事件
    eventBus.emit(
      type === "user" ? Events.CHAT_MESSAGE_SENT : Events.CHAT_MESSAGE_RECEIVED,
      {
        content,
        timestamp,
      }
    );
  }

  formatMessage(content) {
    // 增强的消息格式化
    return content
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  }

  scrollToBottom() {
    if (this.chatMessages) {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
  }

  setButtonState(disabled, text) {
    if (this.sendChatBtn) {
      this.sendChatBtn.disabled = disabled;
      this.sendChatBtn.textContent = text;
    }
  }

  stopCurrentQuery() {
    console.log("停止当前查询:", this.currentQueryId);

    // 取消当前的网络请求
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // 清理活动查询
    if (this.currentQueryId) {
      this.activeQueries.delete(this.currentQueryId);
      this.currentQueryId = null;
    }

    // 显示停止消息
    this.addChatMessage("assistant", "❌ 查询已停止");

    // 重置状态
    this.resetChatState();
  }

  resetChatState() {
    this.isProcessing = false;
    this.currentQueryId = null;
    this.abortController = null;
    this.setButtonState(false, "发送");
  }

  async pollWithAbort(userId, queryId, onUpdate) {
    return new Promise((resolve, reject) => {
      // 创建一个包装的轮询函数
      const pollPromise = this.apiClient.pollQueryResult(
        userId,
        queryId,
        onUpdate
      );

      // 监听中断信号
      const abortHandler = () => {
        console.log("轮询被中断");
        reject(new Error("查询已被取消"));
      };

      if (this.abortController) {
        this.abortController.signal.addEventListener("abort", abortHandler);
      }

      // 执行轮询
      pollPromise
        .then((result) => {
          if (this.abortController) {
            this.abortController.signal.removeEventListener(
              "abort",
              abortHandler
            );
          }
          resolve(result);
        })
        .catch((error) => {
          if (this.abortController) {
            this.abortController.signal.removeEventListener(
              "abort",
              abortHandler
            );
          }
          reject(error);
        });
    });
  }

  clearChat() {
    if (confirm("确定要清空聊天记录吗？")) {
      this.chatHistory = [];
      if (this.chatMessages) {
        this.chatMessages.innerHTML = "";
      }
      this.showWelcomeMessage();
      this.saveData();
      this.uiManager.showNotification("聊天记录已清空", "success");
    }
  }

  // 获取聊天统计
  getChatStatistics() {
    const userMessages = this.chatHistory.filter(
      (m) => m.type === "user"
    ).length;
    const assistantMessages = this.chatHistory.filter(
      (m) => m.type === "assistant"
    ).length;

    return {
      totalMessages: this.chatHistory.length,
      userMessages,
      assistantMessages,
      activeQueries: this.activeQueries.size,
    };
  }

  // 导出聊天记录
  exportChatHistory() {
    const data = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      userId: this.authService.getUserId(),
      messages: this.chatHistory,
    };

    return JSON.stringify(data, null, 2);
  }

  // 导入聊天记录
  importChatHistory(data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.messages && Array.isArray(parsed.messages)) {
        this.chatHistory = parsed.messages;
        this.renderChatHistory();
        return true;
      }
    } catch (error) {
      console.error("导入聊天记录失败:", error);
    }
    return false;
  }

  // 数据管理
  loadHistory(history) {
    this.chatHistory = history || [];
    this.renderChatHistory();
  }

  getHistory() {
    return this.chatHistory;
  }

  renderChatHistory() {
    if (!this.chatMessages) return;

    this.chatMessages.innerHTML = "";

    if (this.chatHistory.length === 0) {
      this.showWelcomeMessage();
    } else {
      this.chatHistory.forEach((msg) => {
        // 不重复添加到历史记录
        const originalPush = this.chatHistory.push;
        this.chatHistory.push = () => {}; // 临时禁用
        this.addChatMessage(msg.type, msg.content);
        this.chatHistory.push = originalPush; // 恢复
      });
    }
  }

  saveData() {
    if (window.app && window.app.saveLocalData) {
      window.app.saveLocalData();
    }
  }

  clearHistory() {
    this.chatHistory = [];
    this.saveData();
  }
}
