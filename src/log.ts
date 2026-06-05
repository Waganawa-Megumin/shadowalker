// 軽量診断ログ: console 出力＋直近をメモリ保持。失敗時に「診断ログをコピー」で取り出せる。
type Entry = { t: string; scope: string; msg: string; detail?: string };

const buf: Entry[] = [];
const MAX = 60;

function push(e: Entry): void { buf.push(e); if (buf.length > MAX) buf.shift(); }
const now = () => new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm

export function logError(scope: string, err: unknown, extra?: Record<string, unknown>): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const detail = [e.stack, extra ? JSON.stringify(extra) : ''].filter(Boolean).join(' | ');
  push({ t: now(), scope, msg: 'ERROR ' + e.message, detail });
  console.error(`[影みち:${scope}]`, e, extra ?? '');
}

export function logWarn(scope: string, err: unknown): void {
  const m = err instanceof Error ? err.message : String(err);
  push({ t: now(), scope, msg: 'WARN ' + m });
  console.warn(`[影みち:${scope}] ${m}`);
}

export function logInfo(scope: string, msg: string): void {
  push({ t: now(), scope, msg });
}

// 共有用テキスト（端末情報＋直近ログ）
export function getDiagnostics(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const head = `影みち 診断ログ ${new Date().toISOString()}\nUA: ${ua}\nURL: ${typeof location !== 'undefined' ? location.href : ''}\n----`;
  const lines = buf.map(e => `${e.t} [${e.scope}] ${e.msg}${e.detail ? '\n    ' + e.detail : ''}`);
  return [head, ...lines, '(ログは直近のみ保持)'].join('\n');
}
