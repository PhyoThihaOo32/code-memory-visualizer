import { motion, AnimatePresence } from 'framer-motion';
import type { HeapObject, Value } from '../../types';
import { ValueChip } from './ValueChip';

// ─── Individual cell ──────────────────────────────────────────────────────────

function VectorCell({
  value,
  index,
  isActive,
  activeType,
}: {
  value: Value;
  index: number;
  isActive: boolean;
  activeType?: 'read' | 'write';
}) {
  const accentColor =
    activeType === 'write' ? '#FF2D92' : activeType === 'read' ? '#00E5FF' : '#00E5FF';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <motion.div
        layout
        animate={{
          background: isActive
            ? activeType === 'write'
              ? 'rgba(255,45,146,0.10)'
              : 'rgba(0,229,255,0.10)'
            : 'rgba(255,255,255,0.92)',
          borderColor: isActive ? accentColor : 'rgba(0,0,0,0.08)',
          boxShadow: isActive
            ? `0 0 10px ${accentColor}40`
            : '0 1px 4px rgba(0,0,0,0.05)',
        }}
        transition={{ duration: 0.2 }}
        style={{
          width: 46,
          padding: '5px 4px',
          border: '0.5px solid rgba(0,0,0,0.08)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 32,
        }}
      >
        <ValueChip value={value} small />
      </motion.div>
      <span
        style={{
          fontSize: 9,
          color: isActive ? accentColor : '#C7C7CC',
          marginTop: 3,
          fontFamily: '"JetBrains Mono", monospace',
          fontWeight: isActive ? 600 : 400,
          transition: 'color 0.2s',
        }}
      >
        [{index}]
      </span>
    </div>
  );
}

// ─── Separator between cells ──────────────────────────────────────────────────

function CellSep() {
  return (
    <div
      style={{
        width: 1,
        height: 32,
        background: 'rgba(0,0,0,0.06)',
        flexShrink: 0,
        alignSelf: 'center',
        marginBottom: 15, // offset to align with cells, not index labels
      }}
    />
  );
}

// ─── Size indicator (logical vs physical length) ──────────────────────────────

function SizeMarker({ size, total }: { size: number; total: number }) {
  if (size >= total) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
        marginLeft: 6,
      }}
    >
      <div
        style={{
          width: 2,
          height: 32,
          background: 'rgba(57,255,148,0.5)',
          borderRadius: 1,
        }}
      />
      <span
        style={{
          fontSize: 9,
          color: '#39FF94',
          marginTop: 3,
          fontFamily: '"JetBrains Mono", monospace',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        size
      </span>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  arrayObj: HeapObject & { kind: 'list' };
  highlight?: { type: 'read' | 'write'; target: string };
  /** Optional logical size (drawn as a marker) */
  logicalSize?: number;
}

export function VectorView({ arrayObj, highlight, logicalSize }: Props) {
  const isHighlighted = highlight?.target === arrayObj.id;
  const items = arrayObj.items;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      style={{
        background: isHighlighted ? 'rgba(0,229,255,0.04)' : 'rgba(255,255,255,0.92)',
        border: isHighlighted
          ? '0.5px solid rgba(0,229,255,0.45)'
          : '0.5px solid rgba(0,0,0,0.07)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: isHighlighted
          ? '0 0 18px rgba(0,229,255,0.18), 0 3px 12px rgba(0,0,0,0.05)'
          : '0 2px 10px rgba(0,0,0,0.05)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          borderBottom: '0.5px solid rgba(0,0,0,0.06)',
          background: isHighlighted ? 'rgba(0,229,255,0.06)' : 'rgba(250,250,250,0.8)',
        }}
      >
        <span style={{ fontSize: 9, color: '#A1A1A6', fontFamily: '"JetBrains Mono", monospace' }}>
          {arrayObj.id}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: isHighlighted ? '#00B4CC' : '#86868B',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginLeft: 'auto',
          }}
        >
          array
        </span>
        <span style={{ fontSize: 10, color: '#C7C7CC', fontFamily: '"JetBrains Mono", monospace' }}>
          [{items.length}]
        </span>
      </div>

      {/* Cells */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0,
          padding: '10px 12px 8px',
          overflowX: 'auto',
        }}
      >
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={i}
              layout
              style={{ display: 'flex', alignItems: 'flex-start' }}
            >
              {i > 0 && <CellSep />}
              <VectorCell
                value={item}
                index={i}
                isActive={isHighlighted && i === (logicalSize ?? -1) - 1}
                activeType={highlight?.type}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Logical size marker */}
        {logicalSize !== undefined && logicalSize < items.length && (
          <SizeMarker size={logicalSize} total={items.length} />
        )}
      </div>
    </motion.div>
  );
}

// ─── Detection utility ────────────────────────────────────────────────────────
//
// Identifies heap arrays that look like vectors — plain arrays with ≥ 2 elements.
// Returns their IDs so VizPane can render them with VectorView instead of HeapView.

export function detectVectors(heap: Record<string, HeapObject>): string[] {
  return Object.values(heap)
    .filter((obj): obj is HeapObject & { kind: 'list' } => obj.kind === 'list' && obj.items.length >= 2)
    .map((obj) => obj.id);
}
