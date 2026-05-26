import { motion, AnimatePresence } from 'framer-motion';
import type { StackFrame } from '../../types';
import { ValueChip } from './ValueChip';

interface Props {
  frames: StackFrame[];
  highlight?: { type: 'read' | 'write'; target: string };
  depth?: number;
}

const DEPTH_AMBERS = [
  'rgba(255,184,0,0)',
  'rgba(255,184,0,0.04)',
  'rgba(255,184,0,0.08)',
  'rgba(255,184,0,0.13)',
  'rgba(255,184,0,0.18)',
  'rgba(255,184,0,0.24)',
];

export function StackView({ frames, highlight }: Props) {
  const reversed = [...frames].reverse(); // top frame first visually

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence initial={false}>
        {reversed.map((frame, i) => {
          const isTop = i === 0;
          const depthIdx = Math.min(i, DEPTH_AMBERS.length - 1);

          return (
            <motion.div
              key={frame.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              style={{
                background: isTop
                  ? 'rgba(255,255,255,0.95)'
                  : `rgba(250,250,250,${0.7 - i * 0.05})`,
                border: isTop
                  ? '0.5px solid rgba(0,229,255,0.25)'
                  : '0.5px solid rgba(0,0,0,0.06)',
                borderRadius: 10,
                overflow: 'hidden',
                boxShadow: isTop
                  ? '0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,229,255,0.08)'
                  : '0 2px 8px rgba(0,0,0,0.04)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {/* Frame header */}
              <div style={{
                display: 'flex', alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderBottom: '0.5px solid rgba(0,0,0,0.06)',
                background: DEPTH_AMBERS[depthIdx],
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isTop ? '#00E5FF' : '#A1A1A6',
                  boxShadow: isTop ? '0 0 6px #00E5FF' : 'none',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isTop ? '#00B4CC' : '#86868B',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontFamily: '"JetBrains Mono", monospace',
                }}>
                  {frame.name === '<module>' ? 'module' : frame.name}()
                </span>
                {i > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    color: '#FFB800',
                    background: 'rgba(255,184,0,0.12)',
                    border: '0.5px solid rgba(255,184,0,0.3)',
                    borderRadius: 4,
                    padding: '1px 5px',
                  }}>
                    depth {frames.length - 1 - i + 1}
                  </span>
                )}
              </div>

              {/* Locals */}
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {Object.entries(frame.locals).length === 0 ? (
                  <span style={{ fontSize: 11, color: '#C7C7CC', fontStyle: 'italic' }}>no locals</span>
                ) : (
                  Object.entries(frame.locals).map(([name, val]) => {
                    const isHighlighted = highlight?.target === name;
                    return (
                      <motion.div
                        key={name}
                        layout
                        data-var={`${frame.id}-${name}`}
                        initial={false}
                        animate={{
                          background: isHighlighted
                            ? highlight?.type === 'write'
                              ? 'rgba(255,45,146,0.06)'
                              : 'rgba(0,229,255,0.06)'
                            : 'transparent',
                        }}
                        transition={{ duration: 0.25 }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          borderRadius: 6, padding: '2px 4px',
                          gap: 8,
                        }}
                      >
                        <span style={{
                          fontSize: 12,
                          color: '#86868B',
                          fontFamily: '"JetBrains Mono", monospace',
                          letterSpacing: '-0.2px',
                        }}>
                          {name}
                        </span>
                        <ValueChip
                          value={val}
                          highlight={isHighlighted ? highlight?.type : undefined}
                        />
                      </motion.div>
                    );
                  })
                )}

                {/* Return value */}
                {frame.returnValue && frame.returnValue.kind !== 'none' && (
                  <motion.div
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginTop: 4,
                      paddingTop: 6,
                      borderTop: '0.5px solid rgba(57,255,148,0.2)',
                    }}
                  >
                    <span style={{
                      fontSize: 10, color: '#39FF94',
                      textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
                    }}>↩ return</span>
                    <ValueChip value={frame.returnValue} />
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
