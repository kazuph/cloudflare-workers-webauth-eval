/**
 * RS256認証のテスト
 */

import { describe, it, expect } from 'vitest'
import {
  login,
  verify,
  accessProtected,
  refresh,
  getTestCredentials,
  type LoginResponse,
  type VerifyResponse,
  type ProtectedResponse,
  type ErrorResponse,
} from './helpers'

describe('RS256 Authentication', () => {
  describe('POST /auth/rs256/login', () => {
    it('should return tokens for valid credentials', async () => {
      const { email, password } = getTestCredentials()
      const response = await login('rs256', email, password)

      expect(response.status).toBe(200)

      const data: LoginResponse = await response.json()
      expect(data.message).toBe('Login successful')
      expect(data.algorithm).toBe('RS256')
      expect(data.accessToken).toBeDefined()
      expect(data.refreshToken).toBeDefined()
      expect(data.expiresIn).toBe('15m')
    })

    it('should reject invalid credentials', async () => {
      const response = await login('rs256', 'wrong@example.com', 'wrongpassword')

      expect(response.status).toBe(401)

      const data: ErrorResponse = await response.json()
      expect(data.error).toBe('Invalid credentials')
    })
  })

  describe('GET /auth/rs256/verify', () => {
    it('should verify valid access token', async () => {
      const { email, password } = getTestCredentials()

      // First, login to get a token
      const loginResponse = await login('rs256', email, password)
      const loginData: LoginResponse = await loginResponse.json()

      // Then, verify the token
      const verifyResponse = await verify('rs256', loginData.accessToken)

      expect(verifyResponse.status).toBe(200)

      const data: VerifyResponse = await verifyResponse.json()
      expect(data.valid).toBe(true)
      expect(data.algorithm).toBe('RS256')
      expect(data.payload.email).toBe(email)
      expect(data.payload.type).toBe('access')
    })

    it('should reject invalid token', async () => {
      const response = await verify('rs256', 'invalid-token')

      expect(response.status).toBe(401)
    })

    it('should reject request without token', async () => {
      const response = await verify('rs256', '')

      expect(response.status).toBe(401)
    })
  })

  describe('GET /auth/rs256/protected', () => {
    it('should allow access with valid token', async () => {
      const { email, password } = getTestCredentials()

      // First, login to get a token
      const loginResponse = await login('rs256', email, password)
      const loginData: LoginResponse = await loginResponse.json()

      // Then, access protected resource
      const protectedResponse = await accessProtected('rs256', loginData.accessToken)

      expect(protectedResponse.status).toBe(200)

      const data: ProtectedResponse = await protectedResponse.json()
      expect(data.message).toBe('Access granted to protected resource')
      expect(data.algorithm).toBe('RS256')
      expect(data.user.email).toBe(email)
      expect(data.data.secretInfo).toBeDefined()
    })

    it('should reject access without token', async () => {
      const response = await accessProtected('rs256', '')

      expect(response.status).toBe(401)
    })
  })

  describe('POST /auth/rs256/refresh', () => {
    it('should issue new tokens with valid refresh token', async () => {
      const { email, password } = getTestCredentials()

      // First, login to get tokens
      const loginResponse = await login('rs256', email, password)
      const loginData: LoginResponse = await loginResponse.json()

      // Then, refresh the tokens
      const refreshResponse = await refresh('rs256', loginData.refreshToken)

      expect(refreshResponse.status).toBe(200)

      const data: LoginResponse = await refreshResponse.json()
      expect(data.message).toBe('Token refreshed')
      expect(data.algorithm).toBe('RS256')
      expect(data.accessToken).toBeDefined()
      expect(data.refreshToken).toBeDefined()
      // Tokens should be valid JWT format
      expect(data.accessToken.split('.').length).toBe(3)
      expect(data.refreshToken.split('.').length).toBe(3)
    })

    it('should reject refresh with access token', async () => {
      const { email, password } = getTestCredentials()

      // First, login to get tokens
      const loginResponse = await login('rs256', email, password)
      const loginData: LoginResponse = await loginResponse.json()

      // Try to refresh with access token (should fail)
      const refreshResponse = await refresh('rs256', loginData.accessToken)

      expect(refreshResponse.status).toBe(401)
    })
  })
})
