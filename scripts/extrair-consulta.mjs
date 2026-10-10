import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const fonte = process.argv[2] || 'COLE_NO_CLAUDE_CODE.md';
const txt = fs.readFileSync(fonte, 'utf8').replace(/\r\n/g, '\n');
const re = /<!-- ARQUIVO: (.+?) sha256=([0-9a-f]{64}) -->\n~~~~~[a-z]*\n([\s\S]*?)\n~~~~~\n<!-- FIM -->/g;
let n = 0, m;
while ((m = re.exec(txt))) {
  const [, destino, hash, corpo] = m;
  const conteudo = corpo + '\n';
  const h = crypto.createHash('sha256').update(conteudo, 'utf8').digest('hex');
  if (h !== hash) { console.error('ERRO: conteúdo corrompido em', destino); process.exit(1); }
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, conteudo, 'utf8');
  n++; console.log('ok', destino);
}
if (n !== 3) { console.error('ERRO: esperava 3 arquivos e encontrei', n); process.exit(1); }
JSON.parse(fs.readFileSync('docs/consulta-profundidade/consulta-profundidade.dados.json', 'utf8'));
console.log('Extração concluída e íntegra.');
