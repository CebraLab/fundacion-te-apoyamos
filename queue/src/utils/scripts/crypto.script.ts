import * as crypto from 'crypto';
import { CONFIG } from '../config/enviroment.config';

export class Crypto {
  private algorithm: string;
  private key: Buffer;
  private iv: Buffer;

  constructor() {
    // Configuración para la encriptación
    this.algorithm = 'aes-256-cbc';
    this.key = Buffer.from(CONFIG.keyCrypto.key, 'hex'); // La clave debe ser de 32 bytes (256 bits)
    this.iv = Buffer.from(CONFIG.keyCrypto.iv, 'hex'); // El IV debe ser de 16 bytes (128 bits)
  }

  encrypt(text: string) {
    const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  decrypt(encryptedText: string) {
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, this.iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
