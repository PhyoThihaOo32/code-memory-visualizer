import { motion, AnimatePresence } from 'framer-motion';
import type { HeapObject, Value } from '../../types';
import { ValueChip } from './ValueChip';

interface Props {
  heap: Record<string, HeapObject>;
  highlight?: { type: 'read' | 'write'; target: string };
  /** IDs already rendered by LinkedListView — skip them here */
  excludeIds?: Set<string>;
}

function ListCell({ value, index, isActive }: { value: Value; index: number; isActive: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minWidth: 36,
    }}>
      <motion.div
        animate={{
          background: isActive ? 'rgba(0,229,255,0.12)' : 'rgba(250,250,250,0.8)',
          borderTopColor: isActive ? '#00E5FF' : 'rgba(0,0,0,0.06)',
          boxShadow: isActive ? '0 0 8px rgba(0,229,255,0.3)' : 'none',
        }}
        style={{
          padding: '4px 8px',
          border: '0.5px solid rgba(0,0,0,0.06)',
          borderTopWidth: 2,
          borderTopStyle: 'solid',
          borderRadius: 4,
          minWidth: 36, textAlign: 'center',
        }}
      >
        <ValueChip value={value} small />
      </motion.div>
      <span style={{ fontSize: 9, color: '#C7C7CC', marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
        {index}
      </span>
    </div>
  );
}

function HeapCard({ obj, highlight }: { obj: HeapObject; highlight?: { type: 'read' | 'write'; target: string } }) {
  const isHighlighted = highlight?.target === obj.id;

  return (
    <motion.div
      layout
      data-heap={obj.id}
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -4 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      style={{
        background: 'rgba(255,255,255,0.92)',
        border: isHighlighted
          ? `0.5px solid rgba(0,229,255,0.5)`
          : '0.5px solid rgba(0,0,0,0.07)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: isHighlighted
          ? '0 0 20px rgba(0,229,255,0.2), 0 4px 16px rgba(0,0,0,0.06)'
          : '0 2px 12px rgba(0,0,0,0.05)',
        backdropFilter: 'blur(8px)',
        maxWidth: 280,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px',
        borderBottom: '0.5px solid rgba(0,0,0,0.06)',
        background: isHighlighted ? 'rgba(0,229,255,0.06)' : 'rgba(250,250,250,0.8)',
      }}>
        <span style={{
          fontSize: 9,
          fontFamily: '"JetBrains Mono", monospace',
          color: '#A1A1A6',
          letterSpacing: '0.04em',
        }}>
          {obj.id}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: isHighlighted ? '#00B4CC' : '#86868B',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          marginLeft: 'auto',
        }}>
          {obj.kind === 'list' ? 'list' : obj.kind === 'dict' ? 'dict' : obj.type}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 10px' }}>
        {obj.kind === 'list' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {obj.items.length === 0
              ? <span style={{ fontSize: 11, color: '#C7C7CC', fontStyle: 'italic' }}>empty</span>
              : obj.items.slice(0, 20).map((item, i) => (
                <ListCell key={i} value={item} index={i} isActive={false} />
              ))}
            {obj.items.length > 20 && (
              <span style={{ fontSize: 10, color: '#A1A1A6', alignSelf: 'center' }}>+{obj.items.length - 20} more</span>
            )}
          </div>
        )}

        {obj.kind === 'dict' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {obj.entries.slice(0, 10).map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#1C7A3E', fontFamily: '"JetBrains Mono", monospace' }}>
                  "{entry.key}"
                </span>
                <span style={{ fontSize: 10, color: '#C7C7CC' }}>→</span>
                <ValueChip value={entry.value} small />
              </div>
            ))}
            {obj.entries.length > 10 && (
              <span style={{ fontSize: 10, color: '#A1A1A6' }}>+{obj.entries.length - 10} more</span>
            )}
          </div>
        )}

        {obj.kind === 'object' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(obj.attrs).length === 0
              ? <span style={{ fontSize: 11, color: '#C7C7CC', fontStyle: 'italic' }}>no attributes</span>
              : Object.entries(obj.attrs).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#86868B', fontFamily: '"JetBrains Mono", monospace' }}>{k}</span>
                  <span style={{ fontSize: 10, color: '#C7C7CC' }}>·</span>
                  <ValueChip value={v} small />
                </div>
              ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function HeapView({ heap, highlight, excludeIds }: Props) {
  const objects = Object.values(heap).filter(
    (obj) => !excludeIds?.has(obj.id),
  );
  const visible = objects.slice(0, 50);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <AnimatePresence initial={false}>
        {visible.map((obj) => (
          <HeapCard key={obj.id} obj={obj} highlight={highlight} />
        ))}
      </AnimatePresence>
      {objects.length > 50 && (
        <div style={{
          fontSize: 11, color: '#A1A1A6', textAlign: 'center',
          padding: '6px 0',
          border: '0.5px dashed rgba(0,0,0,0.1)',
          borderRadius: 8,
        }}>
          + {objects.length - 50} more objects
        </div>
      )}
    </div>
  );
}
