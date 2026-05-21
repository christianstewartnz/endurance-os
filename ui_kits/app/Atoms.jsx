// Shared atomic components for the Endurance.OS UI kit.
// Loaded via Babel before any view component.

const { useState, useEffect, useRef } = React;

/* -------- Phosphor icon helper --------
   The kit was migrated from Lucide → Phosphor (@phosphor-icons/react).
   In this Babel-runtime / no-bundler environment we render Phosphor via the
   `@phosphor-icons/web` CDN, which exposes every glyph as a CSS class on an
   `<i class="ph-light ph-arrow-up">` element. Equivalent in spirit to:

       import { ArrowUp } from "@phosphor-icons/react";
       <ArrowUp size={16} weight="light" color="..." />

   Defaults follow the design system:
   - General UI icons → weight="light"
   - AI-specific icons (sparkles, brain, coach/memory indicators) → weight="duotone"

   Callers still pass the original lucide-kebab `name` prop (e.g. "arrow-up",
   "search", "sparkles"). The map below translates each to its Phosphor
   counterpart per the migration table. Pass `weight` to override the default. */

const PHOSPHOR_NAME_MAP = {
  // From the migration mapping (Lucide → Phosphor)
  'layout-dashboard':   'squares-four',
  'calendar':           'calendar-blank',
  'message-square':     'chat-circle',
  'brain':              'brain',
  'flag':               'flag',
  'settings-2':         'gear-six',
  'sparkles':           'sparkle',
  'search':             'magnifying-glass',
  'chevron-right':      'caret-right',
  'chevron-left':       'caret-left',
  'chevrons-up-down':   'arrows-down-up',
  'plus':               'plus',
  'x':                  'x',
  'check':              'check',
  'pencil-line':        'pencil-line',
  'arrow-up':           'arrow-up',
  'at-sign':            'at',
  'paperclip':          'paperclip',
  'more-horizontal':    'dots-three',
  'pin':                'push-pin',
  'cpu':                'cpu',
  'download':           'download-simple',
  'git-pull-request':   'git-pull-request',
  'git-fork':           'git-fork',
  'git-branch':         'git-branch',
  'activity':           'activity',
  'sliders-horizontal': 'sliders-horizontal',
  'utensils':           'fork',
  'heart':              'heart',
  'bed':                'bed',
  'key':                'key',
  'plug':               'plugs-connected',
  'palette':            'palette',
  'user':               'user',
  'copy':               'copy',
  'shuffle':            'shuffle',
  'refresh-cw':         'arrows-clockwise',
  'trending-down':      'trend-down',
  'chart-line':         'chart-line',
  'battery-low':        'battery-low',
  'layers':             'stack',
  'zap':                'lightning',
  'heart-pulse':        'heart-beat',
  'moon':               'moon',
  'arrow-right':        'arrow-right',
  'trash-2':            'trash',
  'filter':             'funnel',
  // Additional names referenced in the app, not in the explicit table
  'play':                 'play',
  'chevron-down':         'caret-down',
  'message-square-plus':  'chat-circle-plus',
};

// AI-specific indicators always render at duotone weight unless overridden.
const PHOSPHOR_DUOTONE_DEFAULTS = new Set(['sparkles', 'brain']);

