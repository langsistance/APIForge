/**
 * 特殊请求头配置
 * 这些header会被打平保存到服务器的工具参数中
 * 并在本地回放时用于覆盖录制的header
 */

export const SPECIAL_HEADERS = [
  "Content-Type",
  "content-type",
  "Referer",
  "referer",
  "X-CSRF-Token",
  "x-csrf-token",
  "X-XSRF-Token",
  "x-xsrf-token",
  "Sec-Fetch-Site",
  "sec-fetch-site",
  // Cookie不保存，它是会话敏感信息，应该从本地实时获取
];

/**
 * 标准化header名称
 */
export function standardizeHeaderName(header) {
  const lower = header.toLowerCase();

  const mapping = {
    "content-type": "Content-Type",
    referer: "Referer",
    authorization: "Authorization",
    "x-csrf-token": "X-CSRF-Token",
    "x-xsrf-token": "X-XSRF-Token",
    "sec-fetch-site": "Sec-Fetch-Site",
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
