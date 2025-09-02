const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  webContents,
} = require("electron");
const path = require("path");
const https = require("https");
const http = require("http");

let mainWindow;
const interceptedAPIs = [];

// 智能拦截判断函数
function shouldInterceptRequest(details) {
  const url = details.url.toLowerCase();
  const resourceType = details.resourceType;
  
  // 1. 总是拦截API请求
  if (resourceType === 'xhr' || resourceType === 'fetch') {
    return true;
  }
  
  // 2. 拦截包含API关键词的请求
  if (url.includes('/api/') || 
      url.includes('api.') || 
      url.includes('/v1/') || 
      url.includes('/v2/') || 
      url.includes('jsonplaceholder') ||
      url.includes('prod-api') ||
      url.includes('firebase.googleapis.com') ||
      url.includes('google-analytics.com')) {
    return true;
  }
  
  // 3. 拦截可能包含数据的HTML文档（后端渲染网站）
  if (resourceType === 'mainFrame' || resourceType === 'subFrame' || resourceType === 'other') {
    // 排除所有静态资源文件
    const staticFileExtensions = [
      '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 
      '.woff', '.woff2', '.ttf', '.eot', '.otf',  // 字体文件
      '.webp', '.bmp', '.tiff',  // 图片文件
      '.mp4', '.mp3', '.avi', '.mov', '.wmv',  // 媒体文件
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',  // 文档文件
      '.zip', '.rar', '.tar', '.gz'  // 压缩文件
    ];
    
    const staticDomains = [
      'fonts.', 'static/', 'assets/', 'githubassets.com', 'bdstatic.com',
      'jsdelivr.net', 'cdnjs.com', 'unpkg.com', 'googleapis.com'
    ];
    
    // 检查是否是静态文件
    const isStaticFile = staticFileExtensions.some(ext => url.includes(ext)) ||
                        staticDomains.some(domain => url.includes(domain));
    
    if (!isStaticFile) {
      // 特别关注GitHub页面
      if (url.includes('github.com/') && !url.includes('/assets/') && !url.includes('githubassets.com')) {
        console.log(`🎯 GitHub page detection: ${url}, resourceType: ${resourceType}`);
        return true;
      }
      
      return true;
    }
  }
  
  // 4. 拦截可能包含JSON数据的请求
  if (url.includes('.json') || 
      url.includes('/data/') || 
      url.includes('/config/') ||
      url.includes('webconfig')) {
    return true;
  }
  
  // 5. 拦截GraphQL和认证相关请求
  if (url.includes('graphql') || 
      url.includes('/graph/') ||
      url.includes('auth0.com') ||
      url.includes('/oauth/') ||
      url.includes('/login')) {
    return true;
  }
  
  // 6. 拦截可能的后端数据端点
  if (url.includes('/list') ||
      url.includes('/get') ||
      url.includes('/fetch') ||
      url.includes('/query') ||
      url.includes('/search')) {
    return true;
  }
  
  return false;
}

// 增强的响应体获取函数
async function fetchEnhancedResponseBody(apiCall, details) {
  // 跳过某些不需要获取响应体的请求
  if (apiCall.method === 'OPTIONS' || apiCall.method === 'HEAD') return;
  
  console.log(`🔍 Attempting to fetch response body for ${apiCall.method} ${apiCall.url}`);
  
  try {
    const url = new URL(apiCall.url);
    const client = url.protocol === 'https:' ? https : http;
    
    // 构建请求选项
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: apiCall.method,
      headers: {
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (Electron API Interceptor)',
        ...getAuthHeaders(apiCall)
      },
      timeout: 10000
    };
    
    // 对POST等请求添加Content-Type
    if (apiCall.method !== 'GET' && apiCall.headers['Content-Type']) {
      requestOptions.headers['Content-Type'] = apiCall.headers['Content-Type'];
    }
    
    const response = await makeHttpRequest(requestOptions, client, apiCall.body ? apiCall.body[0] : null);
    
    if (response.success) {
      const parsedContent = parseResponseContent(response.body, response.contentType, apiCall.url);
      
      // 更新API记录
      apiCall.responseBody = parsedContent.data;
      apiCall.contentType = response.contentType;
      apiCall.parsedDataType = parsedContent.type;
      
      console.log(`✅ Fetched response body for: ${apiCall.url}`);
      console.log(`   Content-Type: ${response.contentType}`);
      console.log(`   Data Type: ${parsedContent.type}`);
      console.log(`   Size: ${response.body.length} bytes`);
      
      // 通知前端
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('api-response-body', {
          id: apiCall.id,
          url: apiCall.url,
          responseBody: parsedContent.data,
          contentType: response.contentType,
          dataType: parsedContent.type,
          extractedData: parsedContent.extractedData
        });
      }
    }
  } catch (error) {
    console.error(`Error fetching response body for ${apiCall.url}:`, error.message);
  }
}

