import crypto from 'crypto'
import Razorpay from 'razorpay'

// Real Razorpay TEST/SANDBOX mode is used automatically once
// RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set in backend/.env (Razorpay
// test keys start with "rzp_test_..." and never move real money).
//
// If those variables are absent (e.g. a reviewer running this project
// without signing up for a gateway), we fall back to a local "mock"
// gateway that reproduces the same order -> checkout -> verify -> store
// flow, so the whole payment feature can still be demoed end-to-end
// offline. Swap MOCK_MODE off simply by adding real test keys — no other
// code changes needed.
export const MOCK_MODE = !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET

const razorpay = MOCK_MODE
  ? null
  : new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })

// Amount is always handled in the smallest currency unit (paise for INR),
// same convention Razorpay uses, so switching off mock mode later needs
// no unit-conversion changes elsewhere.
export async function createOrder({ amountInPaise, currency = 'INR', receipt }) {
  if (MOCK_MODE) {
    return {
      id: `mock_order_${crypto.randomBytes(8).toString('hex')}`,
      amount: amountInPaise,
      currency,
      receipt,
      status: 'created'
    }
  }
  return razorpay.orders.create({ amount: amountInPaise, currency, receipt })
}

// Verifies the HMAC-SHA256 signature Razorpay returns after a successful
// checkout, proving the payment confirmation actually came from Razorpay
// and wasn't forged by the browser. In mock mode we simulate the same
// signature scheme locally using the same secret-based approach so the
// verification code path is exercised identically either way.
export function verifySignature({ orderId, paymentId, signature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET || process.env.MOCK_GATEWAY_SECRET || 'mock-gateway-secret-change-me'
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
  return expected === signature
}

// Used by the mock checkout page (frontend) to produce a signature the
// same way a real client-side Razorpay checkout would hand back, so
// verifySignature() above can validate it the same way in both modes.
export function mockSign({ orderId, paymentId }) {
  const secret = process.env.RAZORPAY_KEY_SECRET || process.env.MOCK_GATEWAY_SECRET || 'mock-gateway-secret-change-me'
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
}
