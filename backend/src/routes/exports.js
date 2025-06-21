/**
 * @fileoverview Export routes for task data export functionality
 * @module routes/exports
 */

import express from 'express';
import { createReadStream } from 'fs';
import ExportService from '../services/exportService.js';

const router = express.Router();

/**
 * Socket handlers reference for real-time updates
 * @type {Object|null}
 */
export let socketHandlers = null;

/**
 * Sets socket handlers for broadcasting real-time updates
 * @param {Object} handlers - Socket handler object with broadcast methods
 * @example
 * setSocketHandlers(socketHandlers);
 */
export const setSocketHandlers = (handlers) => {
  console.log('🔌 Setting socket handlers in exports router:', !!handlers);
  socketHandlers = handlers;
};

/**
 * POST /exports - Initiate a new export request
 * @name InitiateExport
 * @function
 * @param {Object} req.body - Export request data
 * @param {Object} req.body.filters - Filter parameters for export
 * @param {string} req.body.format - Export format (csv/json)
 * @returns {Object} Export initiation result with exportId
 */
router.post('/', async (req, res, next) => {
  try {
    const { filters = {}, format } = req.body;
    console.dir(req.body, { depth: null });
    if (!format) {
      return res.status(400).json({
        success: false,
        message: 'Export format is required'
      });
    }

    const result = await ExportService.initiateExport(filters, format);

    res.status(201).json({
      success: true,
      data: result,
      message: result.cached
        ? 'Export retrieved from cache'
        : 'Export initiated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /exports/:exportId/status - Get export status and progress
 * @name GetExportStatus
 * @function
 * @param {string} req.params.exportId - Export identifier
 * @returns {Object} Export status information
 */
router.get('/:exportId/status', async (req, res, next) => {
  try {
    const { exportId } = req.params;

    const status = await ExportService.getExportStatus(exportId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    if (error.message === 'Export not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
});

/**
 * GET /exports/:exportId/download - Download completed export
 * @name DownloadExport
 * @function
 * @param {string} req.params.exportId - Export identifier
 * @returns {File} Export file download
 */
router.get('/:exportId/download', async (req, res, next) => {
  try {
    const { exportId } = req.params;
    const exportData = await ExportService.getExportData(exportId);

    res.setHeader('Content-Type', exportData.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportData.filename}"`
    );
    res.setHeader('Content-Length', exportData.fileSize);

    console.log(
      `📤 Streaming export file: ${exportData.filename} (${(exportData.fileSize / 1024 / 1024).toFixed(2)}MB)`
    );

    const readStream = createReadStream(exportData.filePath);

    readStream.on('error', (error) => {
      console.error('Error streaming export file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming export file'
        });
      }
    });

    readStream.pipe(res);
  } catch (error) {
    if (
      error.message === 'Export not found' ||
      error.message.includes('not ready') ||
      error.message.includes('expired') ||
      error.message.includes('file not found')
    ) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
});

/**
 * GET /exports/history - Get user's export history
 * @name GetExportHistory
 * @function
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=20] - Number of exports per page
 * @param {string} [req.query.status] - Filter by export status
 * @param {string} [req.query.format] - Filter by export format
 * @returns {Object} Paginated export history
 */
router.get('/history', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, format } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      format
    };

    const history = await ExportService.getExportHistory(options);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /exports/:exportId/repeat - Repeat a failed export
 * @name RepeatExport
 * @function
 * @param {string} req.params.exportId - Original export identifier
 * @returns {Object} New export initiation result
 */
router.post('/:exportId/repeat', async (req, res, next) => {
  try {
    const { exportId } = req.params;

    const result = await ExportService.repeatExport(exportId);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Export repeated successfully'
    });
  } catch (error) {
    if (error.message === 'Export not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    if (error.message.includes('cannot be repeated')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
});

export default router;
