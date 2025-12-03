import { CONFIG } from './enviroment.config';
import axios from 'axios';

export class IntegrationConfig {
  constructor() {}

  public hubspot = {
    apiAuthV1: axios.create({
      baseURL: CONFIG.integrations.hubspot.apiV1Oauth,
      headers: {
        // Authorization: `Bearer ${CONFIG.integrations.hubspot.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    }),
    apiV3: axios.create({
      baseURL: CONFIG.integrations.hubspot.apiV3Url,
      headers: {
        Authorization: `Bearer ${CONFIG.integrations.hubspot.apiKey}`,
      },
    }),
    apiFilesV3: axios.create({
      baseURL: CONFIG.integrations.hubspot.apiFilesV3,
      headers: {
        Authorization: `Bearer ${CONFIG.integrations.hubspot.apiKey}`,
      },
    }),
    apiV4: axios.create({
      baseURL: CONFIG.integrations.hubspot.apiV4,
      headers: {
        Authorization: `Bearer ${CONFIG.integrations.hubspot.apiKey}`,
      },
    }),
  };
}

export const INTEGRATION = new IntegrationConfig();
