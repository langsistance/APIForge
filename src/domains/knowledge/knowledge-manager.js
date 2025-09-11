/**
 * 知识管理器 - 负责知识库的创建、管理和搜索（集成远程API）
 */

import { CONFIG } from "../../utils/config.js";
import apiClient from "../../services/websight-api-client.js";
import authService from "../../services/auth-service.js";
import eventBus, { Events } from "../../shared/event-bus.js";

export class KnowledgeManager {
  constructor(uiManager, apiManager) {
    this.uiManager = uiManager;
    this.apiManager = apiManager;
    this.apiClient = apiClient;
    this.authService = authService;
    // 不再本地存储知识库数据，直接从服务器获取
    // userId通过authService.getUserId()动态获取，不存储

    // UI元素
    this.addKnowledgeBtn = null;
    this.knowledgeSearch = null;
    this.knowledgeList = null;
    this.knowledgeCount = null;
    this.availableKnowledgeCount = null;
  }

  async init() {
    this.initializeElements();
    this.setupEventListeners();
    await this.loadKnowledgeFromServer();
    console.log("✅ KnowledgeManager 初始化完成");
  }

  async loadKnowledgeFromServer() {
    try {
      const result = await this.apiClient.queryKnowledge(
        this.authService.getUserId(),
        "",
        100,
        0
      );
      if (result.success && result.knowledge) {
        console.log(
          `Loaded ${result.knowledge.length} knowledge items from server`
        );

        // 直接使用知识数据，不再获取额外的工具信息
        const enrichedKnowledge = result.knowledge;

        await this.updateKnowledgeList(enrichedKnowledge);
        this.updateKnowledgeStats(enrichedKnowledge);
      } else {
        await this.updateKnowledgeList([]);
        this.updateKnowledgeStats([]);
      }
    } catch (error) {
      console.error("Failed to load knowledge from server:", error);
      this.uiManager.showNotification("加载知识库失败", "error");
      await this.updateKnowledgeList([]);
      this.updateKnowledgeStats([]);
    }
  }

  initializeElements() {
    this.addKnowledgeBtn = document.getElementById("addKnowledgeBtn");
    this.knowledgeSearch = document.getElementById("knowledgeSearch");
    this.knowledgeList = document.getElementById("knowledgeList");
    this.knowledgeCount = document.getElementById("knowledgeCount");
    this.availableKnowledgeCount = document.getElementById(
      "availableKnowledgeCount"
    );
  }

  setupEventListeners() {
    this.addKnowledgeBtn?.addEventListener("click", () =>
      this.showAddKnowledgeDialog()
    );
    this.knowledgeSearch?.addEventListener("input", () =>
      this.filterKnowledge()
    );
  }