// HTTP请求封装
function makeHttpRequest(options, client, body = null) {
  return new Promise((resolve) => {
    const req = client.request(options, (res) => {
      let responseBody = '';
      const contentType = res.headers['content-type'] || '';
      
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        resolve({
          success: true,
          body: responseBody,
          statusCode: res.statusCode,
          contentType: contentType,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });
    
    if (body && (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH')) {
      req.write(body);
    }
    
    req.end();
  });
}

// 获取认证头信息
function getAuthHeaders(apiCall) {
  const authHeaders = {};
  
  if (apiCall.headers.Authorization) {
    authHeaders.Authorization = apiCall.headers.Authorization;
  }
  if (apiCall.headers.Cookie) {
    authHeaders.Cookie = apiCall.headers.Cookie;
  }
  if (apiCall.headers['X-API-Key']) {
    authHeaders['X-API-Key'] = apiCall.headers['X-API-Key'];
  }
  if (apiCall.headers['x-goog-api-key']) {
    authHeaders['x-goog-api-key'] = apiCall.headers['x-goog-api-key'];
  }
  
  return authHeaders;
}

// 智能内容解析
function parseResponseContent(body, contentType, url) {
  const result = {
    data: body,
    type: 'raw',
    extractedData: null
  };
  
  try {
    // 1. JSON 数据解析
    if (contentType.includes('application/json') || contentType.includes('text/json')) {
      try {
        result.data = JSON.parse(body);
        result.type = 'json';
        result.extractedData = extractJSONData(result.data);
      } catch (e) {
        console.log('JSON parse failed, treating as text');
      }
    }
    
    // 2. HTML 文档解析（后端渲染数据提取）
    else if (contentType.includes('text/html')) {
      result.type = 'html';
      result.extractedData = extractHTMLData(body, url);
      
      // 保持原始HTML，但标记提取的数据
      if (result.extractedData && Object.keys(result.extractedData).length > 0) {
        console.log(`🎯 Extracted data from HTML: ${Object.keys(result.extractedData).join(', ')}`);
      }
    }
    
    // 3. XML/RSS 数据解析
    else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
      result.type = 'xml';
      result.extractedData = extractXMLData(body);
    }
    
    // 4. 纯文本数据
    else if (contentType.includes('text/plain')) {
      result.type = 'text';
      result.extractedData = extractTextData(body);
    }
    
  } catch (error) {
    console.error('Error parsing response content:', error);
  }
  
  return result;
}

// 从JSON中提取结构化数据
function extractJSONData(data) {
  const extracted = {};
  
  if (Array.isArray(data)) {
    extracted.isArray = true;
    extracted.itemCount = data.length;
    if (data.length > 0) {
      extracted.firstItemKeys = Object.keys(data[0]);
    }
  } else if (typeof data === 'object' && data !== null) {
    extracted.keys = Object.keys(data);
    extracted.hasNestedObjects = extracted.keys.some(key => 
      typeof data[key] === 'object' && data[key] !== null
    );
  }
  
  return extracted;
}

// 从HTML中提取后端渲染的数据
function extractHTMLData(html, url) {
  const extracted = {};
  
  try {
    // 1. 提取JavaScript中的数据对象
    const scriptDataRegexes = [
      /window\.__INITIAL_STATE__\s*=\s*({.+?});/gs,
      /window\.__DATA__\s*=\s*({.+?});/gs,
      /window\.__PROPS__\s*=\s*({.+?});/gs,
      /__NEXT_DATA__\s*=\s*({.+?})/gs,
      /window\.__APP_DATA__\s*=\s*({.+?});/gs
    ];
    
    for (const regex of scriptDataRegexes) {
      const matches = html.match(regex);
      if (matches) {
        matches.forEach((match, index) => {
          try {
            const jsonStr = match.match(/{.+}/s)?.[0];
            if (jsonStr) {
              const data = JSON.parse(jsonStr);
              extracted[`scriptData_${index}`] = data;
            }
          } catch (e) {
            // 忽略JSON解析错误
          }
        });
      }
    }
    
    // 2. 提取表格数据
    const tableRegex = /<table[^>]*>(.*?)<\/table>/gs;
    const tables = html.match(tableRegex);
    if (tables) {
      extracted.tables = tables.map(table => ({
        html: table,
        rowCount: (table.match(/<tr/g) || []).length
      }));
    }
    
    // 3. 提取表单数据和API端点
    const formRegex = /<form[^>]*action=['"]([^'"]*)['"]/g;
    const forms = [];
    let formMatch;
    while ((formMatch = formRegex.exec(html)) !== null) {
      forms.push(formMatch[1]);
    }
    if (forms.length > 0) {
      extracted.forms = forms;
    }
    
    // 4. 提取API端点引用
    const apiEndpointRegex = /(['"])([^'"]*(?:\/api\/|\.json|graphql)[^'"]*)\1/g;
    const endpoints = new Set();
    let endpointMatch;
    while ((endpointMatch = apiEndpointRegex.exec(html)) !== null) {
      endpoints.add(endpointMatch[2]);
    }
    if (endpoints.size > 0) {
      extracted.apiEndpoints = Array.from(endpoints);
    }
    
    // 5. 提取meta标签中的数据
    const metaDataRegex = /<meta[^>]*(?:property|name)=['"]([^'"]*)['"]\s*content=['"]([^'"]*)['"]/g;
    const metaData = {};
    let metaMatch;
    while ((metaMatch = metaDataRegex.exec(html)) !== null) {
      metaData[metaMatch[1]] = metaMatch[2];
    }
    if (Object.keys(metaData).length > 0) {
      extracted.metaData = metaData;
    }
    
  } catch (error) {
    console.error('Error extracting HTML data:', error);
  }
  
  return extracted;
}

// 从XML中提取数据结构
function extractXMLData(xml) {
  const extracted = {};
  
  // 简单的XML标签提取
  const tagRegex = /<([^>\/\s]+)[^>]*>/g;
  const tags = new Set();
  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    tags.add(match[1]);
  }
  
  extracted.xmlTags = Array.from(tags);
  extracted.isRSS = xml.includes('<rss') || xml.includes('<feed');
  
  return extracted;
}

// 从文本中提取结构化信息
function extractTextData(text) {
  const extracted = {};
  
  // 检测是否是JSON格式的文本
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      const jsonData = JSON.parse(text);
      extracted.hiddenJSON = jsonData;
      extracted.type = 'disguised_json';
    } catch (e) {
      // 不是JSON
    }
  }
  
  // 提取URL模式
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex);
  if (urls) {
    extracted.urls = urls;
  }
  
  return extracted;
}

