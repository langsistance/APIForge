/**
 * 浏览器管理器 - 负责网页浏览和拦截功能
 */

export class BrowserManager {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.isIntercepting = false;
    
    // UI元素
    this.webview = null;
    this.urlInput = null;
    this.loadBtn = null;
    this.startInterceptBtn = null;
    this.stopInterceptBtn = null;
  }

  async init() {
    this.initializeElements();
    this.setupEventListeners();
    console.log('✅ BrowserManager 初始化完成');
  }

  initializeElements() {
    this.webview = document.getElementById('webview');
    this.urlInput = document.getElementById('urlInput');
    this.loadBtn = document.getElementById('loadBtn');
    this.startInterceptBtn = document.getElementById('startInterceptBtn');
    this.stopInterceptBtn = document.getElementById('stopInterceptBtn');
  }

  setupEventListeners() {
    // 加载网页
    this.loadBtn.addEventListener('click', () => this.loadWebpage());
    this.urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.loadWebpage();
    });
    
    // 拦截控制
    this.startInterceptBtn.addEventListener('click', () => this.startIntercepting());
    this.stopInterceptBtn.addEventListener('click', () => this.stopIntercepting());
    
    // Webview事件
    if (this.webview) {
      this.webview.addEventListener('dom-ready', () => {
        this.setupInterception();
      });
      
      this.webview.addEventListener('did-finish-load', () => {
        console.log('页面加载完成');
        // 页面加载完成后也重新设置拦截
        if (this.isIntercepting) {
          this.setupInterception();
        }
      });

      // 监听来自webview的消息
      this.webview.addEventListener('console-message', (e) => {
        console.log('Webview console:', e.message);
      });
    }
  }

  loadWebpage() {
    const url = this.urlInput.value.trim();
    if (!url) {
      alert('请输入网址');
      return;
    }
    
    let formattedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      formattedUrl = 'https://' + url;
    }
    
    console.log('加载网页:', formattedUrl);
    this.webview.src = formattedUrl;
  }

  startIntercepting() {
    this.isIntercepting = true;
    this.startInterceptBtn.disabled = true;
    this.stopInterceptBtn.disabled = false;
    
    console.log('开始拦截API请求');
    this.uiManager.showNotification('API拦截已开启', 'success');
    
    // 如果webview已加载，立即设置拦截
    if (this.webview && this.webview.src !== 'about:blank') {
      this.setupInterception();
    }
  }

  stopIntercepting() {
    this.isIntercepting = false;
    this.startInterceptBtn.disabled = false;
    this.stopInterceptBtn.disabled = true;
    
    console.log('停止拦截API请求');
    this.uiManager.showNotification('API拦截已关闭', 'info');
  }

  setupInterception() {
    if (!this.isIntercepting || !this.webview) return;
    
    try {
      // 注入拦截脚本
      const interceptScript = `
        (function() {
          console.log('🚀 Browser manager intercepting APIs...');
          const originalFetch = window.fetch;
          const originalXHR = window.XMLHttpRequest;
          
          // 拦截fetch
          window.fetch = function(...args) {
            const startTime = Date.now();
            
            return originalFetch.apply(this, args).then(response => {
              const endTime = Date.now();
              
              // 发送拦截数据到主进程
              window.postMessage({
                type: 'API_INTERCEPTED',
                data: {
                  url: args[0],
                  method: args[1]?.method || 'GET',
                  headers: args[1]?.headers || {},
                  body: args[1]?.body,
                  status: response.status,
                  statusText: response.statusText,
                  responseHeaders: Object.fromEntries(response.headers.entries()),
                  duration: endTime - startTime,
                  timestamp: new Date().toISOString(),
                  type: 'fetch'
                }
              }, '*');
              
              return response;
            });
          };
          
          // 拦截XMLHttpRequest
          const XHRProxy = new Proxy(originalXHR, {
            construct(target, args) {
              const xhr = new target(...args);
              const originalOpen = xhr.open;
              const originalSend = xhr.send;
              
              xhr.open = function(method, url, ...rest) {
                this._intercepted = { method, url, startTime: Date.now() };
                return originalOpen.call(this, method, url, ...rest);
              };
              
              xhr.send = function(body) {
                const result = originalSend.call(this, body);
                
                this.addEventListener('loadend', () => {
                  if (this._intercepted) {
                    // 发送到主进程和渲染进程
                    const apiData = {
                      url: this._intercepted.url,
                      method: this._intercepted.method,
                      body: body,
                      status: this.status,
                      statusText: this.statusText,
                      responseText: this.responseText,
                      duration: Date.now() - this._intercepted.startTime,
                      timestamp: new Date().toISOString(),
                      type: 'xhr',
                      id: 'browser_' + Date.now() + '_' + Math.random()
                    };
                    
                    window.postMessage({
                      type: 'API_INTERCEPTED',
                      data: apiData
                    }, '*');
                    
                    // 如果有ipcRenderer，也发送到主进程
                    if (typeof require !== 'undefined') {
                      try {
                        const { ipcRenderer } = require('electron');
                        ipcRenderer.send('xhr-fetch-response', apiData);
                        console.log('✅ Sent to main process via IPC');
                      } catch (e) {
                        console.log('❌ IPC not available:', e.message);
                      }
                    }
                  }
                });
                
                return result;
              };
              
              return xhr;
            }
          });
          
          window.XMLHttpRequest = XHRProxy;
          
          console.log('API拦截脚本已注入');
        })();
      `;
      
      this.webview.executeJavaScript(interceptScript);
      
      // 监听拦截到的API
      this.webview.addEventListener('ipc-message', (event) => {
        if (event.channel === 'API_INTERCEPTED') {
          this.handleInterceptedAPI(event.args[0]);
        }
      });
      
    } catch (error) {
      console.error('设置API拦截失败:', error);
    }
  }

  handleInterceptedAPI(apiData) {
    console.log('拦截到API请求:', apiData);
    
    // 通过事件通知API管理器
    const event = new CustomEvent('api-intercepted', { detail: apiData });
    window.dispatchEvent(event);
  }

  getCurrentUrl() {
    return this.webview ? this.webview.getURL() : '';
  }

  getInterceptingStatus() {
    return this.isIntercepting;
  }
}