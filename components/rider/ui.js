'use client';

// 라이더 화면 공통 UI. 사장 화면(components/owner/ui.js)과 같은 부품, 같은 모양이고
// 클래스 이름만 rd- 로 바꿔서 서로 영향을 주지 않는다. 스타일은 app/rider/rider.css
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const cx = (...a) => a.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size, full, className, ...props }) {
  return <button type="button" className={cx('rd-btn', `rd-btn-${variant}`, size && `rd-btn-${size}`, full && 'rd-full', className)} {...props} />;
}

export function Badge({ tone = 'gray', children }) {
  return <span className={cx('rd-badge', `rd-tone-${tone}`)}>{children}</span>;
}

export function Card({ title, action, children, className }) {
  return (
    <section className={cx('rd-card', className)}>
      {(title || action) && (
        <div className="rd-cardHead">
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
    <label className="rd-field">
      {label && <span className="rd-label">{label}{required && <span className="rd-reqMark">*</span>}</span>}
      {children}
      {error ? <span className="rd-error">{error}</span> : hint ? <span className="rd-hint">{hint}</span> : null}
    </label>
  );
}

export function Chips({ options, value, onChange, disabled }) {
  return (
    <div className="rd-chips">
      {options.map((o) => (
        <button key={o.value} type="button" disabled={disabled} aria-pressed={value === o.value}
          className={cx('rd-chip', value === o.value && 'rd-chipOn')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, title, desc, children, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="rd-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="rd-modal" role="dialog" aria-modal="true" aria-label={title}>
        {title && <div className="rd-modalTitle">{title}</div>}
        {desc && <p className="rd-modalDesc">{desc}</p>}
        {children}
      </div>
    </div>
  );
}

export function ModalActions({ children }) {
  return <div className="rd-modalActions">{children}</div>;
}

export function Empty({ mark = '·', title, children }) {
  return (
    <div className="rd-empty">
      <div className="rd-emptyMark" aria-hidden="true">{mark}</div>
      {title && <p className="rd-emptyTitle">{title}</p>}
      {children}
    </div>
  );
}

export function Loading({ children = '불러오는 중이에요' }) {
  return <div className="rd-loading">{children}</div>;
}

// 불러오기 실패 표시 + 다시 시도
export function LoadError({ error, onRetry }) {
  return (
    <div className="rd-loadError">
      <p>{error?.message || '정보를 불러오지 못했어요.'}</p>
      {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>다시 시도</Button>}
    </div>
  );
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
      <div className="rd-toastWrap" aria-live="polite">
        {list.map((t) => <div key={t.id} className={cx('rd-toast', t.kind === 'error' && 'rd-toastError')}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
