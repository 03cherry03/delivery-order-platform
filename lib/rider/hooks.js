'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRiderMe, USE_MOCK } from './api';
import { loginUrl } from '@/lib/auth/session';

// 로그인 화면 주소. 실제 API면 통합 로그인(/login?next=지금 주소), 목업이면 라이더 로그인
const toLogin = () => (USE_MOCK ? '/rider/login' : loginUrl());

// D-02 내 라이더 정보 + 로그인 확인. 401(로그인 안 함)·403(라이더 아님)이면 로그인 화면으로 보낸다.
export function useRider() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const reload = useCallback(async () => {
    try {
      const d = await getRiderMe();
      setMe(d);
      return d;
    } catch (e) {
      if (e.status === 401 || e.status === 403) router.replace(toLogin());
      return null;
    }
  }, [router]);
  useEffect(() => {
    getRiderMe()
      .then(setMe)
      .catch((e) => (e.status === 401 || e.status === 403) && router.replace(toLogin()));
  }, [router]);
  return { me, reload, setMe };
}

// 데이터 불러오기 + 다시 불러오기. intervalMs를 주면 폴링한다. (사장 화면 lib/owner/hooks.js와 같은 방식)
export function useLoad(fn, deps = [], intervalMs) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState({ key: null, data: undefined, error: null });
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
      return undefined;
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
  // data: undefined = 아직 불러오는 중, null = 응답이 null (예: 진행 중 배달 없음)
  return { data: current ? state.data : undefined, error: current ? state.error : null, reload };
}

// 주기적으로 현재 시각 (남은 시간 표시용)
export function useNow(ms = 15000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
