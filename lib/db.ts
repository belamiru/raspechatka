import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var postgresPool: Pool | undefined;
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL не задана. Проверьте интеграцию PostgreSQL в ONREZA."
    );
  }

  if (!global.postgresPool) {
    global.postgresPool = new Pool({
      connectionString,
      max: 5,
    });
  }

  return global.postgresPool;
}