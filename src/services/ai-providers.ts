import type { AiProviderResponse } from '../types/ai-providers'

import { requestJson } from '../lib/api-client'

export function listProviders() {
  return requestJson<AiProviderResponse[]>('/admin/providers')
}

