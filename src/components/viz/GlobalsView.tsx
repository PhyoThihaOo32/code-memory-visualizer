import { motion, AnimatePresence } from 'framer-motion';
import type { Value } from '../../types';
import { ValueChip } from './ValueChip';

interface Props {
  globals: Record<string, Value>;
  highlight?: { type: 'read' | 'write'; target: string };
}

export function GlobalsView({ globals, highlight }: Props) {
  const entries = Object.entries(globals);

  if (entries.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.85)',
      border: '0.5px solid rgba(0,0,0,0.07)',
      borderRadius: 10,
      overflow: 'hidden',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        padding: '5px 12px',
        borderBottom: '0.5px solid rgba(0,0,0,0.06)',
        background: 'rgba(250,250,250,0.9)',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: '#A1A1A6',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Globals
        </span>
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
        <AnimatePresence initial={false}>
          {entries.map(([name, val]) => {
            const isHighlighted = highlight?.target === name;
            return (
              <motion.div
                key={name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: isHighlighted
                    ? highlight?.type === 'write' ? 'rgba(255,45,146,0.07)' : 'rgba(0,229,255,0.07)'
                    : 'rgba(0,0,0,0.02)',
                  border: `0.5px solid ${isHighlighted
                    ? highlight?.type === 'write' ? 'rgba(255,45,146,0.3)' : 'rgba(0,229,255,0.3)'
                    : 'rgba(0,0,0,0.06)'}`,
                  boxShadow: isHighlighted
                    ? highlight?.type === 'write'
                      ? '0 0 8px rgba(255,45,146,0.15)'
                      : '0 0 8px rgba(0,229,255,0.15)'
                    : 'none',
                  transition: 'background 0.25s, box-shadow 0.25s',
                }}
              >
                <span style={{
                  fontSize: 12,
                  color: '#86868B',
                  fontFamily: '"JetBrains Mono", monospace',
                }}>
                  {name}
                </span>
                <span style={{ fontSize: 10, color: '#C7C7CC' }}>=</span>
                <ValueChip
                  value={val}
                  highlight={isHighlighted ? highlight?.type : undefined}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
