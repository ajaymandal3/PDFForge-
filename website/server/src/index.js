const app = require('./app');
const { connectDatabase } = require('./config/db');
const { ensureDirectories } = require('./services/storage');
require('dotenv').config();

const port = process.env.PORT || 5000;

async function boot() {
  await ensureDirectories();
  await connectDatabase();

  app.listen(port, () => {
    console.log(`HuffZip AI server running on port ${port}`);
  });
}

boot().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
