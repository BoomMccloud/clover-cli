const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validSessionId(value) {
  return typeof value === 'string' && UUID.test(value) ? value : null;
}
export function requestSessionId(body) {
  const metadata = body?.client_metadata || {};
  let turn = {};
  try { turn = JSON.parse(metadata['x-codex-turn-metadata'] || '{}'); } catch { /* Optional metadata. */ }
  if (turn.agent_name && turn.agent_name !== '/root') return null;
  return validSessionId(metadata.session_id) || validSessionId(metadata.thread_id)
    || validSessionId(turn.session_id) || validSessionId(turn.thread_id);
}
export function resumeHint(sessionId) {
  const id = validSessionId(sessionId);
  return id
    ? `\nTo continue this Clover session, run:\n  diffuspace clover -- resume ${id}\n`
    : '\nTo resume a Clover session, run:\n  diffuspace clover -- resume\n';
}
export function showResumeHint(args) {
  if (args.some(arg => ['--help', '-h', '--version', '-V', '--ephemeral'].includes(arg))) return false;
  return !['exec', 'e', 'review', 'login', 'logout', 'mcp', 'plugin', 'doctor', 'features', 'debug', 'app-server'].includes(args[0]);
}
