/**
 * English translation file
 */

export default {
  // Common
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    loading: 'Loading...',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
    confirm: 'Confirm',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    refresh: 'Refresh',
    clear: 'Clear',
    copy: 'Copy',
    export: 'Export',
    import: 'Import',
    total: 'Total',
    available: 'Available'
  },

  // App title and description
  app: {
    title: 'WebSight - Intelligent Web Data Interception & Analysis Tool',
    description: 'Intelligent Web Data Interception & Analysis Tool',
    version: 'Version'
  },

  // API management
  api: {
    title: 'API Management',
    intercepted: 'Intercepted APIs',
    method: 'Method',
    url: 'Request URL',
    status: 'Status',
    timestamp: 'Timestamp',
    headers: 'Headers',
    body: 'Request Body',
    response: 'Response',
    responseBody: 'Response Body',
    responseHeaders: 'Response Headers',
    noData: 'No data available',
    clearAll: 'Clear All',
    fetchResponse: 'Fetch Response',
    generating: 'Generating...',
    generateTool: 'Generate Tool',
    toolGenerated: 'Tool generated successfully',
    toolGenerationFailed: 'Tool generation failed',
    copied: 'Copied to clipboard',
    copyFailed: 'Copy failed',
    filterPlaceholder: 'Filter APIs (URL, method, status code)...',
    stopIntercept: 'Stop Intercept',
    startIntercept: 'Start Intercept'
  },

  // Browser management
  browser: {
    title: 'Browser',
    address: 'Address Bar',
    go: 'Go',
    refresh: 'Refresh',
    back: 'Back',
    forward: 'Forward',
    home: 'Home',
    bookmark: 'Bookmark',
    history: 'History',
    devTools: 'Developer Tools',
    loading: 'Page loading...',
    loadError: 'Page load failed'
  },

  // Chat functionality
  chat: {
    title: 'AI Assistant',
    placeholder: 'Enter your question...',
    send: 'Send',
    thinking: 'Thinking...',
    processing: 'Processing...',
    error: 'Chat error, please try again',
    noHistory: 'No chat history',
    clearHistory: 'Clear History',
    newChat: 'New Chat',
    toolExecution: 'Tool Execution',
    executingTool: 'Executing tool...',
    toolExecuted: 'Tool executed successfully',
    toolFailed: 'Tool execution failed',
    welcome: {
      greeting: '👋 Welcome to APIForge AI Assistant!',
      canHelp: 'I can help you:',
      feature1: '🔍 Query information from knowledge base',
      feature2: '🛠️ Call configured tools to retrieve data',
      feature3: '💡 Answer technical questions',
      prompt: 'Please enter your question, I will do my best to help you!'
    },
    processingWithTime: '⏳ Processing... (elapsed {seconds} seconds)',
    queryFailed: 'Query failed',
    toolQueryFailed: '❌ Tool query failed: {error}\n\nTrying other methods...',
    directQueryFailed: 'Direct query failed',
    toolDataObtained: '📊 Tool data obtained, analyzing...',
    localToolExecutionFailed: 'Local tool execution failed: {error}'
  },

  // Knowledge management
  knowledge: {
    title: 'Knowledge Base',
    question: 'Question',
    answer: 'Answer',
    description: 'Description',
    create: 'Create Knowledge',
    edit: 'Edit Knowledge',
    delete: 'Delete Knowledge',
    search: 'Search Knowledge',
    noResults: 'No relevant knowledge found',
    created: 'Knowledge created successfully',
    updated: 'Knowledge updated successfully',
    deleted: 'Knowledge deleted successfully'
  },

  // Tools management
  tools: {
    title: 'Tools Management',
    name: 'Tool Name',
    description: 'Tool Description',
    url: 'Tool URL',
    method: 'Request Method',
    parameters: 'Parameters',
    timeout: 'Timeout',
    public: 'Public',
    private: 'Private',
    create: 'Create Tool',
    edit: 'Edit Tool',
    delete: 'Delete Tool',
    execute: 'Execute Tool',
    test: 'Test Tool',
    noTools: 'No tools available',
    created: 'Tool created successfully',
    updated: 'Tool updated successfully',
    deleted: 'Tool deleted successfully',
    executed: 'Tool executed successfully',
    executionFailed: 'Tool execution failed'
  },

  // Settings
  settings: {
    title: 'Settings',
    general: 'General Settings',
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    auto: 'Auto',
    apiSettings: 'API Settings',
    serverUrl: 'Server URL',
    timeout: 'Request Timeout',
    retries: 'Retry Count',
    debugMode: 'Debug Mode',
    logLevel: 'Log Level',
    clearCache: 'Clear Cache',
    resetSettings: 'Reset Settings',
    saved: 'Settings saved',
    resetConfirm: 'Are you sure you want to reset all settings?'
  },

  // Error messages
  errors: {
    networkError: 'Network connection failed',
    serverError: 'Server error',
    timeout: 'Request timeout',
    unauthorized: 'Unauthorized access',
    forbidden: 'Access forbidden',
    notFound: 'Resource not found',
    invalidData: 'Invalid data format',
    unknown: 'Unknown error'
  },

  // Confirmation dialogs
  confirmations: {
    deleteApi: 'Are you sure you want to delete this API record?',
    clearAllApis: 'Are you sure you want to clear all API records?',
    deleteTool: 'Are you sure you want to delete this tool?',
    deleteKnowledge: 'Are you sure you want to delete this knowledge?',
    clearChat: 'Are you sure you want to clear chat history?'
  },

  // Notification messages
  notifications: {
    apiIntercepted: 'New API request intercepted',
    toolCreated: 'Tool created successfully',
    knowledgeCreated: 'Knowledge created successfully',
    settingsSaved: 'Settings saved successfully',
    dataExported: 'Data exported successfully',
    dataImported: 'Data imported successfully'
  },

  // Modals and dialogs
  modals: {
    // Common
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    create: 'Create',
    
    // API details modal
    apiDetails: {
      title: 'API Details',
      generateTool: 'Generate Tool',
      close: 'Close'
    },
    
    // Knowledge creation modal
    knowledgeCreate: {
      title: 'Add Knowledge for Tool',
      selectTool: 'Select Tool',
      selectToolPlaceholder: 'Please select a tool',
      questionAndAnswer: 'Question and Answer',
      question: 'Question',
      questionPlaceholder: 'Enter question, e.g.: How to query Beijing weather?',
      answer: 'Answer',
      answerPlaceholder: 'Enter the corresponding answer or solution',
      makePublic: 'Make Public',
      createToolKnowledge: 'Create Tool Knowledge',
      required: '*'
    },
    
    // Tool creation modal
    toolCreate: {
      title: 'Create Tool',
      toolName: 'Tool Name',
      toolNamePlaceholder: 'e.g., get_weather or search api (start with letter, letters/numbers/underscores allowed)',
      toolNameHelp: 'Tool name for OpenAI function calling, must start with letter and contain only letters, numbers, underscores and hyphens',
      toolDescription: 'Tool Description',
      toolDescriptionPlaceholder: 'Please describe the function of this tool',
      apiUrl: 'API URL',
      apiUrlPlaceholder: 'Please enter the API URL',
      requestMethod: 'Request Method',
      contentType: 'Content-Type',
      requestBody: 'Request Body',
      requestBodyPlaceholder: 'Please enter request body content (JSON or other formats)',
      requestBodyHelp: 'For GET requests, usually no request body needed. For POST/PUT requests, fill in content according to Content-Type.',
      makePublic: 'Make Public',
      createKnowledge: 'Also Create Knowledge Base',
      knowledgeQuestion: 'Knowledge Question',
      knowledgeQuestionPlaceholder: 'e.g., How to use this tool?',
      knowledgeAnswer: 'Knowledge Answer',
      knowledgeAnswerPlaceholder: 'Please enter the corresponding answer or instructions',
      createTool: 'Create Tool'
    },
    
    // Tool details modal
    toolDetails: {
      title: 'Tool Details',
      name: 'Name',
      description: 'Description',
      url: 'URL',
      method: 'Request Method',
      contentType: 'Content-Type',
      parameters: 'Parameters',
      createdAt: 'Created At',
      status: 'Status',
      serverId: 'Server ID',
      source: 'Source',
      local: 'Local',
      server: 'Server',
      public: 'Public',
      private: 'Private',
      deleteTool: 'Delete Tool'
    }
  },

  // Alerts and confirmation messages
  alerts: {
    noToolsForKnowledge: 'Please generate at least one tool from intercepted APIs before creating knowledge',
    noToolsCreated: 'No tools created yet',
    noKnowledgeAdded: 'No knowledge added yet',
    createToolFirstTip: 'Please create tools first, then add relevant knowledge',
    localServerToolStats: 'Local: {local} | Server: {server}',
    toolsStatsTotal: 'Total: {total} | Local: {local} | Server: {server}',
    refreshButton: 'Refresh',
    serverToolsRefreshed: 'Server tools refreshed',
    noApiIntercepted: 'No API requests intercepted yet',
    enableInterceptTip: 'Please enable interception first, then perform operations on the web page',
    confirmClearApis: 'Are you sure you want to clear all API records?',
    apisCleared: 'API records cleared',
    pleaseSelectTool: 'Please select a tool',
    fillAllRequired: 'Please fill in all required fields',
    invalidToolName: 'Invalid tool name format! Must start with a letter and contain only letters, numbers, underscores, and hyphens',
    fillKnowledgeComplete: 'If you choose to create knowledge base, please fill in complete questions and answers',
    fillQuestionAnswer: 'Please fill in complete questions and answers',
    enterWebAddress: 'Please enter a web address',
    confirmDeleteTool: 'Are you sure you want to delete this tool?',
    confirmDeleteServerTool: 'Are you sure you want to delete server tool "{name}"?',
    confirmDeleteKnowledge: 'Are you sure you want to delete this knowledge?',
    confirmClearChat: 'Are you sure you want to clear chat history?',
    confirmDeleteToolUnified: 'Are you sure you want to delete tool "{name}"?\n\nWill delete in the following order:\n1. Delete local tool (if exists)\n2. Delete server tool (if exists)'
  }
};