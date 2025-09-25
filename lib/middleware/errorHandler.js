/**
 * Centralized error handling middleware for API endpoints
 */

/**
 * Standard error response format
 */
export class ApiError extends Error {
  constructor(message, statusCode = 500, code = null, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Create standardized error responses
 */
export const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED'
};

/**
 * Create validation error
 */
export function createValidationError(message, details = null) {
  return new ApiError(message, 400, ErrorTypes.VALIDATION_ERROR, details);
}

/**
 * Create not found error
 */
export function createNotFoundError(message = 'Resource not found') {
  return new ApiError(message, 404, ErrorTypes.NOT_FOUND);
}

/**
 * Create conflict error
 */
export function createConflictError(message) {
  return new ApiError(message, 409, ErrorTypes.CONFLICT);
}

/**
 * Create forbidden error
 */
export function createForbiddenError(message) {
  return new ApiError(message, 403, ErrorTypes.FORBIDDEN);
}

/**
 * Create unauthorized error
 */
export function createUnauthorizedError(message = 'Unauthorized') {
  return new ApiError(message, 401, ErrorTypes.UNAUTHORIZED);
}

/**
 * Create method not allowed error
 */
export function createMethodNotAllowedError(method, allowedMethods = []) {
  const message = `Method ${method} Not Allowed`;
  const error = new ApiError(message, 405, ErrorTypes.METHOD_NOT_ALLOWED);
  error.allowedMethods = allowedMethods;
  return error;
}

/**
 * Map common errors to appropriate HTTP responses
 */
export function mapErrorToResponse(error) {
  // Handle known ApiError instances
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.code || 'API_ERROR',
        message: error.message,
        ...(error.details && { details: error.details })
      },
      headers: error.allowedMethods ? { 'Allow': error.allowedMethods.join(', ') } : {}
    };
  }

  // Handle common model errors
  if (error.message) {
    // Validation errors
    if (error.message.includes('Invalid key') ||
        error.message.includes('validation') ||
        error.message.includes('Invalid') && !error.message.includes('not found')) {
      return {
        statusCode: 400,
        body: {
          error: ErrorTypes.VALIDATION_ERROR,
          message: error.message
        }
      };
    }

    // Not found errors
    if (error.message.includes('not found')) {
      return {
        statusCode: 404,
        body: {
          error: ErrorTypes.NOT_FOUND,
          message: error.message
        }
      };
    }

    // Conflict errors
    if (error.message.includes('already exists') ||
        error.message.includes('Cannot delete') ||
        error.message.includes('depend') ||
        error.message.includes('reference')) {
      return {
        statusCode: 409,
        body: {
          error: ErrorTypes.CONFLICT,
          message: error.message
        }
      };
    }

    // Forbidden errors
    if (error.message.includes('disabled') ||
        error.message.includes('not allowed') ||
        error.message.includes('forbidden')) {
      return {
        statusCode: 403,
        body: {
          error: ErrorTypes.FORBIDDEN,
          message: error.message
        }
      };
    }

    // Authentication errors
    if (error.message.includes('unauthorized') ||
        error.message.includes('authentication') ||
        error.message.includes('invalid credentials')) {
      return {
        statusCode: 401,
        body: {
          error: ErrorTypes.UNAUTHORIZED,
          message: error.message
        }
      };
    }
  }

  // Handle Prisma errors
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        return {
          statusCode: 409,
          body: {
            error: ErrorTypes.CONFLICT,
            message: 'A record with this value already exists'
          }
        };

      case 'P2025':
        return {
          statusCode: 404,
          body: {
            error: ErrorTypes.NOT_FOUND,
            message: 'Record not found'
          }
        };

      case 'P2003':
        return {
          statusCode: 400,
          body: {
            error: ErrorTypes.VALIDATION_ERROR,
            message: 'Invalid reference to related record'
          }
        };

      case 'P2014':
        return {
          statusCode: 409,
          body: {
            error: ErrorTypes.CONFLICT,
            message: 'Cannot delete record due to related records'
          }
        };
    }
  }

  // Default to internal server error
  return {
    statusCode: 500,
    body: {
      error: ErrorTypes.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    }
  };
}

