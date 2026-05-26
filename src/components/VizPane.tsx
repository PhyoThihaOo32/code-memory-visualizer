import { useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { StackView } from './viz/StackView';
import { HeapView } from './viz/HeapView';
import { GlobalsView } from './viz/GlobalsView';
import { LinkedListView, detectLinkedChains } from './viz/LinkedListView';
import { VectorView, detectVectors } from './viz/VectorView';
import { PointerArrows } from './viz/PointerArrows';

const EVENT_COLORS: Record<string, string> = {
  call: '#00E5FF',
  return: '#39FF94',
  line: '#86868B',
  exception: '#FFB800',
};

const REGION_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#C7C7CC',
  marginBottom: 10,
  paddingLeft: 2,
};

export function VizPane() {
  const { snapshots, stepIndex, playState } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const { error } = useStore();
  const snap = snapshots[stepIndex] ?? null;
  const isEmpty = snapshots.length === 0 && playState === 'idle' && !error;
  const isLoading = playState === 'running' && snapshots.length === 0;

  const hasGlobals = snap && Object.keys(snap.globals).length > 0;
  const hasHeap = snap && Object.keys(snap.heap).length > 0;

  // Detect linked-list chains so we can render them full-width
  const linkedChains = useMemo(
    () => (snap ? detectLinkedChains(snap.heap) : []),
    [snap],
  );
  const chainedIds = useMemo(
    () => new Set(linkedChains.flat()),
    [linkedChains],
  );
  const hasLinkedChains = linkedChains.length > 0;

  // Detect arrays/vectors so we can render them with VectorView
  const vectorIds = useMemo(
    () => (snap ? new Set(detectVectors(snap.heap)) : new Set<string>()),
    [snap],
  );
  const hasVectors = vectorIds.size > 0;

  // Remaining heap: not a chain node and not a vector
  const specialIds = useMemo(
    () => new Set([...chainedIds, ...vectorIds]),
    [chainedIds, vectorIds],
  );
  const hasRemainingHeap =
    hasHeap && Object.keys(snap!.heap).some((id) => !specialIds.has(id));

  const eventColor = snap ? EVENT_COLORS[snap.event] ?? '#86868B' : '#86868B';

  return (
    <div
      ref={containerRef}
      className="dot-grid"
      style={{
        height: '100%',
        overflow: 'auto',
        position: 'relative',
        background: '#FAFAFA',
      }}
    >
      {/* Empty state */}
      <AnimatePresence>
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 12, pointerEvents: 'none',
            }}
          >
            {/* Faint illustration */}
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" opacity={0.25}>
              <rect x="4" y="4" width="24" height="56" rx="4" stroke="#1D1D1F" strokeWidth="1.5" />
              <rect x="8" y="10" width="16" height="3" rx="1.5" fill="#1D1D1F" />
              <rect x="8" y="17" width="12" height="3" rx="1.5" fill="#1D1D1F" />
              <rect x="8" y="24" width="14" height="3" rx="1.5" fill="#1D1D1F" />
              <rect x="36" y="16" width="24" height="32" rx="4" stroke="#1D1D1F" strokeWidth="1.5" />
              <rect x="41" y="22" width="14" height="3" rx="1.5" fill="#1D1D1F" />
              <rect x="41" y="29" width="10" height="3" rx="1.5" fill="#1D1D1F" />
              <path d="M28 32 L36 32" stroke="#1D1D1F" strokeWidth="1.5" strokeDasharray="2 2" />
            </svg>
            <p style={{ fontSize: 13, color: '#A1A1A6', margin: 0, fontWeight: 400 }}>
              Write code, then press <strong style={{ color: '#86868B', fontWeight: 600 }}>Run</strong>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      <AnimatePresence>
        {error && !snap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
          >
            <div style={{
              background: 'rgba(255,184,0,0.06)',
              border: '0.5px solid rgba(255,184,0,0.35)',
              borderRadius: 10, padding: '16px 20px',
              maxWidth: 480,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#FFB800', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Execution error
              </div>
              <pre style={{ margin: 0, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#86868B', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {error}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 12,
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 24, height: 24,
                border: '2px solid rgba(0,229,255,0.15)',
                borderTopColor: '#00E5FF',
                borderRadius: '50%',
              }}
            />
            <span style={{ fontSize: 13, color: '#86868B' }}>Tracing execution…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      {snap && (
        <div style={{ padding: 20, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
          <PointerArrows frames={snap.stack} containerRef={containerRef} />

          {/* Event badge + step info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div
              key={snap.event + stepIndex}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                fontSize: 10, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: eventColor,
                background: `${eventColor}14`,
                border: `0.5px solid ${eventColor}40`,
                borderRadius: 6,
                padding: '2px 8px',
                boxShadow: `0 0 8px ${eventColor}20`,
              }}
            >
              {snap.event}
            </motion.div>
            <span style={{ fontSize: 11, color: '#A1A1A6' }}>
              line <strong style={{ color: '#86868B', fontVariantNumeric: 'tabular-nums' }}>{snap.line}</strong>
            </span>
            <div style={{ flex: 1 }} />
            <span style={{
              fontSize: 10, color: '#C7C7CC',
              fontVariantNumeric: 'tabular-nums',
            }}>
              step {stepIndex + 1} / {snapshots.length}
            </span>
          </div>

          {/* Globals region — GlobalsView has its own internal card header */}
          {hasGlobals && (
            <GlobalsView globals={snap.globals} highlight={snap.highlight} />
          )}

          {/* ── Vector / array band — full width ── */}
          {hasVectors && (
            <div>
              <div style={REGION_LABEL}>Array</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...vectorIds].map((id) => {
                  const obj = snap.heap[id];
                  if (!obj || obj.kind !== 'list') return null;
                  return (
                    <VectorView
                      key={id}
                      arrayObj={obj}
                      highlight={snap.highlight}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Linked list chains — full width ── */}
          {hasLinkedChains && (
            <div>
              <div style={REGION_LABEL}>Linked List</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {linkedChains.map((chain) => (
                  <LinkedListView
                    key={chain[0]}
                    chain={chain}
                    heap={snap.heap}
                    highlight={snap.highlight}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Stack + remaining heap side by side ── */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1 }}>

            {/* Stack */}
            <div style={{ flex: '0 0 auto', minWidth: 220, maxWidth: 320, width: '48%' }}>
              <div style={REGION_LABEL}>Call Stack</div>
              {snap.stack.length === 0
                ? <span style={{ fontSize: 12, color: '#C7C7CC', fontStyle: 'italic' }}>empty</span>
                : <StackView frames={snap.stack} highlight={snap.highlight} />
              }
            </div>

            {/* Non-chain, non-vector heap objects */}
            {hasRemainingHeap && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={REGION_LABEL}>Heap</div>
                <HeapView
                  heap={snap.heap}
                  highlight={snap.highlight}
                  excludeIds={specialIds}
                />
              </div>
            )}
          </div>

          {/* Stdout */}
          {snap.stdout && snap.stdout.trim() && (
            <div style={{
              background: 'rgba(255,255,255,0.85)',
              border: '0.5px solid rgba(0,0,0,0.07)',
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '5px 12px',
                borderBottom: '0.5px solid rgba(0,0,0,0.06)',
                background: 'rgba(250,250,250,0.9)',
                fontSize: 10, fontWeight: 600,
                color: '#A1A1A6', textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                stdout
              </div>
              <pre style={{
                margin: 0,
                padding: '10px 12px',
                fontSize: 12,
                fontFamily: '"JetBrains Mono", monospace',
                color: '#1D1D1F',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {snap.stdout}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
