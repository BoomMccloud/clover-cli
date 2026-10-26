import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { requestSessionId, resumeHint, showResumeHint } from '../src/session.mjs';
import { paths, saveKey } from '../src/config.mjs';
import { startAdapter } from '../src/adapter.mjs';

const ID = '01a17778-9874-7211-845e-48815d78590f';

test('session identity comes from validated root request metadata', () => {
  assert.equal(requestSessionId({ client_metadata: { session_id: ID } }), ID);
  assert.equal(requestSessionId({ client_metadata: { 'x-codex-turn-metadata': JSON.stringify({ agent_name: '/root', thread_id: ID }) } }), ID);
  assert.equal(requestSessionId({ client_metadata: { session_id: ID, 'x-codex-turn-metadata': JSON.stringify({ agent_name: '/root/child' }) } }), null);
  assert.equal(requestSessionId({ client_metadata: { session_id: 'bad; arbitrary command' } }), null);
  assert.equal(requestSessionId({ prompt_cache_key: ID }), null);
});

test('resume hint is safe and omitted for exec, help and ephemeral launches', () => {
  assert.match(resumeHint(ID), new RegExp(`diffuspace clover -- resume ${ID}`));
  assert.ok(!resumeHint('bad; command').includes('bad; command'));
  assert.equal(showResumeHint([]), true); assert.equal(showResumeHint(['resume', ID]), true);
  for (const args of [['exec', '--json'], ['e'], ['--help'], ['--version'], ['--ephemeral']]) assert.equal(showResumeHint(args), false);
});

test('adapter reports session ID even when the request format is rejected locally', async t => {
  let observed = null;
  const adapter = await startAdapter({ apiKey: 'test-key', onSessionId: id => { observed = id; }, fetchImpl: async () => { throw new Error('No upstream request expected'); } });
  t.after(() => adapter.close());
  const response = await fetch(adapter.baseURL + '/responses', { method: 'POST', headers: { authorization: `Bearer ${adapter.token}` }, body: JSON.stringify({ client_metadata: { session_id: ID }, text: { format: { type: 'json_schema' } } }) });
  assert.equal(response.status, 400); await response.text(); assert.equal(observed, ID);
});

test('interactive launcher prints correct Clover command after native Codex exit text', async t => {
  const root = await mkdtemp(join(tmpdir(), 'clover-resume-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const p = paths({ DIFFUSPACE_HOME: join(root, 'state'), CODEX_HOME: join(root, 'codex') });
  await saveKey(p, 'saved-unit-key');
  const bin = join(root, 'bin'); await mkdir(bin);
  await writeFile(join(bin, 'package.json'), '{"type":"module"}');
  const executable = join(bin, 'codex');
  await writeFile(executable, `#!${process.execPath}
if (process.argv.includes('--version')) console.log('codex-cli 0.164.0');
else {
  const arg = process.argv.find(value => value.startsWith('model_providers.diffuspace.base_url='));
  const url = JSON.parse(arg.slice(arg.indexOf('=') + 1));
  const response = await fetch(url + '/responses', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.DIFFUSPACE_ADAPTER_TOKEN }, body: JSON.stringify({ client_metadata: { session_id: '${ID}' }, text: { format: { type: 'json_schema' } } }) });
  await response.text();
  console.error('To continue this session, run: codex resume ${ID}');
}
`);
  await chmod(executable, 0o755);
  const env = { ...process.env, CODEX_HOME: p.codexHome, DIFFUSPACE_HOME: p.dataHome, PATH: `${bin}:${process.env.PATH}` };
  delete env.DIFFUSPACE_API_KEY;
  const child = spawn(process.execPath, [fileURLToPath(new URL('../bin/diffuspace.mjs', import.meta.url)), 'clover'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stderr.on('data', chunk => { output += chunk; }); child.stdout.resume();
  const exit = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  assert.equal(exit, 0, output);
  const native = output.indexOf('codex resume ' + ID); const corrected = output.indexOf('diffuspace clover -- resume ' + ID);
  assert.ok(native >= 0 && corrected > native, output);
  assert.ok(output.endsWith(`diffuspace clover -- resume ${ID}\n`));
});