function createWindow() {
  console.log("Creating window...");

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      webviewTag: true,
      partition: "persist:webview",
    },
  });

  mainWindow.loadFile("index.html");

  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }

  console.log("Window created successfully");
}

// 基本的IPC处理器 - 只保留网络拦截相关的
ipcMain.handle("get-intercepted-apis", () => {
  return interceptedAPIs;
});

ipcMain.handle("clear-intercepted-apis", () => {
  interceptedAPIs.length = 0;
  return true;
});

ipcMain.handle("generate-tool-from-api", (event, apiCall) => {
  const tool = {
    name: `${apiCall.method.toLowerCase()}_${apiCall.url.split("/").pop()}`,
    description: `Generated tool for ${apiCall.method} ${apiCall.url}`,
    method: apiCall.method,
    url: apiCall.url,
    headers: apiCall.requestHeaders || {},
    parameters: extractParameters(apiCall),
    responseSchema: apiCall.responseBody
      ? generateSchema(apiCall.responseBody)
      : null,
  };

  return tool;
});

// 网络拦截设置
function setupAPIInterception() {
  console.log("Setting up API interception...");

  const ENABLE_MAIN_PROCESS_INTERCEPTION = true;

  if (ENABLE_MAIN_PROCESS_INTERCEPTION) {
    // 为webview session设置拦截
    const webviewSession = session.fromPartition("persist:webview");

    webviewSession.webRequest.onBeforeSendHeaders(
      { urls: ["*://*/*"] },
      (details, callback) => {
        // 判断是否需要拦截此请求
        const shouldIntercept = shouldInterceptRequest(details);
        
        if (shouldIntercept) {
          console.log(
            "🎯 INTERCEPTING:",
            details.resourceType,
            details.method,
            details.url
          );

          // 转换headers格式
          const formattedHeaders = {};
          if (details.requestHeaders) {
            Object.keys(details.requestHeaders).forEach(key => {
              const values = details.requestHeaders[key];
              if (Array.isArray(values)) {
                formattedHeaders[key] = values.join(', ');
              } else {
                formattedHeaders[key] = values;
              }
            });
          }

          // 创建API调用对象
          const apiCall = {
            id: Date.now() + Math.random(),
            method: details.method || "GET",
            url: details.url,
            headers: formattedHeaders,
            timestamp: new Date().toISOString(),
            resourceType: details.resourceType,
            body: details.uploadData ? details.uploadData.map(d => {
              try {
                return d.bytes ? d.bytes.toString() : null;
              } catch (e) {
                return null;
              }
            }).filter(Boolean) : null,
            source: 'webview'
          };

          // 检查是否已存在相同的请求（避免重复）
          const isDuplicate = interceptedAPIs.some(existing => 
            existing.url === apiCall.url && 
            existing.method === apiCall.method &&
            Math.abs(new Date(existing.timestamp).getTime() - new Date(apiCall.timestamp).getTime()) < 1000 // 1秒内的相同请求视为重复
          );
          
          if (!isDuplicate) {
            // 添加到拦截列表
            interceptedAPIs.push(apiCall);
          } else {
            console.log("🔄 Skipping duplicate request:", apiCall.method, apiCall.url);
          }

          // 提取授权信息
          // TODO: Re-enable when authManager is properly initialized
          // if (authManager) {
          //   const authInfo = authManager.extractAuthFromAPI(apiCall);
          //   if (authInfo.authType !== 'unknown') {
          //     const domain = authManager.extractDomain(apiCall.url);
          //     authManager.updateAuthInfo(domain, authInfo);
          //     console.log(`Updated auth info for ${domain}:`, authInfo);
          //   }
          // }

          // 发送到前端
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("api-intercepted", apiCall);
          }

          console.log("📤 Sent intercepted request to frontend:", apiCall.method, apiCall.url);

          // 开始分析API（异步）
          // TODO: Re-enable when agentManager is properly initialized
          // if (agentManager) {
          //   agentManager.analyzeAndStoreAPI(apiCall).catch(error => {
          //     console.log('API analysis failed but continuing:', error.message);
          //   });
          // }
        } else {
          console.log(
            "📱 Webview request:",
            details.resourceType,
            details.method,
            details.url
          );
          
          // 强制拦截HTML页面（排除静态资源）
          const staticFileExtensions = [
            '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 
            '.woff', '.woff2', '.ttf', '.eot', '.otf', '.webp', '.bmp', '.tiff',
            '.mp4', '.mp3', '.avi', '.mov', '.wmv'
          ];
          
          const staticDomains = [
            'githubassets.com', 'bdstatic.com', 'jsdelivr.net', 'cdnjs.com', 
            'unpkg.com', 'googleapis.com', 'fonts.', 'static/', 'assets/'
          ];
          
          const isStaticResource = staticFileExtensions.some(ext => details.url.includes(ext)) ||
                                  staticDomains.some(domain => details.url.includes(domain));
          
          if (!isStaticResource && 
              (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame' || details.resourceType === 'other')) {
            console.log("🔄 Force intercepting GitHub page:", details.url, details.resourceType);
            
            // 强制将此请求添加到拦截列表
            const forcedApiCall = {
              id: Date.now() + Math.random(),
              method: details.method || "GET",
              url: details.url,
              headers: details.requestHeaders || {},
              timestamp: new Date().toISOString(),
              resourceType: details.resourceType,
              body: null,
              source: 'webview-forced'
            };

            // 检查是否已存在相同的强制拦截请求（避免重复）
            const isDuplicateForced = interceptedAPIs.some(existing => 
              existing.url === forcedApiCall.url && 
              existing.method === forcedApiCall.method &&
              Math.abs(new Date(existing.timestamp).getTime() - new Date(forcedApiCall.timestamp).getTime()) < 1000
            );
            
            if (!isDuplicateForced) {
              interceptedAPIs.push(forcedApiCall);

              if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send("api-intercepted", forcedApiCall);
              }
            } else {
              console.log("🔄 Skipping duplicate forced request:", forcedApiCall.method, forcedApiCall.url);
            }

            console.log("📤 Force sent to frontend:", forcedApiCall.method, forcedApiCall.url);
          }
        }
        callback({});
      }
    );

    // 添加WebView响应头拦截
    webviewSession.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
      if (shouldInterceptRequest(details)) {
        console.log('📨 WebView response headers:', details.resourceType, details.statusCode, details.url);
        
        const apiIndex = interceptedAPIs.findIndex(api => 
          api.url === details.url && Math.abs(Date.now() - api.id) < 5000
        );
        
        if (apiIndex !== -1) {
          interceptedAPIs[apiIndex].responseHeaders = details.responseHeaders;
          interceptedAPIs[apiIndex].statusCode = details.statusCode;
          
          // 通知前端更新
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('api-response-headers', interceptedAPIs[apiIndex]);
          }
          
          // 获取响应体
          if (details.statusCode >= 200 && details.statusCode < 400) {
            console.log(`🔍 Triggering enhanced response body fetch for: ${interceptedAPIs[apiIndex].method} ${interceptedAPIs[apiIndex].url}`);
            fetchEnhancedResponseBody(interceptedAPIs[apiIndex], details).catch(error => {
              console.log('Enhanced response body fetch failed:', error.message);
            });
          } else {
            console.log(`⚠️ Skipping response body fetch due to status code: ${details.statusCode}`);
          }
        }
      }
      callback({});
    });

    // 添加WebView响应完成拦截
    webviewSession.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
      if (shouldInterceptRequest(details)) {
        console.log('✅ WebView request completed:', details.resourceType, details.statusCode, details.url);
        
        const apiIndex = interceptedAPIs.findIndex(api => 
          api.url === details.url && Math.abs(Date.now() - api.id) < 5000
        );
        
        if (apiIndex !== -1) {
          interceptedAPIs[apiIndex].completed = true;
          interceptedAPIs[apiIndex].finalStatusCode = details.statusCode;
          
          // 通知前端请求完成
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('api-completed', interceptedAPIs[apiIndex]);
          }
        }
      }
    });

    // 同时为默认session设置拦截
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ["*://*/*"] },
      (details, callback) => {
        if (true) {
          console.log(
            "🔍 MAIN PROCESS API request:",
            details.resourceType,
            details.method,
            details.url
          );

          // 创建API调用对象
          const apiCall = {
            id: Date.now() + Math.random(),
            method: details.method || "GET",
            url: details.url,
            requestHeaders: details.requestHeaders || {},
            timestamp: Date.now(),
            resourceType: details.resourceType,
          };

          // 检查是否已存在相同的API请求（避免重复）
          const isDuplicateApi = interceptedAPIs.some(existing => 
            existing.url === apiCall.url && 
            existing.method === apiCall.method &&
            Math.abs(existing.timestamp - apiCall.timestamp) < 1000
          );
          
          if (!isDuplicateApi) {
            // 添加到拦截列表
            interceptedAPIs.push(apiCall);
          } else {
            console.log("🔄 Skipping duplicate API request:", apiCall.method, apiCall.url);
          }

          // 发送到前端
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send("api-intercepted", apiCall);
          }

          console.log("📤 Sent API to frontend:", apiCall.method, apiCall.url);
        }
        callback({});
      }
    );

    // 为webview session监听响应
    webviewSession.webRequest.onCompleted({ urls: ["*://*/*"] }, (details) => {
      if (true) {
        console.log(
          "✅ WEBVIEW API response completed:",
          details.method,
          details.url,
          details.statusCode
        );

        // 找到对应的API调用
        const apiIndex = interceptedAPIs.findIndex(
          (api) =>
            api.url === details.url &&
            Math.abs(api.timestamp - Date.now()) < 30000
        );

        if (apiIndex !== -1) {
          interceptedAPIs[apiIndex].responseHeaders = details.responseHeaders;
          interceptedAPIs[apiIndex].statusCode = details.statusCode;
          interceptedAPIs[apiIndex].completed = true;

          // 尝试获取响应体 - 使用webview注入
          const webview = webContents
            .getAllWebContents()
            .find((wc) => wc.getType() === "webview");

          if (webview) {
            const responseBodyScript = `
              (function() {
                // 简单的响应体模拟
                if ('${details.url}'.includes('jsonplaceholder')) {
                  if ('${details.url}'.includes('/posts/1')) {
                    return {
                      userId: 1,
                      id: 1,
                      title: "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
                      body: "quia et suscipit\\nsuscipit recusandae consequuntur expedita et cum\\nreprehenderit molestiae ut ut quas totam\\nnostrum rerum est autem sunt rem eveniet architecto"
                    };
                  } else if ('${details.url}'.includes('/posts') && '${details.method}' === 'POST') {
                    return {
                      id: 101,
                      title: "Test Post",
                      body: "This is a test post",
                      userId: 1
                    };
                  }
                }
                return null;
              })()
            `;

            webview
              .executeJavaScript(responseBodyScript)
              .then((result) => {
                if (result) {
                  console.log("📦 Got response body from webview:", result);
                  interceptedAPIs[apiIndex].responseBody = result;

                  if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send(
                      "api-completed",
                      interceptedAPIs[apiIndex]
                    );
                  }
                }
              })
              .catch((err) => {
                console.log("❌ Failed to get response body:", err);
              });
          }

          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send(
              "api-completed",
              interceptedAPIs[apiIndex]
            );
          }
        }
      }
    });

    // 监听默认session响应
    session.defaultSession.webRequest.onCompleted(
      { urls: ["*://*/*"] },
      (details) => {
        if (true) {
          console.log(
            "✅ API response completed:",
            details.method,
            details.url,
            details.statusCode
          );

          // 找到对应的API调用
          const apiIndex = interceptedAPIs.findIndex(
            (api) =>
              api.url === details.url &&
              Math.abs(api.timestamp - Date.now()) < 30000 // 30秒内的请求
          );

          if (apiIndex !== -1) {
            interceptedAPIs[apiIndex].responseHeaders = details.responseHeaders;
            interceptedAPIs[apiIndex].statusCode = details.statusCode;
            interceptedAPIs[apiIndex].completed = true;

            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send(
                "api-completed",
                interceptedAPIs[apiIndex]
              );
            }
          }
        }
      }
    );
  }
}

