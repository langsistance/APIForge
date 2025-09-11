/**
 * API管理器 - 负责API拦截、工具生成和管理
 */

import authService from "../../services/auth-service.js";
import { CONFIG } from "../../utils/config.js";
import apiClient from "../../services/websight-api-client.js";

export class APIManager {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.authService = authService;
    this.apiClient = apiClient;
    this.interceptedAPIs = [];
    this.generatedTools = [];
    this.filteredAPIs = [];

    // UI元素
    this.apiList = null;
    this.clearApisBtn = null;
    this.apiFilter = null;
    this.clearFilterBtn = null;
    this.generatedToolsDiv = null;
    this.createToolBtn = null;
  }

  async init() {
    this.initializeElements();
    this.setupEventListeners();
    this.updateAPIList();
    this.updateGeneratedTools();
    console.log("✅ APIManager 初始化完成");
  }

  initializeElements() {
    this.apiList = document.getElementById("apiList");
    this.clearApisBtn = document.getElementById("clearApisBtn");
    this.apiFilter = document.getElementById("apiFilter");
    this.clearFilterBtn = document.getElementById("clearFilterBtn");
    this.generatedToolsDiv = document.getElementById("generatedTools");
    this.createToolBtn = document.getElementById("createToolBtn");
  }

  setupEventListeners() {
    // API工具栏事件
    this.clearApisBtn.addEventListener("click", () => this.clearAPIs());
    this.createToolBtn.addEventListener("click", () =>
      this.showCreateToolDialog()
    );
    this.apiFilter.addEventListener("input", () => this.filterAPIs());
    this.clearFilterBtn.addEventListener("click", () => this.clearFilter());

    // 监听浏览器拦截的API
    window.addEventListener("api-intercepted", (event) => {
      this.handleAPIRequest(event.detail);
    });

    // 监听主进程发送的API拦截消息
    if (typeof window !== "undefined" && window.require) {
      try {
        const { ipcRenderer } = window.require("electron");

        ipcRenderer.on("api-intercepted", (event, apiData) => {
          console.log(
            "📥 Received API from main process:",
            apiData.method,
            apiData.url
          );
          this.handleAPIRequest(apiData);
        });

        ipcRenderer.on("api-completed", (event, apiData) => {
          console.log(
            "✅ API completed from main process:",
            apiData.method,
            apiData.url
          );
          this.handleAPIRequest(apiData);
        });

        console.log("✅ IPC listeners registered for API interception");
      } catch (error) {
        console.log("⚠️ IPC not available, using fallback:", error.message);
      }
    }
  }

  handleAPIRequest(apiData) {
    const processedAPI = this.processAPIData(apiData);
    this.interceptedAPIs.push(processedAPI);
    this.updateAPIList();
    // 不再保存拦截的API列表到本地存储

    console.log("处理API请求:", processedAPI);
  }

  processAPIData(rawData) {
    console.log("Processing raw API data:", rawData); // 调试日志

    return {
      id: Date.now() + Math.random(),
      url: rawData.url,
      method: rawData.method || "GET",
      headers: rawData.headers || rawData.requestHeaders || {},
      body: rawData.body || rawData.requestBody,
      status: rawData.status || rawData.statusCode || rawData.responseStatus,
      statusText: rawData.statusText || rawData.responseStatusText || "",
      responseHeaders: rawData.responseHeaders || {},
      responseText:
        rawData.responseText || rawData.responseBody || rawData.response,
      duration: rawData.duration || rawData.responseTime,
      timestamp: rawData.timestamp || new Date().toISOString(),
      type: rawData.type || "unknown",
    };
  }

  updateAPIList() {
    if (!this.apiList) return;

    this.apiList.innerHTML = "";

    if (this.interceptedAPIs.length === 0) {
      this.apiList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div>还没有拦截到API请求</div>
          <div style="font-size: 11px; color: #6c757d; margin-top: 4px;">
            请先开启拦截，然后在网页中进行操作
          </div>
        </div>
      `;
      return;
    }

    const apisToShow = this.apiFilter.value
      ? this.filteredAPIs
      : this.interceptedAPIs;

    apisToShow.forEach((api, index) => {
      const apiElement = document.createElement("div");
      apiElement.className = "api-item";
      apiElement.innerHTML = `
        <div class="api-method method-${api.method.toLowerCase()}">${
        api.method
      }</div>
        <div class="api-url">${this.truncateUrl(api.url)}</div>
        <div class="api-time">${new Date(
          api.timestamp
        ).toLocaleTimeString()}</div>
      `;

      apiElement.addEventListener("click", () =>
        this.showAPIDetails(api, index)
      );
      this.apiList.appendChild(apiElement);
    });
  }

  filterAPIs() {
    const query = this.apiFilter.value.toLowerCase().trim();

    if (!query) {
      this.filteredAPIs = [];
      this.updateAPIList();
      return;
    }

    this.filteredAPIs = this.interceptedAPIs.filter(
      (api) =>
        api.url.toLowerCase().includes(query) ||
        api.method.toLowerCase().includes(query) ||
        (api.responseText && api.responseText.toLowerCase().includes(query))
    );

    this.updateAPIList();
  }

  clearFilter() {
    this.apiFilter.value = "";
    this.filteredAPIs = [];
    this.updateAPIList();
  }

  clearAPIs() {
    if (confirm("确定要清空所有API记录吗？")) {
      this.interceptedAPIs = [];
      this.filteredAPIs = [];
      this.updateAPIList();
      // 不再保存拦截的API列表到本地存储
      this.uiManager.showNotification("API记录已清空", "success");
    }
  }

  showAPIDetails(api, index) {
    const modal = this.uiManager.createModal();
    const modalContent = modal.querySelector(".modal-content");

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3>API详情</h3>
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
      </div>
      <div class="modal-body">
        ${this.generateAPIDetailsHTML(api)}
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="app.apiManager.showCreateToolDialog('${index}'); this.closest('.modal').remove();">
          生成工具
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove();">
          关闭
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  generateAPIDetailsHTML(api) {
    return `
      <div class="api-detail-section">
        <h4>基本信息</h4>
        <div class="detail-item">
          <strong>请求方法:</strong>
          <span class="method-badge method-${api.method.toLowerCase()}">${
      api.method
    }</span>
        </div>
        <div class="detail-item">
          <strong>URL:</strong>
          <div class="url-display">${api.url}</div>
        </div>
        <div class="detail-item">
          <strong>状态码:</strong> ${api.status || "未知"} ${
      api.statusText || ""
    }
        </div>
        <div class="detail-item">
          <strong>响应时间:</strong> ${
            api.duration ? api.duration + "ms" : "未知"
          }
        </div>
        <div class="detail-item">
          <strong>时间:</strong> ${new Date(api.timestamp).toLocaleString()}
        </div>
      </div>
      
      <div class="api-detail-section">
        <h4>请求头</h4>
        <div class="json-display">
          <pre>${JSON.stringify(api.headers, null, 2)}</pre>
        </div>
      </div>
      
      ${
        api.body
          ? `
        <div class="api-detail-section">
          <h4>请求体</h4>
          <div class="json-display">
            <pre>${
              typeof api.body === "string"
                ? api.body
                : JSON.stringify(api.body, null, 2)
            }</pre>
          </div>
        </div>
      `
          : ""
      }
      
      <div class="api-detail-section">
        <h4>响应头</h4>
        <div class="json-display">
          <pre>${JSON.stringify(api.responseHeaders, null, 2)}</pre>
        </div>
      </div>
      
      <div class="api-detail-section">
        <h4>响应体</h4>
        <div class="json-display">
          <pre>${this.formatResponseBody(api.responseText)}</pre>
        </div>
      </div>
    `;
  }

  showCreateToolDialog(apiIndex = null) {
    const modal = this.uiManager.createModal();
    const modalContent = modal.querySelector(".modal-content");

    let selectedAPI = null;
    if (apiIndex !== null) {
      selectedAPI = this.interceptedAPIs[parseInt(apiIndex)];
    }

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3>创建工具</h3>
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="toolName">工具名称:</label>
          <input type="text" id="toolName" class="form-control" 
                 placeholder="例如: get_weather 或 search api (字母开头，可包含字母数字下划线)" 
                 value="${
                   selectedAPI
                     ? this.generateToolNameFromURL(selectedAPI.url)
                     : ""
                 }"
                 onblur="app.apiManager.validateToolName(this)">
          <small class="form-text text-muted">
            工具名称用于 OpenAI function calling，必须以字母开头，只能包含字母、数字、下划线和连字符
          </small>
        </div>
        <div class="form-group">
          <label for="toolDescription">工具描述:</label>
          <textarea id="toolDescription" class="form-control" rows="3" placeholder="请描述这个工具的功能">${
            selectedAPI ? this.generateToolDescription(selectedAPI) : ""
          }</textarea>
        </div>
        <div class="form-group">
          <label for="toolURL">API地址:</label>
          <input type="text" id="toolURL" class="form-control" placeholder="请输入API地址" 
                 value="${selectedAPI ? selectedAPI.url : ""}">
        </div>
        <div class="form-group">
          <label for="toolMethod">请求方式:</label>
          <select id="toolMethod" class="form-control">
            <option value="GET" ${
              selectedAPI && selectedAPI.method === "GET" ? "selected" : ""
            }>GET</option>
            <option value="POST" ${
              selectedAPI && selectedAPI.method === "POST" ? "selected" : ""
            }>POST</option>
            <option value="PUT" ${
              selectedAPI && selectedAPI.method === "PUT" ? "selected" : ""
            }>PUT</option>
            <option value="DELETE" ${
              selectedAPI && selectedAPI.method === "DELETE" ? "selected" : ""
            }>DELETE</option>
            <option value="PATCH" ${
              selectedAPI && selectedAPI.method === "PATCH" ? "selected" : ""
            }>PATCH</option>
          </select>
        </div>
        <div class="form-group">
          <label for="toolContentType">Content-Type:</label>
          <select id="toolContentType" class="form-control">
            <option value="application/json" ${
              selectedAPI &&
              this.getContentType(selectedAPI) === "application/json"
                ? "selected"
                : ""
            }>application/json</option>
            <option value="application/x-www-form-urlencoded" ${
              selectedAPI &&
              this.getContentType(selectedAPI) ===
                "application/x-www-form-urlencoded"
                ? "selected"
                : ""
            }>application/x-www-form-urlencoded</option>
            <option value="multipart/form-data" ${
              selectedAPI &&
              this.getContentType(selectedAPI) === "multipart/form-data"
                ? "selected"
                : ""
            }>multipart/form-data</option>
            <option value="text/plain" ${
              selectedAPI && this.getContentType(selectedAPI) === "text/plain"
                ? "selected"
                : ""
            }>text/plain</option>
          </select>
        </div>
        <div class="form-group">
          <label for="toolBody">请求体 (Body):</label>
          <textarea id="toolBody" class="form-control" rows="4" placeholder="请输入请求体内容（JSON或其他格式）">${
            selectedAPI ? this.generateToolParamsBodyOnly(selectedAPI) : "{}"
          }</textarea>
          <small class="form-text text-muted">
            对于GET请求，通常不需要请求体。对于POST/PUT等请求，请根据Content-Type填写相应格式的内容。
          </small>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="toolPublic" checked> 设为公开
          </label>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="createKnowledge" onchange="app.apiManager.toggleKnowledgeFields(this.checked)"> 同时创建知识库
          </label>
        </div>
        <div id="knowledgeFields" style="display: none;">
          <div class="form-group">
            <label for="knowledgeQuestion">知识库问题:</label>
            <input type="text" id="knowledgeQuestion" class="form-control" placeholder="例如：如何使用这个工具？">
          </div>
          <div class="form-group">
            <label for="knowledgeAnswer">知识库答案:</label>
            <textarea id="knowledgeAnswer" class="form-control" rows="3" placeholder="请输入对应的答案或使用说明"></textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="app.apiManager.createTool(); this.closest('.modal').remove();">
          创建工具
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove();">
          取消
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  toggleKnowledgeFields(checked) {
    const knowledgeFields = document.getElementById("knowledgeFields");
    if (knowledgeFields) {
      knowledgeFields.style.display = checked ? "block" : "none";
    }
  }

  validateToolName(input) {
    const value = input.value.trim();
    const isValid = /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value);

    if (!isValid && value) {
      // 自动修正工具名称
      const correctedName = this.normalizeToolName(value);
      input.value = correctedName;
      input.style.borderColor = "#28a745"; // 绿色边框表示已修正

      // 显示提示
      this.uiManager.showNotification(
        `工具名称已自动修正为: ${correctedName}`,
        "info"
      );
    } else if (!value) {
      input.style.borderColor = "#dc3545"; // 红色边框
    } else {
      input.style.borderColor = "#28a745"; // 绿色边框表示有效
    }
  }

  async createTool() {
    const name = document.getElementById("toolName").value.trim();
    const description = document.getElementById("toolDescription").value.trim();
    const url = document.getElementById("toolURL").value.trim();
    const method = document.getElementById("toolMethod").value;
    const contentType = document.getElementById("toolContentType").value;
    const body = document.getElementById("toolBody").value.trim();
    const isPublic = document.getElementById("toolPublic").checked;
    const createKnowledge = document.getElementById("createKnowledge").checked;

    if (!name || !description || !url) {
      alert("请填写所有必填字段");
      return;
    }

    // 验证工具名称格式
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
      alert(
        "工具名称格式不正确！必须以字母开头，只能包含字母、数字、下划线和连字符"
      );
      return;
    }

    // 验证请求体格式（仅对JSON格式验证）
    let parsedBody = null;
    if (body) {
      if (contentType === "application/json") {
        try {
          parsedBody = JSON.parse(body);
        } catch (e) {
          alert(
            "当Content-Type为application/json时，请求体必须是有效的JSON格式"
          );
          return;
        }
      } else {
        parsedBody = body; // 其他格式直接保存原始内容
      }
    }

    // 如果选择创建知识库，检查知识库字段
    if (createKnowledge) {
      const knowledgeQuestion = document
        .getElementById("knowledgeQuestion")
        .value.trim();
      const knowledgeAnswer = document
        .getElementById("knowledgeAnswer")
        .value.trim();

      if (!knowledgeQuestion || !knowledgeAnswer) {
        alert("如果选择创建知识库，请填写完整的问题和答案");
        return;
      }
    }

    try {
      let remoteToolId = null;
      let remoteKnowledgeId = null;

      if (createKnowledge) {
        // 调用create_tool_and_knowledge API
        const knowledgeQuestion = document
          .getElementById("knowledgeQuestion")
          .value.trim();
        const knowledgeAnswer = document
          .getElementById("knowledgeAnswer")
          .value.trim();

        // 构建工具参数：包含method、contentType，并将body内容平铺
        let toolParamsObj = {
          method: method,
          contentType: contentType,
        };

        // 如果有body内容，将其平铺到params中
        if (parsedBody && typeof parsedBody === "object") {
          // JSON对象，直接平铺
          Object.assign(toolParamsObj, parsedBody);
        } else if (
          body &&
          contentType === "application/x-www-form-urlencoded"
        ) {
          // Form格式，尝试解析
          try {
            const formData = new URLSearchParams(body);
            formData.forEach((value, key) => {
              toolParamsObj[key] = value;
            });
          } catch (e) {
            // 解析失败，保存原始内容
            toolParamsObj.rawBody = body;
          }
        } else if (body) {
          // 其他格式，保存原始内容
          toolParamsObj.rawBody = body;
        }

        const toolParamsForAPI = JSON.stringify(toolParamsObj);

        const requestData = {
          userId: this.authService.getUserId(),
          toolTitle: name,
          toolDescription: description,
          toolUrl: url,
          toolPush: 1,
          toolPublic: isPublic,
          toolTimeout: 30,
          toolParams: toolParamsForAPI,
          knowledgeQuestion: knowledgeQuestion,
          knowledgeDescription: description,
          knowledgeAnswer: knowledgeAnswer,
          knowledgePublic: isPublic,
          embeddingId: 1,
          modelName: "gpt-3.5-turbo",
          knowledgeParams: "",
        };

        console.log("创建工具和知识库请求:", requestData);

        const result = await this.apiClient.createToolAndKnowledge(requestData);

        if (result.success) {
          console.log("远程创建成功:", result);
          remoteToolId = result.toolId;
          remoteKnowledgeId = result.knowledgeId;
        } else {
          throw new Error(`远程创建失败: ${result.message || "未知错误"}`);
        }
      } else {
        // 不创建知识库时，直接保存到本地
        console.log("仅创建本地工具，不调用远程API");
        remoteToolId = null; // 本地工具没有远程ID
      }

      // 创建本地工具对象
      const tool = {
        id: Date.now(),
        remoteId: remoteToolId,
        remoteKnowledgeId: remoteKnowledgeId, // 如果创建了知识库，保存知识库ID
        name,
        description,
        url,
        method,
        contentType,
        body,
        params: createKnowledge
          ? toolParamsForAPI
          : this.buildToolParams(method, contentType, parsedBody || body), // 保存完整的params
        isPublic,
        createdAt: new Date().toISOString(),
        userId: this.authService.getUserId(),
      };

      this.generatedTools.push(tool);
      this.updateGeneratedTools();
      this.saveData();

      const successMsg = createKnowledge
        ? `工具"${name}"和知识库创建成功`
        : `工具"${name}"创建成功`;
      this.uiManager.showNotification(successMsg, "success");
      console.log("创建工具:", tool);
    } catch (error) {
      console.error("创建工具失败:", error);
      this.uiManager.showNotification(`创建失败: ${error.message}`, "error");
    }
  }

  updateGeneratedTools() {
    if (!this.generatedToolsDiv) return;

    this.generatedToolsDiv.innerHTML = "";

    if (this.generatedTools.length === 0) {
      this.generatedToolsDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔧</div>
          <div>还没有创建工具</div>
        </div>
      `;
      return;
    }

    this.generatedTools.forEach((tool, index) => {
      const toolElement = document.createElement("div");
      toolElement.className = "generated-tool-item";
      toolElement.innerHTML = `
        <div style="font-weight: 500; color: #495057;">${tool.name}</div>
        <div style="font-size: 11px; color: #6c757d; margin-top: 2px;">${tool.description}</div>
      `;

      toolElement.addEventListener("click", () =>
        this.showToolDetails(tool, index)
      );
      this.generatedToolsDiv.appendChild(toolElement);
    });
  }

  showToolDetails(tool, index) {
    const modal = this.uiManager.createModal();
    const modalContent = modal.querySelector(".modal-content");

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3>工具详情</h3>
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
      </div>
      <div class="modal-body">
        <div class="detail-item"><strong>名称:</strong> ${tool.name}</div>
        <div class="detail-item"><strong>描述:</strong> ${
          tool.description
        }</div>
        <div class="detail-item"><strong>URL:</strong> ${tool.url}</div>
        <div class="detail-item"><strong>请求方式:</strong> ${this.getToolMethod(
          tool
        )}</div>
        <div class="detail-item"><strong>Content-Type:</strong> ${this.getToolContentType(
          tool
        )}</div>
        <div class="detail-item"><strong>参数:</strong>
          <div class="json-display"><pre>${this.formatToolBody(
            tool
          )}</pre></div>
        </div>
        <div class="detail-item"><strong>创建时间:</strong> ${new Date(
          tool.createdAt
        ).toLocaleString()}</div>
        <div class="detail-item"><strong>状态:</strong> ${
          tool.isPublic ? "公开" : "私有"
        }</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" onclick="app.apiManager.deleteTool(${index}); this.closest('.modal').remove();">
          删除工具
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove();">
          关闭
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  async deleteTool(index) {
    if (!confirm("确定要删除这个工具吗？")) {
      return;
    }

    const tool = this.generatedTools[index];
    if (!tool) {
      this.uiManager.showNotification("找不到要删除的工具", "error");
      return;
    }

    try {
      // 如果有远程ID，先删除远程工具
      if (tool.remoteId) {
        console.log("删除远程工具:", tool.remoteId);
        const response = await this.apiClient.deleteTool(
          this.authService.getUserId(),
          tool.remoteId
        );

        if (!response.success) {
          throw new Error(response.message || "远程删除失败");
        }
        console.log("远程工具删除成功");
      } else {
        console.log("删除本地工具，无需调用远程API");
      }

      // 删除本地工具
      this.generatedTools.splice(index, 1);
      this.updateGeneratedTools();
      this.saveData();

      this.uiManager.showNotification("工具删除成功", "success");
    } catch (error) {
      console.error("删除工具失败:", error);
      this.uiManager.showNotification(`删除失败: ${error.message}`, "error");
    }
  }

  // 工具方法
  truncateUrl(url, maxLength = 50) {
    return url.length > maxLength ? url.substring(0, maxLength) + "..." : url;
  }

  formatResponseBody(responseText) {
    if (!responseText) return "无响应体";

    try {
      const parsed = JSON.parse(responseText);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return responseText;
    }
  }

  generateToolNameFromURL(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.split("/").filter((p) => p);
      let baseName = path.length > 0 ? path[path.length - 1] : urlObj.hostname;

      // 转换为符合 OpenAI function calling 规范的名称
      return this.normalizeToolName(baseName);
    } catch (e) {
      return "api_tool";
    }
  }

  normalizeToolName(name) {
    // 1. 转换中文到拼音或英文描述（简单映射）
    const chineseToEnglish = {
      百度: "baidu",
      首页: "homepage",
      搜索: "search",
      查询: "query",
      获取: "get",
      天气: "weather",
      新闻: "news",
      用户: "user",
      数据: "data",
      信息: "info",
      列表: "list",
      详情: "detail",
      页面: "page",
      接口: "api",
      服务: "service",
    };

    // 2. 替换中文词汇
    let englishName = name;
    for (const [chinese, english] of Object.entries(chineseToEnglish)) {
      englishName = englishName.replace(new RegExp(chinese, "g"), english);
    }

    // 3. 移除中文字符，保留字母数字下划线连字符
    englishName = englishName.replace(/[^\w\s-]/g, "");

    // 4. 转换为小写，将空格和多个连字符替换为单个下划线
    englishName = englishName
      .toLowerCase()
      .replace(/\s+/g, "_") // 空格转下划线
      .replace(/-+/g, "_") // 连字符转下划线
      .replace(/_+/g, "_") // 多个下划线合并为一个
      .replace(/^_+|_+$/g, ""); // 移除首尾下划线

    // 5. 确保以字母开头
    if (englishName && /^[0-9]/.test(englishName)) {
      englishName = "api_" + englishName;
    }

    // 6. 如果为空或无效，使用默认名称
    if (!englishName || englishName.length === 0) {
      englishName = "api_tool";
    }

    // 7. 最终验证是否符合规范
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(englishName)) {
      englishName = "api_tool_" + Date.now();
    }

    return englishName;
  }

  generateToolDescription(api) {
    return `通过${api.method}方法调用${api.url}的API工具`;
  }

  getDefaultToolParams() {
    const defaultParams = {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "APIForge-Tool/1.0",
      },
      body: {
        example_param: "示例参数值",
      },
    };

    return JSON.stringify(defaultParams, null, 2);
  }

  formatToolBody(tool) {
    // 格式化工具参数显示
    if (tool.params) {
      try {
        const params = JSON.parse(tool.params);
        // 移除method和contentType，只显示实际参数
        const displayParams = { ...params };
        delete displayParams.method;
        delete displayParams.contentType;
        return JSON.stringify(displayParams, null, 2);
      } catch (e) {
        return tool.params;
      }
    } else if (tool.body) {
      // 兼容旧版本
      if (tool.contentType === "application/json") {
        try {
          return JSON.stringify(JSON.parse(tool.body), null, 2);
        } catch (e) {
          return tool.body;
        }
      }
      return tool.body;
    }
    return "{}";
  }

  getContentType(api) {
    // 从API headers中获取Content-Type
    if (api.headers) {
      return (
        api.headers["Content-Type"] ||
        api.headers["content-type"] ||
        "application/json"
      );
    }
    return "application/json";
  }

  getToolMethod(tool) {
    // 获取工具的请求方式
    if (tool.method) {
      return tool.method;
    }
    if (tool.params) {
      try {
        const params = JSON.parse(tool.params);
        return params.method || "GET";
      } catch (e) {}
    }
    return "GET";
  }

  getToolContentType(tool) {
    // 获取工具的Content-Type
    if (tool.contentType) {
      return tool.contentType;
    }
    if (tool.params) {
      try {
        const params = JSON.parse(tool.params);
        return params.contentType || "application/json";
      } catch (e) {}
    }
    return "application/json";
  }

  buildToolParams(method, contentType, body) {
    // 构建完整的工具参数
    let paramsObj = {
      method: method,
      contentType: contentType,
    };

    // 处理body内容
    if (body) {
      if (typeof body === "object") {
        // 已经是对象，直接平铺
        Object.assign(paramsObj, body);
      } else if (typeof body === "string") {
        // 尝试解析字符串
        if (contentType === "application/json") {
          try {
            const parsed = JSON.parse(body);
            Object.assign(paramsObj, parsed);
          } catch (e) {
            paramsObj.rawBody = body;
          }
        } else if (contentType === "application/x-www-form-urlencoded") {
          try {
            const params = new URLSearchParams(body);
            params.forEach((value, key) => {
              paramsObj[key] = value;
            });
          } catch (e) {
            paramsObj.rawBody = body;
          }
        } else {
          paramsObj.rawBody = body;
        }
      }
    }

    return JSON.stringify(paramsObj, null, 2);
  }

  generateToolParamsBodyOnly(api) {
    const bodyParams = {};

    // 只从请求体中提取参数，不提取URL查询参数
    // 从请求体中提取，保留原始值和结构
    if (api.body) {
      try {
        // 先尝试解析为JSON
        const bodyObj = JSON.parse(api.body);
        Object.assign(bodyParams, bodyObj);
      } catch (e) {
        // 如果不是JSON，检查是否为form格式
        if (typeof api.body === "string") {
          // 检查Content-Type是否为form格式
          const contentType =
            (api.headers && api.headers["content-type"]) ||
            (api.headers && api.headers["Content-Type"]) ||
            "";

          if (contentType.includes("application/x-www-form-urlencoded")) {
            // 解析form格式: key1=value1&key2=value2
            try {
              const params = new URLSearchParams(api.body);
              params.forEach((value, key) => {
                bodyParams[key] = value;
              });
            } catch (formError) {
              bodyParams.form_data = api.body;
            }
          } else if (contentType.includes("multipart/form-data")) {
            // multipart数据比较复杂，暂时作为原始数据保存
            bodyParams.multipart_data = api.body;
          } else {
            // 其他格式作为原始数据
            bodyParams.raw_data = api.body;
          }
        }
      }
    }

    // 如果body为空，至少提供一个示例参数
    if (Object.keys(bodyParams).length === 0) {
      bodyParams.example_param = "示例参数值";
    }

    return JSON.stringify(bodyParams, null, 2);
  }

  generateToolParams(api) {
    const toolParams = {
      headers: {},
      body: {},
    };

    // 从拦截的API中提取headers
    if (api.headers && Object.keys(api.headers).length > 0) {
      // 过滤掉一些不需要的headers
      const skipHeaders = [
        "host",
        "content-length",
        "connection",
        "upgrade-insecure-requests",
      ];
      Object.keys(api.headers).forEach((key) => {
        const lowerKey = key.toLowerCase();
        if (!skipHeaders.includes(lowerKey)) {
          toolParams.headers[key] = api.headers[key];
        }
      });
    }

    // 从URL参数中提取到body，保留原始值
    try {
      const urlObj = new URL(api.url);
      urlObj.searchParams.forEach((value, key) => {
        toolParams.body[key] = value; // 保留原始值
      });
    } catch (e) {}

    // 从请求体中提取，保留原始值和结构
    if (api.body) {
      try {
        // 先尝试解析为JSON
        const bodyObj = JSON.parse(api.body);
        Object.assign(toolParams.body, bodyObj);
      } catch (e) {
        // 如果不是JSON，检查是否为form格式
        if (typeof api.body === "string") {
          // 检查Content-Type是否为form格式
          const contentType =
            (api.headers && api.headers["content-type"]) ||
            (api.headers && api.headers["Content-Type"]) ||
            "";

          if (contentType.includes("application/x-www-form-urlencoded")) {
            // 解析form格式: key1=value1&key2=value2
            try {
              const params = new URLSearchParams(api.body);
              params.forEach((value, key) => {
                toolParams.body[key] = value;
              });
            } catch (formError) {
              toolParams.body.form_data = api.body;
            }
          } else if (contentType.includes("multipart/form-data")) {
            // multipart数据比较复杂，暂时作为原始数据保存
            toolParams.body.multipart_data = api.body;
          } else {
            // 其他格式作为原始数据
            toolParams.body.raw_data = api.body;
          }
        }
      }
    }

    // 如果body为空，至少提供一个示例参数
    if (Object.keys(toolParams.body).length === 0) {
      toolParams.body = {
        example_param: "示例参数值",
      };
    }

    return JSON.stringify(toolParams, null, 2);
  }

  // 数据管理 - API列表不再持久化
  loadAPIs(apis) {
    // 不再加载拦截的API列表，每次启动都重新开始
    this.interceptedAPIs = [];
    this.updateAPIList();
  }

  loadTools(tools) {
    this.generatedTools = tools || [];
    this.updateGeneratedTools();
  }

  getAPIs() {
    // 返回空数组，API列表不再持久化
    return [];
  }

  getTools() {
    return this.generatedTools;
  }

  saveData() {
    if (window.app && window.app.saveLocalData) {
      window.app.saveLocalData();
    }
  }
}
