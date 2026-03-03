import { 
  closePgPool, 
  ensureUsersTable,
  ensureWorkspaceTables,
  ensureIntegrationTables,
  ensureApiTokenTables,
  ensureBundleTables,
  ensureEvidenceTables,
  ensureChatTables,
  ensureChatImageTable,
  ensureMemoryTables,
  ensureEventTables,
  query,
} from "./pg.js";

import { 
  closeVectorPool, 
  ensureVectorTables,
  vectorQuery,
} from "./vector.js";

async function closePool(): Promise<void> {
  await closePgPool();
  await closeVectorPool();
}

export { 
  ensureUsersTable,
  ensureWorkspaceTables,
  ensureIntegrationTables,
  ensureApiTokenTables,
  ensureBundleTables,
  ensureEvidenceTables,
  ensureChatTables,
  ensureChatImageTable,
  ensureMemoryTables,
  ensureEventTables,
  ensureVectorTables,
  closePool,
  query,
  vectorQuery,
};