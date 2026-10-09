import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../i18n/ThemeContext';
import { useLang } from '../i18n/LangContext';
import { IconRayaAssistant, IconSend, IconX } from './icons/ScIcons';
import { useNavigate } from 'react-router-dom';
import { useEarlyWarnings } from './EarlyWarningContext';
import { reply as rayaReply, SUGGESTIONS } from '../services/raya';
import { askRayaLLM } from '../services/rayaLLM';

export default function RayaChat({ profile }) {
  const { theme } = useTheme();
  const { lang } = useLang();
  const navigate = useNavigate();
  const { parcels, claims, alerts, isDemo } = useEarlyWarnings();
  const memory = useRef({});
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      role: 'model',
      content:
        lang === 'mr'
          ? 'नमस्कार! मी रया. तुमचे विमा दावे, पीक तणाव इशारे, हवामान आणि जमीन याबद्दल विचारा.'
          : "Hi, I'm Raya. Ask me about your insurance claims, crop stress alerts, weather, or land.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const ask = async (text) => {
    const q = (text ?? input).trim();
    if (!q || isTyping) return;
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setInput('');
    setIsTyping(true);
    try {
      const r = await rayaReply(q, { lang, profile, parcels, claims, alerts, isDemo, memory: memory.current });
      // The language model answers from the farm data; the rule-based answer is the fallback.
      const history = messages.slice(-8).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
      const ai = await askRayaLLM({ message: q, history, context: r.context, lang });
      setMessages((prev) => [...prev, { role: 'model', content: ai || r.text, actions: r.actions }]);
    } catch (err) {
      console.error('Raya failed', err);
      setMessages((prev) => [...prev, { role: 'model', content: lang === 'mr' ? 'काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.' : 'Something went wrong. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };
  const sendMessage = () => ask();

  const go = (to) => {
    setIsOpen(false);
    navigate(to.split('#')[0]);
    const hash = to.split('#')[1];
    if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 120);
  };

  if (!isOpen) {
    return (
      <button 
        className="sc-raya-fab"
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: '80px', right: '16px', zIndex: 9999,
          width: '56px', height: '56px', borderRadius: '50%',
          background: theme.accent, border: 'none',
          boxShadow: '0 8px 24px rgba(0,210,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'transform 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        aria-label="Open Raya assistant"
      >
        <IconRayaAssistant size={26} color={theme.accentText || '#000'} />
      </button>
    );
  }

  return (
    <div className="sc-raya-panel" style={{
      position: 'fixed',
      bottom: '80px',
      right: '16px',
      zIndex: 9999,
      width: 'min(360px, calc(100vw - 32px))',
      height: 'min(500px, calc(100vh - 140px))',
      background: theme.card, border: `1px solid ${theme.border}`,
      borderRadius: '20px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', background: theme.cardAlt, borderBottom: `1px solid ${theme.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconRayaAssistant size={20} color="#111" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: theme.text }}>Raya AI</div>
            <div style={{ fontSize: '11px', color: theme.textDim, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} aria-hidden />
              <span style={{ color: '#22c55e' }}>Online</span>
            </div>
          </div>
        </div>
        <button type="button" onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }} aria-label="Close">
          <IconX size={22} color="currentColor" />
        </button>
      </div>

      {/* Messages */}
      <div ref={chatRef} style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', background: theme.bg }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '12px 16px',
              borderRadius: '16px',
              borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
              borderBottomLeftRadius: m.role === 'model' ? '4px' : '16px',
              background: m.role === 'user' ? theme.accent : theme.cardAlt,
              color: m.role === 'user' ? '#111' : theme.text,
              fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap',
              border: m.role === 'model' ? `1px solid ${theme.border}` : 'none'
            }}>
              {m.content}
            </div>
            {m.actions?.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {m.actions.map((a) => (
                  <button key={a.to + a.label} type="button" onClick={() => go(a.to)}
                    style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${theme.accentBorder}`, background: theme.accentBg, color: theme.text, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {a.label} {'->'}
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: '10px', color: theme.textDim, marginTop: '4px', padding: '0 4px' }}>
              {m.role === 'user' ? 'You' : 'Raya'}
            </div>
          </div>
        ))}
        {isTyping && (
          <div style={{ alignSelf: 'flex-start', background: theme.cardAlt, padding: '12px 16px', borderRadius: '16px', borderBottomLeftRadius: '4px', border: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: '12px', color: theme.textDim }}>...</span>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '10px 16px 0', background: theme.cardAlt, borderTop: `1px solid ${theme.border}` }}>
        {SUGGESTIONS[lang === 'mr' ? 'mr' : 'en'].map((q) => (
          <button key={q} type="button" onClick={() => ask(q)}
            style={{ flexShrink: 0, padding: '6px 12px', borderRadius: '20px', border: `1px solid ${theme.border}`, background: theme.card, color: theme.textDim, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px 16px', background: theme.cardAlt, display: 'flex', gap: '8px' }}>
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={lang === 'mr' ? 'विमा, पीक, हवामानाबद्दल विचारा...' : 'Ask about claims, crop stress, weather...'}
          style={{
            flex: 1, padding: '12px 16px', borderRadius: '24px',
            border: `1px solid ${theme.border}`, background: theme.bg,
            color: theme.text, fontSize: '13px', outline: 'none'
          }}
        />
        <button 
          type="button"
          onClick={sendMessage}
          aria-label="Send message"
          style={{
            width: '42px', height: '42px', borderRadius: '50%',
            background: theme.accent, border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <IconSend size={18} color="#111" />
        </button>
      </div>
    </div>
  );
}
