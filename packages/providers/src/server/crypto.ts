import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Versioned AES-256-GCM envelope. Binding prevents moving ciphertext between users/providers. */
export class TokenCipher {
  private key: Buffer;
  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32)
      throw new Error('TOKEN_ENCRYPTION_KEY must encode exactly 32 random bytes');
  }
  seal(value: unknown, binding: string): string {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(binding));
    const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      data.toString('base64url'),
    ].join('.');
  }
  open(envelope: string, binding: string): unknown {
    const [version, iv, tag, data, extra] = envelope.split('.');
    if (version !== 'v1' || !iv || !tag || !data || extra)
      throw new Error('Invalid encrypted envelope');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(binding));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(
      Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString(
        'utf8',
      ),
    );
  }
}
