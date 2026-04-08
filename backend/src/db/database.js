const { MongoClient } = require("mongodb");

// MongoDB Atlas connection string with properly encoded password
const MONGODB_URI = "mongodb+srv://patelkirtan2308_db_user:Kirtan%401775@dbcluster.bfm1r77.mongodb.net/?retryWrites=true&w=majority";
const DB_NAME = "icc_management";

let cachedClient = null;
let cachedDb = null;

/**
 * Get MongoDB client instance (reused across requests)
 * For traditional long-running servers:
 * - maxPoolSize: 50 - handles peak concurrent requests
 * - minPoolSize: 10 - pre-warmed connections ready for traffic
 * - maxIdleTimeMS: 600000 (10 min) - cleanup idle connections but maintain capacity during stable periods
 * - connectTimeoutMS: 10000 (10s) - fail fast on connection issues
 * - socketTimeoutMS: 30000 (30s) - prevents hanging queries during OLTP operations
 * - serverSelectionTimeoutMS: 5000 (5s) - quick failover for replica set topology changes
 */
async function getClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 50,
    minPoolSize: 10,
    maxIdleTimeMS: 600000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 30000,
    serverSelectionTimeoutMS: 5000,
    retryWrites: true,
  });

  await client.connect();
  cachedClient = client;
  return client;
}

/**
 * Get MongoDB database instance
 */
async function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = await getClient();
  cachedDb = client.db(DB_NAME);
  return cachedDb;
}

/**
 * Graceful shutdown
 */
async function closeDb() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}

module.exports = { getDb, getClient, closeDb };
