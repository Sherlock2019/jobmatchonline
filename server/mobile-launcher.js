import os from 'node:os';
import { spawn } from 'node:child_process';
import qrcode from 'qrcode-terminal';

function localAddress() {
  const candidates = Object.values(os.networkInterfaces()).flat().filter((entry) =>
    entry && entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.')
  );
  return candidates.find((entry) => entry.address.startsWith('192.168.'))?.address
    || candidates.find((entry) => entry.address.startsWith('10.'))?.address
    || candidates[0]?.address;
}

const address = process.env.MOBILE_HOST || localAddress();
if (!address) {
  console.error('\nCould not find a local network address. Connect this computer to Wi-Fi, then try again.\n');
  process.exit(1);
}

const webPort = Number(process.env.MOBILE_WEB_PORT || 4173);
const apiPort = Number(process.env.MOBILE_API_PORT || 4174);
const mobileUrl = `http://${address}:${webPort}`;
const api = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(apiPort), FORCE_COLOR: '1' },
  stdio: 'inherit',
});
const web = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', String(webPort), '--strictPort'], {
  cwd: process.cwd(),
  env: { ...process.env, API_PORT: String(apiPort), FORCE_COLOR: '1' },
  stdio: 'inherit',
});

async function waitUntilReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${webPort}`);
      if (response.ok) return true;
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

if (await waitUntilReady()) {
  console.log('\n\x1b[1;32mJobMatch is ready for your phone.\x1b[0m');
  console.log('1. Put your phone and computer on the same Wi-Fi.');
  console.log('2. Scan this QR code, or open:');
  console.log(`\x1b[1;36m${mobileUrl}\x1b[0m\n`);
  qrcode.generate(mobileUrl, { small: true }, (code) => console.log(code));
  console.log('Keep this window open while testing. Press Ctrl+C when finished.\n');
  if (process.env.WSL_DISTRO_NAME && !process.env.MOBILE_HOST) {
    console.log('\x1b[1;33mWSL note:\x1b[0m If your phone cannot reach this address, double-click launch-jobmatch-mobile.cmd from Windows Explorer. It safely opens the private-network route while the preview is running.\n');
  }
} else {
  console.error('\nThe launcher started, but the web preview did not become ready in 30 seconds.\n');
}

function stop() {
  if (!api.killed) api.kill('SIGTERM');
  if (!web.killed) web.kill('SIGTERM');
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
let exiting = false;
function childExited(code) {
  if (exiting) return;
  exiting = true;
  stop();
  process.exit(code ?? 0);
}
api.on('exit', childExited);
web.on('exit', childExited);
