import { Suspense } from 'react';
import Screen from '@/components/admin/reports';
import { Loading } from '@/components/admin/ui';
export default function Page(){return <Suspense fallback={<Loading/>}><Screen/></Suspense>;}
