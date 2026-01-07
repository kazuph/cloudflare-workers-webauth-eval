#!/usr/bin/env npx tsx
/**
 * JWT鍵生成スクリプト
 * HS256, RS256, ES256 用の暗号鍵を生成し、.envファイルに書き込む
 */

import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ENV_FILE = path.join(process.cwd(), '.env')
const ENV_EXAMPLE_FILE = path.join(process.cwd(), '.env.example')

interface GeneratedKeys {
  hs256Secret: string
  rs256PrivateKey: string
  rs256PublicKey: string
  es256PrivateKey: string
  es256PublicKey: string
}

function generateHS256Secret(): string {
  // 64バイトのランダムなシークレットを生成
  return crypto.randomBytes(64).toString('hex')
}

function generateRS256KeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })
  return {
    privateKey: Buffer.from(privateKey).toString('base64'),
    publicKey: Buffer.from(publicKey).toString('base64'),
  }
}

function generateES256KeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1', // P-256
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })
  return {
    privateKey: Buffer.from(privateKey).toString('base64'),
    publicKey: Buffer.from(publicKey).toString('base64'),
  }
}

function generateAllKeys(): GeneratedKeys {
  console.log('Generating HS256 secret...')
  const hs256Secret = generateHS256Secret()

  console.log('Generating RS256 key pair...')
  const rs256 = generateRS256KeyPair()

  console.log('Generating ES256 key pair...')
  const es256 = generateES256KeyPair()

  return {
    hs256Secret,
    rs256PrivateKey: rs256.privateKey,
    rs256PublicKey: rs256.publicKey,
    es256PrivateKey: es256.privateKey,
    es256PublicKey: es256.publicKey,
  }
}

function createEnvContent(keys: GeneratedKeys): string {
  return `# JWT Authentication Keys
# Generated at: ${new Date().toISOString()}

# HS256 - HMAC Secret (64 bytes, hex encoded)
JWT_HS256_SECRET=${keys.hs256Secret}

# RS256 - RSA Key Pair (PEM format, Base64 encoded)
JWT_RS256_PRIVATE_KEY=${keys.rs256PrivateKey}
JWT_RS256_PUBLIC_KEY=${keys.rs256PublicKey}

# ES256 - ECDSA P-256 Key Pair (PEM format, Base64 encoded)
JWT_ES256_PRIVATE_KEY=${keys.es256PrivateKey}
JWT_ES256_PUBLIC_KEY=${keys.es256PublicKey}

# Test User Credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=password123
`
}

function createEnvExampleContent(): string {
  return `# JWT Authentication Keys
# Run: pnpm run generate-keys to generate actual keys

# HS256 - HMAC Secret (64 bytes, hex encoded)
JWT_HS256_SECRET=<run generate-keys.ts>

# RS256 - RSA Key Pair (PEM format, Base64 encoded)
JWT_RS256_PRIVATE_KEY=<run generate-keys.ts>
JWT_RS256_PUBLIC_KEY=<run generate-keys.ts>

# ES256 - ECDSA P-256 Key Pair (PEM format, Base64 encoded)
JWT_ES256_PRIVATE_KEY=<run generate-keys.ts>
JWT_ES256_PUBLIC_KEY=<run generate-keys.ts>

# Test User Credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=password123
`
}

function main(): void {
  console.log('=== JWT Key Generation Script ===\n')

  // Check if .env already exists
  if (fs.existsSync(ENV_FILE)) {
    console.log('Warning: .env file already exists.')
    console.log('Do you want to overwrite it? (Set FORCE=1 to overwrite)')
    if (process.env.FORCE !== '1') {
      console.log('Skipping .env generation. Use FORCE=1 to overwrite.')
      process.exit(0)
    }
  }

  // Generate keys
  const keys = generateAllKeys()

  // Write .env file
  const envContent = createEnvContent(keys)
  fs.writeFileSync(ENV_FILE, envContent, 'utf-8')
  console.log(`\n✅ .env file created at: ${ENV_FILE}`)

  // Write .env.example file
  const envExampleContent = createEnvExampleContent()
  fs.writeFileSync(ENV_EXAMPLE_FILE, envExampleContent, 'utf-8')
  console.log(`✅ .env.example file created at: ${ENV_EXAMPLE_FILE}`)

  console.log('\n=== Key Generation Complete ===')
  console.log('\nGenerated keys:')
  console.log(`  - HS256 Secret: ${keys.hs256Secret.substring(0, 16)}...`)
  console.log(`  - RS256 Private Key: ${keys.rs256PrivateKey.substring(0, 32)}...`)
  console.log(`  - RS256 Public Key: ${keys.rs256PublicKey.substring(0, 32)}...`)
  console.log(`  - ES256 Private Key: ${keys.es256PrivateKey.substring(0, 32)}...`)
  console.log(`  - ES256 Public Key: ${keys.es256PublicKey.substring(0, 32)}...`)
}

main()
