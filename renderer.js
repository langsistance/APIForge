const { ipcRenderer } = require('electron');

class APIInterceptorApp {
  constructor() {
    this.isIntercepting = true; // 默认开启拦截
    this.interceptedAPIs = [];
    this.generatedTools = [];
    
    this.initializeElements();
    this.setupEventListeners();
    this.setupIPCListeners();
    
    // 添加直接测试按钮
    this.addDirectTestButton();
  }
  
  initializeElements() {
    this.urlInput = document.getElementById('urlInput');
    this.loadBtn = document.getElementById('loadBtn');
    this.startInterceptBtn = document.getElementById('startInterceptBtn');
    this.stopInterceptBtn = document.getElementById('stopInterceptBtn');
    this.webview = document.getElementById('webview');
    
    this.apiList = document.getElementById('apiList');
    this.clearApisBtn = document.getElementById('clearApisBtn');
    this.generatedToolsDiv = document.getElementById('generatedTools');
    this.exportToolsBtn = document.getElementById('exportToolsBtn');
    this.importToolsBtn = document.getElementById('importToolsBtn');
    
    // 初始化按钮状态（拦截默认开启）
    this.startInterceptBtn.disabled = true;
    this.stopInterceptBtn.disabled = false;
  }
  
  setupEventListeners() {
    this.loadBtn.addEventListener('click', () => this.loadWebpage());
    this.startInterceptBtn.addEventListener('click', () => this.startInterception());
    this.stopInterceptBtn.addEventListener('click', () => this.stopInterception());
    
    this.clearApisBtn.addEventListener('click', () => this.clearAPIs());
    this.exportToolsBtn.addEventListener('click', () => this.exportTools());
    this.importToolsBtn.addEventListener('click', () => this.importTools());
    
    this.urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.loadWebpage();
    });
  }
  
  setupIPCListeners() {
    ipcRenderer.on('api-intercepted', (event, apiCall) => {
      console.log('🔥 Frontend received api-intercepted event:', apiCall.method, apiCall.url);
      console.log('🔥 isIntercepting status:', this.isIntercepting);
      if (this.isIntercepting) {
        // 检查是否已存在相同的请求（避免重复）
        const isDuplicate = this.interceptedAPIs.some(existing => 
          existing.url === apiCall.url && 
          existing.method === apiCall.method &&
          Math.abs(new Date(existing.timestamp).getTime() - new Date(apiCall.timestamp).getTime()) < 2000 // 2秒内的相同请求视为重复
        );
        
        if (!isDuplicate) {
          this.interceptedAPIs.push(apiCall);
          this.updateAPIList();
          console.log('🔥 Added to interceptedAPIs. Total count:', this.interceptedAPIs.length);
        } else {
          console.log('🔄 Frontend skipping duplicate request:', apiCall.method, apiCall.url);
        }
      } else {
        console.log('🔥 Ignoring because isIntercepting is false');
      }
    });
    
    // 监听API完成事件
    ipcRenderer.on('api-completed', (event, apiCall) => {
      console.log('🔥 Frontend received api-completed event:', apiCall);
      if (this.isIntercepting) {
        // 查找并更新现有API记录
        const existingIndex = this.interceptedAPIs.findIndex(api => 
          api.url === apiCall.url && 
          Math.abs(api.timestamp - apiCall.timestamp) < 10000 // 10秒内的请求
        );
        
        if (existingIndex !== -1) {
          // 更新现有记录
          this.interceptedAPIs[existingIndex] = { ...this.interceptedAPIs[existingIndex], ...apiCall };
          console.log('🔥 Updated existing API:', this.interceptedAPIs[existingIndex]);
        } else {
          // 如果没找到，创建新记录
          this.interceptedAPIs.push(apiCall);
          console.log('🔥 Added new API from completion:', apiCall);
        }
        this.updateAPIList();
      }
    });

    // 授权功能已移除
    
    // 监听响应头更新
    ipcRenderer.on('api-response-headers', (event, apiCall) => {
      if (this.isIntercepting) {
        const existingIndex = this.interceptedAPIs.findIndex(api => api.id === apiCall.id);
        if (existingIndex !== -1) {
          this.interceptedAPIs[existingIndex] = apiCall;
          this.updateAPIList();
        }
      }
    });
    
    // 监听响应体更新
    ipcRenderer.on('api-response-body', (event, data) => {
      if (this.isIntercepting) {
        const existingIndex = this.interceptedAPIs.findIndex(api => api.id === data.id);
        if (existingIndex !== -1) {
          this.interceptedAPIs[existingIndex].responseBody = data.responseBody;
          this.updateAPIList();
          console.log('Updated API with response body:', this.interceptedAPIs[existingIndex]);
        }
      }
    });
    
    // 监听响应体错误
    ipcRenderer.on('api-response-error', (event, data) => {
      console.log('API response error:', data);
      const existingIndex = this.interceptedAPIs.findIndex(api => api.id === data.id);
      if (existingIndex !== -1) {
        this.interceptedAPIs[existingIndex].responseError = data.error;
        this.updateAPIList();
      }
    });
    
    // 监听来自webview的消息
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'api-request') {
        this.handleAPIRequest(event.data.data);
      } else if (event.data && event.data.type === 'api-response') {
        this.handleAPIResponse(event.data.data);
      } else if (event.data && event.data.type === 'webview-api-response') {
        this.handleWebViewAPIResponse(event.data.data);
      } else if (event.data && (event.data.type === 'xhr-response' || event.data.type === 'fetch-response')) {
        // 转发XHR/Fetch响应数据到主进程
        console.log('🎯 Frontend received XHR/Fetch response from webview:', event.data.type, event.data.data.method, event.data.data.url);
        ipcRenderer.send('xhr-fetch-response', event.data.data);
      }
    });
  }
  
  loadWebpage() {
    const url = this.urlInput.value.trim();
    if (!url) return;
    
    let fullUrl = url;
    
    // 处理不同类型的URL
    if (url.startsWith('file://')) {
      fullUrl = url; // 保持file://协议
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = 'https://' + url;
    }
    
    console.log('Loading URL:', fullUrl);
    this.webview.setAttribute('src', fullUrl);
    
    // 监听webview加载事件
    this.webview.addEventListener('did-finish-load', () => {
      console.log('Webpage loaded successfully:', fullUrl);
    });
    
    this.webview.addEventListener('did-fail-load', (event) => {
      console.log('Webpage load failed:', event.errorDescription, event.errorCode);
    });
  }
  
  startInterception() {
    this.isIntercepting = true;
    this.startInterceptBtn.disabled = true;
    this.stopInterceptBtn.disabled = false;
    
    // 等待webview准备好后注入拦截脚本
    const setupInterception = () => {
      console.log('Setting up webview interception...');
      
      // 使用不同的方式注入脚本
      const script = `
          (function() {
            if (window.interceptorSetup) return;
            window.interceptorSetup = true;
            
            // 初始化响应存储
            if (!window.interceptedResponses) {
              window.interceptedResponses = new Map();
            }
            
            console.log('Setting up API interception...');
            
            const originalFetch = window.fetch;
            const originalXHROpen = XMLHttpRequest.prototype.open;
            const originalXHRSend = XMLHttpRequest.prototype.send;
            
            // 拦截fetch请求
            if (window.fetch) {
              window.fetch = function(...args) {
                const [url, options = {}] = args;
                const requestId = 'fetch_' + Date.now() + '_' + Math.random();
                
                // 确保headers是对象格式
                let formattedHeaders = {};
                if (options.headers) {
                  if (options.headers instanceof Headers) {
                    // Headers对象转换为普通对象
                    for (const [key, value] of options.headers.entries()) {
                      formattedHeaders[key] = value;
                    }
                  } else if (typeof options.headers === 'object') {
                    formattedHeaders = { ...options.headers };
                  }
                }
                
                console.log('Fetch intercepted:', {
                  id: requestId,
                  url: url,
                  method: options.method || 'GET',
                  headers: formattedHeaders,
                  body: options.body
                });
                
                return originalFetch.apply(this, args).then(async (response) => {
                  try {
                    const responseClone = response.clone();
                    const responseText = await responseClone.text();
                    let responseData = responseText;
                    
                    try {
                      responseData = JSON.parse(responseText);
                    } catch (e) {
                      // 保持原始文本
                    }
                    
                    const responseInfo = {
                      id: requestId,
                      url: url,
                      method: options.method || 'GET',
                      status: response.status,
                      statusText: response.statusText,
                      headers: Object.fromEntries(response.headers.entries()),
                      data: responseData,
                      timestamp: new Date().toISOString()
                    };
                    
                    if (!window.interceptedResponses) {
                      window.interceptedResponses = new Map();
                    }
                    window.interceptedResponses.set(responseInfo.id, responseInfo);
                    console.log('Fetch response intercepted:', responseInfo);
                  } catch (err) {
                    console.log('Failed to parse fetch response:', err);
                  }
                  
                  return response;
                });
              };
            }
            
            // 拦截XMLHttpRequest
            const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
            
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
              this._method = method;
              this._url = url;
              this._requestId = 'xhr_' + Date.now() + '_' + Math.random();
              this._requestHeaders = {};
              console.log('XHR open intercepted:', method, url);
              return originalXHROpen.apply(this, arguments);
            };
            
            XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
              if (!this._requestHeaders) {
                this._requestHeaders = {};
              }
              this._requestHeaders[name] = value;
              console.log('XHR header set:', name, value);
              return originalXHRSetRequestHeader.apply(this, arguments);
            };
            
            XMLHttpRequest.prototype.send = function(body) {
              const self = this;
              
              console.log('XHR send intercepted:', {
                id: this._requestId,
                method: this._method,
                url: this._url,
                headers: this._requestHeaders || {},
                body: body
              });
              
              const originalOnreadystatechange = this.onreadystatechange;
              
              this.onreadystatechange = function(event) {
                if (this.readyState === 4) {
                  try {
                    let responseData = this.responseText;
                    try {
                      responseData = JSON.parse(this.responseText);
                    } catch (e) {
                      // 保持原始文本
                    }
                    
                    const responseInfo = {
                      id: self._requestId,
                      url: self._url,
                      method: self._method,
                      status: this.status,
                      statusText: this.statusText,
                      headers: this.getAllResponseHeaders(),
                      data: responseData,
                      timestamp: new Date().toISOString()
                    };
                    
                    if (!window.interceptedResponses) {
                      window.interceptedResponses = new Map();
                    }
                    window.interceptedResponses.set(responseInfo.id, responseInfo);
                    console.log('XHR response intercepted:', responseInfo);
                  } catch (err) {
                    console.log('Failed to parse XHR response:', err);
                  }
                }
                
                if (originalOnreadystatechange) {
                  originalOnreadystatechange.call(this, event);
                }
              };
              
              return originalXHRSend.apply(this, arguments);
            };
            
            console.log('API interception setup complete!');
          })();
        `;
      
      // 尝试多种方式注入脚本
      if (this.webview.executeJavaScript) {
        this.webview.executeJavaScript(script).catch(err => {
          console.log('executeJavaScript failed:', err);
        });
      }
      
      // 备用方法：通过preload
      if (this.webview.getWebContentsId) {
        const webContents = this.webview.getWebContents && this.webview.getWebContents();
        if (webContents && webContents.executeJavaScript) {
          webContents.executeJavaScript(script).catch(err => {
            console.log('webContents.executeJavaScript failed:', err);
          });
        }
      }
      
      console.log('Script injection attempted');
    };
    
    // 如果webview已经加载，立即设置拦截
    if (this.webview.src && this.webview.src !== 'about:blank') {
      setupInterception();
    }
    
    // 监听webview的dom-ready事件
    this.webview.addEventListener('dom-ready', () => {
      console.log('Webview DOM ready, injecting script...');
      setupInterception();
      
      // 额外注入简化的响应拦截脚本
      const simpleScript = `
        (function() {
          console.log('🚀 Simple interception script loaded');
          
          // 简化的fetch拦截
          const originalFetch = window.fetch;
          if (originalFetch) {
            window.fetch = function(...args) {
              const [url, options = {}] = args;
              console.log('🔍 Simple fetch intercepted:', url, options.method || 'GET');
              
              return originalFetch.apply(this, args).then(async (response) => {
                try {
                  const clone = response.clone();
                  const text = await clone.text();
                  
                  console.log('📥 Simple fetch response:', {
                    url: url,
                    status: response.status,
                    body: text.substring(0, 200) + (text.length > 200 ? '...' : '')
                  });
                  
                  // 通过console传递数据
                  console.log('RESPONSE_DATA:', JSON.stringify({
                    url: url,
                    method: options.method || 'GET',
                    status: response.status,
                    data: text,
                    timestamp: Date.now()
                  }));
                  
                } catch (e) {
                  console.log('❌ Simple fetch response error:', e.message);
                }
                return response;
              });
            };
          }
          
          // 简化的XHR拦截
          const originalOpen = XMLHttpRequest.prototype.open;
          const originalSend = XMLHttpRequest.prototype.send;
          
          XMLHttpRequest.prototype.open = function(method, url) {
            this._method = method;
            this._url = url;
            console.log('🔍 Simple XHR open:', method, url);
            return originalOpen.apply(this, arguments);
          };
          
          XMLHttpRequest.prototype.send = function(body) {
            const self = this;
            const originalOnready = this.onreadystatechange;
            
            this.onreadystatechange = function() {
              if (this.readyState === 4 && this.status === 200) {
                console.log('📥 Simple XHR response:', {
                  url: self._url,
                  status: this.status,
                  body: this.responseText.substring(0, 200) + (this.responseText.length > 200 ? '...' : '')
                });
                
                // 通过console传递数据
                console.log('RESPONSE_DATA:', JSON.stringify({
                  url: self._url,
                  method: self._method,
                  status: this.status,
                  data: this.responseText,
                  timestamp: Date.now()
                }));
              }
              
              if (originalOnready) {
                originalOnready.call(this);
              }
            };
            
            return originalSend.apply(this, arguments);
          };
          
          console.log('✅ Simple interception active');
        })();
      `;
      
      // 使用executeJavaScript注入简化脚本
      this.webview.executeJavaScript(simpleScript).then(() => {
        console.log('✅ Simple script injected successfully');
      }).catch(err => {
        console.log('❌ Simple script injection failed:', err);
      });
    });
    
    // 监听webview的ipc消息
    this.webview.addEventListener('ipc-message', (event) => {
      console.log('Webview IPC message:', event.channel, event.args);
      if (event.channel === 'api-response') {
        this.handleWebViewAPIResponse(event.args[0]);
      }
    });
    
    // 监听webview加载事件
    this.webview.addEventListener('did-start-loading', () => {
      console.log('🌐 Webview started loading');
    });
    
    this.webview.addEventListener('did-finish-load', () => {
      console.log('🌐 Webview finished loading');
      
      // 测试webview JavaScript执行
      setTimeout(() => {
        const testScript = `
          console.log('🧪 Test script executed in webview');
          console.log('🧪 Current URL:', window.location.href);
          console.log('🧪 Has fetch:', typeof window.fetch);
          console.log('🧪 Has XMLHttpRequest:', typeof XMLHttpRequest);
          'Test execution completed'
        `;
        
        this.webview.executeJavaScript(testScript)
          .then(result => console.log('🧪 Test script result:', result))
          .catch(err => console.log('🧪 Test script error:', err));
      }, 1000);
    });
    
    this.webview.addEventListener('did-fail-load', (event) => {
      console.log('🌐 Webview failed to load:', event.errorDescription);
    });
    
    // 监听webview的console消息来获取拦截数据
    this.webview.addEventListener('console-message', (event) => {
      const message = event.message;
      const level = event.level;
      console.log(`WebView console [${level}]:`, message);
      
      // 处理RESPONSE_DATA消息
      if (message.startsWith('RESPONSE_DATA:')) {
        try {
          const jsonStr = message.replace('RESPONSE_DATA:', '');
          const responseData = JSON.parse(jsonStr);
          console.log('📦 Parsed response data from webview:', responseData);
          this.handleWebViewAPIResponse(responseData);
        } catch (e) {
          console.log('❌ Failed to parse RESPONSE_DATA:', e);
        }
      }
      
      // 处理Fetch响应拦截
      if (message.includes('Fetch response intercepted:')) {
        try {
          const jsonStart = message.indexOf('{');
          if (jsonStart !== -1) {
            const jsonStr = message.substring(jsonStart);
            const responseData = JSON.parse(jsonStr);
            console.log('Parsed fetch response:', responseData);
            this.handleWebViewAPIResponse(responseData);
          }
        } catch (e) {
          console.log('Failed to parse fetch response data:', e);
        }
      }
      
      // 处理XHR响应拦截
      if (message.includes('XHR response intercepted:')) {
        try {
          const jsonStart = message.indexOf('{');
          if (jsonStart !== -1) {
            const jsonStr = message.substring(jsonStart);
            const responseData = JSON.parse(jsonStr);
            console.log('Parsed XHR response:', responseData);
            this.handleWebViewAPIResponse(responseData);
          }
        } catch (e) {
          console.log('Failed to parse XHR response data:', e);
        }
      }
      
      // 处理Fetch请求拦截
      if (message.includes('Fetch intercepted:')) {
        try {
          const jsonStart = message.indexOf('{');
          if (jsonStart !== -1) {
            const jsonStr = message.substring(jsonStart);
            const data = JSON.parse(jsonStr);
            if (data.url && data.method) {
              data.timestamp = new Date().toISOString();
              this.handleAPIRequest(data);
            }
          }
        } catch (e) {
          console.log('Failed to parse fetch intercepted data:', e);
        }
      }
      
      // 处理XHR请求拦截
      if (message.includes('XHR send intercepted:')) {
        try {
          const jsonStart = message.indexOf('{');
          if (jsonStart !== -1) {
            const jsonStr = message.substring(jsonStart);
            const data = JSON.parse(jsonStr);
            if (data.url && data.method) {
              data.timestamp = new Date().toISOString();
              this.handleAPIRequest(data);
            }
          }
        } catch (e) {
          console.log('Failed to parse XHR intercepted data:', e);
        }
      }
      
      // 处理其他拦截消息（保持兼容性）
      if (message.includes('intercepted:') && !message.includes('response intercepted:') && 
          !message.includes('Fetch intercepted:') && !message.includes('XHR send intercepted:')) {
        try {
          const jsonStart = message.indexOf('{');
          if (jsonStart !== -1) {
            const jsonStr = message.substring(jsonStart);
            const data = JSON.parse(jsonStr);
            if (data.url && data.method) {
              data.id = Date.now() + Math.random();
              data.timestamp = new Date().toISOString();
              this.handleAPIRequest(data);
            }
          }
        } catch (e) {
          console.log('Failed to parse intercepted data:', e);
        }
      }
    });
    
    console.log('API interception started');
    
    // 定期检查webview中的响应数据
    this.startResponseBodyPolling();
  }
  
  stopInterception() {
    this.isIntercepting = false;
    this.startInterceptBtn.disabled = false;
    this.stopInterceptBtn.disabled = true;
    
    // 停止轮询
    if (this.responsePollingInterval) {
      clearInterval(this.responsePollingInterval);
      this.responsePollingInterval = null;
    }
    
    console.log(`API interception stopped. Total intercepted: ${this.interceptedAPIs.length}`);
  }
  
  startResponseBodyPolling() {
    // 每2秒检查一次webview中的响应数据
    this.responsePollingInterval = setInterval(async () => {
      if (!this.isIntercepting || !this.webview.src || this.webview.src === 'about:blank') return;
      
      try {
        const result = await this.webview.executeJavaScript(`
          (function() {
            if (window.interceptedResponses && window.interceptedResponses.size > 0) {
              const responses = Array.from(window.interceptedResponses.values());
              window.interceptedResponses.clear(); // 清空已读取的响应
              return responses;
            }
            return [];
          })();
        `);
        
        if (result && result.length > 0) {
          console.log('Polled responses from webview:', result);
          result.forEach(responseData => {
            this.handleWebViewAPIResponse(responseData);
          });
        }
      } catch (err) {
        // 忽略错误，可能是页面还没加载完成
      }
    }, 2000);
  }
  
  handleAPIRequest(requestData) {
    console.log('handleAPIRequest called with:', requestData);
    
    if (!this.isIntercepting) {
      console.log('Not intercepting, ignoring request');
      return;
    }
    
    if (!requestData) {
      console.log('No request data provided');
      return;
    }
    
    // 创建新的API记录
    const newAPI = {
      id: requestData.id,
      url: requestData.url,
      method: requestData.method || 'GET',
      timestamp: requestData.timestamp,
      headers: requestData.headers || {},
      body: requestData.body ? (typeof requestData.body === 'string' ? [requestData.body] : [JSON.stringify(requestData.body)]) : null,
      requestType: requestData.type
    };
    
    this.interceptedAPIs.push(newAPI);
    this.updateAPIList();
    console.log('Added new API request:', newAPI);
    console.log('Total intercepted APIs:', this.interceptedAPIs.length);
  }

  handleAPIResponse(responseData) {
    console.log('handleAPIResponse called with:', responseData);
    
    if (!this.isIntercepting) {
      console.log('Not intercepting, ignoring response');
      return;
    }
    
    if (!responseData) {
      console.log('No response data provided');
      return;
    }
    
    // 查找对应的API请求并更新响应数据
    const apiIndex = this.interceptedAPIs.findIndex(api => 
      api.url === responseData.url && 
      Math.abs(new Date(api.timestamp).getTime() - new Date(responseData.timestamp).getTime()) < 10000
    );
    
    if (apiIndex !== -1) {
      this.interceptedAPIs[apiIndex].responseBody = responseData.data;
      this.interceptedAPIs[apiIndex].responseStatus = responseData.status;
      this.interceptedAPIs[apiIndex].responseStatusText = responseData.statusText;
      this.interceptedAPIs[apiIndex].responseHeaders = responseData.headers;
      console.log('Updated API with response:', this.interceptedAPIs[apiIndex]);
      this.updateAPIList(); // 刷新显示
    } else {
      console.log('No matching request found for response, creating new entry');
      // 如果找不到对应的请求，创建新的条目
      const newAPI = {
        id: Date.now() + Math.random(),
        url: responseData.url,
        method: responseData.method || 'GET',
        timestamp: responseData.timestamp,
        headers: {},
        body: null,
        responseBody: responseData.data,
        responseStatus: responseData.status,
        responseStatusText: responseData.statusText,
        responseHeaders: responseData.headers
      };
      this.interceptedAPIs.push(newAPI);
      this.updateAPIList();
      console.log('Created new API entry from response:', newAPI);
    }
  }
  
  handleWebViewAPIResponse(responseData) {
    console.log('handleWebViewAPIResponse called with:', responseData);
    
    if (!this.isIntercepting) {
      console.log('Not intercepting, ignoring webview response');
      return;
    }
    
    if (!responseData) {
      console.log('No webview response data provided');
      return;
    }
    
    // 查找对应的API请求并更新响应体数据
    const apiIndex = this.interceptedAPIs.findIndex(api => 
      api.url === responseData.url
    );
    
    if (apiIndex !== -1) {
      this.interceptedAPIs[apiIndex].responseBody = responseData.data;
      if (!this.interceptedAPIs[apiIndex].responseStatus) {
        this.interceptedAPIs[apiIndex].responseStatus = responseData.status;
        this.interceptedAPIs[apiIndex].responseStatusText = responseData.statusText;
      }
      console.log('Updated API with webview response body:', this.interceptedAPIs[apiIndex]);
      this.updateAPIList(); // 刷新显示
    } else {
      console.log('No matching request found for webview response');
    }
  }

  async clearAPIs() {
    this.interceptedAPIs = [];
    await ipcRenderer.invoke('clear-intercepted-apis');
    this.updateAPIList();
  }
  
  updateAPIList() {
    console.log('🔄 Updating API list, total APIs:', this.interceptedAPIs.length);
    console.log('🔄 API list element:', this.apiList);
    
    if (!this.apiList) {
      console.error('❌ apiList element not found!');
      return;
    }
    
    this.apiList.innerHTML = '';
    
    this.interceptedAPIs.forEach((api, index) => {
      const apiElement = document.createElement('div');
      apiElement.className = 'api-item';
      apiElement.innerHTML = `
        <div class="api-method">${api.method}</div>
        <div class="api-url">${api.url}</div>
        <div class="api-time">${new Date(api.timestamp).toLocaleTimeString()}</div>
      `;
      
      apiElement.addEventListener('click', () => this.showAPIDetails(api, index));
      this.apiList.appendChild(apiElement);
    });
  }
  
  showAPIDetails(api, index) {
    // 创建模态对话框
    const modal = this.createModal();
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.innerHTML = `
      <div class="modal-header">
        <h3>API详情</h3>
        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
      </div>
      <div class="modal-body">
        <div class="api-detail-section">
          <h4>基本信息</h4>
          <div class="detail-item">
            <strong>方法:</strong> <span class="method-badge method-${api.method.toLowerCase()}">${api.method}</span>
          </div>
          <div class="detail-item">
            <strong>URL:</strong> <div class="url-display">${api.url}</div>
          </div>
          <div class="detail-item">
            <strong>时间:</strong> ${new Date(api.timestamp).toLocaleString()}
          </div>
          <div class="detail-item">
            <strong>状态码:</strong> ${api.statusCode || '未知'}
          </div>
        </div>
        
        <div class="api-detail-section">
          <h4>URL参数 (Query Parameters)</h4>
          <div class="json-display">${this.formatQueryParams(api.url)}</div>
        </div>
        
        <div class="api-detail-section">
          <h4>请求头 (Headers)</h4>
          <div class="json-display">${this.formatJSON(api.headers || {})}</div>
        </div>
        
        <div class="api-detail-section">
          <h4>请求体 (Body)</h4>
          <div class="json-display">${this.formatRequestBody(api.body)}</div>
        </div>
        
        <div class="api-detail-section">
          <h4>响应头 (出参)</h4>
          <div class="json-display">${this.formatJSON(api.responseHeaders || {})}</div>
        </div>
        
        <div class="api-detail-section">
          <h4>响应体 (出参)</h4>
          <div class="json-display response-body" id="responseBody-${index}">
            ${this.formatResponseBody(api.responseBody)}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="app.generateToolFromAPI(${JSON.stringify(api).replace(/"/g, '&quot;')}, ${index}); this.closest('.modal').remove();">
          生成工具
        </button>
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove();">
          关闭
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
  }
  
  createModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content"></div>`;
    
    // 点击背景关闭模态框
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    return modal;
  }
  
  formatJSON(obj) {
    if (!obj || Object.keys(obj).length === 0) {
      return '<div class="empty-data">无数据</div>';
    }
    
    try {
      return `<pre>${JSON.stringify(obj, null, 2)}</pre>`;
    } catch (e) {
      return `<div class="error-data">格式化错误: ${e.message}</div>`;
    }
  }
  
  formatQueryParams(url) {
    try {
      const urlObj = new URL(url);
      const params = {};
      
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      
      if (Object.keys(params).length === 0) {
        return '<div class="empty-data">无URL参数</div>';
      }
      
      return `<pre>${JSON.stringify(params, null, 2)}</pre>`;
    } catch (e) {
      return '<div class="error-data">URL解析失败</div>';
    }
  }
  
  formatRequestBody(body) {
    if (!body || body.length === 0) {
      return '<div class="empty-data">无请求体</div>';
    }
    
    try {
      // 尝试解析为JSON
      const parsed = JSON.parse(body[0]);
      return `<pre>${JSON.stringify(parsed, null, 2)}</pre>`;
    } catch (e) {
      // 如果不是JSON，直接显示原始数据
      return `<pre>${body[0]}</pre>`;
    }
  }
  
  formatResponseBody(body) {
    if (!body) {
      return '<div class="empty-data">无响应数据</div>';
    }
    
    try {
      if (typeof body === 'string') {
        // 检查是否是HTML内容
        if (body.trim().toLowerCase().startsWith('<!doctype html') || 
            body.trim().toLowerCase().startsWith('<html')) {
          
          // 为HTML内容创建特殊显示
          const sizeKB = (body.length / 1024).toFixed(1);
          const preview = body.substring(0, 500) + (body.length > 500 ? '...' : '');
          
          const responseId = `html-response-${Date.now()}-${Math.random()}`;
          setTimeout(() => {
            this.setupHtmlToggleButton(responseId, body);
          }, 100);
          
          return `
            <div class="html-response" id="${responseId}">
              <div class="response-info">
                <strong>HTML文档</strong> - 大小: ${sizeKB}KB
                <div class="response-buttons">
                  <button class="toggle-full-content" data-target="${responseId}">
                    查看完整内容
                  </button>
                  <button class="render-html-content" data-target="${responseId}">
                    渲染为HTML
                  </button>
                </div>
              </div>
              <div class="html-preview">
                <strong>预览 (前500字符):</strong>
                <pre class="html-content">${this.escapeHtml(preview)}</pre>
              </div>
              <div class="html-full" style="display: none;">
                <strong>完整HTML:</strong>
                <pre class="html-content" style="max-height: 400px; overflow-y: auto;">${this.escapeHtml(body)}</pre>
              </div>
              <div class="html-rendered" style="display: none;">
                <strong>HTML渲染效果:</strong>
                <div class="html-render-container" style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; background: white; padding: 10px;">
                  <!-- HTML内容将在这里渲染 -->
                </div>
              </div>
            </div>
          `;
        }
        
        // 尝试解析为JSON
        const parsed = JSON.parse(body);
        return `<pre>${JSON.stringify(parsed, null, 2)}</pre>`;
      } else if (typeof body === 'object') {
        return `<pre>${JSON.stringify(body, null, 2)}</pre>`;
      } else {
        return `<pre>${body}</pre>`;
      }
    } catch (e) {
      // 如果不是JSON，检查是否是HTML或其他文本内容
      const bodyStr = typeof body === 'string' ? body : String(body);
      const sizeKB = (bodyStr.length / 1024).toFixed(1);
      
      if (bodyStr.length > 1000) {
        const preview = bodyStr.substring(0, 500);
        const responseId = `text-response-${Date.now()}-${Math.random()}`;
        setTimeout(() => {
          this.setupHtmlToggleButton(responseId);
        }, 100);
        
        return `
          <div class="large-text-response" id="${responseId}">
            <div class="response-info">
              <strong>文本内容</strong> - 大小: ${sizeKB}KB
              <button class="toggle-full-content" data-target="${responseId}">
                查看完整内容
              </button>
            </div>
            <div class="text-preview">
              <strong>预览:</strong>
              <pre class="text-content">${this.escapeHtml(preview)}...</pre>
            </div>
            <div class="text-full" style="display: none;">
              <strong>完整内容:</strong>
              <pre class="text-content" style="max-height: 400px; overflow-y: auto;">${this.escapeHtml(bodyStr)}</pre>
            </div>
          </div>
        `;
      } else {
        return `<pre>${this.escapeHtml(bodyStr)}</pre>`;
      }
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  setupHtmlToggleButton(responseId, htmlContent = null) {
    const responseElement = document.getElementById(responseId);
    if (!responseElement) return;
    
    const toggleButton = responseElement.querySelector('.toggle-full-content');
    const renderButton = responseElement.querySelector('.render-html-content');
    const fullContent = responseElement.querySelector('.html-full, .text-full');
    const renderedContent = responseElement.querySelector('.html-rendered');
    
    // 设置查看完整内容按钮
    if (toggleButton && fullContent) {
      toggleButton.addEventListener('click', () => {
        const isHidden = fullContent.style.display === 'none' || !fullContent.style.display;
        
        // 隐藏渲染的HTML内容
        if (renderedContent) {
          renderedContent.style.display = 'none';
        }
        
        fullContent.style.display = isHidden ? 'block' : 'none';
        toggleButton.textContent = isHidden ? '隐藏完整内容' : '查看完整内容';
        
        // 重置渲染按钮文本
        if (renderButton) {
          renderButton.textContent = '渲染为HTML';
        }
      });
    }
    
    // 设置渲染HTML按钮
    if (renderButton && renderedContent && htmlContent) {
      renderButton.addEventListener('click', () => {
        const isHidden = renderedContent.style.display === 'none' || !renderedContent.style.display;
        
        if (isHidden) {
          // 隐藏完整文本内容
          if (fullContent) {
            fullContent.style.display = 'none';
          }
          
          // 渲染HTML内容
          const renderContainer = renderedContent.querySelector('.html-render-container');
          if (renderContainer) {
            try {
              // 安全地渲染HTML - 移除可能有害的脚本
              const safeHtml = this.sanitizeHtml(htmlContent);
              renderContainer.innerHTML = safeHtml;
            } catch (e) {
              renderContainer.innerHTML = '<p style="color: red;">HTML渲染失败: ' + e.message + '</p>';
            }
          }
          
          renderedContent.style.display = 'block';
          renderButton.textContent = '隐藏渲染效果';
          
          // 重置查看完整内容按钮文本
          if (toggleButton) {
            toggleButton.textContent = '查看完整内容';
          }
        } else {
          renderedContent.style.display = 'none';
          renderButton.textContent = '渲染为HTML';
        }
      });
    }
  }
  
  sanitizeHtml(html) {
    // 创建一个临时DOM元素来解析HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 移除所有脚本标签
    const scripts = tempDiv.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // 移除危险的事件处理器属性
    const dangerousAttributes = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'];
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(element => {
      dangerousAttributes.forEach(attr => {
        if (element.hasAttribute(attr)) {
          element.removeAttribute(attr);
        }
      });
      
      // 移除javascript: 协议的链接
      if (element.tagName === 'A' && element.href && element.href.startsWith('javascript:')) {
        element.removeAttribute('href');
      }
      
      // 处理iframe - 移除或限制src
      if (element.tagName === 'IFRAME') {
        element.removeAttribute('src');
        element.textContent = '[iframe内容已被过滤]';
      }
    });
    
    return tempDiv.innerHTML;
  }
  

  async generateToolFromAPI(apiCall, index) {
    try {
      const tool = await ipcRenderer.invoke('generate-tool-from-api', apiCall);
      this.generatedTools.push(tool);
      this.updateGeneratedTools();
      this.updateToolsList();
    } catch (error) {
      console.error('Failed to generate tool:', error);
    }
  }
  
  updateGeneratedTools() {
    this.generatedToolsDiv.innerHTML = '';
    
    this.generatedTools.forEach((tool, index) => {
      const toolElement = document.createElement('div');
      toolElement.className = 'generated-tool-item';
      toolElement.innerHTML = `
        <div><strong>${tool.name}</strong></div>
        <div>${tool.description}</div>
        <div><small>${tool.method} ${tool.url}</small></div>
      `;
      
      toolElement.addEventListener('click', () => {
        console.log(`工具详情: ${JSON.stringify(tool, null, 2)}`);
      });
      
      this.generatedToolsDiv.appendChild(toolElement);
    });
  }
  
  updateToolsList() {
    this.toolsList.innerHTML = '';
    
    this.generatedTools.forEach((tool, index) => {
      const toolElement = document.createElement('div');
      toolElement.className = 'tool-item';
      toolElement.textContent = tool.name;
      
      toolElement.addEventListener('click', () => {
        console.log(`选择工具: ${tool.name}`);
      });
      
      this.toolsList.appendChild(toolElement);
    });
  }
  
  // 聊天功能已移除
  
  exportTools() {
    if (this.generatedTools.length === 0) {
      return;
    }
    
    const toolsData = JSON.stringify(this.generatedTools, null, 2);
    const blob = new Blob([toolsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'api-tools.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  importTools() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const tools = JSON.parse(e.target.result);
          this.generatedTools = [...this.generatedTools, ...tools];
          this.updateGeneratedTools();
          this.updateToolsList();
        } catch (error) {
          console.error('Failed to import tools:', error);
        }
      };
      reader.readAsText(file);
    });
    
    input.click();
  }
  
  addDirectTestButton() {
    // 在聊天面板底部添加一个直接测试按钮
    const chatPanel = document.querySelector('.chat-panel .panel-content');
    const testSection = document.createElement('div');
    testSection.innerHTML = `
      <div style="margin-top: 15px; padding: 10px; border: 1px solid #dee2e6; border-radius: 4px;">
        <h4 style="margin: 0 0 10px 0; font-size: 12px;">直接测试API拦截:</h4>
        <button id="directTestBtn" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">
          发送测试API请求
        </button>
      </div>
    `;
    chatPanel.appendChild(testSection);
    
    // 添加测试按钮事件
    document.getElementById('directTestBtn').addEventListener('click', () => {
      this.testDirectAPI();
    });
  }
  
  async testDirectAPI() {
    console.log('Starting direct API test...');
    this.isIntercepting = true; // 确保拦截开启
    
    // 模拟添加一个请求
    const testRequest = {
      id: Date.now() + Math.random(),
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET',
      timestamp: new Date().toISOString(),
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Header': 'direct-test'
      },
      body: null,
      type: 'direct-test'
    };
    
    this.handleAPIRequest(testRequest);
    
    // 模拟一个响应
    setTimeout(() => {
      const testResponse = {
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
          'server': 'nginx'
        },
        data: {
          userId: 1,
          id: 1,
          title: "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
          body: "quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto"
        },
        timestamp: new Date().toISOString()
      };
      
      this.handleAPIResponse(testResponse);
    }, 500);
    
    // 发送真实的API请求作为对比
    try {
      console.log('Making real API request...');
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Header': 'real-request'
        }
      });
      
      const data = await response.json();
      console.log('Real API response:', data);
      
      // 手动创建真实请求记录
      const realRequest = {
        id: Date.now() + Math.random(),
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
        timestamp: new Date().toISOString(),
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Header': 'real-request'
        },
        body: null,
        type: 'real-request',
        responseBody: data,
        responseStatus: response.status,
        responseStatusText: response.statusText,
        responseHeaders: Object.fromEntries(response.headers.entries())
      };
      
      this.interceptedAPIs.push(realRequest);
      this.updateAPIList();
      
    } catch (error) {
      console.error('Real API request failed:', error);
    }
  }

  // Agent和Auth功能已移除
}

// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new APIInterceptorApp();
});
