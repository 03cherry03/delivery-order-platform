'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function StoreHome() {
  const { storeId } = useParams();
  const router = useRouter();
  useEffect(() => { router.replace(`/owner/${storeId}/orders`); }, [router, storeId]);
  return null;
}
