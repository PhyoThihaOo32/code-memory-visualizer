import { motion, AnimatePresence } from 'framer-motion';
import type { HeapObject, Value } from '../../types';
import { ValueChip } from './ValueChip';

// ─── Arrow connector ─────────────────────────────────────────────────────────

function NodeArrow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      <svg width="40" height="14" viewBox="0 0 40 14" fill="none">
        <line x1="0" y1="7" x2="32" y2="7" stroke="#00E5FF" strokeWidth="1.5" />
        <path
          d="M27 3L35 7L27 11"
          stroke="#00E5FF"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

// ─── Null / nullptr terminator ───────────────────────────────────────────────

function NullCap() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 42,
        height: 42,
        border: '1px dashed rgba(161,161,166,0.3)',
        borderRadius: 7,
        fontSize: 11,
        fontFamily: '"JetBrains Mono", monospace',
        color: '#C7C7CC',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      ∅
    </motion.div>
  );
}

// ─── Individual node card ────────────────────────────────────────────────────

function LinkedNodeCard({
  obj,
  isHighlighted,
}: {
  obj: HeapObject & { kind: 'object' };
  isHighlighted: boolean;
}) {
  // Everything except the structural 'next' pointer goes in the data column
  const dataFields = Object.entries(obj.attrs).filter(([k]) => k !== 'next');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.86, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.86, y: -6 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      data-heap={obj.id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 9,
        overflow: 'hidden',
        flexShrink: 0,
        border: isHighlighted
          ? '0.5px solid rgba(0,229,255,0.55)'
          : '0.5px solid rgba(0,0,0,0.1)',
        background: isHighlighted
          ? 'rgba(255,255,255,0.98)'
          : 'rgba(255,255,255,0.95)',
        boxShadow: isHighlighted
          ? '0 0 20px rgba(0,229,255,0.22), 0 3px 12px rgba(0,0,0,0.07)'
          : '0 2px 8px rgba(0,0,0,0.06)',
        backdropFilter: 'blur(10px)',
        minWidth: 86,
      }}
    >
      {/* ── Header: heap id + type name ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          padding: '3px 8px',
          borderBottom: '0.5px solid rgba(0,0,0,0.06)',
          background: isHighlighted
            ? 'rgba(0,229,255,0.07)'
            : 'rgba(250,250,250,0.9)',
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: '#C7C7CC',
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          {obj.id}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: isHighlighted ? '#00B4CC' : '#A1A1A6',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {obj.type}
        </span>
      </div>

      {/* ── Body: data fields | next-port dot ── */}
      <div style={{ display: 'flex', minHeight: 40 }}>
        {/* Data fields */}
        <div
          style={{
            flex: 1,
            padding: '6px 9px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {dataFields.length === 0 ? (
            <span
              style={{
                fontSize: 10,
                color: '#C7C7CC',
                fontStyle: 'italic',
                alignSelf: 'center',
              }}
            >
              —
            </span>
          ) : (
            dataFields.map(([k, v]) => (
              <div
                key={k}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: '#A1A1A6',
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  {k}
                </span>
                <ValueChip value={v} small />
              </div>
            ))
          )}
        </div>

        {/* next-pointer port — the outgoing connection dot */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderLeft: '0.5px solid rgba(0,0,0,0.07)',
            padding: '0 8px',
            background: isHighlighted
              ? 'rgba(0,229,255,0.05)'
              : 'rgba(0,229,255,0.02)',
            flexShrink: 0,
          }}
        >
          <motion.div
            animate={{
              boxShadow: isHighlighted
                ? '0 0 8px rgba(0,229,255,0.8)'
                : '0 0 4px rgba(0,229,255,0.4)',
            }}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#00E5FF',
              opacity: isHighlighted ? 1 : 0.65,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Chain label ─────────────────────────────────────────────────────────────

function ChainLabel({ typeName, count }: { typeName: string; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#A1A1A6',
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        {typeName}
      </span>
      <div
        style={{
          height: '0.5px',
          flex: 1,
          background: 'rgba(0,0,0,0.06)',
        }}
      />
      <span
        style={{
          fontSize: 9,
          color: '#C7C7CC',
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        {count} node{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

interface Props {
  chain: string[];
  heap: Record<string, HeapObject>;
  highlight?: { type: 'read' | 'write'; target: string };
}

export function LinkedListView({ chain, heap, highlight }: Props) {
  const firstObj = heap[chain[0]];
  const typeName =
    firstObj?.kind === 'object' ? firstObj.type : 'Node';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <ChainLabel typeName={typeName} count={chain.length} />

      {/* Horizontal strip — scrolls if chain is wider than panel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          paddingBottom: 4,           // room for scrollbar
          paddingTop: 2,
        }}
      >
        <AnimatePresence initial={false}>
          {chain.map((id) => {
            const obj = heap[id];
            if (!obj || obj.kind !== 'object') return null;
            return (
              <motion.div
                key={id}
                style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <LinkedNodeCard
                  obj={obj}
                  isHighlighted={highlight?.target === id}
                />
                <NodeArrow />
              </motion.div>
            );
          })}
        </AnimatePresence>
        <NullCap />
      </div>
    </div>
  );
}

// ─── Chain detection utility ─────────────────────────────────────────────────
//
// A "linked chain" is a set of heap objects where each object (except the last)
// has a `next` attribute that is a {kind:'ref'} pointing to the next object.
// We identify heads as objects with a `next` field that are NOT themselves
// pointed to by any other object's `next` field.

export function detectLinkedChains(
  heap: Record<string, HeapObject>,
): string[][] {
  // Collect every ID that is pointed to by someone else's 'next' field
  const pointedTo = new Set<string>();
  for (const obj of Object.values(heap)) {
    if (obj.kind === 'object') {
      const nxt = obj.attrs['next'];
      if (nxt?.kind === 'ref') pointedTo.add(nxt.id);
    }
  }

  const visited = new Set<string>();
  const chains: string[][] = [];

  for (const obj of Object.values(heap)) {
    if (
      obj.kind === 'object' &&
      'next' in obj.attrs &&         // has a structural 'next' field
      !pointedTo.has(obj.id) &&      // not in the middle of a chain
      !visited.has(obj.id)
    ) {
      // Walk the chain from this head
      const chain: string[] = [];
      let cur: string | null = obj.id;
      while (cur && heap[cur] && !visited.has(cur)) {
        visited.add(cur);
        chain.push(cur);
        const node: HeapObject = heap[cur];
        if (node.kind === 'object') {
          const nxt: Value | undefined = node.attrs['next'];
          cur = nxt?.kind === 'ref' ? nxt.id : null;
        } else {
          cur = null;
        }
      }
      if (chain.length > 0) chains.push(chain);
    }
  }

  return chains;
}