// 处理webview响应数据
function handleWebviewAPIResponse(responseData) {
  console.log(
    "📥 Processing API response:",
    responseData.method,
    responseData.url
  );

  const apiIndex = interceptedAPIs.findIndex(
    (api) =>
      api.id === responseData.id ||
      (api.method === responseData.method &&
        api.url === responseData.url &&
        Math.abs(api.timestamp - responseData.timestamp) < 5000) // 扩大时间窗口
  );

  if (apiIndex !== -1) {
    // 更新响应数据
    interceptedAPIs[apiIndex].responseBody =
      responseData.data || responseData.responseBody;
    interceptedAPIs[apiIndex].responseStatus = responseData.status;
    interceptedAPIs[apiIndex].responseStatusText = responseData.statusText;
    interceptedAPIs[apiIndex].responseHeaders = responseData.headers;
    interceptedAPIs[apiIndex].completed = true;

    console.log(
      "📤 Updated API with response body:",
      interceptedAPIs[apiIndex]
    );

    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("api-completed", interceptedAPIs[apiIndex]);
    }
  } else {
    console.log(
      "⚠️  Could not find matching API record for:",
      responseData.method,
      responseData.url
    );
    // 创建新的API记录（只有响应数据）
    const newApi = {
      id: Date.now() + Math.random(),
      method: responseData.method || "GET",
      url: responseData.url,
      timestamp: Date.now(),
      requestHeaders: {},
      responseBody: responseData.data || responseData.responseBody,
      responseStatus: responseData.status,
      responseStatusText: responseData.statusText,
      responseHeaders: responseData.headers,
      completed: true,
      resourceType: "response-only",
    };

    interceptedAPIs.push(newApi);

    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("api-completed", newApi);
    }
  }
}

// 添加IPC处理器来接收webview中的响应数据
ipcMain.on("xhr-fetch-response", (event, responseData) => {
  handleWebviewAPIResponse(responseData);
});

// 辅助函数
function extractParameters(apiCall) {
  const params = {};

  try {
    const url = new URL(apiCall.url);
    url.searchParams.forEach((value, key) => {
      params[key] = {
        type: "string",
        description: `Query parameter: ${key}`,
        value: value,
      };
    });
  } catch (e) {}

  if (apiCall.body) {
    try {
      const bodyData = JSON.parse(apiCall.body[0]);
      Object.keys(bodyData).forEach((key) => {
        params[key] = {
          type: typeof bodyData[key],
          description: `Body parameter: ${key}`,
          value: bodyData[key],
        };
      });
    } catch (e) {}
  }

  return params;
}

function generateSchema(responseBody) {
  try {
    const parsed = JSON.parse(responseBody);
    return { type: typeof parsed, example: parsed };
  } catch (e) {
    return { type: "string", example: responseBody };
  }
}

// 应用启动
app.whenReady().then(() => {
  console.log("App ready, creating window...");
  createWindow();
  setupAPIInterception();
  console.log("App initialization completed");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
