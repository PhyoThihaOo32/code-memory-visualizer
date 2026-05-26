import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { Snapshot } from '../types';

declare global {
  interface Window {
    loadPyodide: (opts: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: { get: (key: string) => unknown };
}

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/';

let pyodideInstance: PyodideInterface | null = null;
let loadPromise: Promise<PyodideInterface> | null = null;

async function getPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    await new Promise<void>((resolve, reject) => {
      if (document.querySelector('script[data-pyodide]')) { resolve(); return; }
      const s = document.createElement('script');
      s.src = `${PYODIDE_CDN}pyodide.js`;
      s.dataset.pyodide = 'true';
      s.onload = () => resolve();
      s.onerror = (e) => { console.error('[memviz] Pyodide script load error', e); reject(e); };
      document.head.appendChild(s);
    });
    console.log('[memviz] Pyodide script loaded, calling loadPyodide…');
    const py = await window.loadPyodide({ indexURL: PYODIDE_CDN });
    console.log('[memviz] Pyodide instance ready');
    pyodideInstance = py;
    return py;
  })();

  return loadPromise;
}

export function usePyodide() {
  const { setPyodideReady, setPyodideError } = useStore();
  const initStarted = useRef(false);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    getPyodide()
      .then(() => setPyodideReady(true))
      .catch((e) => {
        console.error('[memviz] Pyodide load failed:', e);
        setPyodideError(String(e));
      });
  }, [setPyodideReady, setPyodideError]);
}

async function runTracer(tracerFile: string, runFn: string, code: string): Promise<Snapshot[]> {
  console.log(`[memviz] executeCode(${tracerFile}) called`);
  const py = await getPyodide();

  const tracerRes = await fetch(`/${tracerFile}`);
  if (!tracerRes.ok) throw new Error(`${tracerFile} fetch failed: ${tracerRes.status}`);
  const tracerCode = await tracerRes.text();
  console.log(`[memviz] ${tracerFile} fetched`);

  try {
    await py.runPythonAsync(tracerCode);
    await py.runPythonAsync(`_user_code = ${JSON.stringify(code)}`);
    await py.runPythonAsync(`_result_json = ${runFn}(_user_code)`);
    console.log('[memviz] tracing complete');
  } catch (pyErr) {
    console.error('[memviz] Python execution error:', pyErr);
    throw pyErr;
  }

  const raw = py.globals.get('_result_json') as string;
  const snapshots: Snapshot[] = JSON.parse(raw);
  console.log('[memviz] snapshots:', snapshots.length);
  return snapshots;
}

export async function executeCode(code: string): Promise<Snapshot[]> {
  return runTracer('tracer.py', 'run_and_trace', code);
}

export async function executeCpp(code: string): Promise<Snapshot[]> {
  return runTracer('cpp_tracer.py', 'run_cpp', code);
}

export async function executeJava(code: string): Promise<Snapshot[]> {
  return runTracer('java_tracer.py', 'run_java', code);
}
