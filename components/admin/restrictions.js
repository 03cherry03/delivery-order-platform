'use client';
import Link from 'next/link';
import { useState } from 'react';
import { L } from '@/lib/admin/labels';
import * as api from '@/lib/admin/api';
import { useLoad,slicePage } from '@/lib/admin/hooks';
import { asList,dateTime,isActiveRestriction } from '@/lib/admin/format';
import { Icon } from './icons';
import { Button,Badge,PageHeader,Card,Resource,Tabs,Empty,Confirm,Notice,Pagination,useAction } from './ui';
export default function Restrictions(){
 const [filter,setFilter]=useState('active'),[page,setPage]=useState(1),[selected,setSelected]=useState(null),action=useAction();
 // The specification defines active=true only. Omit active to get all history;
 // the released tab filters that history locally rather than assuming active=false semantics.
 const resource=useLoad(()=>api.getRestrictions(filter==='active'?{active:true}:{}),[filter]);
 const data=asList(resource.data).filter((r)=>filter==='released'?!isActiveRestriction(r):filter==='active'?isActiveRestriction(r):true),paged=slicePage(data,page,8);
 async function release(){const success=await action.run(()=>api.releaseRestriction(selected.restrictionId));if(success)setSelected(null);}
 return <><PageHeader title={L.restrictions} description={L.restrictionDesc} action={<Link href="/admin/members" className="adm-btn adm-btn-primary"><Icon name="plus" size={16}/>{L.addRestriction}</Link>}/><Notice>{L.restrictDesc}</Notice><Card><Tabs value={filter} onChange={(v)=>{setFilter(v);setPage(1);}} items={[{value:'active',label:L.active},{value:'released',label:L.released},{value:'all',label:L.all}]}/><Resource resource={resource}>{()=>data.length?<><div className="adm-table-scroll"><table className="adm-table"><thead><tr>{[L.member,L.restrictReason,L.startedAt,L.endedAt,L.status,L.action].map((x)=><th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{paged.items.map((r)=>{const active=isActiveRestriction(r);return <tr key={r.restrictionId}><td><div className="adm-member-row"><span className="adm-member-avatar">{r.memberName?.slice(0,1)||'M'}</span><div><strong>{r.memberName}</strong><small>{r.email}</small></div></div></td><td><span className="adm-preview-text">{r.reason}</span>{r.reportId&&<small>{L.report} #{r.reportId}</small>}</td><td>{dateTime(r.startedAt)}</td><td>{dateTime(r.endedAt)}</td><td><Badge tone={active?'red':'gray'}>{active?L.active:L.released}</Badge></td><td><Button variant="outline" size="sm" disabled={!active} onClick={()=>setSelected(r)}>{L.release}</Button></td></tr>;})}</tbody></table></div><Pagination {...paged} onChange={setPage}/></>:<Empty icon="shield"/>}</Resource></Card><Confirm open={!!selected} title={L.releaseConfirm} description={`${selected?.memberName||''} - ${L.releaseDesc}`} confirmLabel={L.release} busy={action.busy} onClose={()=>setSelected(null)} onConfirm={release}/></>;
}
