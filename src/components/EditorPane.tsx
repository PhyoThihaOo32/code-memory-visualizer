import { useEffect, useRef, useCallback } from 'react';
import MonacoEditor from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useStore } from '../store';
import { PlayControls } from './PlayControls';
import { EXAMPLES } from '../examples';
import { executeCode, executeCpp, executeJava } from '../engine/usePyodide';
import { LANG_CONFIG } from './TopBar';

const MONACO_LANG: Record<string, string> = {
  python: 'python',
  cpp: 'cpp',
  java: 'java',
};

export function EditorPane() {
  const { code, setCode, pyodideReady, setSnapshots, setPlayState, setError, reset,
          selectedExample, snapshots, language } = useStore();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const themeApplied = useRef(false);

  // Load initial example on first mount
  useEffect(() => {
    const ex = EXAMPLES.find((e) => e.id === selectedExample);
    if (ex && !code) setCode(ex.code);
  }, []);

  // Highlight executing line
  const { stepIndex } = useStore();
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !snapshots.length) return;
    const snap = snapshots[stepIndex];
    if (!snap || snap.line <= 0) return;
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: new monaco.Range(snap.line, 1, snap.line, 9999),
        options: {
          isWholeLine: true,
          className: 'current-exec-line',
          overviewRuler: { color: '#FF2D92', position: 1 },
          minimap: { color: '#FF2D92', position: 1 },
        },
      },
    ]);
    editor.revealLineInCenterIfOutsideViewport(snap.line);
  }, [stepIndex, snapshots]);

  const handleRun = useCallback(async () => {
    if (!pyodideReady) return;
    reset();
    setPlayState('running');
    setError(null);
    try {
      let snaps;
      if (language === 'cpp')       snaps = await executeCpp(code);
      else if (language === 'java') snaps = await executeJava(code);
      else                          snaps = await executeCode(code);
      setSnapshots(snaps);
      setPlayState('paused');
    } catch (e) {
      setError(String(e));
      setPlayState('idle');
    }
  }, [code, pyodideReady, language, reset, setSnapshots, setPlayState, setError]);

  function handleMount(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (!themeApplied.current) {
      themeApplied.current = true;
      const style = document.createElement('style');
      style.textContent = `.current-exec-line { background: rgba(255,45,146,0.07) !important; border-left: 2px solid #FF2D92 !important; }`;
      document.head.appendChild(style);

      monaco.editor.defineTheme('memviz-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'keyword',    foreground: '6E6E73' },
          { token: 'keyword.type', foreground: '0051A8' },
          { token: 'string',     foreground: '1C7A3E' },
          { token: 'number',     foreground: '0051A8' },
          { token: 'comment',    foreground: 'A1A1A6', fontStyle: 'italic' },
          { token: 'identifier', foreground: '1D1D1F' },
          { token: 'type',       foreground: '3A3AFF' },
          { token: 'delimiter',  foreground: '86868B' },
        ],
        colors: {
          'editor.background':                '#FAFAFA',
          'editor.foreground':                '#1D1D1F',
          'editorLineNumber.foreground':      '#C7C7CC',
          'editorLineNumber.activeForeground':'#86868B',
          'editor.selectionBackground':       '#E8F0FE',
          'editorCursor.foreground':          '#1D1D1F',
          'editor.lineHighlightBackground':   '#F5F5F7',
          'editorIndentGuide.background1':    '#F0F0F0',
        },
      });
      monaco.editor.setTheme('memviz-light');
    }
  }

  const langCfg = LANG_CONFIG[language];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', background: '#FAFAFA' }}>
      {/* Language hint bar */}
      <div style={{
        height: 28, display: 'flex', alignItems: 'center', paddingInline: 14, gap: 8,
        borderBottom: '0.5px solid rgba(0,0,0,0.05)',
        background: langCfg.bg,
        flexShrink: 0,
      }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: langCfg.color, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: langCfg.color, letterSpacing: '0.04em' }}>
          {EXAMPLES.find(e => e.id === selectedExample)?.hint ?? ''}
        </span>
      </div>

      <MonacoEditor
        height="100%"
        language={MONACO_LANG[language] ?? 'plaintext'}
        value={code}
        onChange={(v) => setCode(v ?? '')}
        onMount={handleMount}
        options={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: 13,
          lineHeight: 20,
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: 'none',
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
          padding: { top: 12, bottom: 80 },
          glyphMargin: false,
          folding: false,
          lineDecorationsWidth: 8,
          contextmenu: false,
        }}
      />
      <PlayControls onRun={handleRun} />
    </div>
  );
}
