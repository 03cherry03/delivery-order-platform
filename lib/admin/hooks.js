'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
// Sequence guard prevents a slow response from replacing a more recent selection.
export function useLoad(fn,deps=[],{poll=0,enabled=true}={}){
 const key=JSON.stringify(deps),fnRef=useRef(fn),sequence=useRef(0),alive=useRef(false);
 const [state,setState]=useState({key:null,data:null,error:null,loading:true,updatedAt:null});
 useEffect(()=>{fnRef.current=fn;});
 const reload=useCallback(async()=>{
  if(!enabled)return null;
  const token=++sequence.current;
  setState((s)=>({...s,loading:!s.data,error:null}));
  try{const data=await fnRef.current();if(alive.current&&sequence.current===token)setState({key,data,error:null,loading:false,updatedAt:Date.now()});return data;}
  catch(error){if(alive.current&&sequence.current===token)setState((s)=>({...s,key,error,loading:false}));return null;}
 },[key,enabled]);
 useEffect(()=>{
  alive.current=true;
  if(enabled)reload();
  const refresh=()=>{if(!document.hidden)reload();};
  window.addEventListener('admin-data-changed',refresh);window.addEventListener('focus',refresh);
  const timer=enabled&&poll?setInterval(refresh,poll):null;
  return()=>{alive.current=false;++sequence.current;if(timer)clearInterval(timer);window.removeEventListener('admin-data-changed',refresh);window.removeEventListener('focus',refresh);};
 },[reload,poll,enabled]);
 return{data:state.key===key?state.data:null,error:state.key===key?state.error:null,loading:enabled&&(state.key!==key||state.loading),updatedAt:state.updatedAt,reload};
}
export function slicePage(data,page=1,size=10){
 if(data&&Array.isArray(data.items))return{items:data.items,totalCount:data.totalCount??data.items.length,page:data.page??page,size:data.size??size};
 const list=Array.isArray(data)?data:[];
 return{items:list.slice((page-1)*size,page*size),totalCount:list.length,page,size};
}
