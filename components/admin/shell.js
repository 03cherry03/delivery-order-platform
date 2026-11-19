'use client';
import Link from 'next/link';
import { usePathname,useRouter } from 'next/navigation';
import { createContext,useContext,useEffect,useState } from 'react';
import { L } from '@/lib/admin/labels';
import { getMe,getSummary,logout,USE_MOCK,notifyChanged } from '@/lib/admin/api';
import { loginUrl } from '@/lib/auth/session';
// 로그인 화면 주소. 실제 API면 통합 로그인(/login?next=지금 주소), 목업이면 관리자 로그인
const toLogin=()=>(USE_MOCK?'/admin/login':loginUrl());
import { resetAdminDemo } from '@/lib/admin/mock/server';
import { useLoad } from '@/lib/admin/hooks';
import { Button,Confirm,Loading,ErrorBox,cx } from './ui';
import { Icon } from './icons';
const MeContext=createContext(null);
export const useAdmin=()=>useContext(MeContext);
export const NAV=[
 {href:'/admin',name:'dashboard',icon:'dashboard'},
 {href:'/admin/applications',name:'applications',icon:'store',count:'pendingApplications'},
 {href:'/admin/reports',name:'reports',icon:'message',count:'pendingReports'},
 {href:'/admin/restrictions',name:'restrictions',icon:'shield',count:'activeRestrictions'},
 {href:'/admin/orders',name:'orders',icon:'order'},
 {href:'/admin/members',name:'members',icon:'users'},
];
export function Brand(){return <Link href="/admin" className="adm-brand"><span className="adm-brand-mark"><Icon name="bag" size={24}/></span><div><strong>{L.brand}</strong><small>{L.brandSub}</small></div></Link>;}
export default function AdminShell({children}){
 const pathname=usePathname(),router=useRouter(),isLogin=pathname==='/admin/login';
 const [me,setMe]=useState(null),[authError,setAuthError]=useState(null),[checking,setChecking]=useState(true),[mobile,setMobile]=useState(false),[reset,setReset]=useState(false),[leaving,setLeaving]=useState(false);
 const summary=useLoad(getSummary,[me?.memberId],{enabled:!!me&&!isLogin,poll:20000});
 useEffect(()=>{
  if(isLogin)return;
  let valid=true;
  getMe().then((u)=>{if(!valid)return;if(u?.role!=='ADMIN'){if(!USE_MOCK){router.replace(loginUrl());return;}setAuthError({message:L.noAccess,code:'FORBIDDEN'});setMe(null);}else{setMe(u);setAuthError(null);}setChecking(false);}).catch((e)=>{if(!valid)return;setChecking(false);if(e.status===401)router.replace(toLogin());else setAuthError(e);});
  const expired=()=>{setMe(null);router.replace(toLogin());};
  window.addEventListener('admin-session-expired',expired);
  return()=>{valid=false;window.removeEventListener('admin-session-expired',expired);};
 },[isLogin,router]);
 async function signOut(){setLeaving(true);try{await logout();setMe(null);router.replace('/admin/login');}catch(e){setAuthError(e);}finally{setLeaving(false);}}
 if(isLogin)return children;
 if(authError)return <div style={{maxWidth:640,margin:'15vh auto',padding:24}}><Brand/><ErrorBox error={authError} onRetry={()=>window.location.reload()}/><Button onClick={signOut} loading={leaving}>{L.logout}</Button></div>;
 if(checking||!me)return <Loading/>;
 const current=NAV.find((n)=>n.href==='/admin'?pathname==='/admin':pathname.startsWith(n.href))||NAV[0];
 return <MeContext.Provider value={me}><div className="adm-layout"><a className="adm-skip" href="#admin-main">{L.dashboard}</a>{mobile&&<button aria-label={L.close} className="adm-sidebar-overlay" onClick={()=>setMobile(false)}/>}<aside className={cx('adm-sidebar',mobile&&'is-open')}><Brand/><p className="adm-nav-section">{L.workspace}</p><nav className="adm-nav" aria-label={L.workspace}>{NAV.map((n,i)=><div key={n.href}>{i===4&&<p className="adm-nav-section" style={{marginTop:20}}>{L.support}</p>}<Link href={n.href} aria-current={current.href===n.href?'page':undefined} onClick={()=>setMobile(false)} className={cx('adm-nav-item',current.href===n.href&&'is-active')}><Icon name={n.icon}/><span>{L[n.name]}</span>{n.count&&summary.data?.[n.count]>0&&<span className="adm-nav-count">{summary.data[n.count]}</span>}</Link></div>)}</nav><div className="adm-sidebar-bottom"><div className="adm-mode-box"><strong><span className="adm-mode-dot"/>{USE_MOCK?L.demo:L.live}</strong>{USE_MOCK?L.demoShared:'Node.js + Next.js + SQLite'}</div><div className="adm-sidebar-links"><span className="adm-small">ADMIN WORKSPACE</span>{USE_MOCK&&<button className="adm-link-button" onClick={()=>setReset(true)}>{L.reset}</button>}</div></div></aside><div className="adm-workspace"><header className="adm-topbar"><div style={{display:'flex',alignItems:'center',gap:10}}><button className="adm-icon-btn adm-mobile-toggle" aria-label={L.workspace} onClick={()=>setMobile(true)}><Icon name="menu"/></button><div className="adm-breadcrumb"><span>{L.brandSub}</span><Icon name="chevron" size={12}/><b>{L[current.name]}</b></div></div><div className="adm-top-right"><span className="adm-chip"><span className="adm-mode-dot"/>{USE_MOCK?L.demo:L.live}</span><button className="adm-icon-btn" aria-label={L.refresh} onClick={notifyChanged}><Icon name="refresh" size={18}/></button><div className="adm-profile"><div className="adm-avatar">AD</div><div><strong>{me.name}</strong><small>Administrator</small></div></div><button className="adm-icon-btn" aria-label={L.logout} disabled={leaving} onClick={signOut}><Icon name="logout" size={18}/></button></div></header><main id="admin-main" className="adm-main">{children}</main></div></div><Confirm open={reset} title={L.resetConfirm} description={L.resetDesc} danger confirmLabel={L.reset} onClose={()=>setReset(false)} onConfirm={()=>{resetAdminDemo();setReset(false);setMe(null);router.replace('/admin/login');}}/></MeContext.Provider>;
}
