/**
 * @fileoverview Rate limiting middleware configurations
 * @module middleware/rateLimiters
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for export creation
 * Limits each IP to 10 export requests per 1 minute
 */
export const exportRateLimit = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 10, // Limit each IP to 10 request per windowMs
  message: {
    success: false,
    message:
      'You have reached the maximum number of exports per minute. Please wait for a few minutes and try again later.',
    retryAfter: '2 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    console.log(`🚫 Rate limit exceeded for IP: ${req.ip} on export creation`);
    res.status(429).json({
      success: false,
      message:
        'You have reached the maximum number of exports per minute. Please wait for a few minutes and try again later.',
      retryAfter: '2 minutes'
    });
  }
});

/**
 * General API rate limiter
 * Can be used for other endpoints if needed
 */
export const generalRateLimit = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: {
    success: false,
    message:
      'You have reached the maximum number of requests per minute. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
