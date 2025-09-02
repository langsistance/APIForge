const { ipcRenderer } = require('electron');

console.log('🚀 Webview preload script loaded');

// 立即设置拦截，不等待DOM加载
(function() {
  console.log('🚀 Setting up immediate API interception...');
  
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  // 拦截fetch请求
  if (window.fetch) {
    window.fetch = function(...args) {
      const [url, options = {}] = args;
      const requestId = 'fetch_' + Date.now() + '_' + Math.random();
      
      console.log('🔍 Fetch intercepted:', url, options.method || 'GET');
      
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
            responseBody: responseData,
            timestamp: Date.now()
          };
          
          console.log('📥 Fetch response intercepted:', url, response.status);
          
          // 直接发送到主进程
          ipcRenderer.send('xhr-fetch-response', responseInfo);
          
        } catch (err) {
          console.log('❌ Failed to parse fetch response:', err);
        }
        
        return response;
      });
    };
  }
  
  // 拦截XMLHttpRequest
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._method = method;
    this._url = url;
    this._requestId = 'xhr_' + Date.now() + '_' + Math.random();
    console.log('🔍 XHR open intercepted:', method, url);
    return originalXHROpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    const self = this;
    
    console.log('🔍 XHR send intercepted:', self._method, self._url);
    
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
            responseBody: responseData,
            timestamp: Date.now()
          };
          
          console.log('📥 XHR response intercepted:', self._url, this.status);
          
          // 直接发送到主进程
          ipcRenderer.send('xhr-fetch-response', responseInfo);
          
        } catch (err) {
          console.log('❌ Failed to parse XHR response:', err);
        }
      }
      
      if (originalOnreadystatechange) {
        originalOnreadystatechange.call(this, event);
      }
    };
    
    return originalXHRSend.apply(this, arguments);
  };
  
  console.log('✅ Immediate API interception setup complete!');
})();