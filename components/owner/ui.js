'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import s from './ui.styles';

const cx = (...a) => a.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size, full, className, ...props }) {
  return <button type="button" className={cx(s.btn, s[variant], size && s[size], full && s.full, className)} {...props} />;
}

export function Badge({ tone = 'gray', children }) {
  return <span className={cx(s.badge, s[`tone-${tone}`])}>{children}</span>;
}

export function Card({ title, action, children, className, style }) {
  return (
    <section className={cx(s.card, className)} style={style}>
      {(title || action) && (
        <div className={s.cardHead}>
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, required, hint, error, children }) {
  return (
    <label className={s.field}>
      {label && <span className={s.label}>{label}{required && <span className={s.req}>*</span>}</span>}
      {children}
      {error ? <span className={s.error}>{error}</span> : hint ? <span className={s.hint}>{hint}</span> : null}
    </label>
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className={s.tabs} role="tablist">
      {items.map((it) => (
        <button key={it.value} type="button" role="tab" aria-selected={value === it.value}
          className={cx(s.tab, value === it.value && s.tabActive)} onClick={() => onChange(it.value)}>
          {it.label}
          {it.count !== undefined && <span className={cx(s.count, it.hot && it.count > 0 && s.countHot)}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <div className={s.chips}>
      {options.map((o) => (
        <button key={o.value} type="button" className={cx(s.chip, value === o.value && s.chipOn)} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, disabled, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={cx(s.switch, on && s.switchOn)} onClick={() => onChange(!on)} />;
}

export function Modal({ open, title, desc, children, onClose, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cx(s.modal, wide && s.modalWide)} role="dialog" aria-modal="true" aria-label={title}>
        {title && <div className={s.modalTitle}>{title}</div>}
        {desc && <p className={s.modalDesc}>{desc}</p>}
        {children}
      </div>
    </div>
  );
}

export function ModalActions({ children }) {
  return <div className={s.modalActions}>{children}</div>;
}

export function Empty({ mark = '·', children }) {
  return (
    <div className={s.empty}>
      <div className={s.emptyMark}>{mark}</div>
      {children}
    </div>
  );
}

export function Loading({ children = '불러오는 중이에요' }) {
  return <div className={s.spinner}>{children}</div>;
}

/* ── 토스트 ── */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((message, kind = 'info') => {
    const id = Math.random();
    setList((l) => [...l, { id, message, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className={s.toastWrap} aria-live="polite">
        {list.map((t) => <div key={t.id} className={cx(s.toast, t.kind === 'error' && s.toastError)}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
