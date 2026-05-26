import { useEffect } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { AnimatePresence, motion } from 'framer-motion';
import { TopBar } from './components/TopBar';
import { EditorPane } from './components/EditorPane';
import { VizPane } from './components/VizPane';
import { usePyodide } from './engine/usePyodide';
import { useStore } from './store';
import { EXAMPLES } from './examples';
import './index.css';

function PyodideLoader() {
  usePyodide();
  const { pyodideReady, pyodideError } = useStore();

  return (
    <AnimatePresence>
      {!pyodideReady && !pyodideError && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(20px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 14,
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            style={{
              width: 28, height: 28,
              border: '2px solid rgba(0,229,255,0.15)',
              borderTopColor: '#00E5FF',
              borderRadius: '50%',
              boxShadow: '0 0 12px rgba(0,229,255,0.3)',
            }}
          />
          <p style={{ fontSize: 14, color: '#86868B', margin: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
            Preparing your sandbox…
          </p>
          <p style={{ fontSize: 11, color: '#C7C7CC', margin: 0 }}>
            Loading Python via WebAssembly
          </p>
        </motion.div>
      )}
      {pyodideError && (
        <motion.div
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(255,255,255,0.97)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            background: 'rgba(255,184,0,0.06)',
            border: '0.5px solid rgba(255,184,0,0.3)',
            borderRadius: 12, padding: '24px 32px', maxWidth: 420, textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, color: '#86868B', margin: '0 0 10px', fontWeight: 500 }}>
              Could not load the Python sandbox
            </p>
            <p style={{ fontSize: 12, color: '#A1A1A6', margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
              {pyodideError}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  const { setCode, setSelectedExample } = useStore();

  useEffect(() => {
    const first = EXAMPLES[0];
    setSelectedExample(first.id);
    setCode(first.code);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#FFFFFF' }}>
      <PyodideLoader />
      <TopBar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <PanelGroup orientation="horizontal" style={{ flex: 1 }}>
          <Panel defaultSize={50} minSize={25}>
            <EditorPane />
          </Panel>

          <PanelResizeHandle
            style={{
              width: 1,
              background: 'rgba(0,0,0,0.07)',
              cursor: 'col-resize',
              flexShrink: 0,
              transition: 'background 0.2s, box-shadow 0.2s, width 0.15s',
            }}
          />

          <Panel defaultSize={50} minSize={25}>
            <VizPane />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
