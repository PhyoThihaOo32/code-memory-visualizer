import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StackFrame } from '../../types';

interface Arrow {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
}

interface Props {
  frames: StackFrame[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function PointerArrows({ frames, containerRef }: Props) {
  const [arrows, setArrows] = useState<Arrow[]>([]);

  // Stable key: only re-measure when the set of ref-valued locals actually changes.
  // Without this, the effect would run on every render and call setArrows → infinite loop.
  const refKey = useMemo(
    () =>
      frames
        .flatMap((f) =>
          Object.entries(f.locals)
            .filter(([, v]) => v.kind === 'ref')
            .map(([name, v]) => `${f.id}:${name}->${v.kind === 'ref' ? v.id : ''}`)
        )
        .join('|'),
    [frames],
  );

  useEffect(() => {
    if (!containerRef.current) { setArrows([]); return; }
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    const found: Arrow[] = [];

    // For each ref value in frames, find the source element and target heap card
    const collectRefs = (frameId: string, varName: string, refId: string) => {
      const srcEl = container.querySelector(`[data-var="${frameId}-${varName}"]`);
      const tgtEl = container.querySelector(`[data-heap="${refId}"]`);
      if (!srcEl || !tgtEl) return;

      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();

      found.push({
        id: `${frameId}-${varName}->${refId}`,
        x1: sr.right - rect.left,
        y1: sr.top + sr.height / 2 - rect.top,
        x2: tr.left - rect.left,
        y2: tr.top + tr.height / 2 - rect.top,
      });
    };

    for (const frame of frames) {
      for (const [name, val] of Object.entries(frame.locals)) {
        if (val.kind === 'ref') collectRefs(frame.id, name, val.id);
      }
    }

    setArrows(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey]);

  if (arrows.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20,
        overflow: 'visible',
      }}
      width="100%" height="100%"
    >
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#00E5FF" opacity="0.7" />
        </marker>
      </defs>
      <AnimatePresence>
        {arrows.map((a) => {
          const mx = (a.x1 + a.x2) / 2;
          const my = (a.y1 + a.y2) / 2;
          const cpx = mx + (a.y2 - a.y1) * 0.3;
          const cpy = my - Math.abs(a.x2 - a.x1) * 0.15;
          const d = `M ${a.x1} ${a.y1} Q ${cpx} ${cpy} ${a.x2} ${a.y2}`;

          return (
            <motion.path
              key={a.id}
              d={d}
              fill="none"
              stroke="#00E5FF"
              strokeWidth={1.5}
              strokeOpacity={0.55}
              strokeDasharray="4 3"
              markerEnd="url(#arrowhead)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          );
        })}
      </AnimatePresence>
    </svg>
  );
}
