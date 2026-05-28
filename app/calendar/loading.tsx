export default function Loading() {
  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--bg-0)' }}>
      <style>{`
        @keyframes eos-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        .eos-skeleton { animation: eos-pulse 1.6s ease-in-out infinite; }
      `}</style>

      <div style={{ width: 220, background: 'var(--bg-1)', borderRight: '1px solid var(--border-subtle)', flexShrink: 0, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="eos-skeleton" style={{ height: 22, width: 120, borderRadius: 4, background: 'var(--bg-3)' }} />
        <div style={{ height: 12 }} />
        {[80, 90, 70, 85, 75].map((w, i) => (
          <div key={i} className="eos-skeleton" style={{ height: 28, width: `${w}%`, borderRadius: 6, background: 'var(--bg-2)', animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>

      <div style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="eos-skeleton" style={{ height: 14, width: 140, borderRadius: 4, background: 'var(--bg-2)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className="eos-skeleton" style={{ height: 80, borderRadius: 8, background: 'var(--bg-2)', animationDelay: `${(i % 7) * 0.05}s` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
