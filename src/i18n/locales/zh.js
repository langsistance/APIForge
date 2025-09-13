/**
 * 中文翻译文件
 */

export default {
  // 通用
  common: {
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    add: '添加',
    search: '搜索',
    loading: '加载中...',
    success: '成功',
    error: '错误',
    warning: '警告',
    info: '信息',
    confirm: '确认',
    close: '关闭',
    yes: '是',
    no: '否',
    back: '返回',
    next: '下一步',
    previous: '上一步',
    refresh: '刷新',
    clear: '清空',
    copy: '复制',
    export: '导出',
    import: '导入',
    total: '总数',
    available: '可用'
  },

  // 应用标题和描述
  app: {
    title: 'WebSight - 智能网页数据拦截与分析工具',
    description: '智能网页数据拦截与分析工具',
    version: '版本'
  },

  // API管理
  api: {
    title: 'API 管理',
    intercepted: '已拦截的 API',
    method: '请求方法',
    url: '请求URL',
    status: '状态',
    timestamp: '时间戳',
    headers: '请求头',
    body: '请求体',
    response: '响应',
    responseBody: '响应体',
    responseHeaders: '响应头',
    noData: '暂无数据',
    clearAll: '清空所有',
    fetchResponse: '获取响应',
    generating: '生成中...',
    generateTool: '生成工具',
    toolGenerated: '工具生成成功',
    toolGenerationFailed: '工具生成失败',
    copied: '已复制到剪贴板',
    copyFailed: '复制失败',
    filterPlaceholder: '过滤API (URL、方法、状态码)...',
    stopIntercept: '停止拦截',
    startIntercept: '开始拦截'
  },

  // 浏览器管理
  browser: {
    title: '浏览器',
    address: '地址栏',
    go: '访问',
    refresh: '刷新',
    back: '后退',
    forward: '前进',
    home: '首页',
    bookmark: '收藏',
    history: '历史记录',
    devTools: '开发者工具',
    loading: '页面加载中...',
    loadError: '页面加载失败'
  },

  // 聊天功能
  chat: {
    title: '智能助手',
    placeholder: '请输入您的问题...',
    send: '发送',
    thinking: '思考中...',
    processing: '处理中...',
    error: '聊天出错，请重试',
    noHistory: '暂无聊天记录',
    clearHistory: '清空历史',
    newChat: '新建对话',
    toolExecution: '工具执行',
    executingTool: '正在执行工具...',
    toolExecuted: '工具执行完成',
    toolFailed: '工具执行失败',
    welcome: {
      greeting: '👋 欢迎使用 APIForge 智能助手！',
      canHelp: '我可以帮助您：',
      feature1: '🔍 查询知识库中的信息',
      feature2: '🛠️ 调用已配置的工具获取数据', 
      feature3: '💡 回答技术相关问题',
      prompt: '请输入您的问题，我会尽力帮助您！'
    },
    processingWithTime: '⏳ 正在处理中... (已用时 {seconds} 秒)',
    queryFailed: '查询失败',
    toolQueryFailed: '❌ 工具查询失败：{error}\n\n正在尝试其他方式...',
    directQueryFailed: '直接查询失败',
    toolDataObtained: '📊 已获取工具数据，正在分析...',
    localToolExecutionFailed: '本地工具执行失败: {error}'
  },

  // 知识管理
  knowledge: {
    title: '知识库',
    question: '问题',
    answer: '答案',
    description: '描述',
    create: '创建知识',
    edit: '编辑知识',
    delete: '删除知识',
    search: '搜索知识',
    noResults: '未找到相关知识',
    created: '知识创建成功',
    updated: '知识更新成功',
    deleted: '知识删除成功'
  },

  // 工具管理
  tools: {
    title: '工具管理',
    name: '工具名称',
    description: '工具描述',
    url: '工具URL',
    method: '请求方法',
    parameters: '参数',
    timeout: '超时时间',
    public: '公开',
    private: '私有',
    create: '创建工具',
    edit: '编辑工具',
    delete: '删除工具',
    execute: '执行工具',
    test: '测试工具',
    noTools: '暂无工具',
    created: '工具创建成功',
    updated: '工具更新成功',
    deleted: '工具删除成功',
    executed: '工具执行成功',
    executionFailed: '工具执行失败'
  },

  // 设置
  settings: {
    title: '设置',
    general: '常规设置',
    language: '语言',
    theme: '主题',
    light: '浅色',
    dark: '深色',
    auto: '自动',
    apiSettings: 'API 设置',
    serverUrl: '服务器地址',
    timeout: '请求超时',
    retries: '重试次数',
    debugMode: '调试模式',
    logLevel: '日志级别',
    clearCache: '清空缓存',
    resetSettings: '重置设置',
    saved: '设置已保存',
    resetConfirm: '确定要重置所有设置吗？'
  },

  // 错误消息
  errors: {
    networkError: '网络连接失败',
    serverError: '服务器错误',
    timeout: '请求超时',
    unauthorized: '未授权访问',
    forbidden: '访问被禁止',
    notFound: '资源未找到',
    invalidData: '数据格式错误',
    unknown: '未知错误'
  },

  // 确认对话框
  confirmations: {
    deleteApi: '确定要删除这个 API 记录吗？',
    clearAllApis: '确定要清空所有 API 记录吗？',
    deleteTool: '确定要删除这个工具吗？',
    deleteKnowledge: '确定要删除这条知识吗？',
    clearChat: '确定要清空聊天记录吗？'
  },

  // 通知消息
  notifications: {
    apiIntercepted: '拦截到新的 API 请求',
    toolCreated: '工具创建成功',
    knowledgeCreated: '知识创建成功',
    settingsSaved: '设置保存成功',
    dataExported: '数据导出成功',
    dataImported: '数据导出成功'
  },

  // 弹窗和对话框
  modals: {
    // 通用
    close: '关闭',
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    create: '创建',
    
    // API详情弹窗
    apiDetails: {
      title: 'API详情',
      generateTool: '生成工具',
      close: '关闭'
    },
    
    // 知识创建弹窗
    knowledgeCreate: {
      title: '为工具添加知识',
      selectTool: '选择工具',
      selectToolPlaceholder: '请选择一个工具',
      questionAndAnswer: '问题和答案',
      question: '问题',
      questionPlaceholder: '请输入问题，如：如何查询北京的天气？',
      answer: '答案',
      answerPlaceholder: '请输入对应的答案或解决方案',
      makePublic: '设为公开',
      createToolKnowledge: '创建工具知识',
      required: '*'
    },
    
    // 工具创建弹窗
    toolCreate: {
      title: '创建工具',
      toolName: '工具名称',
      toolNamePlaceholder: '例如: get_weather 或 search api (字母开头，可包含字母数字下划线)',
      toolNameHelp: '工具名称用于 OpenAI function calling，必须以字母开头，只能包含字母、数字、下划线和连字符',
      toolDescription: '工具描述',
      toolDescriptionPlaceholder: '请描述这个工具的功能',
      apiUrl: 'API地址',
      apiUrlPlaceholder: '请输入API地址',
      requestMethod: '请求方式',
      contentType: 'Content-Type',
      requestBody: '请求体 (Body)',
      requestBodyPlaceholder: '请输入请求体内容（JSON或其他格式）',
      requestBodyHelp: '对于GET请求，通常不需要请求体。对于POST/PUT等请求，请根据Content-Type填写相应格式的内容。',
      makePublic: '设为公开',
      createKnowledge: '同时创建知识库',
      knowledgeQuestion: '知识库问题',
      knowledgeQuestionPlaceholder: '例如：如何使用这个工具？',
      knowledgeAnswer: '知识库答案',
      knowledgeAnswerPlaceholder: '请输入对应的答案或使用说明',
      createTool: '创建工具'
    },
    
    // 知识库详情弹窗
    knowledgeDetails: {
      title: '知识库详情',
      loadingToolDetails: '正在加载工具详情...',
      question: '❓ 问题',
      answer: '✅ 答案',
      noQuestion: '无问题',
      noQAContent: '暂无问答内容',
      toolName: '🏷️ 工具名称',
      toolDescription: '📝 工具描述',
      toolUrl: '🔗 工具URL',
      unknownTool: '未知工具',
      noDescription: '无描述',
      noUrl: '无URL',
      associatedTool: '🔧 关联工具',
      noAssociatedTool: '无关联工具',
      knowledgeContent: '📚 知识内容',
      toolInfo: '🔧 关联工具',
      basicInfo: 'ℹ️ 基本信息',
      createdAt: '创建时间',
      status: '状态',
      modelName: '模型',
      unknown: '未知',
      public: '公开',
      private: '私有',
      deleteKnowledge: '删除知识库'
    },
    
    // 工具详情弹窗
    toolDetails: {
      title: '工具详情',
      name: '名称',
      description: '描述',
      url: 'URL',
      method: '请求方式',
      contentType: 'Content-Type',
      parameters: '参数',
      createdAt: '创建时间',
      status: '状态',
      serverId: '服务器ID',
      source: '来源',
      local: '本地',
      server: '服务器',
      public: '公开',
      private: '私有',
      deleteTool: '删除工具'
    }
  },

  // 警告和确认消息
  alerts: {
    noToolsForKnowledge: '请先从拦截的API中生成至少一个工具，然后才能创建知识库',
    knowledgeCreationFailed: '知识库创建失败',
    toolAndKnowledgeCreationFailed: '工具和知识库创建失败',
    knowledgeCreatedForTool: '成功为工具"{name}"创建知识条目',
    createToolKnowledgeFailed: '创建工具知识失败',
    creationFailed: '创建失败: {error}',
    deleteFailed: '删除失败',
    knowledgeDeletedSuccess: '知识删除成功',
    deletionFailed: '删除失败: {error}',
    noToolsCreated: '还没有创建工具',
    noKnowledgeAdded: '还没有添加知识',
    createToolFirstTip: '请先创建工具，然后添加相关知识',
    localServerToolStats: '本地工具: {local} | 服务器工具: {server}',
    toolsStatsTotal: '总计: {total} | 本地: {local} | 服务器: {server}',
    refreshButton: '刷新',
    serverToolsRefreshed: '服务器端工具已刷新',
    noApiIntercepted: '还没有拦截到API请求',
    enableInterceptTip: '请先开启拦截，然后在网页中进行操作',
    confirmClearApis: '确定要清空所有API记录吗？',
    apisCleared: 'API记录已清空',
    pleaseSelectTool: '请选择一个工具',
    fillAllRequired: '请填写所有必填字段',
    invalidToolName: '工具名称格式不正确！必须以字母开头，只能包含字母、数字、下划线和连字符',
    fillKnowledgeComplete: '如果选择创建知识库，请填写完整的问题和答案',
    fillQuestionAnswer: '请填写完整的问题和答案',
    enterWebAddress: '请输入网址',
    confirmDeleteTool: '确定要删除这个工具吗？',
    confirmDeleteServerTool: '确定要删除服务器端工具"{name}"吗？',
    confirmDeleteKnowledge: '确定要删除这条知识吗？',
    confirmClearChat: '确定要清空聊天记录吗？',
    confirmDeleteToolUnified: '确定要删除工具"{name}"吗？\n\n将会按照以下顺序删除：\n1. 删除本地工具（如果存在）\n2. 删除服务器端工具（如果存在）'
  }
};