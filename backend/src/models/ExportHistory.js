/**
 * @fileoverview Export History model definition with Mongoose schema
 * @module models/ExportHistory
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Export format enum values
 * @constant {Array<string>}
 */
export const EXPORT_FORMATS = ['csv', 'json'];

/**
 * Export status enum values
 * @constant {Array<string>}
 */
export const EXPORT_STATUSES = ['pending', 'processing', 'completed', 'failed'];

/**
 * Mongoose schema for ExportHistory documents
 * @typedef {Object} ExportHistorySchema
 * @property {string} exportId - Unique export identifier
 * @property {Object} filters - Applied filters for the export
 * @property {string} format - Export format (csv/json)
 * @property {string} status - Export status
 * @property {number} fileSize - Size of generated file in bytes
 * @property {number} taskCount - Number of tasks in export
 * @property {Date} createdAt - Export creation timestamp
 * @property {Date} completedAt - Export completion timestamp
 * @property {number} downloadCount - Number of times downloaded
 * @property {string} errorMessage - Error message if export failed
 */
const exportHistorySchema = new mongoose.Schema(
  {
    exportId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    format: {
      type: String,
      enum: EXPORT_FORMATS,
      required: true
    },
    status: {
      type: String,
      enum: EXPORT_STATUSES,
      default: 'pending',
      index: true
    },
    fileSize: {
      type: Number,
      default: 0
    },
    taskCount: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    completedAt: {
      type: Date,
      default: null
    },
    downloadCount: {
      type: Number,
      default: 0
    },
    errorMessage: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
exportHistorySchema.index({ createdAt: -1 });
exportHistorySchema.index({ status: 1, createdAt: -1 });

/**
 * Virtual property to generate cache key dynamically
 * @name cacheKey
 * @memberof ExportHistorySchema
 * @returns {string} Generated cache key from filters and format
 */
exportHistorySchema.virtual('cacheKey').get(function () {
  const filterString = JSON.stringify(
    this.filters,
    Object.keys(this.filters || {}).sort()
  );
  const hash = crypto
    .createHash('md5')
    .update(filterString + this.format)
    .digest('hex');
  return `export:${hash}`;
});

/**
 * Virtual property to check if export has expired based on cache TTL
 * @name isExpired
 * @memberof ExportHistorySchema
 * @returns {boolean} True if export has expired
 */
exportHistorySchema.virtual('isExpired').get(function () {
  const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
  const expirationTime = new Date(this.createdAt.getTime() + CACHE_TTL_MS);
  return new Date() > expirationTime;
});

/**
 * Pre-save middleware to set completedAt when status changes to completed
 * @param {Function} next - Mongoose next function
 */
exportHistorySchema.pre('save', function (next) {
  if (
    this.isModified('status') &&
    this.status === 'completed' &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
  }
  next();
});

/**
 * Increments download count
 * @method incrementDownloadCount
 * @returns {Promise<void>}
 */
exportHistorySchema.methods.incrementDownloadCount = async function () {
  this.downloadCount += 1;
  await this.save();
};

/**
 * Export History model for managing export tracking documents in MongoDB
 * @type {mongoose.Model}
 */
const ExportHistory = mongoose.model('ExportHistory', exportHistorySchema);

export default ExportHistory;
