import { EnviromentEnum } from '../models/enviroment.model';
import 'dotenv/config';

class Config {
  constructor() {}

  public prefix: string = process.env.PREFIX || 'api/v1';

  public httpPort: number = Number(process.env.PORT) || 3001;

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

  public queues = {
    rabbitmq: {
      queues: {
        ventas: 'ventas',
      },
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
    mysqlfazenda: {
      type: 'mysql',
      host: process.env.FMYSQL_HOSTNAME,
      port: Number(process.env.FMYSQL_PORT) || 3306,
      username: process.env.FMYSQL_USER,
      password: process.env.FMYSQL_PASSWORD,
      database: process.env.FMYSQL_DATABASE,
      synchronize: false,
    },
  };

  public integrations = {
    hubspot: {
      apiKey: 'process.env.HUBSPOT_TOKEN',
      clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
      apiV3Url: 'https://api.hubapi.com/crm/v3',
      apiV1Oauth: 'https://api.hubapi.com/oauth/v1',
      apiFilesV3: 'https://api.hubapi.com/files/v3',
      apiV4: 'https://api.hubapi.com/crm/v4',
    },
  };
}

export const CONFIG = new Config();
