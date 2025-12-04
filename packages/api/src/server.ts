/**
 * SIP Protocol REST API Server
 *
 * Production-ready Express server with:
 * - Structured logging (pino)
 * - Environment validation (envalid)
 * - Graceful shutdown handling
 * - Security middleware (helmet, CORS, rate limiting)
 * - Request authentication
 */

import express, { Express } from 'express'
import helmet from 'helmet'
import compression from 'compression'
import router from './routes'
import { env, logConfigWarnings } from './config'
import { logger, requestLogger } from './logger'
import { setupGracefulShutdown, shutdownMiddleware, isServerShuttingDown } from './shutdown'
import {
  errorHandler,
  notFoundHandler,
  secureCors,
  rateLimiter,
  authenticate,
  isAuthEnabled,
  getCorsConfig,
} from './middleware'

const app: Express = express()

// Shutdown middleware (early to reject during shutdown)
app.use(shutdownMiddleware)

// Security middleware
app.use(helmet())
app.use(secureCors)

// Rate limiting (before auth to prevent brute force)
app.use(rateLimiter)

// Authentication
app.use(authenticate)

// Body parsing middleware
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// Compression middleware
app.use(compression())

// Request logging (replaces morgan)
app.use(requestLogger)

// API routes
app.use('/api/v1', router)

// Root endpoint
app.get('/', (req, res) => {
  const corsConfig = getCorsConfig()
  res.json({
    name: '@sip-protocol/api',
    version: '0.1.0',
    description: 'REST API service for SIP Protocol SDK',
    documentation: '/api/v1/health',
    endpoints: {
      health: 'GET /api/v1/health',
      stealth: 'POST /api/v1/stealth/generate',
      commitment: 'POST /api/v1/commitment/create',
      proof: 'POST /api/v1/proof/funding',
      quote: 'POST /api/v1/quote',
      swap: 'POST /api/v1/swap',
      swapStatus: 'GET /api/v1/swap/:id/status',
    },
    security: {
      authentication: isAuthEnabled() ? 'enabled' : 'disabled',
      cors: {
        origins: corsConfig.origins.length > 0 ? corsConfig.origins.length + ' configured' : 'none (blocked)',
        credentials: corsConfig.credentials,
      },
      rateLimit: 'enabled',
    },
  })
})

// 404 handler
app.use(notFoundHandler)

// Error handler (must be last)
app.use(errorHandler)

// Start server
if (require.main === module) {
  // Log configuration warnings
  logConfigWarnings(logger)

  const corsConfig = getCorsConfig()
  const server = app.listen(env.PORT, () => {
    logger.info({
      port: env.PORT,
      environment: env.NODE_ENV,
      auth: isAuthEnabled() ? 'enabled' : 'disabled',
      corsOrigins: corsConfig.origins.length,
      logLevel: env.LOG_LEVEL,
    }, 'SIP Protocol API started')

    // Pretty banner in development
    if (env.isDevelopment) {
      console.log(`
╔════════════════════════════════════════════════════╗
║  SIP Protocol REST API                             ║
║  Version: 0.1.0                                    ║
╠════════════════════════════════════════════════════╣
║  Port: ${String(env.PORT).padEnd(43)}║
║  Environment: ${env.NODE_ENV.padEnd(37)}║
╠════════════════════════════════════════════════════╣
║  Security:                                         ║
║  • Auth: ${(isAuthEnabled() ? 'ENABLED' : 'disabled (dev mode)').padEnd(42)}║
║  • CORS: ${(corsConfig.origins.length + ' origins').padEnd(42)}║
║  • Rate Limit: enabled                             ║
╠════════════════════════════════════════════════════╣
║  Logging: ${env.LOG_LEVEL.padEnd(41)}║
╠════════════════════════════════════════════════════╣
║  Documentation: http://localhost:${String(env.PORT).padEnd(17)}║
╚════════════════════════════════════════════════════╝
      `)
    }
  })

  // Setup graceful shutdown
  setupGracefulShutdown(server, async () => {
    // Add any cleanup logic here (close DB connections, flush logs, etc.)
    logger.info('Flushing logs...')
    // pino handles its own flushing on process exit
  })
}

// Export for testing
export default app
export { isServerShuttingDown }
