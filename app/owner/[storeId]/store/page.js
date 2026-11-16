'use client';

// 가게 정보: S-01 조회, S-02 운영 정보 수정, S-04 영업시간 저장 (영업 상태 S-03은 위쪽 막대에 있음)
import { useState } from 'react';
import { saveHours, updateStore } from '@/lib/owner/api';
import { APPROVAL_STATUS, DAY_NAMES, STORE_CATEGORY } from '@/lib/owner/codes';
import { fromServerHours, toServerHours } from '@/lib/owner/hours';
import { won } from '@/lib/owner/format';
import { useStore } from '@/lib/owner/store-context';
import HoursEditor from '@/components/owner/HoursEditor';
import { Badge, Button, Card, Field, useToast } from '@/components/owner/ui';
import s from './store.styles';

export default function StorePage() {
  const { storeId, store, reloadStore } = useStore();
  const toast = useToast();
  // 고치는 중인 값. null이면 서버 값(S-01)을 보여준다
  const [opsDraft, setOps] = useState(null);
  const [weekDraft, setWeek] = useState(null);
  const [errors, setErrors] = useState({});
  const [hoursError, setHoursError] = useState('');

  const ops = opsDraft ?? {
    minOrderAmount: String(store.minOrderAmount), deliveryTip: String(store.deliveryTip),
    cookMinutes: String(store.cookMinutes), telNo: store.telNo, description: store.description || '',
  };
  const week = weekDraft ?? fromServerHours(store.hours);

  async function saveOps(e) {
    e.preventDefault();
    setErrors({});
    // 바뀐 필드만 보낸다 (PATCH)
    const patch = {};
    if (Number(ops.minOrderAmount) !== store.minOrderAmount) patch.minOrderAmount = Number(ops.minOrderAmount);
    if (Number(ops.deliveryTip) !== store.deliveryTip) patch.deliveryTip = Number(ops.deliveryTip);
    if (Number(ops.cookMinutes) !== store.cookMinutes) patch.cookMinutes = Number(ops.cookMinutes);
    if (ops.telNo !== store.telNo) patch.telNo = ops.telNo;
    if (ops.description !== (store.description || '')) patch.description = ops.description;
    if (!Object.keys(patch).length) { toast('바뀐 내용이 없어요'); return; }
    try {
      await updateStore(storeId, patch);
      toast('운영 정보를 저장했어요. 이미 들어온 주문에는 영향이 없어요');
      await reloadStore();
      setOps(null);
    } catch (err) {
      setErrors(err.fields || {});
      toast(err.message, 'error');
    }
  }

  async function onSaveHours() {
    setHoursError('');
    const r = toServerHours(week);
    if (r.error) { setHoursError(r.error); return; }
    try {
      await saveHours(storeId, r.hours);
      toast('영업시간을 저장했어요');
      await reloadStore();
      setWeek(null);
    } catch (err) {
      setHoursError(err.message);
    }
  }

  if (!ops || !week) return null;
  const set = (k) => (e) => setOps({ ...ops, [k]: e.target.value });

  return (
    <div className={s.page}>
      <h1>가게 정보</h1>

      <div className={s.stats}>
        <div className={s.stat}><span className={s.statLabel}>평균 별점</span><span className={s.statValue}>{store.avgRating ?? '-'}<small> / 5</small></span></div>
        <div className={s.stat}><span className={s.statLabel}>리뷰</span><span className={s.statValue}>{store.reviewCount}<small>개</small></span></div>
        <div className={s.stat}><span className={s.statLabel}>판매중 메뉴</span><span className={s.statValue}>{store.onSaleMenuCount}<small>개</small></span></div>
        <div className={s.stat}><span className={s.statLabel}>휴무일</span><span className={s.statValue}>{store.closedDays.length ? store.closedDays.map((d) => DAY_NAMES[d]).join('·') : '없음'}</span></div>
      </div>

      <div className={s.grid}>
        <Card title="입점 정보" action={<Badge tone={APPROVAL_STATUS[store.approvalStatus].tone}>{APPROVAL_STATUS[store.approvalStatus].label}</Badge>}>
          <dl className={s.dl}>
            <dt>가게명</dt><dd>{store.storeName}</dd>
            <dt>카테고리</dt><dd>{STORE_CATEGORY[store.categoryCode] || store.categoryCode}</dd>
            <dt>사업자번호</dt><dd className="num">{store.bizNo}</dd>
            <dt>주소</dt><dd>{store.address} {store.addressDetail}</dd>
            <dt>좌표</dt><dd className="num">{store.lat}, {store.lng}</dd>
          </dl>
          <p className="caption" style={{ marginTop: 12 }}>입점 승인 정보라 여기서는 바꿀 수 없어요.</p>
        </Card>

        <Card title="운영 정보">
          <form className={s.form} onSubmit={saveOps}>
            <div className={s.two}>
              <Field label="최소주문금액(원)" error={errors.minOrderAmount} hint={`지금 ${won(store.minOrderAmount)}`}>
                <input className="input num" type="number" min="0" step="500" value={ops.minOrderAmount} onChange={set('minOrderAmount')} />
              </Field>
              <Field label="배달팁(원)" error={errors.deliveryTip} hint={`지금 ${won(store.deliveryTip)}`}>
                <input className="input num" type="number" min="0" step="500" value={ops.deliveryTip} onChange={set('deliveryTip')} />
              </Field>
              <Field label="기본 조리시간(분)" error={errors.cookMinutes} hint="주문 접수할 때 기본값">
                <input className="input num" type="number" min="1" value={ops.cookMinutes} onChange={set('cookMinutes')} />
              </Field>
              <Field label="가게 전화번호" error={errors.telNo}>
                <input className="input" value={ops.telNo} onChange={set('telNo')} />
              </Field>
            </div>
            <Field label="가게 소개" error={errors.description}>
              <textarea className="textarea" value={ops.description} onChange={set('description')} maxLength={300} />
            </Field>
            <div className={s.actions}><Button type="submit" size="md">저장</Button></div>
          </form>
        </Card>
      </div>

      <Card title="영업시간" action={<Button size="sm" onClick={onSaveHours}>영업시간 저장</Button>}>
        {hoursError && <div className={s.error}>{hoursError}</div>}
        <HoursEditor value={week} onChange={setWeek} />
      </Card>
    </div>
  );
}
