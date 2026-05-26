import type { Value } from '../../types';

interface Props {
  value: Value;
  highlight?: 'read' | 'write';
  small?: boolean;
}

export function ValueChip({ value, highlight, small }: Props) {
  const fs = small ? 11 : 12;

  if (value.kind === 'none') {
    return (
      <span style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: fs,
        color: '#A1A1A6',
        padding: '1px 6px',
      }}>None</span>
    );
  }

  if (value.kind === 'ref') {
    return (
      <span style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: fs,
        color: '#00B4CC',
        padding: '1px 6px',
        background: 'rgba(0,229,255,0.08)',
        borderRadius: 4,
        border: '0.5px solid rgba(0,229,255,0.25)',
      }}>
        ↗ ref
      </span>
    );
  }

  const v = value.value;
  let color = '#1D1D1F';
  let bg = 'transparent';
  let border = 'transparent';

  if (typeof v === 'string') { color = '#1C7A3E'; bg = 'rgba(57,255,148,0.06)'; border = 'rgba(57,255,148,0.2)'; }
  else if (typeof v === 'number') { color = '#0051A8'; bg = 'rgba(0,81,168,0.06)'; border = 'rgba(0,81,168,0.15)'; }
  else if (typeof v === 'boolean') { color = '#7B2FF7'; bg = 'rgba(123,47,247,0.06)'; border = 'rgba(123,47,247,0.2)'; }
  else if (v === null) { color = '#A1A1A6'; }

  if (highlight === 'write') { bg = 'rgba(255,45,146,0.08)'; border = 'rgba(255,45,146,0.4)'; color = '#FF2D92'; }
  if (highlight === 'read') { bg = 'rgba(0,229,255,0.08)'; border = 'rgba(0,229,255,0.4)'; color = '#00B4CC'; }

  const display = typeof v === 'string' ? `"${v}"` : String(v);

  return (
    <span style={{
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: fs,
      color,
      background: bg,
      border: `0.5px solid ${border}`,
      borderRadius: 4,
      padding: '1px 6px',
      display: 'inline-block',
      maxWidth: 120,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      boxShadow: highlight === 'write'
        ? '0 0 8px rgba(255,45,146,0.25)'
        : highlight === 'read'
        ? '0 0 8px rgba(0,229,255,0.25)'
        : 'none',
      transition: 'box-shadow 0.3s, background 0.3s',
    }}>
      {display}
    </span>
  );
}
