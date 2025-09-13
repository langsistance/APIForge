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
    this.generatedTools = []; // 本地工具
    this.serverTools = []; // 服务器端工具
    this.filteredAPIs = [];

    // 定时器
    this.autoRefreshInterval = null;

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
    await this.loadServerTools(); // 加载服务器端工具
    this.updateGeneratedTools();
    this.startAutoRefresh(); // 启动定时刷新
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

    // 如果是POST请求且有headers，存储到域名headers中
    if (
      processedAPI.method === "POST" &&
      processedAPI.headers &&
      Object.keys(processedAPI.headers).length > 0
    ) {
      this.storeDomainHeaders(processedAPI.url, processedAPI.headers);
    }

    // 使用增量更新而不是完全重建
    this.addAPIToList(processedAPI);
    // 不再保存拦截的API列表到本地存储

    console.log("处理API请求:", processedAPI);
  }

  processAPIData(rawData) {
    console.log("Processing raw API data:", rawData); // 调试日志

    return {
      id: Date.now() + Math.random(),
      url: rawData.url,
      method: rawData.method || "GET",
      // 优先使用requestHeaders，向后兼容headers
      headers: rawData.requestHeaders || rawData.headers || {},
      // 优先使用requestBody，向后兼容body
      body: rawData.requestBody || rawData.body,
      status: rawData.status || rawData.statusCode || rawData.responseStatus,
      statusText: rawData.statusText || rawData.responseStatusText || "",
      responseHeaders: rawData.responseHeaders || {},
      responseText:
        rawData.responseText ||
        rawData.responseBody ||
        rawData.response ||
        rawData.data,
      duration: rawData.duration || rawData.responseTime,
      timestamp: rawData.timestamp
        ? new Date(rawData.timestamp).toISOString()
        : new Date().toISOString(),
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
          <div data-i18n="alerts.noApiIntercepted">${$t('alerts.noApiIntercepted')}</div>
          <div style="font-size: 11px; color: #6c757d; margin-top: 4px;" data-i18n="alerts.enableInterceptTip">
            ${$t('alerts.enableInterceptTip')}
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
        this.showAPIDetails(api)
      );
      this.apiList.appendChild(apiElement);
    });
  }

  // 增量添加新API到列表（防止闪烁）
  addAPIToList(api) {
    if (!this.apiList) return;
    
    // 如果有过滤器且新API不匹配，不添加到显示列表
    if (this.apiFilter.value) {
      const query = this.apiFilter.value.toLowerCase().trim();
      if (!api.url.toLowerCase().includes(query) && 
          !api.method.toLowerCase().includes(query) &&
          !(api.responseText && api.responseText.toLowerCase().includes(query))) {
        return;
      }
    }
    
    // 如果是第一个API，清空空状态
    if (this.interceptedAPIs.length === 1) {
      this.apiList.innerHTML = "";
    }
    
    const apiElement = document.createElement("div");
    apiElement.className = "api-item api-item-new"; // 添加新项目类名用于动画
    apiElement.innerHTML = `
      <div class="api-method method-${api.method.toLowerCase()}">${api.method}</div>
      <div class="api-url">${this.truncateUrl(api.url)}</div>
      <div class="api-time">${new Date(api.timestamp).toLocaleTimeString()}</div>
    `;
    // 直接传递API对象，不使用索引
    apiElement.addEventListener("click", () => this.showAPIDetails(api));
    
    // 将新API添加到列表顶部
    this.apiList.insertBefore(apiElement, this.apiList.firstChild);
    
    // 移除新项目动画类
    setTimeout(() => apiElement.classList.remove("api-item-new"), 300);
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
    if (confirm($t('alerts.confirmClearApis'))) {
      this.interceptedAPIs = [];
      this.filteredAPIs = [];
      this.updateAPIList();
      // 不再保存拦截的API列表到本地存储
      this.uiManager.showNotification($t('alerts.apisCleared'), "success");
    }
  }

  showAPIDetails(api) {
    const modal = this.uiManager.createModal();
    const modalContent = modal.querySelector(".modal-content");

    // 找到该API在数组中的实际索引
    const actualIndex = this.interceptedAPIs.findIndex(item => 
      item.id === api.id || 
      (item.url === api.url && item.method === api.method && item.timestamp === api.timestamp)
    );

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3 data-i18n="modals.apiDetails.title">${$t('modals.apiDetails.title')}</h3>
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
      </div>
      <div class="modal-body">
        ${this.generateAPIDetailsHTML(api)}
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary create-tool-btn" data-api-id="${api.id}" data-i18n="modals.apiDetails.generateTool">
          ${$t('modals.apiDetails.generateTool')}
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove();" data-i18n="modals.close">
          ${$t('modals.close')}
        </button>
      </div>
    `;

    // 添加事件监听器
    const createToolBtn = modal.querySelector('.create-tool-btn');
    if (createToolBtn) {
      createToolBtn.addEventListener('click', () => {
        const apiId = createToolBtn.dataset.apiId;
        this.showCreateToolDialogWithStoredAPI(apiId);
        modal.remove();
      });
    }

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

  showCreateToolDialogForAPI(apiData) {
    // 直接接受API对象的方法
    this.showCreateToolDialog(null, apiData);
  }

  showCreateToolDialogWithStoredAPI(apiId) {
    // 通过ID查找API的方法
    console.log('🔍 查找API ID:', apiId);
    console.log('🔍 当前interceptedAPIs:', this.interceptedAPIs);
    const api = this.interceptedAPIs.find(item => item.id == apiId);
    console.log('🔍 找到的API:', api);
    if (api) {
      console.log('🔍 API.body:', api.body);
      this.showCreateToolDialog(null, api);
    } else {
      console.error('未找到指定的API:', apiId);
    }
  }

  showCreateToolDialog(apiIndex = null, apiData = null) {
    const modal = this.uiManager.createModal();
    const modalContent = modal.querySelector(".modal-content");

    let selectedAPI = null;
    if (apiData) {
      console.log('🔍 showCreateToolDialog 使用传入的apiData:', apiData);
      selectedAPI = apiData;
    } else if (apiIndex !== null) {
      selectedAPI = this.interceptedAPIs[parseInt(apiIndex)];
      console.log('🔍 showCreateToolDialog 通过索引找到API:', selectedAPI);
    }
    
    console.log('🔍 showCreateToolDialog 最终的selectedAPI:', selectedAPI);
    if (selectedAPI) {
      console.log('🔍 selectedAPI.body:', selectedAPI.body);
    }

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3 data-i18n="modals.toolCreate.title">${$t('modals.toolCreate.title')}</h3>
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="toolName" data-i18n="modals.toolCreate.toolName">${$t('modals.toolCreate.toolName')}:</label>
          <input type="text" id="toolName" class="form-control" 
                 data-i18n-placeholder="modals.toolCreate.toolNamePlaceholder" 
                 placeholder="${$t('modals.toolCreate.toolNamePlaceholder')}" 
                 value="${
                   selectedAPI
                     ? this.generateToolNameFromURL(selectedAPI.url)
                     : ""
                 }"
                 onblur="app.apiManager.validateToolName(this)">
          <small class="form-text text-muted" data-i18n="modals.toolCreate.toolNameHelp">
            ${$t('modals.toolCreate.toolNameHelp')}
          </small>
        </div>
        <div class="form-group">
          <label for="toolDescription" data-i18n="modals.toolCreate.toolDescription">${$t('modals.toolCreate.toolDescription')}:</label>
          <textarea id="toolDescription" class="form-control" rows="3" 
                    data-i18n-placeholder="modals.toolCreate.toolDescriptionPlaceholder" 
                    placeholder="${$t('modals.toolCreate.toolDescriptionPlaceholder')}">${
            selectedAPI ? this.generateToolDescription(selectedAPI) : ""
          }</textarea>
        </div>
        <div class="form-group">
          <label for="toolURL" data-i18n="modals.toolCreate.apiUrl">${$t('modals.toolCreate.apiUrl')}:</label>
          <input type="text" id="toolURL" class="form-control" 
                 data-i18n-placeholder="modals.toolCreate.apiUrlPlaceholder" 
                 placeholder="${$t('modals.toolCreate.apiUrlPlaceholder')}" 
                 value="${selectedAPI ? selectedAPI.url : ""}">
        </div>
        <div class="form-group">
          <label for="toolMethod" data-i18n="modals.toolCreate.requestMethod">${$t('modals.toolCreate.requestMethod')}:</label>
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
          <label for="toolContentType" data-i18n="modals.toolCreate.contentType">${$t('modals.toolCreate.contentType')}:</label>
          <select id="toolContentType" class="form-control">
            <option value="application/json" ${
              !selectedAPI ||
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
          <label for="toolBody" data-i18n="modals.toolCreate.requestBody">${$t('modals.toolCreate.requestBody')}:</label>
          <textarea id="toolBody" class="form-control" rows="4" 
                    data-i18n-placeholder="modals.toolCreate.requestBodyPlaceholder" 
                    placeholder="${$t('modals.toolCreate.requestBodyPlaceholder')}">${
            selectedAPI ? this.generateToolParamsBodyOnly(selectedAPI) : "{}"
          }</textarea>
          <small class="form-text text-muted" data-i18n="modals.toolCreate.requestBodyHelp">
            ${$t('modals.toolCreate.requestBodyHelp')}
          </small>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="toolPublic" checked> <span data-i18n="modals.toolCreate.makePublic">${$t('modals.toolCreate.makePublic')}</span>
          </label>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="createKnowledge" onchange="app.apiManager.toggleKnowledgeFields(this.checked)"> <span data-i18n="modals.toolCreate.createKnowledge">${$t('modals.toolCreate.createKnowledge')}</span>
          </label>
        </div>
        <div id="knowledgeFields" style="display: none;">
          <div class="form-group">
            <label for="knowledgeQuestion" data-i18n="modals.toolCreate.knowledgeQuestion">${$t('modals.toolCreate.knowledgeQuestion')}:</label>
            <input type="text" id="knowledgeQuestion" class="form-control" 
                   data-i18n-placeholder="modals.toolCreate.knowledgeQuestionPlaceholder" 
                   placeholder="${$t('modals.toolCreate.knowledgeQuestionPlaceholder')}">
          </div>
          <div class="form-group">
            <label for="knowledgeAnswer" data-i18n="modals.toolCreate.knowledgeAnswer">${$t('modals.toolCreate.knowledgeAnswer')}:</label>
            <textarea id="knowledgeAnswer" class="form-control" rows="3" 
                      data-i18n-placeholder="modals.toolCreate.knowledgeAnswerPlaceholder" 
                      placeholder="${$t('modals.toolCreate.knowledgeAnswerPlaceholder')}"></textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="app.apiManager.createTool(); this.closest('.modal').remove();" data-i18n="modals.toolCreate.createTool">
          ${$t('modals.toolCreate.createTool')}
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove();" data-i18n="modals.cancel">
          ${$t('modals.cancel')}
        </button>
      </div>
    `;

    document.body.appendChild(modal);
    
    // 更新弹窗内的翻译文本
    if (window.app && window.app.uiUpdater) {
      window.app.uiUpdater.updateContainerTexts(modal);
    }
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
      alert($t('alerts.fillAllRequired'));
      return;
    }

    // 验证工具名称格式
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
      alert($t('alerts.invalidToolName'));
      return;
    }

    // 验证并解析请求体格式
    let parsedBody = null;
    if (body) {
      try {
        // body 是从 generateToolParamsBodyOnly 返回的 JSON 字符串
        // 先尝试解析为对象
        parsedBody = JSON.parse(body);
        console.log('解析后的body对象:', parsedBody);
      } catch (e) {
        // 如果解析失败，可能是普通字符串
        console.log('body不是JSON格式，作为原始字符串处理');
        parsedBody = body;
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
        alert($t('alerts.fillKnowledgeComplete'));
        return;
      }
    }

    try {
      let remoteToolId = null;
      let remoteKnowledgeId = null;
      let toolParamsForAPI = null; // 在外部定义变量

      // 构建工具参数：包含method、Content-Type，并将body内容平铺
      let toolParamsObj = {
        method: method,
        "Content-Type": contentType,
      };

      // 如果有body内容，将其平铺到params中
      // parsedBody 现在应该是一个对象（从 generateToolParamsBodyOnly 返回的JSON解析而来）
      if (parsedBody && typeof parsedBody === "object" && Object.keys(parsedBody).length > 0) {
        // 直接平铺解析后的对象
        Object.assign(toolParamsObj, parsedBody);
      } else if (typeof parsedBody === "string" && parsedBody.trim() && parsedBody.trim() !== "{}") {
        // 如果parsedBody还是字符串（解析失败的情况），不处理
        console.log('警告：parsedBody是字符串，跳过平铺');
      }

      toolParamsForAPI = JSON.stringify(toolParamsObj);

      if (createKnowledge) {
        // 调用create_tool_and_knowledge API
        const knowledgeQuestion = document
          .getElementById("knowledgeQuestion")
          .value.trim();
        const knowledgeAnswer = document
          .getElementById("knowledgeAnswer")
          .value.trim();

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
        params: toolParamsForAPI, // 统一使用构建好的params
        isPublic,
        createdAt: new Date().toISOString(),
        userId: this.authService.getUserId(),
      };

      this.generatedTools.push(tool);
      this.saveData();

      // 自动刷新服务器端工具列表（不管是否创建了远程工具）
      console.log("🔄 创建工具后自动刷新服务器端工具列表...");
      await this.loadServerTools();

      this.updateGeneratedTools();

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

    // 获取合并后的工具列表
    const mergedTools = this.getMergedTools();

    if (mergedTools.length === 0) {
      this.generatedToolsDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔧</div>
          <div data-i18n="alerts.noToolsCreated">${$t('alerts.noToolsCreated')}</div>
          <div style="font-size: 11px; color: #6c757d; margin-top: 4px;" data-i18n="alerts.localServerToolStats">
            ${$t('alerts.localServerToolStats', { 
              local: this.generatedTools.length, 
              server: this.serverTools.length 
            })}
          </div>
        </div>
      `;
      return;
    }

    // 添加统计信息
    const statsDiv = document.createElement("div");
    statsDiv.className = "tools-stats";
    statsDiv.style.cssText = `
      font-size: 11px; 
      color: #6c757d; 
      margin-bottom: 8px; 
      text-align: center;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 4px;
    `;
    statsDiv.innerHTML = `
      ${$t('alerts.toolsStatsTotal', { total: mergedTools.length, local: this.generatedTools.length, server: this.serverTools.length })}
      <button onclick="app.apiManager.refreshServerTools()" style="
        margin-left: 8px; 
        font-size: 10px; 
        padding: 2px 6px; 
        border: 1px solid #ccc; 
        background: #f8f9fa;
        border-radius: 3px;
        cursor: pointer;
      " data-i18n="alerts.refreshButton">${$t('alerts.refreshButton')}</button>
    `;
    this.generatedToolsDiv.appendChild(statsDiv);

    mergedTools.forEach((tool, index) => {
      const toolElement = document.createElement("div");
      toolElement.className = "generated-tool-item";

      // 根据来源设置不同的样式
      const sourceIcon = tool.source === "server" ? "☁️" : "💻";
      const sourceColor = tool.source === "server" ? "#28a745" : "#6c757d";

      toolElement.innerHTML = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between;">
          <div style="flex: 1; min-width: 0; padding-right: 8px;">
            <div style="font-weight: 500; color: #495057; margin-bottom: 2px;">
              ${sourceIcon} ${tool.name}
            </div>
            <div style="
              font-size: 11px; 
              color: #6c757d; 
              line-height: 1.3;
              word-wrap: break-word; 
              word-break: break-all;
              white-space: normal;
              max-width: 100%;
            ">
              ${tool.description}
            </div>
          </div>
          <div style="
            font-size: 10px; 
            color: ${sourceColor}; 
            white-space: nowrap;
            flex-shrink: 0;
            margin-top: 2px;
          ">
            ${tool.source === "server" ? $t('modals.toolDetails.server') : $t('modals.toolDetails.local')}
          </div>
        </div>
      `;

      toolElement.addEventListener("click", () =>
        this.showToolDetails(tool, index, tool.source)
      );
      this.generatedToolsDiv.appendChild(toolElement);
    });
  }

  showToolDetails(tool, index, source = "local") {
    const modal = this.uiManager.createModal();
    const modalContent = modal.querySelector(".modal-content");

    const sourceInfo =
      source === "server"
        ? `<div class="detail-item"><strong data-i18n="modals.toolDetails.source">${$t('modals.toolDetails.source')}:</strong> <span style="color: #28a745;">☁️ <span data-i18n="modals.toolDetails.server">${$t('modals.toolDetails.server')}</span></span></div>`
        : `<div class="detail-item"><strong data-i18n="modals.toolDetails.source">${$t('modals.toolDetails.source')}:</strong> <span style="color: #6c757d;">💻 <span data-i18n="modals.toolDetails.local">${$t('modals.toolDetails.local')}</span></span></div>`;

    // 统一的删除按钮，先删本地再删服务器
    const deleteButton = `<button class="btn btn-danger" onclick="app.apiManager.deleteToolUnified('${
      tool.name
    }', '${tool.id || ""}', '${source}'); this.closest('.modal').remove();" data-i18n="modals.toolDetails.deleteTool">
        ${$t('modals.toolDetails.deleteTool')}
      </button>`;

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3 data-i18n="modals.toolDetails.title">${$t('modals.toolDetails.title')}</h3>
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
      </div>
      <div class="modal-body">
        <div class="detail-item"><strong data-i18n="modals.toolDetails.name">${$t('modals.toolDetails.name')}:</strong> ${tool.name}</div>
        <div class="detail-item"><strong data-i18n="modals.toolDetails.description">${$t('modals.toolDetails.description')}:</strong> ${
          tool.description
        }</div>
        <div class="detail-item"><strong data-i18n="modals.toolDetails.url">${$t('modals.toolDetails.url')}:</strong> ${tool.url}</div>
        <div class="detail-item"><strong data-i18n="modals.toolDetails.method">${$t('modals.toolDetails.method')}:</strong> ${this.getToolMethod(
          tool
        )}</div>
        <div class="detail-item"><strong data-i18n="modals.toolDetails.contentType">${$t('modals.toolDetails.contentType')}:</strong> ${this.getToolContentType(
          tool
        )}</div>
        <div class="detail-item"><strong data-i18n="modals.toolDetails.parameters">${$t('modals.toolDetails.parameters')}:</strong>
          <div class="json-display"><pre>${this.formatToolBody(
            tool
          )}</pre></div>
        </div>
        <div class="detail-item"><strong data-i18n="modals.toolDetails.createdAt">${$t('modals.toolDetails.createdAt')}:</strong> ${new Date(
          tool.createdAt
        ).toLocaleString()}</div>
        <div class="detail-item"><strong data-i18n="modals.toolDetails.status">${$t('modals.toolDetails.status')}:</strong> ${
          tool.isPublic ? $t('modals.toolDetails.public') : $t('modals.toolDetails.private')
        }</div>
        ${sourceInfo}
        ${
          source === "server" && tool.id
            ? `<div class="detail-item"><strong data-i18n="modals.toolDetails.serverId">${$t('modals.toolDetails.serverId')}:</strong> ${tool.id}</div>`
            : ""
        }
      </div>
      <div class="modal-footer">
        ${deleteButton}
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove();" data-i18n="modals.close">
          ${$t('modals.close')}
        </button>
      </div>
    `;

    document.body.appendChild(modal);
    
    // 更新弹窗内的翻译文本
    if (window.app && window.app.uiUpdater) {
      window.app.uiUpdater.updateContainerTexts(modal);
    }
  }

  async deleteTool(index) {
    if (!confirm($t('alerts.confirmDeleteTool'))) {
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
      },
      body: {},
    };

    return JSON.stringify(defaultParams, null, 2);
  }

  formatToolBody(tool) {
    // 格式化工具参数显示
    if (tool.params) {
      try {
        const params = JSON.parse(tool.params);
        // 移除method和Content-Type，只显示实际参数
        const displayParams = { ...params };
        delete displayParams.method;
        delete displayParams["Content-Type"];
        delete displayParams.contentType; // 向后兼容，也删除旧字段名
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
    console.log("🔍 getContentType 被调用，API数据:", api);

    // 从API headers中获取Content-Type
    if (api.headers && Object.keys(api.headers).length > 0) {
      // 尝试多种Content-Type header的变体
      const contentType =
        api.headers["Content-Type"] ||
        api.headers["content-type"] ||
        api.headers["Content-type"] ||
        api.headers["CONTENT-TYPE"];

      console.log("📋 从headers中获取的Content-Type:", contentType);

      if (contentType) {
        // 提取主要的MIME类型，去掉charset等参数
        const mainType = contentType.split(";")[0].trim().toLowerCase();
        console.log("🎯 解析后的主要类型:", mainType);

        // 映射到我们支持的类型
        if (mainType.includes("application/json")) {
          console.log("✅ 检测到JSON类型");
          return "application/json";
        } else if (mainType.includes("application/x-www-form-urlencoded")) {
          console.log("✅ 检测到form-urlencoded类型");
          return "application/x-www-form-urlencoded";
        } else if (mainType.includes("multipart/form-data")) {
          console.log("✅ 检测到multipart类型");
          return "multipart/form-data";
        } else if (mainType.includes("text/plain")) {
          console.log("✅ 检测到text/plain类型");
          return "text/plain";
        } else if (mainType.includes("text/")) {
          console.log("✅ 检测到text类型，映射为text/plain");
          return "text/plain";
        }

        // 如果是其他类型，根据请求体内容推断
        if (api.body) {
          try {
            JSON.parse(api.body);
            return "application/json";
          } catch (e) {
            // 检查是否像URL编码的格式
            if (
              typeof api.body === "string" &&
              api.body.includes("=") &&
              api.body.includes("&")
            ) {
              return "application/x-www-form-urlencoded";
            }
          }
        }

        // 返回原始Content-Type，如果都不匹配
        return contentType.split(";")[0].trim();
      }
    }

    // 如果没有headers，根据请求方法和body内容推断
    if (
      api.method === "POST" ||
      api.method === "PUT" ||
      api.method === "PATCH"
    ) {
      if (api.body) {
        try {
          JSON.parse(api.body);
          return "application/json";
        } catch (e) {
          if (typeof api.body === "string" && api.body.includes("=")) {
            return "application/x-www-form-urlencoded";
          }
        }
      }
    }

    // 最后默认为json
    console.log("🔄 使用默认Content-Type: application/json");
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
        // 优先使用新的标准字段名，向后兼容旧的字段名
        return params["Content-Type"] || params.contentType || "application/json";
      } catch (e) {}
    }
    return "application/json";
  }

  buildToolParams(method, contentType, body) {
    // 构建完整的工具参数
    let paramsObj = {
      method: method,
      "Content-Type": contentType,
    };

    // 处理body内容
    if (body) {
      if (typeof body === "object") {
        // 已经是对象且不为空，直接平铺
        if (Object.keys(body).length > 0) {
          Object.assign(paramsObj, body);
        }
      } else if (typeof body === "string") {
        // 尝试解析字符串
        if (contentType === "application/json") {
          try {
            const parsed = JSON.parse(body);
            if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
              Object.assign(paramsObj, parsed);
            }
          } catch (e) {
            // JSON解析失败，不保存原始内容
          }
        } else if (contentType === "application/x-www-form-urlencoded") {
          try {
            // 跳过空的JSON对象字符串
            if (body.trim() !== "{}") {
              const params = new URLSearchParams(body);
              params.forEach((value, key) => {
                paramsObj[key] = value;
              });
            }
          } catch (e) {
            // form-urlencoded解析失败，不保存原始内容
          }
        }
        // 其他格式不处理，只保留method和Content-Type
      }
    }

    return JSON.stringify(paramsObj, null, 2);
  }

  generateToolParamsBodyOnly(api) {
    console.log('🔍 generateToolParamsBodyOnly 被调用，API数据:', api);
    console.log('🔍 API.body 内容:', api.body);
    console.log('🔍 API.body 类型:', typeof api.body);
    
    const bodyParams = {};

    // 只从请求体中提取参数，不提取URL查询参数
    if (api.body) {
      // 获取Content-Type
      const contentType =
        (api.headers && api.headers["content-type"]) ||
        (api.headers && api.headers["Content-Type"]) ||
        "";

      console.log('🔍 Content-Type:', contentType);

      // 先尝试从数组中获取body字符串（拦截API时body经常是数组）
      let bodyStr = api.body;
      if (Array.isArray(api.body) && api.body.length > 0) {
        console.log('🔍 body是数组，取第一个元素');
        bodyStr = api.body[0];
      }

      // 检查body是字符串还是对象
      if (typeof bodyStr === "string") {
        console.log('🔍 body是字符串类型:', bodyStr);
        
        if (contentType.includes("application/x-www-form-urlencoded")) {
          console.log('🔍 使用form-urlencoded解析字符串');
          try {
            const params = new URLSearchParams(bodyStr);
            params.forEach((value, key) => {
              console.log('🔍 解析到参数:', key, '=', value);
              // 对于form-urlencoded，值已经被URL解码，直接保存
              bodyParams[key] = value;
            });
          } catch (formError) {
            console.log('🔍 form解析失败:', formError);
          }
        } else {
          // 尝试JSON解析
          try {
            const bodyObj = JSON.parse(bodyStr);
            if (bodyObj && typeof bodyObj === "object" && Object.keys(bodyObj).length > 0) {
              Object.assign(bodyParams, bodyObj);
            }
          } catch (jsonError) {
            // JSON解析失败，尝试作为form数据
            try {
              const params = new URLSearchParams(bodyStr);
              params.forEach((value, key) => {
                // 对于form-urlencoded，值已经被URL解码，直接保存
                bodyParams[key] = value;
              });
            } catch (formError) {
              console.log('🔍 所有解析都失败');
            }
          }
        }
      } else if (typeof bodyStr === "object" && bodyStr !== null) {
        console.log('🔍 body是对象类型');
        
        // 如果是普通对象，直接使用
        const keys = Object.keys(bodyStr);
        console.log('🔍 对象的键:', keys);
        
        if (keys.length > 0 && !keys.some(key => key.includes('\n') || key.startsWith('{'))) {
          // 正常的键值对象
          Object.assign(bodyParams, bodyStr);
        } else {
          console.log('🔍 对象结构异常，跳过处理');
        }
      }
    }

    console.log('🔍 最终的bodyParams:', bodyParams);
    const result = JSON.stringify(bodyParams, null, 2);
    console.log('🔍 返回的结果:', result);
    return result;
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
        if (bodyObj && typeof bodyObj === "object" && Object.keys(bodyObj).length > 0) {
          Object.assign(toolParams.body, bodyObj);
        }
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
              // form解析失败，不保存原始数据
            }
          } else if (contentType.includes("multipart/form-data")) {
            // multipart数据不处理
          } else {
            // 其他格式不处理
          }
        }
      }
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

  // 域名header管理方法

  /**
   * 从URL中提取域名
   * @param {string} url - 完整的URL
   * @returns {string} 域名
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      console.error("无法解析URL:", url, e);
      return null;
    }
  }

  /**
   * 存储域名的headers
   * @param {string} url - API的URL
   * @param {Object} headers - 请求头对象
   */
  storeDomainHeaders(url, headers) {
    const domain = this.extractDomain(url);
    if (!domain) {
      console.error("无法从URL提取域名:", url);
      return;
    }

    try {
      // 过滤掉一些不需要存储的headers
      const skipHeaders = [
        "content-length",
        "content-encoding",
        "connection",
        "upgrade-insecure-requests",
        "cache-control",
        "accept-encoding",
        "accept-language",
      ];

      const filteredHeaders = {};
      Object.keys(headers).forEach((key) => {
        const lowerKey = key.toLowerCase();
        if (!skipHeaders.includes(lowerKey)) {
          filteredHeaders[key] = headers[key];
        }
      });

      // 获取当前的域名headers数据
      const storedData = window.app?.storageUtil?.loadAll() || {};
      if (!storedData.domainHeaders) {
        storedData.domainHeaders = {};
      }

      // 存储或更新域名headers
      storedData.domainHeaders[domain] = {
        headers: filteredHeaders,
        timestamp: new Date().toISOString(),
        url: url, // 记录最后一次更新时的URL
      };

      // 保存数据
      if (window.app?.storageUtil) {
        window.app.storageUtil.saveAll(storedData);
        console.log(`✅ 已存储域名 ${domain} 的headers:`, filteredHeaders);
      }
    } catch (error) {
      console.error("存储域名headers失败:", error);
    }
  }

  /**
   * 获取域名的headers
   * @param {string} url - API的URL
   * @returns {Object|null} 存储的headers对象，如果没有则返回null
   */
  getDomainHeaders(url) {
    const domain = this.extractDomain(url);
    if (!domain) {
      return null;
    }

    try {
      const storedData = window.app?.storageUtil?.loadAll() || {};
      const domainHeaders = storedData.domainHeaders || {};

      if (domainHeaders[domain]) {
        console.log(
          `📋 找到域名 ${domain} 的存储headers:`,
          domainHeaders[domain].headers
        );
        return domainHeaders[domain].headers;
      }

      console.log(`⚠️ 未找到域名 ${domain} 的存储headers`);
      return null;
    } catch (error) {
      console.error("获取域名headers失败:", error);
      return null;
    }
  }

  /**
   * 获取最新的域名headers（用于没有特定域名headers时的备选）
   * @returns {Object|null} 最新的headers对象，如果没有则返回null
   */
  getLatestHeaders() {
    try {
      const storedData = window.app?.storageUtil?.loadAll() || {};
      const domainHeaders = storedData.domainHeaders || {};

      // 找到最新的headers（按时间戳排序）
      let latestHeaders = null;
      let latestTime = 0;

      Object.values(domainHeaders).forEach((headerData) => {
        const timestamp = new Date(headerData.timestamp).getTime();
        if (timestamp > latestTime) {
          latestTime = timestamp;
          latestHeaders = headerData.headers;
        }
      });

      if (latestHeaders) {
        console.log("📋 使用最新的存储headers:", latestHeaders);
        return latestHeaders;
      }

      console.log("⚠️ 没有找到任何存储的headers");
      return null;
    } catch (error) {
      console.error("获取最新headers失败:", error);
      return null;
    }
  }

  /**
   * 清空某个域名的headers
   * @param {string} domain - 域名
   */
  clearDomainHeaders(domain) {
    try {
      const storedData = window.app?.storageUtil?.loadAll() || {};
      if (storedData.domainHeaders && storedData.domainHeaders[domain]) {
        delete storedData.domainHeaders[domain];
        window.app?.storageUtil?.saveAll(storedData);
        console.log(`✅ 已清空域名 ${domain} 的headers`);
        return true;
      }
      return false;
    } catch (error) {
      console.error("清空域名headers失败:", error);
      return false;
    }
  }

  /**
   * 获取所有存储的域名headers
   * @returns {Object} 所有域名headers的对象
   */
  getAllDomainHeaders() {
    try {
      const storedData = window.app?.storageUtil?.loadAll() || {};
      return storedData.domainHeaders || {};
    } catch (error) {
      console.error("获取所有域名headers失败:", error);
      return {};
    }
  }

  // 服务器端工具管理方法

  /**
   * 从服务器加载工具列表
   */
  async loadServerTools() {
    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        console.log("⚠️ 用户未登录，跳过加载服务器端工具");
        this.serverTools = [];
        return;
      }

      console.log("🔄 正在从服务器加载工具列表...");
      const result = await this.apiClient.queryTools(userId, "", 100, 0); // 获取前100个工具

      if (result.success && result.tools) {
        this.serverTools = result.tools.map((tool) => ({
          ...tool,
          isServerTool: true, // 标记为服务器端工具
          id: tool.id || tool.tool_id, // 统一ID字段
          name: tool.title || tool.tool_title || tool.name,
          description: tool.description || tool.tool_description,
          url: tool.url || tool.tool_url,
          method: this.extractMethodFromParams(tool.params || tool.tool_params),
          contentType: this.extractContentTypeFromParams(
            tool.params || tool.tool_params
          ),
          params: tool.params || tool.tool_params,
          isPublic: tool.public === "1" || tool.tool_public === "1",
          createdAt:
            tool.created_at || tool.createdAt || new Date().toISOString(),
          userId: tool.userId || tool.user_id,
        }));
        console.log(`✅ 成功加载 ${this.serverTools.length} 个服务器端工具`);
      } else {
        console.log("⚠️ 加载服务器端工具失败:", result.message);
        this.serverTools = [];
      }
    } catch (error) {
      console.error("❌ 加载服务器端工具出错:", error);
      this.serverTools = [];
    }
  }

  /**
   * 从工具参数中提取请求方法
   */
  extractMethodFromParams(params) {
    try {
      if (typeof params === "string") {
        const parsed = JSON.parse(params);
        return parsed.method || "GET";
      } else if (typeof params === "object" && params !== null) {
        return params.method || "GET";
      }
    } catch (e) {
      console.error("解析工具参数失败:", e);
    }
    return "GET";
  }

  /**
   * 从工具参数中提取Content-Type
   */
  extractContentTypeFromParams(params) {
    try {
      if (typeof params === "string") {
        const parsed = JSON.parse(params);
        return parsed.contentType || "application/json";
      } else if (typeof params === "object" && params !== null) {
        return params.contentType || "application/json";
      }
    } catch (e) {
      console.error("解析工具参数失败:", e);
    }
    return "application/json";
  }

  /**
   * 合并本地工具和服务器端工具，服务器端优先
   */
  getMergedTools() {
    const toolsMap = new Map();

    // 先添加本地工具
    this.generatedTools.forEach((tool) => {
      toolsMap.set(tool.name, {
        ...tool,
        isServerTool: false,
        source: "local",
      });
    });

    // 服务器端工具覆盖同名本地工具
    this.serverTools.forEach((tool) => {
      toolsMap.set(tool.name, {
        ...tool,
        source: "server",
      });
    });

    // 转换为数组并按创建时间排序
    return Array.from(toolsMap.values()).sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  /**
   * 刷新服务器端工具
   */
  async refreshServerTools() {
    await this.loadServerTools();
    this.updateGeneratedTools();
    this.uiManager.showNotification($t('alerts.serverToolsRefreshed'), "success");
  }

  /**
   * 统一的删除工具方法：先删除本地，再删除服务器
   */
  async deleteToolUnified(toolName, serverId, source) {
    if (
      !confirm($t('alerts.confirmDeleteToolUnified', { name: toolName }))
    ) {
      return;
    }

    try {
      let localDeleted = false;
      let serverDeleted = false;
      const results = [];

      // 第一步：删除本地工具
      console.log("🔄 第1步：查找并删除本地工具...");
      const localIndex = this.generatedTools.findIndex(
        (tool) => tool.name === toolName
      );

      if (localIndex !== -1) {
        const localTool = this.generatedTools[localIndex];

        // 如果本地工具有远程ID，先尝试删除远程工具
        if (localTool.remoteId) {
          try {
            console.log("删除本地工具关联的远程工具:", localTool.remoteId);
            const userId = this.authService.getUserId();
            if (userId) {
              const response = await this.apiClient.deleteTool(
                userId,
                localTool.remoteId
              );
              if (response.success) {
                console.log("✅ 本地工具关联的远程工具删除成功");
              }
            }
          } catch (error) {
            console.warn("⚠️ 删除本地工具关联的远程工具失败:", error);
          }
        }

        // 删除本地工具
        this.generatedTools.splice(localIndex, 1);
        this.saveData();
        localDeleted = true;
        results.push("✅ 本地工具删除成功");
        console.log("✅ 本地工具删除成功");
      } else {
        results.push("ℹ️ 未找到本地工具");
        console.log("ℹ️ 未找到同名的本地工具");
      }

      // 第二步：删除服务器端工具
      console.log("🔄 第2步：查找并删除服务器端工具...");

      // 先检查缓存的服务器工具
      const serverToolInCache = this.serverTools.find(
        (tool) => tool.name === toolName
      );
      let serverToolId = serverId;

      // 如果传入的serverId为空，尝试从缓存中获取
      if (!serverToolId && serverToolInCache) {
        serverToolId = serverToolInCache.id;
      }

      if (serverToolId) {
        try {
          const userId = this.authService.getUserId();
          if (!userId) {
            results.push("⚠️ 用户未登录，跳过服务器端删除");
          } else {
            console.log("删除服务器端工具:", serverToolId);
            const response = await this.apiClient.deleteTool(
              userId,
              serverToolId
            );

            if (response.success) {
              // 从本地缓存中移除服务器工具
              this.serverTools = this.serverTools.filter(
                (tool) => tool.id !== serverToolId
              );
              serverDeleted = true;
              results.push("✅ 服务器端工具删除成功");
              console.log("✅ 服务器端工具删除成功");
            } else {
              throw new Error(response.message || "服务器删除失败");
            }
          }
        } catch (error) {
          console.error("❌ 删除服务器端工具失败:", error);
          results.push(`❌ 服务器端删除失败: ${error.message}`);
        }
      } else {
        results.push("ℹ️ 未找到服务器端工具");
        console.log("ℹ️ 未找到服务器端工具ID");
      }

      // 自动刷新服务器端工具列表
      console.log("🔄 删除工具后自动刷新服务器端工具列表...");
      await this.loadServerTools();

      // 更新UI
      this.updateGeneratedTools();

      // 显示删除结果
      const summary = results.join("\n");
      const deleteCount = (localDeleted ? 1 : 0) + (serverDeleted ? 1 : 0);

      if (deleteCount > 0) {
        this.uiManager.showNotification(
          `工具"${toolName}"删除完成\n\n${summary}`,
          "success",
          5000
        );
      } else {
        this.uiManager.showNotification(
          `未找到要删除的工具"${toolName}"\n\n${summary}`,
          "warning",
          4000
        );
      }

      console.log(`🎯 删除操作完成，共删除 ${deleteCount} 个工具`);
    } catch (error) {
      console.error("❌ 删除工具过程中发生错误:", error);
      this.uiManager.showNotification(`删除失败: ${error.message}`, "error");
    }
  }

  /**
   * 删除服务器端工具（保留原方法作为备用）
   */
  async deleteServerTool(toolId, toolName) {
    if (!confirm($t('alerts.confirmDeleteServerTool', { name: toolName }))) {
      return;
    }

    try {
      const userId = this.authService.getUserId();
      if (!userId) {
        this.uiManager.showNotification("用户未登录", "error");
        return;
      }

      console.log("删除服务器端工具:", toolId);
      const response = await this.apiClient.deleteTool(userId, toolId);

      if (response.success) {
        // 从本地缓存中移除
        this.serverTools = this.serverTools.filter(
          (tool) => tool.id !== toolId
        );
        this.updateGeneratedTools();
        this.uiManager.showNotification("服务器端工具删除成功", "success");
        console.log("服务器端工具删除成功");
      } else {
        throw new Error(response.message || "删除失败");
      }
    } catch (error) {
      console.error("删除服务器端工具失败:", error);
      this.uiManager.showNotification(`删除失败: ${error.message}`, "error");
    }
  }

  /**
   * 启动定时自动刷新
   */
  startAutoRefresh() {
    // 清除已存在的定时器
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    // 每5秒刷新一次
    this.autoRefreshInterval = setInterval(async () => {
      try {
        console.log("🔄 定时自动刷新工具列表...");
        await this.loadServerTools();

        // 通知知识库管理器也进行刷新
        if (window.app && window.app.knowledgeManager) {
          console.log("🔄 定时自动刷新知识库...");
          await window.app.knowledgeManager.loadServerKnowledge();
        }

        this.updateGeneratedTools();
        console.log("✅ 定时刷新完成");
      } catch (error) {
        console.error("❌ 定时刷新失败:", error);
      }
    }, 5000); // 5秒间隔

    console.log("⏰ 定时自动刷新已启动（每5秒刷新工具和知识库）");
  }

  /**
   * 停止定时自动刷新
   */
  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
      console.log("⏰ 定时自动刷新已停止");
    }
  }

  /**
   * 重启定时自动刷新
   */
  restartAutoRefresh() {
    this.stopAutoRefresh();
    this.startAutoRefresh();
  }

  /**
   * 销毁方法，清理资源
   */
  destroy() {
    this.stopAutoRefresh();
  }
}
