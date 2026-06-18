import jwt from 'jsonwebtoken';
import config from '../config.js';

const JWT_SECRET = config.web.jwtSecret;
const JWT_EXPIRE = `${config.web.jwtExpireHours}h`;

/**
 * Generate a JWT token for authenticated user.
 */
export function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
}

/**
 * Express middleware — verify JWT from Authorization header.
 */
export function authMiddleware(req, res, next) {
  // Local access bypass (configurable)
  if (config.web.localAuthBypass && isLocalRequest(req)) {
    req.user = { username: 'local' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Check if request is from localhost.
 */
function isLocalRequest(req) {
  const ip = req.ip || req.connection?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
}

/**
 * Login handler.
 */
export function handleLogin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username !== config.web.adminUser || password !== config.web.adminPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(username);
  res.json({ token, expiresIn: JWT_EXPIRE });
}
