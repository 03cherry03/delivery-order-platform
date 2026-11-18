'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { login,logout,USE_MOCK } from '@/lib/admin/api';
import { L } from '@/lib/admin/labels';
import { Button,Field,ErrorBox } from '@/components/admin/ui';
import { Icon } from '@/components/admin/icons';
import { Brand } from '@/components/admin/shell';
export default function LoginPage(){
 const router=useRouter();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(null);
 async function submit(event){event.preventDefault();if(busy)return;setBusy(true);setError(null);try{const user=await login(email.trim(),password);if(user.role!=='ADMIN'){await logout();setError({message:L.wrongRole});return;}router.replace('/admin/applications');}catch(e){setError(e);}finally{setBusy(false);}}
 return <div className="adm-login"><section className="adm-login-visual"><Brand/><h1>{L.loginTitle}</h1><p>{L.loginSub}</p><div className="adm-login-graphic"><span><Icon name="store" size={36}/></span><span><Icon name="shield" size={40}/></span><span><Icon name="message" size={36}/></span></div></section><div className="adm-login-form-wrap"><div className="adm-login-box"><p className="adm-eyebrow">ADMINISTRATOR</p><h2>{L.loginLabel}</h2><p className="adm-login-sub">{L.loginHint}</p><form onSubmit={submit}><Field label={L.email} required><input className="adm-input" type="email" required autoComplete="username" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="admin@example.com"/></Field><Field label={L.password} required><input className="adm-input" type="password" required autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)}/></Field>{error&&<ErrorBox error={error}/>}<Button type="submit" className="adm-btn-full" loading={busy}>{L.login}<Icon name="arrow" size={17}/></Button></form><p className="adm-login-foot">{L.noSignup}</p>{USE_MOCK&&<div className="adm-demo-login"><b>{L.demo}</b><div>admin@test.com / test1234</div><button className="adm-link-button" type="button" onClick={()=>{setEmail('admin@test.com');setPassword('test1234');}}>{L.demoFill}</button></div>}<p className="adm-login-foot">Delivery Order Platform</p></div></div></div>;
}
