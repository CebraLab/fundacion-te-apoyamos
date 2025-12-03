import { EnviromentEnum } from '../models/enviroment.model';
import 'dotenv/config';
import { join } from 'path';
import { readFileSync } from 'fs';

class Config {
  constructor() {
    // Ruta al archivo JSON usando process.cwd() (directorio de trabajo actual)
    const jsonPath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'config',
      'queues.json',
    );
    console.log('JSON path:', jsonPath);
    const jsonContent = readFileSync(jsonPath, 'utf8');
    const jsonConfig = JSON.parse(jsonContent);
    console.log('JSON config loaded successfully:', jsonConfig);
    this.queues.rabbitmq.queues = jsonConfig.queues;
  }

  public projectName: string = process.env.PROJECT_NAME || 'queue';

  public prefix: string = process.env.PREFIX || 'api/v1';

  public httpPort: number = Number(process.env.PORT) || 3000;

  public enviroment: EnviromentEnum =
    (process.env.NODE_ENV as EnviromentEnum) || EnviromentEnum.DEVELOPMENT;

  public isDevelopment(): boolean {
    return this.enviroment === EnviromentEnum.DEVELOPMENT;
  }

  public isProduction(): boolean {
    return this.enviroment === EnviromentEnum.PRODUCTION;
  }

  public corsOrigins: string[] | string = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS?.split(',')
    : '*';

  public jwtConstants = {
    secret: process.env.JWT_SECRET || 'secret',
  };

  public keyCrypto = {
    key:
      process.env.KEY_CRYPTO ||
      '2cefbac12a6dbbaf491ec54081280d68ede4b7b4d208909ad93b34bc3e1e45a4',
    iv: process.env.IV_CRYPTO || 'c7ebe3b4de5967f5df3328c1ec12b37b',
  };

  public queues = {
    rabbitmq: {
      queues: [{ name: 'default_queue' }],
      username: process.env.RABBITMQ_USER || 'guest',
      password: process.env.RABBITMQ_PASSWORD || 'guest',
      host: process.env.RABBITMQ_HOST || 'rabbitmq',
      port: Number(process.env.RABBITMQ_PORT) || 5672,
      endpoint: process.env.RABBITMQ_ENDPOINT || 'http://localhost:15672/api',
    },
  };

  public databases = {
    mysql: {
      type: 'mysql',
      host: process.env.MYSQL_HOSTNAME,
      port: Number(process.env.MYSQL_PORT) || 3306,
      username: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      synchronize: true,
    },
  };
}

export const CONFIG = new Config();
