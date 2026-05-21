// AI Coach contextual panel — right side, embedded.
const { useState: useStateCoach, useEffect: useEffectCoach, useRef: useRefCoach } = React;

const initialMessages = [
  {
    role: 'system',
    text: 'Tue, Jun 3 · 06:12 · Coach checked in.',
  },
  {
    role: 'ai',
    text: (
      <>
        HRV is <span style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 13 }}>64ms</span>, 8% under your 14-day baseline. Sleep was 6h 12m vs your 7h 30m target. You're trending under recovered.
      </>
    ),
    refs: ['HRV', 'Sleep'],
  },
  {
    role: 'ai',
    text: (
      <>
        Today is threshold (4×8 @ 285 W, TSS 128). My recommendation: swap to <span style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 13 }}>90 min Z2</span>. Thu can absorb the threshold without disrupting Sat's long ride.
      </>
    ),
    actions: ['Apply swap', 'Explain', 'Keep as planned'],
  },
];

function CoachPanel({ onClose }) {
  const [messages, setMessages] = useStateCoach(initialMessages);
  const [input, setInput] = useStateCoach('');
  const [typing, setTyping] = useStateCoach(false);
  const scrollRef = useRefCoach(null);

  useEffectCoach(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  function send(text) {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: 'user', text }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(m => [...m, {
        role: 'ai',
        text: (
          <>Got it. I'll flag the long ride for Sat at <span style={{ fontFamily: 'var(--font-mono)' }}>3h 30m / 195 TSS</span>. If HRV doesn't recover by Fri evening, I'll suggest shortening it to 2h 30m.</>
        ),
      }]);
    }, 1200);
  }

  return (
    <aside style={{
      width: 'var(--rightpanel-w)',
      background: 'var(--bg-1)',
      borderLeft: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          width: 24, height: 24,
          borderRadius: 6,
          background: 'var(--ai-soft)',
          border: '1px solid var(--ai-edge)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon name="sparkles" size={13} color="var(--ai)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.005em' }}>Coach</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            <span style={{ color: 'var(--ai)' }}>●</span> Reading: <span style={{ fontFamily: 'var(--font-mono)' }}>@todayshrv · @plandna · @buildweek3</span>
          </div>
        </div>
        <Button kind="ghost" size="sm" icon="more-horizontal" />
        <Button kind="ghost" size="sm" icon="x" onClick={onClose} />
      </div>

      {/* Context strip */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
      }}>
        <ContextChip label="@todayshrv" />
        <ContextChip label="@lastthresholdsession" />
        <ContextChip label="@plandna" />
        <ContextChip label="+ add context" subtle />
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        {messages.map((m, i) => <Message key={i} m={m} />)}
        {typing && <TypingDots />}
      </div>

      {/* Composer */}
      <div style={{
        padding: '12px 14px 14px',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-2)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: '10px 12px',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about today's session, this week, or anything in your training…"
            rows={2}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: 'var(--fg-1)',
              fontFamily: 'inherit',
              fontSize: 13,
              lineHeight: 1.5,
              padding: 0,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Button kind="ghost" size="sm" icon="paperclip" />
            <Button kind="ghost" size="sm" icon="at-sign" />
            <span style={{ fontSize: 10, color: 'var(--fg-4)', marginLeft: 4 }}>@plan, @session, @week</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
              <Kbd>↵</Kbd> send
            </span>
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              style={{
                width: 24, height: 24,
                borderRadius: 6,
                background: input.trim() ? 'var(--accent)' : 'var(--bg-3)',
                color: input.trim() ? 'var(--accent-fg)' : 'var(--fg-4)',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                transition: 'background var(--dur-micro) var(--ease-out)',
              }}
            >
              <Icon name="arrow-up" size={13} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ContextChip({ label, subtle }) {
  const isTag = label.startsWith('@');
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      background: subtle ? 'transparent' : (isTag ? 'var(--ai-soft)' : 'var(--bg-2)'),
      border: `1px solid ${subtle ? 'var(--border-subtle)' : (isTag ? 'var(--ai-edge)' : 'var(--border-default)')}`,
      color: subtle ? 'var(--fg-3)' : (isTag ? 'var(--ai)' : 'var(--fg-2)'),
      cursor: 'pointer',
    }}>{label}</span>
  );
}

function Message({ m }) {
  if (m.role === 'system') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{m.text}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
      </div>
    );
  }
  if (m.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          background: 'var(--bg-3)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 13,
          color: 'var(--fg-1)',
          maxWidth: '85%',
          lineHeight: 1.5,
        }}>{m.text}</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 22, height: 22,
        borderRadius: 5,
        background: 'var(--ai-soft)',
        border: '1px solid var(--ai-edge)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
      }}>
        <Icon name="sparkles" size={11} color="var(--ai)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: 'rgba(139,124,246,0.06)',
          border: '1px solid rgba(139,124,246,0.16)',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 13,
          color: 'var(--fg-1)',
          lineHeight: 1.55,
        }}>
          {m.text}
        </div>
        {m.actions && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {m.actions.map((a, i) => (
              <Button key={a} kind={i === 0 ? 'ai' : 'ghost'} size="sm">{a}</Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{
        width: 22, height: 22, borderRadius: 5,
        background: 'var(--ai-soft)', border: '1px solid var(--ai-edge)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="sparkles" size={11} color="var(--ai)" />
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: 'rgba(139,124,246,0.06)', border: '1px solid rgba(139,124,246,0.16)', borderRadius: 10 }}>
        {[0,1,2].map(i => (
          <span key={i} style={{
            width: 5, height: 5, borderRadius: 999,
            background: 'var(--ai)',
            animation: `dotPulse 1s ${i * 0.16}s infinite ease-in-out`,
          }} />
        ))}
      </div>
      <style>{`@keyframes dotPulse { 0%, 60%, 100% { opacity: 0.3 } 30% { opacity: 1 } }`}</style>
    </div>
  );
}

window.CoachPanel = CoachPanel;
