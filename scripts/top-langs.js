const https = require('https');

const QUERY = `query {
  viewer {
    repositories(first: 100, privacy: PUBLIC, isFork: false) {
      nodes {
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          nodes { name color }
        }
      }
    }
  }
}`;

function gql(token) {
  const body = JSON.stringify({ query: QUERY });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'User-Agent': 'profile-readme-top-langs',
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}: ${data}`)); return; }
        const json = JSON.parse(data);
        if (json.errors) { reject(new Error(JSON.stringify(json.errors))); return; }
        resolve(json);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const totals = {};
  const colors = {};
  const json = await gql(process.env.GITHUB_TOKEN);
  const repos = json.data.viewer.repositories.nodes;
  let repoCount = 0;
  for (const r of repos) {
    if (r.languages.nodes.length === 0) continue;
    repoCount++;
    for (const l of r.languages.nodes) {
      totals[l.name] = (totals[l.name] || 0) + 1;
      if (!colors[l.name]) colors[l.name] = (l.color || 'cccccc').replace(/^#/, '');
    }
  }

const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 8);

if (entries.length === 0) {
  console.error('No languages found');
  return;
}

const W = 620;
const rows = entries.length;
const barH = 22;
const gap = 10;
const topPad = 44;
const botPad = 18;
const leftPad = 110;
const barW = W - leftPad - 24;
const H = topPad + rows * (barH + gap) + botPad - gap;
const maxVal = entries[0][1];
const FF = 'ui-sans,system-ui,-apple-system,Segoe UI,Helvetica,Arial';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

const parts = [];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Top Languages"><rect width="100%" height="100%" rx="10" fill="#0d1117" stroke="#222" stroke-width="1"/><text x="540" y="26" font-family="${FF}" font-size="13" font-weight="600" fill="#fff" text-anchor="end">Top Languages</text>`);

entries.forEach(([name, count], i) => {
  const y = topPad + i * (barH + gap);
  const w = Math.round((count / maxVal) * barW);
  const col = colors[name] || '8b949e';
  parts.push(`<rect x="${leftPad}" y="${y}" width="${w}" height="${barH}" rx="4" fill="#${col}"/>`);
  parts.push(`<text x="12" y="${y + 15}" font-family="${FF}" font-size="12" fill="#c9d1d9">${esc(name)}</text>`);
  parts.push(`<text x="${W - 12}" y="${y + 15}" font-family="${FF}" font-size="12" fill="#8b949e" text-anchor="end">${count}</text>`);
});

parts.push(`<text x="12" y="${H - 6}" font-family="${FF}" font-size="11" fill="#6e7681">${repoCount} public repos • ${entries.length} languages shown</text>`);
parts.push('</svg>');

require('fs').writeFileSync(process.argv[2], parts.join(''), 'utf8');
console.error('Wrote', process.argv[2]);
})();
