'use client'

import React from 'react'

const PHOSPHOR_NAME_MAP: Record<string, string> = {
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
  'play':               'play',
  'chevron-down':       'caret-down',
  'message-square-plus':'chat-circle-plus',
}

const DUOTONE_DEFAULTS = new Set(['sparkles', 'brain'])

interface IconProps {
  name: string
  size?: number
  color?: string
  weight?: string
  style?: React.CSSProperties
  className?: string
}

export function Icon({ name, size = 16, color, weight, style, className }: IconProps) {
  const phName = PHOSPHOR_NAME_MAP[name] || name
  const w = weight || (DUOTONE_DEFAULTS.has(name) ? 'duotone' : 'light')
  const cls = ['ph-' + w, 'ph-' + phName, className].filter(Boolean).join(' ')
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
  )
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'ai' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  kind?: ButtonKind
  size?: ButtonSize
  icon?: string
  iconRight?: string
  children?: React.ReactNode
  onClick?: () => void
  style?: React.CSSProperties
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export function Button({
  kind = 'secondary',
  size = 'md',
  icon,
  iconRight,
  children,
  onClick,
  style,
  disabled,
  type,
}: ButtonProps) {
  const heights: Record<ButtonSize, number> = { sm: 24, md: 30, lg: 36 }
  const fontSizes: Record<ButtonSize, number> = { sm: 12, md: 13, lg: 14 }
  const pads: Record<ButtonSize, string> = { sm: '0 8px', md: '0 12px', lg: '0 14px' }
  const kindStyles: Record<ButtonKind, React.CSSProperties> = {
    primary:   { background: 'var(--accent)',    color: 'var(--accent-fg)', border: '1px solid transparent' },
    secondary: { background: 'var(--bg-3)',      color: 'var(--fg-1)',      border: '1px solid var(--border-default)' },
    ghost:     { background: 'transparent',      color: 'var(--fg-2)',      border: '1px solid transparent' },
    ai:        { background: 'var(--ai-soft)',   color: 'var(--ai)',        border: '1px solid var(--ai-edge)' },
    danger:    { background: 'var(--bg-3)',      color: 'var(--danger)',    border: '1px solid var(--border-default)' },
  }
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
        padding: pads[size],
        borderRadius: 6,
        fontSize: fontSizes[size],
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background var(--dur-micro) var(--ease-out)',
        whiteSpace: 'nowrap',
        ...kindStyles[kind],
        ...style,
      }}
      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 12 : 14} />}
    </button>
  )
}

type PillColor = 'neutral' | 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'success' | 'warning' | 'danger' | 'ai' | 'accent'

interface PillProps {
  color?: PillColor
  children?: React.ReactNode
  style?: React.CSSProperties
}

export function Pill({ color = 'neutral', children, style }: PillProps) {
  const colors: Record<PillColor, { bg: string; fg: string; border?: string }> = {
    neutral: { bg: 'var(--bg-3)',                  fg: 'var(--fg-2)',  border: '1px solid var(--border-default)' },
    z1:      { bg: 'rgba(92,100,112,0.18)',        fg: '#A2A8B4' },
    z2:      { bg: 'rgba(63,179,127,0.16)',        fg: '#3FB37F' },
    z3:      { bg: 'rgba(232,197,71,0.16)',        fg: '#E8C547' },
    z4:      { bg: 'rgba(232,155,60,0.16)',        fg: '#E89B3C' },
    z5:      { bg: 'rgba(229,72,77,0.16)',         fg: '#E5484D' },
    success: { bg: 'rgba(63,179,127,0.16)',        fg: '#3FB37F' },
    warning: { bg: 'rgba(232,155,60,0.16)',        fg: '#E89B3C' },
    danger:  { bg: 'rgba(229,72,77,0.16)',         fg: '#E5484D' },
    ai:      { bg: 'var(--ai-soft)',               fg: 'var(--ai)' },
    accent:  { bg: 'var(--accent-soft)',           fg: 'var(--accent)' },
  }
  const c = colors[color] || colors.neutral
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
  )
}

interface CardProps {
  eyebrow?: React.ReactNode
  meta?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
  padding?: number
}

export function Card({ eyebrow, meta, action, children, style, padding = 24 }: CardProps) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-default)',
      borderRadius: 10,
      padding,
      ...style,
    }}>
      {(eyebrow || meta || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, gap: 12 }}>
          {eyebrow && (
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' }}>
              {eyebrow}
            </div>
          )}
          {meta && (
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', marginLeft: 'auto' }}>
              {meta}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
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
  )
}

interface AvatarProps {
  initials?: string
  size?: number
  color?: string
}

export function Avatar({ initials = 'AT', size = 24, color = '#E89B3C' }: AvatarProps) {
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
  )
}

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
  baseline?: number
}

export function Sparkline({ data, width = 120, height = 28, color = 'var(--accent)', fill = true, baseline }: SparklineProps) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = (max - min) || 1
  const step = width / (data.length - 1)
  const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * (height - 4) - 2])
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ')
  const area = d + ` L${width},${height} L0,${height} Z`
  const baseY = baseline !== undefined
    ? height - ((baseline - min) / range) * (height - 4) - 2
    : null
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {fill && <path d={area} fill={color} opacity="0.16" />}
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {baseY !== null && (
        <line x1="0" x2={width} y1={baseY} y2={baseY} stroke="var(--fg-4)" strokeWidth="1" strokeDasharray="2 3" />
      )}
    </svg>
  )
}
