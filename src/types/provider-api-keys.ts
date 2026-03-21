export interface ProviderApiKeyResponse {
  id: number
  providerId: number
  label: string
  keyPrefix: string
  modelsAllowed: string
  monthlyQuotaTokens: number
  usedTokensMonth: number
  rateLimitRpm: number
  rateLimitTpm: number
  proxyEndpoint: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface CreateProviderApiKeyPayload {
  providerId: number
  label: string
  apiKey: string
  modelsAllowed?: string
  monthlyQuotaTokens?: number
  rateLimitRpm?: number
  rateLimitTpm?: number
  proxyEndpoint?: string
}