/**
 * Error handling middleware wrapper
 */
export function withErrorHandler(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('API Error:', {
        method: req.method,
        url: req.url,
        query: req.query,
        body: req.body,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });

      const response = mapErrorToResponse(error);

      // Set headers if provided
      if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }

      return res.status(response.statusCode).json(response.body);
    }
  };
}

/**
 * Validation middleware that throws ApiError
 */
export function validateRequest(validationFn) {
  return (req, res, next) => {
    try {
      const result = validationFn(req);
      if (!result.valid) {
        throw createValidationError(result.error, result.details);
      }

      // Add validated data to request
      if (result.data) {
        req.validated = result.data;
      }

      if (next) next();
      return result;
    } catch (error) {
      if (next) {
        next(error);
      } else {
        throw error;
      }
    }
  };
}

/**
 * Method validation middleware
 */
export function validateMethod(allowedMethods) {
  return (req, res, next) => {
    if (!allowedMethods.includes(req.method)) {
      const error = createMethodNotAllowedError(req.method, allowedMethods);
      const response = mapErrorToResponse(error);

      // Set Allow header
      if (response.headers.Allow) {
        res.setHeader('Allow', response.headers.Allow);
      }

      return res.status(response.statusCode).json(response.body);
    }

    if (next) next();
  };
}

/**
 * Async handler wrapper that catches errors
 */
export function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      return await fn(req, res, next);
    } catch (error) {
      if (next) {
        next(error);
      } else {
        throw error;
      }
    }
  };
}

/**
 * Rate limiting error
 */
export function createRateLimitError(retryAfter = null) {
  const error = new ApiError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
  if (retryAfter) {
    error.retryAfter = retryAfter;
  }
  return error;
}

/**
 * Content type validation
 */
export function validateContentType(req, expectedTypes = ['application/json']) {
  const contentType = req.headers['content-type'];

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    if (!contentType || !expectedTypes.some(type => contentType.includes(type))) {
      throw createValidationError(
        `Invalid content type. Expected one of: ${expectedTypes.join(', ')}`
      );
    }
  }
}

/**
 * Request size validation
 */
export function validateRequestSize(req, maxSize = 1024 * 1024) { // 1MB default
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  if (contentLength > maxSize) {
    throw createValidationError(
      `Request too large. Maximum size: ${maxSize} bytes`
    );
  }
}

/**
 * Comprehensive API wrapper
 */
export function createApiHandler(options = {}) {
  const {
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'],
    validateContentType: shouldValidateContentType = true,
    maxRequestSize = 1024 * 1024,
    requireAuth = false
  } = options;

  return (handler) => {
    return async (req, res) => {
      try {
        // Method validation
        if (!allowedMethods.includes(req.method)) {
          throw createMethodNotAllowedError(req.method, allowedMethods);
        }

        // Content type validation
        if (shouldValidateContentType) {
          validateContentType(req);
        }

        // Request size validation
        validateRequestSize(req, maxRequestSize);

        // Authentication (if required)
        if (requireAuth) {
          // TODO: Implement authentication check
          // For now, skip authentication
        }

        // Call the actual handler
        return await handler(req, res);

      } catch (error) {
        const response = mapErrorToResponse(error);

        // Set special headers
        if (error.retryAfter) {
          res.setHeader('Retry-After', error.retryAfter);
        }
        if (response.headers) {
          Object.entries(response.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
        }

        // Log error in development
        if (process.env.NODE_ENV === 'development') {
          console.error('API Handler Error:', {
            method: req.method,
            url: req.url,
            error: error.message,
            stack: error.stack
          });
        }

        return res.status(response.statusCode).json(response.body);
      }
    };
  };
}