  showAddKnowledgeDialog() {
    // 检查是否有已生成的工具
    const tools = this.apiManager.getTools();
    if (tools.length === 0) {
      alert("请先从拦截的API中生成至少一个工具，然后才能创建知识库");
      return;
    }

    const modal = this.uiManager.createModal();
    const modalContent = modal.querySelector(".modal-content");

    // 生成工具选项
    const toolOptions = tools
      .map(
        (tool, index) =>
          `<option value="${index}">${tool.name} - ${tool.description}</option>`
      )
      .join("");

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3>为工具添加知识</h3>
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="selectedToolIndex">选择工具 <span class="required">*</span>:</label>
          <select id="selectedToolIndex" class="form-control" required>
            <option value="">请选择一个工具</option>
            ${toolOptions}
          </select>
        </div>
        
        <div class="form-section">
          <h5>问题和答案</h5>
          <div class="form-group">
            <label>问题 <span class="required">*</span>:</label>
            <input type="text" id="knowledgeQuestion" class="form-control" placeholder="请输入问题，如：如何查询北京的天气？" required>
          </div>
          <div class="form-group">
            <label>答案 <span class="required">*</span>:</label>
            <textarea id="knowledgeAnswer" class="form-control" rows="3" placeholder="请输入对应的答案或解决方案" required></textarea>
          </div>
        </div>
        
        <div class="form-group">
          <label>
            <input type="checkbox" id="knowledgePublic" checked> 设为公开
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="app.knowledgeManager.createToolKnowledge(); this.closest('.modal').remove();">
          创建工具知识
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove();">
          取消
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // 多问答对相关方法已移除，现在只支持单个问答对

  async createToolKnowledge() {
    const selectedToolIndex =
      document.getElementById("selectedToolIndex").value;
    const isPublic = document.getElementById("knowledgePublic").checked;
    const question = document.getElementById("knowledgeQuestion").value.trim();
    const answer = document.getElementById("knowledgeAnswer").value.trim();

    if (!selectedToolIndex) {
      alert("请选择一个工具");
      return;
    }

    if (!question || !answer) {
      alert("请填写完整的问题和答案");
      return;
    }

    const tools = this.apiManager.getTools();
    const selectedTool = tools[parseInt(selectedToolIndex)];

    // 创建知识库条目
    try {
      let remoteKnowledgeId = null;
      let remoteToolId = null;

      if (selectedTool.remoteId) {
        // 工具已有远程ID，只创建知识库
        console.log("工具已存在远程ID，调用create_knowledge API");

        const result = await this.apiClient.createKnowledge({
          userId: this.authService.getUserId(),
          question: question,
          description: selectedTool.description,
          answer: answer,
          public: isPublic,
          embeddingId: 1,
          modelName: "gpt-3.5-turbo",
          toolId: selectedTool.remoteId,
          params: selectedTool.params || "{}",
        });

        if (result.success) {
          remoteKnowledgeId = result.knowledge_id;
          console.log("知识库创建成功:", result);
        } else {
          throw new Error(result.message || "知识库创建失败");
        }
      } else {
        // 工具没有远程ID，需要同时创建工具和知识库
        console.log("工具无远程ID，调用create_tool_and_knowledge API");

        const result = await this.apiClient.createToolAndKnowledge({
          userId: this.authService.getUserId(),
          toolTitle: selectedTool.name,
          toolDescription: selectedTool.description,
          toolUrl: selectedTool.url,
          toolPush: 1,
          toolPublic: isPublic,
          toolTimeout: 30,
          toolParams: selectedTool.params || "{}",
          knowledgeQuestion: question,
          knowledgeDescription: selectedTool.description,
          knowledgeAnswer: answer,
          knowledgePublic: isPublic,
          embeddingId: 1,
          modelName: "gpt-3.5-turbo",
          knowledgeParams: selectedTool.params || "{}",
        });

        if (result.success) {
          remoteToolId = result.toolId;
          remoteKnowledgeId = result.knowledgeId;
          console.log("工具和知识库创建成功:", result);

          // 更新工具的远程ID
          selectedTool.remoteId = remoteToolId;
          this.saveData(); // 保存更新后的工具信息
        } else {
          throw new Error(result.message || "工具和知识库创建失败");
        }
      }

      // 不再保存本地知识库，直接从服务器重新加载
      await this.loadKnowledgeFromServer();

      // 触发事件
      eventBus.emit(Events.KNOWLEDGE_CREATED, {
        remoteId: remoteKnowledgeId,
        question,
        answer,
        toolName: selectedTool.name,
      });

      this.uiManager.showNotification(
        `成功为工具"${selectedTool.name}"创建知识条目`,
        "success"
      );
    } catch (error) {
      console.error("创建工具知识失败:", error);
      this.uiManager.showNotification(`创建失败: ${error.message}`, "error");
    }
  }

  async updateKnowledgeList(knowledgeItems) {
    if (!this.knowledgeList) return;

    this.knowledgeList.innerHTML = "";

    if (!knowledgeItems || knowledgeItems.length === 0) {
      this.knowledgeList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <div>还没有添加知识</div>
          <div style="font-size: 11px; color: #6c757d; margin-top: 4px;">
            请先创建工具，然后添加相关知识
          </div>
        </div>
      `;
      return;
    }

    knowledgeItems.forEach((knowledge) => {
      const knowledgeElement = document.createElement("div");
      knowledgeElement.className = "knowledge-item";

      // 显示问题作为主要内容
      const questionText = knowledge.question || "无问题";

      // 显示工具信息，优先显示tool_name，其次显示tool_id
      let toolInfo = "无关联工具";
      if (knowledge.tool_name) {
        toolInfo = `🔧 ${knowledge.tool_name}`;
      } else if (knowledge.tool_id) {
        toolInfo = `🔧 工具ID: ${knowledge.tool_id}`;
      }

      knowledgeElement.innerHTML = `
          <div class="knowledge-title">${questionText}</div>
          <div class="knowledge-description">${toolInfo}</div>
        `;

      knowledgeElement.addEventListener("click", () =>
        this.showKnowledgeDetails(knowledge)
      );
      this.knowledgeList.appendChild(knowledgeElement);
    });
  }

  showKnowledgeDetails(knowledge) {
    const modal = this.uiManager.createModal();
    const modalContent = modal.querySelector(".modal-content");

    // 生成问答对的HTML
    let qaContentHtml = "";

    if (knowledge.answer) {
      // 显示问题和答案
      qaContentHtml = `
        <div class="qa-detail-item">
          <div class="qa-detail-content">
            <div class="qa-question">
              <strong>问题:</strong> ${knowledge.question || "无问题"}
            </div>
            <div class="qa-answer">
              <strong>答案:</strong>
              <div class="answer-content">${knowledge.answer}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      qaContentHtml = `
        <div class="qa-detail-item">
          <div class="qa-detail-header">无内容</div>
        </div>
      `;
    }

    // 生成工具信息HTML
    let toolInfoHtml = "";
    if (knowledge.tool_name || knowledge.tool_id) {
      toolInfoHtml = `
          <div class="detail-item">
            <strong>关联工具:</strong> ${
              knowledge.tool_name || `工具ID: ${knowledge.tool_id}`
            }
          </div>
        `;
    } else {
      toolInfoHtml = `
          <div class="detail-item">
            <strong>关联工具:</strong> 无关联工具
          </div>
        `;
    }

    modalContent.innerHTML = `
      <div class="modal-header">
        <h3>知识库详情</h3>
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
      </div>
      <div class="modal-body">
        ${toolInfoHtml}
        <div class="detail-item">
          <strong>创建时间:</strong> ${
            knowledge.create_time
              ? new Date(knowledge.create_time).toLocaleString()
              : knowledge.created_at
              ? new Date(knowledge.created_at).toLocaleString()
              : "未知"
          }
        </div>
        <div class="detail-item">
          <strong>状态:</strong> ${knowledge.public !== false ? "公开" : "私有"}
        </div>
        <div class="detail-item">
          <strong>模型:</strong> ${knowledge.model_name || "未知"}
        </div>
        <div class="detail-item">
          <strong>问答内容:</strong>
        </div>
        <div class="qa-details-container">
          ${qaContentHtml}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" onclick="app.knowledgeManager.deleteKnowledge('${
          knowledge.id || knowledge.remoteId
        }'); this.closest('.modal').remove();">
          删除知识库
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove();">
          关闭
        </button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  async deleteKnowledge(knowledgeId) {
    if (!confirm("确定要删除这条知识吗？")) {
      return;
    }

    try {
      console.log("删除知识库:", knowledgeId);
      const response = await this.apiClient.deleteKnowledge(
        this.authService.getUserId(),
        knowledgeId
      );

      if (!response.success) {
        throw new Error(response.message || "删除失败");
      }

      console.log("知识库删除成功");

      // 从服务器重新加载知识库列表
      await this.loadKnowledgeFromServer();

      // 触发事件
      eventBus.emit(Events.KNOWLEDGE_DELETED, { knowledgeId });

      this.uiManager.showNotification("知识删除成功", "success");
    } catch (error) {
      console.error("删除知识失败:", error);
      this.uiManager.showNotification(`删除失败: ${error.message}`, "error");
    }
  }

  filterKnowledge() {
    const query = this.knowledgeSearch?.value.toLowerCase() || "";
    const items = document.querySelectorAll(".knowledge-item");

    items.forEach((item) => {
      const question =
        item.querySelector(".knowledge-title")?.textContent.toLowerCase() || "";
      const toolInfo =
        item
          .querySelector(".knowledge-description")
          ?.textContent.toLowerCase() || "";

      if (question.includes(query) || toolInfo.includes(query)) {
        item.style.display = "block";
      } else {
        item.style.display = "none";
      }
    });
  }

  updateKnowledgeStats(knowledgeItems) {
    if (this.knowledgeCount) {
      this.knowledgeCount.textContent = knowledgeItems
        ? knowledgeItems.length
        : 0;
    }

    if (this.availableKnowledgeCount) {
      const publicCount = knowledgeItems
        ? knowledgeItems.filter((k) => k.public !== false).length
        : 0;
      this.availableKnowledgeCount.textContent = publicCount;
    }
  }

  // 知识库搜索已经由 ChatManager 通过 findKnowledgeTool 处理
  // 这个方法不再被直接调用
  async searchKnowledgeBase(query) {
    // 返回 null，让 ChatManager 使用 findKnowledgeTool API
    return null;
  }

  // 数据管理 - 不再需要本地存储
  saveData() {
    // 仅保存工具信息（如果需要）
    if (window.app && window.app.saveLocalData) {
      window.app.saveLocalData();
    }
  }
}
