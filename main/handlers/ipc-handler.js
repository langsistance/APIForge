const { ipcMain } = require('electron');

class IPCHandler {
  constructor(networkInterceptor, apiFetcher) {
    this.networkInterceptor = networkInterceptor;
    this.apiFetcher = apiFetcher;
  }

  registerHandlers() {
    // 获取拦截的API列表
    ipcMain.handle('get-intercepted-apis', () => {
      return this.networkInterceptor.getInterceptedAPIs();
    });

    // 清空拦截的API列表
    ipcMain.handle('clear-intercepted-apis', () => {
      return this.networkInterceptor.clearInterceptedAPIs();
    });

    // 按需获取API响应体
    ipcMain.handle('fetch-api-response-body', async (event, apiCall) => {
      return await this.apiFetcher.fetchAPIResponseBody(apiCall);
    });

    // 生成工具从API
    ipcMain.handle('generate-tool-from-api', (event, apiCall) => {
      return this.generateToolFromAPI(apiCall);
    });

    // 处理webview响应数据
    ipcMain.on('xhr-fetch-response', (event, responseData) => {
      this.networkInterceptor.handleWebviewAPIResponse(responseData);
    });
  }

  generateToolFromAPI(apiCall) {
    const tool = {
      name: `${apiCall.method.toLowerCase()}_${apiCall.url.split('/').pop()}`,
      description: `Generated tool for ${apiCall.method} ${apiCall.url}`,
      method: apiCall.method,
      url: apiCall.url,
      headers: apiCall.requestHeaders || {},
      parameters: this.extractParameters(apiCall),
      responseSchema: apiCall.responseBody ? this.generateSchema(apiCall.responseBody) : null
    };

    return tool;
  }

  extractParameters(apiCall) {
    const params = {};

    try {
      const url = new URL(apiCall.url);
      url.searchParams.forEach((value, key) => {
        params[key] = {
          type: 'string',
          description: `Query parameter: ${key}`,
          value: value
        };
      });
    } catch (e) {}

    if (apiCall.body) {
      try {
        const bodyData = JSON.parse(apiCall.body[0]);
        Object.keys(bodyData).forEach(key => {
          params[key] = {
            type: typeof bodyData[key],
            description: `Body parameter: ${key}`,
            value: bodyData[key]
          };
        });
      } catch (e) {}
    }

    return params;
  }

  generateSchema(responseBody) {
    try {
      const parsed = JSON.parse(responseBody);
      return { type: typeof parsed, example: parsed };
    } catch (e) {
      return { type: 'string', example: responseBody };
    }
  }
}

module.exports = IPCHandler;