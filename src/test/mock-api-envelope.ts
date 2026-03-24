/** 与后端统一的 JSON 信封，供单测 mock `fetch` 响应 */
export function jsonEnvelope<T>(data: T): string {
  return JSON.stringify({
    success: true,
    code: 200,
    errorCode: null,
    message: 'OK',
    data,
    timestamp: 1774257382613,
  })
}
