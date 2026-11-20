'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, USE_MOCK } from './api';
import { loginUrl } from '@/lib/auth/session';

// 로그인 화면 주소. 실제 API면 통합 로그인(/login?next=지금 주소), 목업이면 사장 로그인
const toLogin = () => (USE_MOCK ? '/owner/login' : loginUrl());

// A-03 로그인 확인. 401이면 로그인 화면으로 보낸다.
export function useMe() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  useEffect(() => {
    getMe()
      .then((u) => (u.role === 'OWNER' ? setMe(u) : router.replace(toLogin())))
      .catch(() => router.replace(toLogin()));
  }, [router]);
  return me;
}

// 데이터 불러오기 + 다시 불러오기. intervalMs를 주면 폴링한다.
// deps가 바뀌면 이전 결과는 보여주지 않는다 (불러오는 동안 null).
export function useLoad(fn, deps = [], intervalMs) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState({ key: null, data: null, error: null });
  const fnRef = useRef(fn);
  const keyRef = useRef(key);
  useEffect(() => {
    fnRef.current = fn;
    keyRef.current = key;
  });

  const reload = useCallback(async () => {
    const k = keyRef.current;
    try {
      const d = await fnRef.current();
      setState((s) => (keyRef.current === k ? { key: k, data: d, error: null } : s));
      return d;
    } catch (e) {
      setState((s) => (keyRef.current === k ? { ...s, key: k, error: e } : s));
      return null;
    }
  }, []);

  useEffect(() => {
    keyRef.current = key;
    fnRef.current = fn;
    reload();
    if (!intervalMs) return undefined;
    const t = setInterval(reload, intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs, reload]);

  const current = state.key === key;
  const setData = useCallback((d) => setState({ key: keyRef.current, data: d, error: null }), []);
  return { data: current ? state.data : null, error: current ? state.error : null, reload, setData };
}

// 1초마다 현재 시각 (남은 시간 표시용)
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
