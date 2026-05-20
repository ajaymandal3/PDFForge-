const crypto = require('crypto');
const mongoose = require('mongoose');
const Operation = require('../models/Operation');

const memoryHistory = [];

function normalizeOperation(entry) {
  return {
    id: entry._id ? String(entry._id) : entry.id,
    type: entry.type,
    inputName: entry.inputName || '',
    outputName: entry.outputName || '',
    originalSize: Number(entry.originalSize || 0),
    outputSize: Number(entry.outputSize || 0),
    savedBytes: Number(entry.savedBytes || 0),
    ratio: Number(entry.ratio || 0),
    metadata: entry.metadata || {},
    createdAt: entry.createdAt || new Date().toISOString(),
  };
}

function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

async function recordOperation(entry) {
  const payload = normalizeOperation(entry);

  if (isDatabaseReady()) {
    try {
      const saved = await Operation.create(payload);
      return normalizeOperation(saved.toObject());
    } catch (error) {
      console.warn('Failed to persist operation history, falling back to memory:', error.message);
    }
  }

  memoryHistory.unshift({ ...payload, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) });
  memoryHistory.splice(100);
  return memoryHistory[0];
}

async function listOperations(limit = 10) {
  if (isDatabaseReady()) {
    const entries = await Operation.find().sort({ createdAt: -1 }).limit(limit).lean();
    return entries.map(normalizeOperation);
  }

  return memoryHistory.slice(0, limit);
}

async function getDashboardStats() {
  const operations = await listOperations(100);
  const totals = operations.reduce(
    (accumulator, operation) => {
      accumulator.count += 1;
      accumulator.savedBytes += Number(operation.savedBytes || 0);
      accumulator.originalBytes += Number(operation.originalSize || 0);
      accumulator.outputBytes += Number(operation.outputSize || 0);
      accumulator.ratioSum += Number(operation.ratio || 0);
      return accumulator;
    },
    { count: 0, savedBytes: 0, originalBytes: 0, outputBytes: 0, ratioSum: 0 }
  );

  return {
    totals: {
      operations: totals.count,
      savedBytes: totals.savedBytes,
      originalBytes: totals.originalBytes,
      outputBytes: totals.outputBytes,
      averageRatio: totals.count === 0 ? 0 : Number((totals.ratioSum / totals.count).toFixed(4)),
    },
    recentOperations: operations.slice(0, 6),
  };
}

module.exports = {
  recordOperation,
  listOperations,
  getDashboardStats,
};
