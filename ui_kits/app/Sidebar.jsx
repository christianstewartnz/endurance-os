// Sidebar navigation for Endurance.OS.
const { useState } = React;

function Sidebar({ activeRoute, onNavigate, athlete }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', kbd: '⌘1' },
    { id: 'calendar',  label: 'Calendar',  icon: 'calendar',         kbd: '⌘2' },
    { id: 'context',   label: 'Context',   icon: 'brain',            kbd: '⌘3', dot: true },
    { id: 'races',     label: 'Races',     icon: 'flag',             kbd: '⌘4' },
    { id: 'settings',  label: 'Settings',  icon: 'settings-2',       kbd: '⌘,' },
  ];

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      background: 'var(--bg-1)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100%',
    }}>
      {/* Athlete switcher / brand */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '16px 14px 12px',
        cursor: 'pointer',
      }}>
        <img src="../../assets/logo-mark.svg" width="22" height="22" alt=""/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {athlete?.name || 'Mira Lindqvist'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            {athlete?.discipline || 'Triathlon · M70.3'}
          </div>
        </div>
        <Icon name="chevrons-up-down" size={14} color="var(--fg-3)" />
      </div>

      {/* Search */}
      <div style={{ padding: '4px 10px 10px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 28,
          padding: '0 10px',
          background: 'transparent',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          color: 'var(--fg-3)',
          fontSize: 12,
          cursor: 'pointer',
        }}>
          <Icon name="search" size={13} />
          <span style={{ flex: 1 }}>Search…</span>
          <Kbd>⌘K</Kbd>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '4px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map(it => {
          const active = activeRoute === it.id;
          return (
            <div
              key={it.id}
              onClick={() => onNavigate(it.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 10px',
                height: 30,
                borderRadius: 6,
                background: active ? 'var(--bg-3)' : 'transparent',
                boxShadow: active ? 'inset 2px 0 0 var(--accent)' : 'none',
                color: active ? 'var(--fg-1)' : 'var(--fg-2)',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                cursor: 'pointer',
                transition: 'background var(--dur-micro) var(--ease-out)',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-2)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon
                name={it.icon}
                size={15}
                color={it.ai ? 'var(--ai)' : (active ? 'var(--fg-1)' : 'var(--fg-3)')}
              />
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 16,
                  height: 16,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: it.ai ? 'var(--ai-soft)' : 'var(--bg-3)',
                  color: it.ai ? 'var(--ai)' : 'var(--fg-2)',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 500,
                }}>{it.badge}</span>
              )}
              {it.dot && !active && (
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
              )}
              {active && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>{it.kbd}</span>}
            </div>
          );
        })}
      </nav>

      {/* Footer: race countdown */}
      <div style={{ padding: '12px 10px 16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg-2)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)', marginBottom: 4 }}>Next race</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>Ironman 70.3 Lahti</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>Aug 16</span>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 500 }}>74<span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>d</span></span>
          </div>
        </div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
