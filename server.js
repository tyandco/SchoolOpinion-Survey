const { createServer } = require('node:http');
const { URLSearchParams } = require('node:url');
const { readFile } = require('node:fs/promises');
const { appendFile, access } = require('node:fs/promises');
const { resolve } = require('node:path');
const os = require('node:os');

const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

const formPath = resolve(__dirname, 'public', 'index.html');
const csvPath = resolve(__dirname, 'submissions.csv');

const getLanIp = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
};

const escapeCsv = (value) => {
  const str = String(value ?? '');
  const needsQuotes = /[",\n]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const appendSubmission = async (submission) => {
  const header = 'role,sentiment,reason,reasonOther,talk\n';
  const row = `${escapeCsv(submission.role)},${escapeCsv(submission.sentiment)},${escapeCsv(submission.reason)},${escapeCsv(submission.reasonOther)},${escapeCsv(submission.talk)}\n`;

  try {
    await access(csvPath);
    await appendFile(csvPath, row);
  } catch {
    await appendFile(csvPath, header + row);
  }
};

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    readFile(formPath, 'utf8')
      .then((html) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      })
      .catch(() => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Could not load form.');
      });
    return;
  }

  if (req.method === 'POST' && req.url === '/submit') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const parsed = new URLSearchParams(body);
      const role = parsed.get('role') || '';
      const sentiment = parsed.get('sentiment') || '';
      const reason = parsed.get('reason') || '';
      const reasonOther = parsed.get('reasonOther') || '';
      const talk = parsed.get('talk') || '';

      appendSubmission({ role, sentiment, reason, reasonOther, talk }).catch(() => {
        // Best-effort logging; user still gets a response.
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Thanks!</title>
  <style>
      body { font-family: "Georgia", "Times New Roman", serif; margin: 2rem; background: #f5f2ea; color: #1f1b16; }
      main { max-width: 560px; background: #fff; padding: 1.5rem; padding-right: 2rem; border: 2px solid #1f1b16; }
      label { display: block; margin-top: 1rem; font-weight: 600; }
      input, textarea { width: 100%; padding: 0.6rem; border: 1px solid #1f1b16; font-size: 1rem; }
      button { margin-top: 1rem; padding: 0.6rem 1rem; border: 2px solid #1f1b16; background: #1f1b16; color: #fff; cursor: pointer; }
    </style>
    </head>
  <body>
    <h1>Thanks for your submission!</h1>
    <p><strong>Staff will be in touch with you soon.</strong></p>
    <p><a href="/">Back to form</a></p>
  </body>
</html>`);
    });
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Not Found');
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://127.0.0.1:${port}/`);
  const lanIp = getLanIp();
  if (lanIp) {
    console.log(`LAN URL: http://${lanIp}:${port}/`);
  } else {
    console.log('Use your machine LAN IP to access from the same Wi-Fi.');
  }
});
