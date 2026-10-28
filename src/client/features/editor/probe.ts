/** 编辑器 feature 的诊断信息，挂到内核的 __dsv.probe() 上。 */

import { BASE } from '../../kernel/transport'
import { monacoDiag, MONACO_CSS_URL, MONACO_JS_URL, reachable } from './monaco/loader'

export async function monacoProbe(): Promise<Record<string, unknown>> {
  return {
    diag: monacoDiag(),
    assets: {
      js: await reachable(MONACO_JS_URL),
      css: await reachable(MONACO_CSS_URL),
      worker: await reachable(`${BASE}/monaco/esm/workers/editor.worker.js`)
    }
  }
}
