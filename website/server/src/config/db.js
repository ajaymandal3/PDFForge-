const mongoose = require('mongoose');

async function connectDatabase() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.warn('MONGO_URI is not set. Running with in-memory history storage.');
    return;
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    autoIndex: true,
  });

  console.log('MongoDB connected');
}

module.exports = { connectDatabase };
