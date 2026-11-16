'use client';

import { ACT_RADIUS_MIN, ACT_RADIUS_MAX } from '@/lib/rider/codes';

// 활동 반경 500~5000m, 500m 단위 슬라이더. 내 정보 화면에서도 쓴다
export default function RadiusField({ value, onChange, error, disabled }) {
  return (
    <div className="rd-field">
      <span className="rd-label rd-labelRow">
        활동 반경
        <span className="rd-radiusVal">{(Number(value) / 1000).toFixed(1)}km</span>
      </span>
      <input type="range" className="rd-range" min={ACT_RADIUS_MIN} max={ACT_RADIUS_MAX} step={500}
        value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-label="활동 반경(미터)" />
      <span className="rd-rangeScale" aria-hidden="true"><span>0.5km</span><span>5km</span></span>
      {error ? <span className="rd-error">{error}</span> : <span className="rd-hint">숭실대에서 이 거리 안에 있는 가게의 배차만 보여요</span>}
    </div>
  );
}
