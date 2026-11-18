'use client';

// 가게 입점 정보 입력 — A-05(가게 추가·재신청)와 A-06(회원가입)의 store 객체가 같은 필드를 쓴다.
import { STORE_CATEGORY } from '@/lib/owner/codes';
import { emptyWeek, fromServerHours, toServerHours } from '@/lib/owner/hours';
import HoursEditor from './HoursEditor';
import { Field } from './ui';
import s from '@/app/owner/auth.styles';

export function initialStore(from) {
  if (!from) {
    return {
      storeName: '', categoryCode: '', bizNo: '', telNo: '', address: '', addressDetail: '', lat: '', lng: '',
      minOrderAmount: '15000', deliveryTip: '3000', cookMinutes: '20', description: '', week: emptyWeek(),
    };
  }
  return {
    storeName: from.storeName, categoryCode: from.categoryCode, bizNo: from.bizNo, telNo: from.telNo,
    address: from.address, addressDetail: from.addressDetail || '', lat: String(from.lat), lng: String(from.lng),
    minOrderAmount: String(from.minOrderAmount), deliveryTip: String(from.deliveryTip), cookMinutes: String(from.cookMinutes),
    description: from.description || '',
    // 영업시간이 하나도 없으면(예: 시연 데이터의 반려 가게) 기본 영업시간을 채워 둔다
    week: from.hours?.length ? fromServerHours(from.hours) : emptyWeek(),
  };
}

// 화면 값 → 요청 본문. 영업시간 오류는 { error }
export function storeBody(v) {
  const h = toServerHours(v.week);
  if (h.error) return { error: h.error };
  const body = {
    storeName: v.storeName, categoryCode: v.categoryCode, bizNo: v.bizNo, telNo: v.telNo,
    address: v.address, lat: Number(v.lat), lng: Number(v.lng),
    minOrderAmount: Number(v.minOrderAmount), deliveryTip: Number(v.deliveryTip), cookMinutes: Number(v.cookMinutes),
    hours: h.hours,
  };
  // 선택 항목은 비어 있으면 아예 보내지 않는다 (API 문서: 생략 시 NULL, null을 보내면 400)
  if (v.addressDetail.trim()) body.addressDetail = v.addressDetail;
  if (v.description.trim()) body.description = v.description;
  return { body };
}

export default function StoreForm({ value, onChange, errors = {} }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const err = (k) => errors[k] || errors[`store.${k}`];
  return (
    <>
      <div className={s.form}>
        <div className={s.grid2}>
          <Field label="가게명" required error={err('storeName')}>
            <input className="input" value={value.storeName} onChange={set('storeName')} maxLength={50} />
          </Field>
          <Field label="카테고리" required error={err('categoryCode')} hint="코드값은 아직 확정 전이에요">
            <select className="select" value={value.categoryCode} onChange={set('categoryCode')}>
              <option value="">선택해 주세요</option>
              {Object.entries(STORE_CATEGORY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="사업자번호" required error={err('bizNo')} hint="000-00-00000">
            <input className="input" value={value.bizNo} onChange={set('bizNo')} placeholder="123-45-67890" />
          </Field>
          <Field label="가게 전화번호" required error={err('telNo')}>
            <input className="input" value={value.telNo} onChange={set('telNo')} placeholder="02-123-4567" />
          </Field>
        </div>
        <Field label="가게 주소" required error={err('address')}>
          <input className="input" value={value.address} onChange={set('address')} placeholder="서울 서대문구 연세로 50" />
        </Field>
        <div className={s.grid2}>
          <Field label="상세 주소">
            <input className="input" value={value.addressDetail} onChange={set('addressDetail')} placeholder="1층" />
          </Field>
          <div className={s.grid2}>
            <Field label="위도" required error={err('lat')}>
              <input className="input num" inputMode="decimal" value={value.lat} onChange={set('lat')} placeholder="37.5596" />
            </Field>
            <Field label="경도" required error={err('lng')}>
              <input className="input num" inputMode="decimal" value={value.lng} onChange={set('lng')} placeholder="126.9370" />
            </Field>
          </div>
        </div>
        <p className="caption">시연 데이터라 위도·경도는 직접 입력해요. 가게명·사업자번호·주소·카테고리는 승인 후 바꿀 수 없어요.</p>
      </div>

      <div className={s.section}>
        <div className={s.sectionTitle}>운영 정보</div>
        <div className={s.form}>
          <div className={s.grid2}>
            <Field label="최소주문금액(원)" required error={err('minOrderAmount')}>
              <input className="input num" type="number" min="0" step="500" value={value.minOrderAmount} onChange={set('minOrderAmount')} />
            </Field>
            <Field label="배달팁(원)" required error={err('deliveryTip')}>
              <input className="input num" type="number" min="0" step="500" value={value.deliveryTip} onChange={set('deliveryTip')} />
            </Field>
            <Field label="기본 조리시간(분)" required error={err('cookMinutes')} hint="주문 접수할 때 기본값으로 채워져요">
              <input className="input num" type="number" min="1" value={value.cookMinutes} onChange={set('cookMinutes')} />
            </Field>
          </div>
          <Field label="가게 소개">
            <textarea className="textarea" value={value.description} onChange={set('description')} maxLength={300} placeholder="손님에게 보여줄 한 줄 소개" />
          </Field>
        </div>
      </div>

      <div className={s.section}>
        <div className={s.sectionTitle}>영업시간</div>
        <HoursEditor value={value.week} onChange={(week) => onChange({ ...value, week })} />
      </div>
    </>
  );
}
