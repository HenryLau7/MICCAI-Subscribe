import { decodeProgram, type MinBundle } from './decode';
import type { Program } from './types';

const DATA_URL = '/data/program.min.json';
const CACHE_NAME = 'miccai-program-v1';

/** 先用缓存立即渲染，同时后台校验新版本；会场 Wi-Fi 很差，这是刚需。 */
export async function loadProgram(): Promise<Program> {
  let cache: Cache | undefined;
  try { cache = await caches.open(CACHE_NAME); } catch { /* 隐私模式 / 不支持 */ }

  const cached = await cache?.match(DATA_URL).catch(() => undefined);
  if (cached) {
    const program = decodeProgram((await cached.json()) as MinBundle);
    void revalidate(cache);
    return program;
  }

  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`program fetch failed: ${res.status}`);
  try { await cache?.put(DATA_URL, res.clone()); } catch { /* 配额不足，忽略 */ }
  return decodeProgram((await res.json()) as MinBundle);
}

async function revalidate(cache?: Cache): Promise<void> {
  if (!cache) return;
  try {
    const fresh = await fetch(DATA_URL, { cache: 'no-cache' });
    if (fresh.ok) await cache.put(DATA_URL, fresh);
  } catch { /* 离线，保留缓存 */ }
}
