'use client';

// 내 정보 = D-02 보기 + D-03 운송수단·활동 반경 수정 (배달 중이면 409 RIDER_BUSY) + A-02 로그아웃 + A-07 회원 탈퇴
// 이름·연락처·비밀번호 수정은 공통 내 정보(A-03 계열) 화면이 따로 맡는다
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { updateRiderMe, logout, withdraw, USE_MOCK } from '@/lib/rider/api';
import { resetMock } from '@/lib/rider/mock/server';
import { VEHICLE, VEHICLE_OPTIONS, RIDER_STATUS } from '@/lib/rider/codes';
import { Badge, Button, Card, Chips, Field, Modal, ModalActions, useToast } from '@/components/rider/ui';
import RadiusField from '@/components/rider/RadiusField';
import { useRiderCtx } from '@/components/rider/RiderShell';

export default function RiderMePage() {
  const router = useRouter();
  const toast = useToast();
  const { me, setMe, reload } = useRiderCtx();
  const [vehicleType, setVehicleType] = useState(me.vehicleType);
  const [actRadiusM, setActRadiusM] = useState(me.actRadiusM);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [askReset, setAskReset] = useState(false);
  const [leave, setLeave] = useState({ open: false, password: '', error: '', busy: false });
  const isBusy = me.riderStatus === 'BUSY';

  // 보낸 필드만 바뀐다 (명세서 D-03)
  const patch = {};
  if (vehicleType !== me.vehicleType) patch.vehicleType = vehicleType;
  if (actRadiusM !== me.actRadiusM) patch.actRadiusM = actRadiusM;
  const dirty = Object.keys(patch).length > 0;

  async function save() {
    setBusy(true);
    setErrors({});
    try {
      const next = await updateRiderMe(patch);
      setMe(next);
      toast('활동 정보를 저장했어요');
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      toast(err.message, 'error');
      if (err.code === 'RIDER_BUSY') reload();
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await logout().catch(() => {});
    router.replace(USE_MOCK ? '/rider/login' : '/login');
  }

  // A-07: 비밀번호 확인 → 성공하면 서버가 세션 쿠키를 지운다
  async function doWithdraw(e) {
    e.preventDefault();
    if (!leave.password) { setLeave((l) => ({ ...l, error: '비밀번호를 입력하세요.' })); return; }
    setLeave((l) => ({ ...l, busy: true, error: '' }));
    try {
      await withdraw(leave.password);
      toast('탈퇴했어요. 그동안 함께 달려 주셔서 고마워요');
      router.replace(USE_MOCK ? '/rider/login?withdrawn=1' : '/login?withdrawn=1');
    } catch (err) {
      // PASSWORD_MISMATCH, HAS_ACTIVE_ORDERS(배달 중) 등은 창 안에 그대로 보여 준다
      setLeave((l) => ({ ...l, busy: false, error: err.message }));
      if (err.code === 'HAS_ACTIVE_ORDERS') reload();
    }
  }
  const closeLeave = () => !leave.busy && setLeave({ open: false, password: '', error: '', busy: false });

  function doReset() {
    resetMock();
    setAskReset(false);
    toast('데모 데이터를 처음 상태로 돌렸어요');
    reload().then((m) => {
      if (m) { setVehicleType(m.vehicleType); setActRadiusM(m.actRadiusM); }
    });
  }

  return (
    <div className="rd-page">
      <div className="rd-pageHead"><h1>내 정보</h1></div>

      <Card>
        <div className="rd-profile">
          <div className="rd-avatar" aria-hidden="true">{me.name.slice(0, 1)}</div>
          <div>
            <p className="rd-profileName">{me.name}</p>
            <p className="rd-profileSub">{me.tel} · 회원번호 {me.memberId}</p>
          </div>
          <Badge tone={RIDER_STATUS[me.riderStatus].tone}>{RIDER_STATUS[me.riderStatus].label}</Badge>
        </div>
      </Card>

      <Card title="활동 정보">
        {isBusy && <p className="rd-notice">배달 중에는 바꿀 수 없어요. 배달을 마친 뒤 수정해 주세요.</p>}
        <div className="rd-form">
          <div className="rd-field">
            <span className="rd-label">운송수단</span>
            <Chips options={VEHICLE_OPTIONS.map((v) => ({ value: v, label: VEHICLE[v] }))} value={vehicleType} onChange={setVehicleType} disabled={isBusy} />
            {errors.vehicleType && <span className="rd-error">{errors.vehicleType}</span>}
          </div>
          <RadiusField value={actRadiusM} onChange={setActRadiusM} error={errors.actRadiusM} disabled={isBusy} />
          <Button size="md" full disabled={!dirty || busy || isBusy} onClick={save}>{busy ? '저장하는 중' : '저장'}</Button>
        </div>
      </Card>

      <Card>
        <Button variant="ghost" size="md" full onClick={doLogout}>로그아웃</Button>
        {USE_MOCK && (
          <Button variant="text" size="sm" full className="rd-resetBtn" onClick={() => setAskReset(true)}>목업 데이터 처음 상태로</Button>
        )}
      </Card>

      <div className="rd-leave">
        <button type="button" className="rd-leaveBtn" onClick={() => setLeave((l) => ({ ...l, open: true }))}>회원 탈퇴</button>
      </div>

      <Modal open={leave.open} title="정말 탈퇴할까요?" onClose={closeLeave}>
        <ul className="rd-leaveList">
          <li>탈퇴하면 이 계정으로 다시 로그인할 수 없어요.</li>
          <li>이름·연락처는 지워지고, 지난 배달 내역은 기록으로만 남아요.</li>
          <li>같은 이메일로 새로 가입할 수 있어요.</li>
          {isBusy && <li className="rd-leaveWarn">지금 배달 중이라 탈퇴할 수 없어요. 배달을 마친 뒤 다시 시도해 주세요.</li>}
        </ul>
        <form onSubmit={doWithdraw} className="rd-form">
          <Field label="비밀번호 확인" error={leave.error}>
            <input className="rd-input" type="password" autoComplete="current-password" value={leave.password}
              onChange={(e) => setLeave((l) => ({ ...l, password: e.target.value, error: '' }))} disabled={isBusy || leave.busy} />
          </Field>
          <ModalActions>
            <Button variant="ghost" size="md" onClick={closeLeave} disabled={leave.busy}>취소</Button>
            <Button type="submit" variant="danger" size="md" disabled={isBusy || leave.busy}>{leave.busy ? '처리하는 중' : '탈퇴하기'}</Button>
          </ModalActions>
        </form>
      </Modal>

      <Modal open={askReset} title="데모 데이터를 초기화할까요?" desc="배차·배달·내역이 처음 샘플 상태로 돌아가요. 로그인은 유지돼요." onClose={() => setAskReset(false)}>
        <ModalActions>
          <Button variant="ghost" size="md" onClick={() => setAskReset(false)}>취소</Button>
          <Button variant="danger" size="md" onClick={doReset}>초기화</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
