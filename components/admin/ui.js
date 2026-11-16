'use client';
import { createContext,useCallback,useContext,useEffect,useId,useRef,useState } from 'react';
import { Icon } from './icons';
import { L } from '@/lib/admin/labels';
import { APPROVAL_STATUS,ORDER_STATUS,REPORT_STATUS } from '@/lib/admin/codes';
import { notifyChanged } from '@/lib/admin/api';
export const cx=(...a)=>a.filter(Boolean).join(' ');
export function Button({variant='primary',size,loading=false,children,className,...props}){return <button type="button" {...props} disabled={props.disabled||loading} aria-busy={loading||undefined} className={cx('adm-btn',`adm-btn-${variant}`,size&&`adm-btn-${size}`,className)}>{loading?<span className="adm-mini-spinner"/>:null}{children}</button>;}
export function Badge({tone='gray',children}){return <span className={`adm-badge adm-tone-${tone}`}><i/>{children}</span>;}
export function Status({type,value}){const map={approval:APPROVAL_STATUS,report:REPORT_STATUS,order:ORDER_STATUS}[type];const s=map?.[value];return <Badge tone={s?.tone||'gray'}>{s?.label||value||'-'}</Badge>;}
export function PageHeader({title,description,eyebrow,action}){return <div className="adm-page-header"><div>{eyebrow&&<p className="adm-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description&&<p className="adm-page-description">{description}</p>}</div>{action}</div>;}
export function Card({title,action,children,className}){return <section className={cx('adm-card',className)}>{title&&<div className="adm-card-head"><h2>{title}</h2>{action}</div>}{children}</section>;}
export function Loading(){return <div className="adm-state" role="status"><span className="adm-spinner"/><p>{L.loading}</p></div>;}
export function Empty({title=L.noResults,description=L.noResultsHint,icon='search',action}){return <div className="adm-state"><span className="adm-empty-icon"><Icon name={icon} size={28}/></span><h3>{title}</h3><p>{description}</p>{action}</div>;}
export function ErrorBox({error,onRetry}){return <div className="adm-error-box" role="alert"><Icon name="alert"/><div><strong>{error?.message||L.unexpected}</strong>{error?.code&&<small>{error.code}</small>}</div>{onRetry&&<Button variant="outline" size="sm" onClick={onRetry}>{L.retry}</Button>}</div>;}
export function Resource({resource,children}){if(resource.loading&&!resource.data)return <Loading/>;if(resource.error&&!resource.data)return <ErrorBox error={resource.error} onRetry={resource.reload}/>;return <>{resource.error&&<ErrorBox error={resource.error} onRetry={resource.reload}/>} {children(resource.data)}</>;}
export function Notice({children,tone='mint'}){return <div className={`adm-notice adm-notice-${tone}`}><Icon name="info" size={18}/><div>{children}</div></div>;}
export function Tabs({items,value,onChange}){return <div className="adm-tabs" role="tablist">{items.map((it)=><button key={it.value} type="button" role="tab" aria-selected={value===it.value} onClick={()=>onChange(it.value)} className={cx('adm-tab',value===it.value&&'is-active')}>{it.label}{it.count!==undefined&&<span>{it.count}</span>}</button>)}</div>;}
export function Field({label,required,hint,error,children}){return <label className="adm-field"><span>{label}{required&&<b aria-label={L.required}> *</b>}</span>{children}{error?<small className="adm-field-error">{error}</small>:hint?<small className="adm-hint">{hint}</small>:null}</label>;}
export function KeyValues({items}){return <dl className="adm-keyvalues">{items.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value===null||value===undefined||value===''?'-':value}</dd></div>)}</dl>;}
export function Pagination({page,size,totalCount,onChange}){const pages=Math.max(1,Math.ceil(totalCount/size));return <div className="adm-pagination"><span>{L.total} <b>{totalCount}</b>{L.count}</span><div><Button variant="ghost" size="sm" disabled={page<=1} onClick={()=>onChange(page-1)}>{L.previous}</Button><span className="adm-page-count">{page} / {pages}</span><Button variant="ghost" size="sm" disabled={page>=pages} onClick={()=>onChange(page+1)}>{L.next}</Button></div></div>;}
export function Modal({open,title,description,children,onClose,sheet=false,busy=false}){
 const id=useId(),ref=useRef(null),onCloseRef=useRef(onClose);useEffect(()=>{onCloseRef.current=onClose;});
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';ref.current?.focus();
  const key=(event)=>{
   const dialogs=[...document.querySelectorAll('[data-admin-dialog]')];if(dialogs.at(-1)!==ref.current)return;
   if(event.key==='Escape'&&!busy){event.preventDefault();onCloseRef.current?.();}
   if(event.key==='Tab'){
    const elements=[...ref.current.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]')].filter((el)=>el.getClientRects().length);
    if(!elements.length){event.preventDefault();return;}
    const first=elements[0],last=elements.at(-1);
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){event.preventDefault();first.focus();}
   }
  };document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
 },[open,busy]);
 if(!open)return null;
 return <div className={cx('adm-dialog-backdrop',sheet&&'is-sheet')} onMouseDown={(e)=>{if(e.target===e.currentTarget&&!busy)onClose?.();}}><div className={cx('adm-dialog',sheet&&'adm-sheet')} ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} data-admin-dialog><div className="adm-dialog-head"><div><h2 id={id}>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" className="adm-icon-btn" aria-label={L.close} disabled={busy} onClick={onClose}><Icon name="close"/></button></div><div className="adm-dialog-content">{children}</div></div></div>;
}
export function Confirm({open,title,description,confirmLabel=L.confirm,danger=false,onConfirm,onClose,busy}){return <Modal open={open} title={title} onClose={onClose} busy={busy}><p className="adm-confirm-description">{description}</p><div className="adm-dialog-actions"><Button variant="outline" disabled={busy} onClick={onClose}>{L.cancel}</Button><Button variant={danger?'danger':'primary'} loading={busy} onClick={onConfirm}>{confirmLabel}</Button></div></Modal>;}
const ToastContext=createContext(()=>{});
export function ToastProvider({children}){
 const [items,setItems]=useState([]);const timers=useRef([]),seq=useRef(0);
 const push=useCallback((message,kind='success')=>{const id=++seq.current;setItems((a)=>[...a,{id,message,kind}]);timers.current.push(setTimeout(()=>setItems((a)=>a.filter((i)=>i.id!==id)),4500));},[]);
 useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
 return <ToastContext.Provider value={push}>{children}<div className="adm-toast-stack" aria-live="polite">{items.map((t)=><div key={t.id} className={cx('adm-toast',t.kind==='error'&&'adm-toast-error')}><Icon name={t.kind==='error'?'alert':'check'}/>{t.message}<button className="adm-icon-btn" aria-label={L.close} onClick={()=>setItems((a)=>a.filter((i)=>i.id!==t.id))}><Icon name="close" size={16}/></button></div>)}</div></ToastContext.Provider>;
}
export const useToast=()=>useContext(ToastContext);
export function useAction(){const toast=useToast(),lock=useRef(false);const [busy,setBusy]=useState(false),[error,setError]=useState(null);const run=async(fn)=>{if(lock.current)return false;lock.current=true;setBusy(true);setError(null);try{await fn();notifyChanged();toast(L.saved);return true;}catch(e){setError(e);toast(e.message,'error');if(e.status===409)notifyChanged();return false;}finally{lock.current=false;setBusy(false);}};return{run,busy,error};}
