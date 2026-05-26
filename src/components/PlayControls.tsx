import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

const ICON = {
  play: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 2.5l9 4.5-9 4.5V2.5z" />
    </svg>
  ),
  pause: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="3" y="2" width="3" height="10" rx="1" />
      <rect x="8" y="2" width="3" height="10" rx="1" />
    </svg>
  ),
  stepBack: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2" y="2" width="2.5" height="10" rx="1" />
      <path d="M12 2.5L5 7l7 4.5V2.5z" />
    </svg>
  ),
  stepFwd: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="9.5" y="2" width="2.5" height="10" rx="1" />
      <path d="M2 2.5L9 7 2 11.5V2.5z" />
    </svg>
  ),
  reset: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 7a5 5 0 1 0 1-3" />
      <path d="M2 2v3h3" />
    </svg>
  ),
  run: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 2.5l9 4.5-9 4.5V2.5z" />
    </svg>
  ),
};

function CtrlBtn({
  icon, label, onClick, disabled, accent, active,
}: {
  icon: React.ReactNode; label: string; onClick: () => void;
  disabled?: boolean; accent?: string; active?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32,
        borderRadius: 8,
        border: active ? `0.5px solid ${accent ?? '#00E5FF'}40` : '0.5px solid rgba(0,0,0,0.08)',
        background: active ? `${accent ?? '#00E5FF'}12` : 'rgba(255,255,255,0.7)',
        color: disabled ? '#C7C7CC' : (accent ?? '#1D1D1F'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 0.1s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s, background 0.15s',
        boxShadow: pressed ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        outline: 'none',
      }}
    >
      {icon}
    </button>
  );
}

interface PlayControlsProps {
  onRun: () => void;
}

export function PlayControls({ onRun }: PlayControlsProps) {
  const { playState, setPlayState, stepForward, stepBack, reset, speed, setSpeed, stepIndex, snapshots, pyodideReady } = useStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hovered, setHovered] = useState(false);

  const isPlaying = playState === 'running';
  const hasSnaps = snapshots.length > 0;
  const atEnd = stepIndex >= snapshots.length - 1;
  const atStart = stepIndex === 0;

  function clearTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  useEffect(() => {
    if (isPlaying && hasSnaps) {
      clearTimer();
      const ms = 600 / speed;
      intervalRef.current = setInterval(() => {
        const { stepIndex, snapshots, stepForward, setPlayState } = useStore.getState();
        if (stepIndex >= snapshots.length - 1) {
          setPlayState('finished');
          clearTimer();
        } else {
          stepForward();
        }
      }, ms);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [isPlaying, speed, hasSnaps]);

  function togglePlay() {
    if (!hasSnaps) return;
    if (isPlaying) setPlayState('paused');
    else {
      if (atEnd) {
        useStore.getState().setStepIndex(0);
      }
      setPlayState('running');
    }
  }

  return (
    <div
      style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px)',
        border: '0.5px solid rgba(0,0,0,0.08)',
        borderRadius: 12,
        padding: '8px 12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        opacity: hovered ? 1 : 0.75,
        transition: 'opacity 0.2s',
        zIndex: 5,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Run button */}
      <button
        onClick={onRun}
        disabled={!pyodideReady}
        title="Run code"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 14px',
          borderRadius: 8,
          border: 'none',
          background: pyodideReady ? '#1D1D1F' : '#C7C7CC',
          color: '#fff',
          fontSize: 12, fontWeight: 500,
          cursor: pyodideReady ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
        }}
      >
        {ICON.run}
        Run
      </button>

      <div style={{ width: 0.5, height: 20, background: 'rgba(0,0,0,0.1)' }} />

      <CtrlBtn icon={ICON.reset} label="Reset" onClick={() => { clearTimer(); reset(); }} />
      <CtrlBtn icon={ICON.stepBack} label="Step back" onClick={stepBack} disabled={!hasSnaps || atStart} />
      <CtrlBtn
        icon={isPlaying ? ICON.pause : ICON.play}
        label={isPlaying ? 'Pause' : 'Play'}
        onClick={togglePlay}
        disabled={!hasSnaps || (atEnd && !isPlaying)}
        accent="#00E5FF"
        active={isPlaying}
      />
      <CtrlBtn icon={ICON.stepFwd} label="Step forward" onClick={stepForward} disabled={!hasSnaps || atEnd} />

      <div style={{ width: 0.5, height: 20, background: 'rgba(0,0,0,0.1)' }} />

      {/* Speed */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#86868B', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
          {speed}×
        </span>
        <input
          type="range" min={0.25} max={4} step={0.25}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          style={{ width: 64, accentColor: '#00E5FF', cursor: 'pointer' }}
        />
      </div>

      <div style={{ width: 0.5, height: 20, background: 'rgba(0,0,0,0.1)' }} />

      {/* Timeline scrubber */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="range" min={0} max={Math.max(0, snapshots.length - 1)} step={1}
          value={stepIndex}
          onChange={(e) => {
            clearTimer();
            setPlayState('paused');
            useStore.getState().setStepIndex(Number(e.target.value));
          }}
          style={{ width: 100, accentColor: '#FF2D92', cursor: 'pointer' }}
          disabled={!hasSnaps}
        />
        <span style={{ fontSize: 10, color: '#86868B', minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {hasSnaps ? `${stepIndex + 1}/${snapshots.length}` : '—'}
        </span>
      </div>
    </div>
  );
}
