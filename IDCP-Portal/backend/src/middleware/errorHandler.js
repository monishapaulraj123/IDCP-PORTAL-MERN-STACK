// Centralized error handler — keeps error shape/format consistent and
// avoids ever leaking stack traces or internal details to the client.
export default function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message)
  const status = err.status || 500
  res.status(status).json({
    error: status === 500 ? 'Something went wrong on our end. Please try again.' : err.message
  })
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route matches ${req.method} ${req.originalUrl}.` })
}
