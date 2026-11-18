import { Suspense } from 'react';
import Screen from '@/components/admin/restrictions';
import { Loading } from '@/components/admin/ui';
export default function Page(){return <Suspense fallback={<Loading/>}><Screen/></Suspense>;}
