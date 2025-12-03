export const EnviromentEnum = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export type EnviromentEnum =
  (typeof EnviromentEnum)[keyof typeof EnviromentEnum];
