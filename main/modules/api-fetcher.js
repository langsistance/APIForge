const fetch = require('node-fetch');

class APIFetcher {
  constructor() {
    this.defaultTimeout = 15000;
  }

  async fetchAPIResponseBody(apiCall) {
    console.log(`🔍 On-demand fetching response body for: ${apiCall.method} ${apiCall.url}`);

    try {
      // 检查认证信息
      if (apiCall.headers && (apiCall.headers.Cookie || apiCall.headers.Authorization)) {
        console.log(`🍪 Found authentication headers for ${apiCall.url}`);
      }

      // 准备请求头
      const headers = this.prepareHeaders(apiCall);
      
      console.log(`📤 Fetching with headers:`, Object.keys(headers));

      const response = await fetch(apiCall.url, {
        method: apiCall.method || 'GET',
        headers: headers,
        timeout: this.defaultTimeout,
        redirect: 'follow'
      });

      // 获取响应体
      const responseText = await response.text();
      const contentType = response.headers.get('content-type') || '';

      console.log(`📥 Response: ${response.status} ${response.statusText}, Content-Length: ${responseText.length}`);

      // 解析响应数据
      const parsedData = this.parseResponseData(responseText, contentType, apiCall.url);

      console.log(`✅ Successfully fetched response body: ${parsedData.dataType}, ${responseText.length} bytes`);

      return {
        success: true,
        statusCode: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        responseBody: parsedData.data,
        dataType: parsedData.dataType,
        contentType,
        responseSize: responseText.length,
        extractedData: parsedData.extractedData
      };
    } catch (error) {
      console.log(`❌ Failed to fetch response body:`, error.message);
      return this.handleFetchError(error);
    }
  }

  prepareHeaders(apiCall) {
    const headers = { ...apiCall.headers };

    // 确保有基本的浏览器请求头
    if (!headers['User-Agent'] && !headers['user-agent']) {
      headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    if (!headers['Accept'] && !headers['accept']) {
      headers['Accept'] = '*/*';
    }

    if (!headers['Accept-Language'] && !headers['accept-language']) {
      headers['Accept-Language'] = 'en-US,en;q=0.9,zh;q=0.8';
    }

    if (!headers['Accept-Encoding'] && !headers['accept-encoding']) {
      headers['Accept-Encoding'] = 'gzip, deflate, br';
    }

    if (!headers['Cache-Control'] && !headers['cache-control']) {
      headers['Cache-Control'] = 'no-cache';
    }

    // 特殊平台请求头处理
    if (apiCall.url.includes('x.com') || apiCall.url.includes('twitter.com')) {
      if (!headers['x-twitter-auth-type']) {
        headers['x-twitter-auth-type'] = 'OAuth2Session';
      }
      if (!headers['x-twitter-active-user']) {
        headers['x-twitter-active-user'] = 'yes';
      }
      if (!headers['x-twitter-client-language']) {
        headers['x-twitter-client-language'] = 'en';
      }
    }

    return headers;
  }

  parseResponseData(responseText, contentType, url) {
    let dataType = 'raw';
    let parsedData = responseText;
    let extractedData = null;

    if (contentType.includes('application/json')) {
      try {
        parsedData = JSON.parse(responseText);
        dataType = 'json';
        extractedData = this.extractJSONData(parsedData);
      } catch (e) {
        dataType = 'text';
      }
    } else if (contentType.includes('text/html')) {
      dataType = 'html';
      extractedData = this.extractHTMLData(responseText, url);
    } else if (contentType.includes('text/')) {
      dataType = 'text';
      extractedData = this.extractTextData(responseText);
    }

    return { data: parsedData, dataType, extractedData };
  }

  extractJSONData(data) {
    const extracted = {};

    if (Array.isArray(data)) {
      extracted.isArray = true;
      extracted.itemCount = data.length;
      if (data.length > 0) {
        extracted.firstItemKeys = Object.keys(data[0]);
      }
    } else if (typeof data === 'object' && data !== null) {
      extracted.keys = Object.keys(data);
      extracted.hasNestedObjects = extracted.keys.some(
        key => typeof data[key] === 'object' && data[key] !== null
      );
    }

    return extracted;
  }

  extractHTMLData(html, url) {
    const extracted = {};

    try {
      // 提取JavaScript中的数据对象
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

      // 提取表格数据
      const tableRegex = /<table[^>]*>(.*?)<\/table>/gs;
      const tables = html.match(tableRegex);
      if (tables) {
        extracted.tables = tables.map(table => ({
          html: table,
          rowCount: (table.match(/<tr/g) || []).length
        }));
      }

      // 提取表单数据和API端点
      const formRegex = /<form[^>]*action=['"]([^'"]*)['"]/g;
      const forms = [];
      let formMatch;
      while ((formMatch = formRegex.exec(html)) !== null) {
        forms.push(formMatch[1]);
      }
      if (forms.length > 0) {
        extracted.forms = forms;
      }

      // 提取API端点引用
      const apiEndpointRegex = /(['"])([^'"]*(?:\/api\/|\.json|graphql)[^'"]*)\1/g;
      const endpoints = new Set();
      let endpointMatch;
      while ((endpointMatch = apiEndpointRegex.exec(html)) !== null) {
        endpoints.add(endpointMatch[2]);
      }
      if (endpoints.size > 0) {
        extracted.apiEndpoints = Array.from(endpoints);
      }

      // 提取meta标签中的数据
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

  extractTextData(text) {
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

  handleFetchError(error) {
    let detailedError = error.message;
    
    if (error.code === 'ENOTFOUND') {
      detailedError = '域名解析失败，请检查网络连接';
    } else if (error.code === 'ECONNREFUSED') {
      detailedError = '连接被拒绝，服务器可能不可用';
    } else if (error.code === 'ETIMEDOUT') {
      detailedError = '请求超时，请稍后重试';
    } else if (error.message.includes('400')) {
      detailedError = '请求参数错误或认证信息已过期 (HTTP 400)';
    } else if (error.message.includes('401')) {
      detailedError = '未授权访问，需要有效的认证信息 (HTTP 401)';
    } else if (error.message.includes('403')) {
      detailedError = '访问被禁止，权限不足 (HTTP 403)';
    } else if (error.message.includes('404')) {
      detailedError = '请求的资源不存在 (HTTP 404)';
    } else if (error.message.includes('429')) {
      detailedError = '请求过于频繁，已被限流 (HTTP 429)';
    } else if (error.message.includes('500')) {
      detailedError = '服务器内部错误 (HTTP 500)';
    }

    return {
      success: false,
      error: detailedError,
      originalError: error.message,
      statusCode: error.status || 'Error',
      statusText: error.statusText || 'Request Failed'
    };
  }
}

module.exports = APIFetcher;