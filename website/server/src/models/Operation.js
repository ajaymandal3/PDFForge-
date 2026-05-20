const mongoose = require('mongoose');

const operationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    inputName: { type: String, default: '' },
    outputName: { type: String, default: '' },
    originalSize: { type: Number, default: 0 },
    outputSize: { type: Number, default: 0 },
    savedBytes: { type: Number, default: 0 },
    ratio: { type: Number, default: 0 },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Operation', operationSchema);
