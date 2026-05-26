import { useStore } from '../store';
import { EXAMPLES_BY_LANG } from '../examples';
import type { Language } from '../types';

const LANG_CONFIG: Record<Language, { label: string; color: string; bg: string; border: string; monacoLang: string }> = {
  python: { label: 'Python',  color: '#006B7A', bg: 'rgba(0,229,255,0.08)',   border: 'rgba(0,229,255,0.3)',   monacoLang: 'python' },
  cpp:    { label: 'C++',     color: '#7B2FF7', bg: 'rgba(123,47,247,0.08)', border: 'rgba(123,47,247,0.3)', monacoLang: 'cpp' },
  java:   { label: 'Java',    color: '#A04800', bg: 'rgba(255,120,0,0.08)',   border: 'rgba(255,120,0,0.3)',   monacoLang: 'java' },
};

export function TopBar() {
  const { language, setLanguage, selectedExample, setSelectedExample, setCode, reset, pyodideReady } = useStore();

  const examples = EXAMPLES_BY_LANG[language];
  const cfg = LANG_CONFIG[language];

  function handleLangChange(lang: Language) {
    setLanguage(lang);
    const exs = EXAMPLES_BY_LANG[lang];
    if (exs.length > 0) {
      setSelectedExample(exs[0].id);
      setCode(exs[0].code);
      reset();
    }
  }

  function handleExampleChange(id: string) {
    const ex = examples.find((e) => e.id === id);
    if (!ex) return;
    setSelectedExample(id);
    setCode(ex.code);
    reset();
  }

  return (
    <div style={{
      height: 48,
      borderBottom: '0.5px solid rgba(0,0,0,0.08)',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      paddingInline: 20,
      gap: 14,
      flexShrink: 0,
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 6 }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect width="22" height="22" rx="6" fill="#1D1D1F" />
          <rect x="5" y="5" width="5" height="5" rx="1.5" fill="#00E5FF" />
          <rect x="12" y="5" width="5" height="5" rx="1.5" fill="#FF2D92" />
          <rect x="5" y="12" width="5" height="5" rx="1.5" fill="#39FF94" />
          <rect x="12" y="12" width="5" height="5" rx="1.5" fill="#FFB800" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.3px', color: '#1D1D1F' }}>
          MemViz
        </span>
      </div>

      {/* Language tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        background: 'rgba(0,0,0,0.04)',
        border: '0.5px solid rgba(0,0,0,0.08)',
        borderRadius: 8,
        padding: 2,
      }}>
        {(['python', 'cpp', 'java'] as Language[]).map((lang) => {
          const lc = LANG_CONFIG[lang];
          const active = language === lang;
          return (
            <button
              key={lang}
              onClick={() => handleLangChange(lang)}
              style={{
                fontSize: 11, fontWeight: active ? 600 : 400,
                letterSpacing: '0.02em',
                color: active ? lc.color : '#86868B',
                background: active ? lc.bg : 'transparent',
                border: active ? `0.5px solid ${lc.border}` : '0.5px solid transparent',
                borderRadius: 6,
                padding: '3px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                outline: 'none',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {lc.label}
            </button>
          );
        })}
      </div>

      {/* Example selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#A1A1A6', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap' }}>
          Example
        </span>
        <div style={{ position: 'relative' }}>
          <select
            value={selectedExample}
            onChange={(e) => handleExampleChange(e.target.value)}
            style={{
              fontSize: 12,
              color: '#1D1D1F',
              background: 'rgba(0,0,0,0.04)',
              border: '0.5px solid rgba(0,0,0,0.1)',
              borderRadius: 7,
              padding: '4px 24px 4px 9px',
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'inherit',
              maxWidth: 180,
            }}
          >
            {examples.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <path d="M1 1l3 3 3-3" stroke="#86868B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Python ready indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: pyodideReady ? 'rgba(57,255,148,0.08)' : 'rgba(0,0,0,0.04)',
        border: `0.5px solid ${pyodideReady ? 'rgba(57,255,148,0.35)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 20, padding: '3px 10px',
        fontSize: 11,
        color: pyodideReady ? '#1D7A4A' : '#86868B',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: pyodideReady ? '#39FF94' : '#A1A1A6',
          boxShadow: pyodideReady ? '0 0 6px #39FF94' : 'none',
        }} />
        {pyodideReady ? 'Engine ready' : 'Loading…'}
      </div>

      {/* Active language pill */}
      <div style={{
        background: cfg.bg,
        border: `0.5px solid ${cfg.border}`,
        borderRadius: 20, padding: '3px 10px',
        fontSize: 11, color: cfg.color,
        letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 500,
      }}>
        {cfg.label}
      </div>
    </div>
  );
}

export { LANG_CONFIG };