function Icon({ name, size = 16, color, weight, style, className }) {
  const phName = PHOSPHOR_NAME_MAP[name] || name;
  const w = weight || (PHOSPHOR_DUOTONE_DEFAULTS.has(name) ? 'duotone' : 'light');
  const cls = ['ph-' + w, 'ph-' + phName, className].filter(Boolean).join(' ');
  return (
    <span
      className={cls}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        fontSize: size,
        lineHeight: 1,
        color: color || 'currentColor',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/* -------- Button -------- */
function Button({ kind = 'secondary', size = 'md', icon, iconRight, children, onClick, style, disabled, type }) {
  const heights = { sm: 24, md: 30, lg: 36 };
  const fontSizes = { sm: 12, md: 13, lg: 14 };
  const pad = { sm: '0 8px', md: '0 12px', lg: '0 14px' };
  const kinds = {
    primary: { background: 'var(--accent)', color: 'var(--accent-fg)', border: '1px solid transparent' },
    secondary: { background: 'var(--bg-3)', color: 'var(--fg-1)', border: '1px solid var(--border-default)' },
    ghost: { background: 'transparent', color: 'var(--fg-2)', border: '1px solid transparent' },
    ai: { background: 'var(--ai-soft)', color: 'var(--ai)', border: '1px solid var(--ai-edge)' },
    danger: { background: 'var(--bg-3)', color: 'var(--danger)', border: '1px solid var(--border-default)' },
  };
  return (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: heights[size],
        padding: pad[size],
        borderRadius: 6,
        fontSize: fontSizes[size],
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background var(--dur-micro) var(--ease-out), transform 80ms var(--ease-out)',
        whiteSpace: 'nowrap',
        ...kinds[kind],
        ...style,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = '')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 12 : 14} />}
    </button>
  );
}

/* -------- Pill -------- */
function Pill({ color = 'neutral', children, style }) {
  const colors = {
    neutral: { bg: 'var(--bg-3)', fg: 'var(--fg-2)', border: '1px solid var(--border-default)' },
    z1: { bg: 'rgba(92,100,112,0.18)', fg: '#A2A8B4' },
    z2: { bg: 'rgba(63,179,127,0.16)', fg: '#3FB37F' },
    z3: { bg: 'rgba(232,197,71,0.16)', fg: '#E8C547' },
    z4: { bg: 'rgba(232,155,60,0.16)', fg: '#E89B3C' },
    z5: { bg: 'rgba(229,72,77,0.16)', fg: '#E5484D' },
    success: { bg: 'rgba(63,179,127,0.16)', fg: '#3FB37F' },
    warning: { bg: 'rgba(232,155,60,0.16)', fg: '#E89B3C' },
    danger: { bg: 'rgba(229,72,77,0.16)', fg: '#E5484D' },
    ai: { bg: 'var(--ai-soft)', fg: 'var(--ai)' },
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
  };
  const c = colors[color] || colors.neutral;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      height: 20,
      padding: '0 8px',
      borderRadius: 999,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      fontWeight: 500,
      lineHeight: 1,
      background: c.bg,
      color: c.fg,
      border: c.border || 'none',
      ...style,
    }}>{children}</span>
  );
}

/* -------- Card -------- */
function Card({ eyebrow, meta, children, style, padding = 24, action }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      padding,
      ...style,
    }}>
      {(eyebrow || meta || action) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 16,
          gap: 12,
        }}>
          {eyebrow && (
            <div style={{
              fontSize: 11,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--fg-3)',
            }}>{eyebrow}</div>
          )}
          {meta && (
            <div style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--fg-3)',
              marginLeft: 'auto',
            }}>{meta}</div>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/* -------- Kbd -------- */
function Kbd({ children }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      padding: '0 5px',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: 'var(--fg-2)',
      background: 'var(--bg-3)',
      border: '1px solid var(--border-default)',
      borderRadius: 4,
    }}>{children}</span>
  );
}

/* -------- Avatar -------- */
function Avatar({ initials = 'AT', size = 24, color = '#E89B3C' }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 999,
      background: `linear-gradient(135deg, ${color}, ${color}99)`,
      color: '#08090A',
      fontSize: size * 0.42,
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>{initials}</div>
  );
}

/* -------- Sparkline (SVG) -------- */
function Sparkline({ data, width = 120, height = 28, color = 'var(--accent)', fill = true, baseline }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = (max - min) || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * (height - 4) - 2]);
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = d + ` L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {fill && <path d={area} fill={color} opacity="0.16" />}
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {baseline !== undefined && (
        <line x1="0" x2={width} y1={height - ((baseline - min) / range) * (height - 4) - 2} y2={height - ((baseline - min) / range) * (height - 4) - 2} stroke="var(--fg-4)" strokeWidth="1" strokeDasharray="2 3" />
      )}
    </svg>
  );
}

/* expose */
Object.assign(window, { Icon, Button, Pill, Card, Kbd, Avatar, Sparkline });
