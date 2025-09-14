/**
 * 特殊请求头配置
 * 只保存真正特殊的、不会在同域请求中自动携带的headers
 * 浏览器自动生成的headers（Referer、Sec-Fetch-*等）不需要保存
 */

export const SPECIAL_HEADERS = [
  // 只保存内容类型，这个可能影响请求格式
  "Content-Type",
  "content-type",
  // CSRF/XSRF tokens - 这些是应用特定的，需要保存
  "X-CSRF-Token",
  "x-csrf-token", 
  "X-XSRF-Token",
  "x-xsrf-token",
  // 自定义认证headers
  "X-API-Key",
  "x-api-key",
  "X-Auth-Token",
  "x-auth-token",
  // 其他应用特定的headers
  "X-Requested-With",
  "x-requested-with",
  
  // 以下headers不保存，因为它们会自动生成或从同域请求中获取：
  // - Cookie: 会话敏感，从浏览器自动获取
  // - Referer: 浏览器自动生成
  // - Sec-Fetch-*: 浏览器自动生成
  // - User-Agent: 浏览器自动生成
  // - Accept-*: 浏览器自动生成
];

/**
 * 标准化header名称
 */
export function standardizeHeaderName(header) {
  const lower = header.toLowerCase();

  const mapping = {
    "content-type": "Content-Type",
    "x-csrf-token": "X-CSRF-Token",
    "x-xsrf-token": "X-XSRF-Token",
    "x-api-key": "X-API-Key",
    "x-auth-token": "X-Auth-Token",
    "x-requested-with": "X-Requested-With",
  };

  return mapping[lower] || header;
}

/**
 * 从headers中提取特殊headers
 */
export function extractSpecialHeaders(headers) {
  const specialHeaders = {};

  if (!headers) return specialHeaders;

  Object.keys(headers).forEach((key) => {
    if (SPECIAL_HEADERS.some((h) => h.toLowerCase() === key.toLowerCase())) {
      const standardName = standardizeHeaderName(key);
      specialHeaders[standardName] = headers[key];
    }
  });

  return specialHeaders;
}

/**
 * 判断是否是特殊header
 */
export function isSpecialHeader(headerName) {
  return SPECIAL_HEADERS.some(
    (h) => h.toLowerCase() === headerName.toLowerCase()
  );
}
