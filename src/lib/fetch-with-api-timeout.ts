/** 接口请求超时（毫秒） */
export const API_REQUEST_TIMEOUT_MS = 10_000

/**
 * 与原生 fetch 相同，但默认在超时后 abort（可与 init.signal 组合，任一触发即取消）。
 */
export async function fetchWithApiTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(API_REQUEST_TIMEOUT_MS)
  const outer = init.signal

  if (outer?.aborted) {
    return fetch(input, init)
  }

  const signal = outer ? AbortSignal.any([timeoutSignal, outer]) : timeoutSignal
  return fetch(input, { ...init, signal })
}
