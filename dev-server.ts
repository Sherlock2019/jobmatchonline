import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import path from 'path';

const app = express();
const PORT = 3000;

// Ports for the underlying services
const VITE_PORT = 5173;
const EXPO_PORT = 8081;

console.log('--- Starting JobMatch AI Dev Services ---');

// 1. Start Vite
const vite = spawn('npm', ['run', 'dev:web', '--', '--port', VITE_PORT.toString(), '--host', '0.0.0.0'], {
  shell: true,
  stdio: 'inherit'
});

// 2. Start Expo
const expo = spawn('npx', ['expo', 'start', '--port', EXPO_PORT.toString()], {
  shell: true,
  stdio: 'inherit',
  env: { 
    ...process.env, 
    EXPO_PACKAGER_PROXY_URL: `https://${process.env.HOST || 'localhost'}`,
    EXPO_NO_TELEMETRY: '1',
    CI: '1',
    NODE_ENV: 'development'
  }
});

// 3. Proxy Logic
const expoProxy = createProxyMiddleware({
  target: `http://localhost:${EXPO_PORT}`,
  changeOrigin: true,
  ws: true,
});

const viteProxy = createProxyMiddleware({
  target: `http://localhost:${VITE_PORT}`,
  changeOrigin: true,
  ws: true,
});

// We distinguish between Expo Go requests and Browser requests
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const isExpoGo = userAgent.includes('Expo') || userAgent.includes('Exponent') || req.headers['expo-platform'];
  
  // Specific paths that are definitely Metro/Expo
  const isExpoPath = 
    req.path.startsWith('/logs') || 
    req.path.startsWith('/inspector') || 
    req.path.endsWith('.bundle') || 
    req.path.endsWith('.map') ||
    req.path === '/status' ||
    req.path === '/symbolicate';

  if (isExpoGo || isExpoPath) {
    return expoProxy(req, res, next);
  }

  // Default to Vite for everything else
  return viteProxy(req, res, next);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Dev Server multiplexer running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Browser: http://localhost:${PORT}`);
  console.log(`👾 Expo Go: Points to this same port 3000\n`);
});

// Cleanup logic
process.on('SIGINT', () => {
  vite.kill();
  expo.kill();
  process.exit();
});
