export function Icon({name,size=20,...props}){
 const paths={
 dashboard:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
 store:<><path d="M3 9h18l-2-6H5L3 9ZM4 13v8h16v-8M9 21v-6h6v6"/><path d="M3 9v2a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9"/></>,
 message:<><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3H13a8 8 0 0 1 8 8.5Z"/><path d="M7 9h9M7 13h6"/></>,
 shield:<><path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
 order:<><rect x="5" y="3" width="14" height="19" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h6M9 19h3"/></>,
 users:<><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v2"/></>,
 search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,chevron:<path d="m9 5 7 7-7 7"/>,
 close:<path d="m6 6 12 12M6 18 18 6"/>,check:<path d="m5 12 4 4L19 6"/>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 3M18 18a8 8 0 0 1-13-3"/></>,
 logout:<><path d="M9 3H4v18h5M10 12h11m-4-4 4 4-4 4"/></>,
 info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></>,
 alert:<><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17v1"/></>,
 plus:<path d="M12 4v16M4 12h16"/>,menu:<path d="M4 6h16M4 12h16M4 18h16"/>,
 star:<path d="m12 2 3 6.5 7 1-5 5 1 7-6-3.5-6 3.5 1-7-5-5 7-1L12 2Z"/>,
 bag:<><path d="M4 7h16l1 14H3L4 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,
 external:<><path d="M14 3h7v7M21 3l-11 11M10 3H3v18h18v-7"/></>,
 bell:<><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4"/></>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]||paths.info}</svg>;
}
