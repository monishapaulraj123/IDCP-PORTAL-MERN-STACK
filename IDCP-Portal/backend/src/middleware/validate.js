import { validationResult } from 'express-validator'

// Runs after an array of express-validator checks; returns a clean 400
// with the first validation error instead of letting bad input reach
// route handlers / SQL.
export default function validate(req, res, next) {
  const result = validationResult(req)
  if (!result.isEmpty()) {
    return res.status(400).json({ error: result.array()[0].msg, fields: result.array() })
  }
  next()
}
