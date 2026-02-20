import jwt from 'jsonwebtoken';

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '24h' });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
}
