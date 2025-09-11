/**
 * 应用配置文件
 */

const API_BASE_URL = "http://52.53.129.41:7777";

export const CONFIG = {
  // API服务器配置
  API: {
    BASE_URL: API_BASE_URL,
    CREATE_TOOL_AND_KNOWLEDGE: `${API_BASE_URL}/create_tool_and_knowledge`,
    CREATE_KNOWLEDGE: `${API_BASE_URL}/create_knowledge`,
    FIND_KNOWLEDGE_TOOL: `${API_BASE_URL}/find_knowledge_tool`,
    QUERY: `${API_BASE_URL}/query`,
    GET_TOOL_REQUEST: `${API_BASE_URL}/get_tool_request`,
    SAVE_TOOL_RESPONSE: `${API_BASE_URL}/save_tool_response`,
    QUERY_TOOLS: `${API_BASE_URL}/query_tools`,
    QUERY_KNOWLEDGE: `${API_BASE_URL}/query_knowledge`,
    DELETE_TOOL: `${API_BASE_URL}/delete_tool`,
    DELETE_KNOWLEDGE: `${API_BASE_URL}/delete_knowledge`,
    UPDATE_TOOL: `${API_BASE_URL}/update_tool`,
    UPDATE_KNOWLEDGE: `${API_BASE_URL}/update_knowledge`,
  },

  // 应用设置
  APP: {
    NAME: "APIForge",
    VERSION: "1.0.0",
    STORAGE_KEY: "apiforge_app_data",
  },

  // 聊天设置
  CHAT: {
    MAX_POLL_ATTEMPTS: 120, // 增加到120次，3秒间隔 = 6分钟总时长
    POLL_INTERVAL: 3000, // 3秒轮询
    TOOL_TIMEOUT: 10000,
  },

  // 开发设置
  DEV: {
    MOCK_GET_TOOL_REQUEST: false, // 是否mock get_tool_request 接口
  },

  // UI设置
  UI: {
    NOTIFICATION_DURATION: 3000,
    AUTO_SAVE_INTERVAL: 30000,
  },
};
