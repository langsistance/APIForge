const { session } = require('electron');

class NetworkInterceptor {
  constructor() {
    this.interceptedAPIs = [];
    this.mainWindow = null;
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  shouldInterceptRequest(details) {
    const url = details.url.toLowerCase();
    const resourceType = details.resourceType;
    
    // 排除软件自身的API请求和常见的开发/调试请求
    const excludePatterns = [
      '52.53.129.41:7777',
      'localhost:',
      '127.0.0.1:',
      'chrome-extension://',
      'devtools://',
      'webpack',
      'hot-update',
      'sockjs-node',
      'browsersync',
      '__webpack',
      'hot-reload',
      // 常见的软件更新和分析服务
      'electron',
      'github.com/electron',
      'update.electronjs.org',
      'sentry.io',
      'bugsnag.com',
      'crashlytics.com',
      // 软件内部通信
      'file://',
      'data:',
      'blob:',
      // Node.js 相关请求特征
      'node-fetch',
      'axios/'
    ];
    
    if (excludePatterns.some(pattern => url.includes(pattern))) {
      console.log(`🚫 Filtered excluded request: ${url.substring(0, 100)}...`);
      return false;
    }
    
    // 排除OPTIONS预检请求
    if (details.method === 'OPTIONS') {
      console.log(`🚫 Filtered OPTIONS request: ${url.substring(0, 100)}...`);
      return false;
    }

    // 过滤静态资源类型
    const staticResourceTypes = ['stylesheet', 'script', 'image', 'font', 'media'];
    if (staticResourceTypes.includes(resourceType)) {
      console.log(`🚫 Filtered static resource: ${resourceType} - ${url.substring(0, 100)}...`);
      return false;
    }

    // 总是拦截API请求
    if (resourceType === 'xhr' || resourceType === 'fetch') {
      return true;
    }

    // 拦截包含API关键词的请求
    const apiKeywords = ['/api/', 'api.', '/v1/', '/v2/', 'jsonplaceholder', 
                         'prod-api', 'firebase.googleapis.com', 'google-analytics.com'];
    if (apiKeywords.some(keyword => url.includes(keyword))) {
      return true;
    }

    // 拦截可能包含数据的HTML文档（后端渲染网站）
    if (resourceType === 'mainFrame' || resourceType === 'subFrame' || resourceType === 'other') {
      const staticFileExtensions = [
        '.css', '.js', '.jsx', '.ts', '.tsx', '.scss', '.sass', '.less',
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff', '.avif',
        '.woff', '.woff2', '.ttf', '.eot', '.otf',
        '.mp4', '.mp3', '.avi', '.mov', '.wmv', '.wav', '.ogg', '.webm',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.zip', '.rar', '.tar', '.gz', '.7z',
        '.map', '.min.js', '.min.css'
      ];

      const staticDomains = [
        'fonts.', 'static/', 'assets/', 'dist/', 'build/', '_next/', 'public/',
        'githubassets.com', 'bdstatic.com', 'jsdelivr.net', 'cdnjs.com',
        'unpkg.com', 'fontawesome.com', 'gstatic.com', 'bootstrapcdn.com'
      ];

      // 检查是否是静态文件
      const cleanUrl = url.split('?')[0].split('#')[0];
      const isStaticFile = 
        staticFileExtensions.some(ext => cleanUrl.endsWith(ext) || cleanUrl.includes(ext)) ||
        staticDomains.some(domain => url.includes(domain));

      // 额外检查JS/CSS bundle文件
      if (url.match(/\/(bundle|chunk|main|app|vendor)\.(js|css)/) || 
          url.match(/\.(min\.(js|css)|bundle|chunk)(\?|$)/)) {
        console.log(`🚫 Filtered JS/CSS bundle: ${url.substring(0, 100)}...`);
        return false;
      }

      if (isStaticFile) {
        console.log(`🚫 Filtered static file: ${url.substring(0, 100)}...`);
        return false;
      }

      // 特别关注GitHub页面
      if (url.includes('github.com/') && !url.includes('/assets/') && !url.includes('githubassets.com')) {
        console.log(`🎯 GitHub page detection: ${url}, resourceType: ${resourceType}`);
        return true;
      }

      return true;
    }

    // 拦截其他可能包含数据的请求
    const dataPatterns = ['.json', '/data/', '/config/', 'webconfig', 'graphql', 
                          '/graph/', 'auth0.com', '/oauth/', '/login',
                          '/list', '/get', '/fetch', '/query', '/search'];
    
    return dataPatterns.some(pattern => url.includes(pattern));
  }

  setupInterception() {
    console.log('Setting up API interception...');

    // 为webview session设置拦截
    const webviewSession = session.fromPartition('persist:webview');
    this.setupSessionInterception(webviewSession, 'webview');

    // 为默认session设置拦截
    this.setupSessionInterception(session.defaultSession, 'default');
  }

  setupSessionInterception(targetSession, sessionType) {
    // 只拦截webview session，避免录制软件自身请求
    if (sessionType === 'default') {
      console.log(`🔇 Skipping ${sessionType} session interception to avoid recording app's own requests`);
      return;
    }

    // 请求发送前拦截
    targetSession.webRequest.onBeforeSendHeaders(
      { urls: ['*://*/*'] },
      (details, callback) => {
        // 检查User-Agent，确保是来自浏览器环境的请求
        const userAgent = details.requestHeaders && 
          (details.requestHeaders['User-Agent'] || details.requestHeaders['user-agent']);
        const isBrowserRequest = userAgent && 
          (Array.isArray(userAgent) ? userAgent[0] : userAgent).includes('Mozilla');
        
        if (isBrowserRequest && this.shouldInterceptRequest(details)) {
          console.log(`🎯 [${sessionType}] INTERCEPTING:`, details.resourceType, details.method, details.url);

          // 转换headers格式
          const formattedHeaders = {};
          if (details.requestHeaders) {
            Object.keys(details.requestHeaders).forEach(key => {
              const values = details.requestHeaders[key];
              formattedHeaders[key] = Array.isArray(values) ? values.join(', ') : values;
            });
          }

          // 创建API调用对象
          const apiCall = {
            id: Date.now() + Math.random(),
            method: details.method || 'GET',
            url: details.url,
            headers: formattedHeaders,
            timestamp: new Date().toISOString(),
            resourceType: details.resourceType,
            body: details.uploadData ? 
              details.uploadData.map(d => {
                try {
                  return d.bytes ? d.bytes.toString() : null;
                } catch (e) {
                  return null;
                }
              }).filter(Boolean) : null,
            source: sessionType
          };

          // 检查是否已存在相同的请求（避免重复）
          const isDuplicate = this.interceptedAPIs.some(
            existing =>
              existing.url === apiCall.url &&
              existing.method === apiCall.method &&
              Math.abs(new Date(existing.timestamp).getTime() - new Date(apiCall.timestamp).getTime()) < 1000
          );

          if (!isDuplicate) {
            this.interceptedAPIs.push(apiCall);
            
            // 发送到前端
            if (this.mainWindow && this.mainWindow.webContents) {
              this.mainWindow.webContents.send('api-intercepted', apiCall);
            }
            
            console.log('📤 Sent intercepted request to frontend:', apiCall.method, apiCall.url);
          } else {
            console.log('🔄 Skipping duplicate request:', apiCall.method, apiCall.url);
          }
        }
        callback({});
      }
    );

    // 响应头拦截
    targetSession.webRequest.onHeadersReceived(
      { urls: ['*://*/*'] },
      (details, callback) => {
        // 统一的浏览器请求检查
        const userAgent = details.requestHeaders && 
          (details.requestHeaders['User-Agent'] || details.requestHeaders['user-agent']);
        const isBrowserRequest = userAgent && 
          (Array.isArray(userAgent) ? userAgent[0] : userAgent).includes('Mozilla');
          
        if (isBrowserRequest && this.shouldInterceptRequest(details)) {
          console.log(`📨 [${sessionType}] Response headers:`, details.resourceType, details.statusCode, details.url);

          const apiIndex = this.interceptedAPIs.findIndex(
            api => api.url === details.url && Math.abs(Date.now() - api.id) < 5000
          );

          if (apiIndex !== -1) {
            this.interceptedAPIs[apiIndex].responseHeaders = details.responseHeaders;
            this.interceptedAPIs[apiIndex].statusCode = details.statusCode;

            // 通知前端更新
            if (this.mainWindow && this.mainWindow.webContents) {
              this.mainWindow.webContents.send('api-response-headers', this.interceptedAPIs[apiIndex]);
            }
          }
        }
        callback({});
      }
    );

    // 请求完成拦截
    targetSession.webRequest.onCompleted(
      { urls: ['*://*/*'] },
      (details) => {
        // 统一的浏览器请求检查
        const userAgent = details.requestHeaders && 
          (details.requestHeaders['User-Agent'] || details.requestHeaders['user-agent']);
        const isBrowserRequest = userAgent && 
          (Array.isArray(userAgent) ? userAgent[0] : userAgent).includes('Mozilla');
          
        if (isBrowserRequest && this.shouldInterceptRequest(details)) {
          console.log(`✅ [${sessionType}] Request completed:`, details.resourceType, details.statusCode, details.url);

          const apiIndex = this.interceptedAPIs.findIndex(
            api => api.url === details.url && Math.abs(Date.now() - api.id) < 5000
          );

          if (apiIndex !== -1) {
            this.interceptedAPIs[apiIndex].completed = true;
            this.interceptedAPIs[apiIndex].finalStatusCode = details.statusCode;

            // 通知前端请求完成
            if (this.mainWindow && this.mainWindow.webContents) {
              this.mainWindow.webContents.send('api-completed', this.interceptedAPIs[apiIndex]);
            }
          }
        }
      }
    );
  }

  getInterceptedAPIs() {
    return this.interceptedAPIs;
  }

  clearInterceptedAPIs() {
    this.interceptedAPIs.length = 0;
    return true;
  }

  handleWebviewAPIResponse(responseData) {
    console.log('📥 Processing API response:', responseData.method, responseData.url);

    const apiIndex = this.interceptedAPIs.findIndex(
      api =>
        api.id === responseData.id ||
        (api.method === responseData.method &&
          api.url === responseData.url &&
          Math.abs(api.timestamp - responseData.timestamp) < 5000)
    );

    if (apiIndex !== -1) {
      // 更新响应数据
      this.interceptedAPIs[apiIndex].responseBody = responseData.data || responseData.responseBody;
      this.interceptedAPIs[apiIndex].responseStatus = responseData.status;
      this.interceptedAPIs[apiIndex].responseStatusText = responseData.statusText;
      this.interceptedAPIs[apiIndex].responseHeaders = responseData.headers;
      this.interceptedAPIs[apiIndex].completed = true;

      console.log('📤 Updated API with response body:', this.interceptedAPIs[apiIndex]);

      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('api-completed', this.interceptedAPIs[apiIndex]);
      }
    } else {
      console.log('⚠️  Could not find matching API record for:', responseData.method, responseData.url);
      
      // 创建新的API记录（只有响应数据）
      const newApi = {
        id: Date.now() + Math.random(),
        method: responseData.method || 'GET',
        url: responseData.url,
        timestamp: Date.now(),
        requestHeaders: {},
        responseBody: responseData.data || responseData.responseBody,
        responseStatus: responseData.status,
        responseStatusText: responseData.statusText,
        responseHeaders: responseData.headers,
        completed: true,
        resourceType: 'response-only'
      };

      this.interceptedAPIs.push(newApi);

      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('api-completed', newApi);
      }
    }
  }
}

module.exports = NetworkInterceptor;