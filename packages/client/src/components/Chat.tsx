import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../store/game';
import { net } from '../net/socket';

const QUICK = ['Zu teuer! 💸', 'Nimm ihn! 🔥', 'Niemals 😤', 'Bluff! 🤨', 'Bietet mit! ⚔️', 'lol 😂'];

/**
 * Chat and game log in one.
 *
 * System lines ("X ersteigert Y für Z") are written by the engine, so the feed
 * doubles as a running history that survives a reconnect.
 */
export function Chat({ variant = 'dock' }: { variant?: 'dock' | 'panel' }) {
  const messages = useGame((s) => s.state?.chat ?? []);
  const players = useGame((s) => s.state?.players ?? []);
  const you = useGame((s) => s.state?.you);
  const open = useGame((s) => s.chatOpen);
  const unread = useGame((s) => s.unreadChat);
  const setOpen = useGame((s) => s.setChatOpen);

  const [text, setText] = useState('');
  const [showQuick, setShowQuick] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const expanded = variant === 'panel' || open;

  useEffect(() => {
    if (expanded) feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, expanded]);

  const send = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    net.chat(trimmed);
    setText('');
    setShowQuick(false);
  };

  const avatarColor = (playerId: string | null) => {
    const index = players.findIndex((p) => p.id === playerId);
    return `hsl(${(index + 1) * 67} 70% 62%)`;
  };

  const body = (
    <>
      <div className="chat-feed" ref={feed}>
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              className={`chat-msg ${m.kind} ${m.playerId === you ? 'mine' : ''}`}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              {m.kind === 'system' ? (
                <span className="chat-system">
                  <span className="chat-sys-icon">{m.avatar}</span>
                  {m.text}
                </span>
              ) : (
                <>
                  <span className="chat-avatar">{m.avatar}</span>
                  <span className="chat-content">
                    <span className="chat-name" style={{ color: avatarColor(m.playerId) }}>
                      {m.name}
                    </span>
                    <span className="chat-text">{m.text}</span>
                  </span>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {messages.length === 0 && <p className="chat-empty">Noch keine Nachrichten. Trash-Talk erwünscht.</p>}
      </div>

      <AnimatePresence>
        {showQuick && (
          <motion.div className="chat-quick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            {QUICK.map((q) => (
              <button key={q} onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="chat-input">
        <button className="chat-emoji" onClick={() => setShowQuick((v) => !v)} aria-label="Schnellnachrichten">
          ⚡
        </button>
        <input
          value={text}
          maxLength={200}
          placeholder="Nachricht…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send(text);
            e.stopPropagation();
          }}
        />
        <button className="chat-send" onClick={() => send(text)} disabled={!text.trim()}>
          ➤
        </button>
      </div>
    </>
  );

  if (variant === 'panel') return <div className="chat panel">{body}</div>;

  return (
    <div className={`chat dock ${open ? 'open' : ''}`}>
      <button className="chat-toggle" onClick={() => setOpen(!open)}>
        <span>💬 Chat</span>
        {!open && unread > 0 && <span className="chat-badge">{unread}</span>}
        <span className="chat-caret">{open ? '▾' : '▴'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="chat-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 340, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            {body}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
