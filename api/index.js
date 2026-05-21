const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config();
const serverless = require('serverless-http');
const app = require('../website/server/src/app');
const { ensureDirectories } = require('../website/server/src/services/storage');
const { connectDatabase } = require('../website/server/src/config/db');

// Ensure expected directories and DB connection on cold start
ensureDirectories().catch(() => {});
connectDatabase().catch(() => {});

module.exports = serverless(app);
