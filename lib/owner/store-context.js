'use client';

import { createContext, useContext } from 'react';

// 선택한 가게 정보 (S-01 응답) — app/owner/[storeId]/layout.js 에서 넣어 준다
export const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);
