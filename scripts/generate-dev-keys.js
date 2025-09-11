#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate RSA key pair for development
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Create keys directory
const keysDir = path.join(__dirname, '..', 'keys');
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

// Write keys to files
fs.writeFileSync(path.join(keysDir, 'private-key.pem'), privateKey);
fs.writeFileSync(path.join(keysDir, 'public-key.pem'), publicKey);

// Create a JSON file with the public key for easy copying to app configs
const publicKeyJson = {
  kid: 'dev-key-2025',
  pem: publicKey
};

fs.writeFileSync(
  path.join(keysDir, 'public-key.json'), 
  JSON.stringify(publicKeyJson, null, 2)
);

console.log('✅ Development keys generated:');
console.log('   - Private key: ./keys/private-key.pem');
console.log('   - Public key: ./keys/public-key.pem');
console.log('   - Public key JSON: ./keys/public-key.json');
console.log('');
console.log('🔒 The private key is used by the admin to sign configs.');
console.log('📱 Copy the public key JSON to your app\'s bootstrap plist.');
console.log('');
console.log('⚠️  These are development keys only. Generate new keys for production!');