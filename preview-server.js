const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 10010;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
  
  if (req.url.includes('?')) {
    filePath = filePath.split('?')[0];
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        fs.readFile(path.join(DIST_DIR, 'index.html'), (err, indexContent) => {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(indexContent, 'utf-8');
        });
      } else {
          res.writeHead(500);
          res.end('Server Error: ' + error.code);
        }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const ip = getLocalIP();

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 知识卡片小程序预览服务已启动');
  console.log('='.repeat(60));
  console.log('');
  console.log('📱 本地访问:');
  console.log(`   http://localhost:${PORT}`);
  console.log('');
  console.log('🌐 局域网访问:');
  console.log(`   http://${ip}:${PORT}`);
  console.log('');
  console.log('📱 手机扫描二维码或在浏览器中打开以上链接即可预览');
  console.log('');
  console.log('='.repeat(60));
  console.log('');
  console.log('💡 提示: 确保手机与电脑在同一WiFi网络下');
  console.log('');
});
