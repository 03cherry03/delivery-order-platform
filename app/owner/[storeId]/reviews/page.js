'use client';

// 리뷰: R-01 목록, R-02~R-04 답글, R-05 신고, R-06 내 신고 목록
import { useState } from 'react';
import {
  createReply, deleteReply, getMyReports, getReviews, reportReview, updateReply,
} from '@/lib/owner/api';
import { REPORT_REASON, REPORT_STATUS } from '@/lib/owner/codes';
import { mdhm, stars, ymd } from '@/lib/owner/format';
import { useLoad } from '@/lib/owner/hooks';
import { useStore } from '@/lib/owner/store-context';
import {
  Badge, Button, Chips, Empty, Field, Loading, Modal, ModalActions, Switch, Tabs, useToast,
} from '@/components/owner/ui';
import s from './reviews.styles';

export default function ReviewsPage() {
  const { storeId, reloadStore } = useStore();
  const [tab, setTab] = useState('reviews');
  const [noReply, setNoReply] = useState(false);
  const [page, setPage] = useState(1);
  const [reportTarget, setReportTarget] = useState(null);

  const { data, reload } = useLoad(() => getReviews(storeId, { noReply: noReply || undefined, page, size: 10 }), [storeId, noReply, page]);
  // R-06은 페이지 없이 배열로 온다 (백엔드 문서 server/docs/api/owner.md)
  const { data: reports, reload: reloadReports } = useLoad(() => (tab === 'reports' ? getMyReports(storeId) : null), [storeId, tab]);

  const after = () => { reload(); reloadStore(); };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1>리뷰</h1>
        {data && (
          <div className={s.summary}>
            <span className={s.bigRating}>{data.avgRating ?? '-'}</span>
            <div>
              <div className={s.stars}>{stars(data.avgRating)}</div>
              <div className="small muted">숨김 처리된 리뷰를 뺀 {data.reviewCount}개 기준</div>
            </div>
          </div>
        )}
      </div>

      <div className={s.toolbar}>
        <Tabs items={[{ value: 'reviews', label: '받은 리뷰' }, { value: 'reports', label: '내 신고' }]} value={tab} onChange={setTab} />
        {tab === 'reviews' && (
          <label className={s.filter}>
            <span className="small">답글 없는 리뷰만</span>
            <Switch on={noReply} label="답글 없는 리뷰만" onChange={(v) => { setNoReply(v); setPage(1); }} />
          </label>
        )}
      </div>

      {tab === 'reviews' && (
        <>
          {!data && <Loading />}
          {data && data.items.length === 0 && <Empty mark="★">{noReply ? '답글을 기다리는 리뷰가 없어요' : '아직 받은 리뷰가 없어요'}</Empty>}
          <div className={s.list}>
            {data?.items.map((r) => (
              <ReviewCard key={r.reviewId} r={r} storeId={storeId} onChanged={after} onReport={() => setReportTarget(r)} />
            ))}
          </div>
          {data && data.totalCount > data.size && (
            <div className={s.pager}>
              <Button variant="text" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ 이전</Button>
              <span className="small muted num">{page} / {Math.ceil(data.totalCount / data.size)}</span>
              <Button variant="text" size="sm" disabled={page * data.size >= data.totalCount} onClick={() => setPage(page + 1)}>다음 ›</Button>
            </div>
          )}
        </>
      )}

      {tab === 'reports' && (
        <>
          {!reports && <Loading />}
          {reports && reports.length === 0 && <Empty>신고한 리뷰가 없어요</Empty>}
          <div className={s.list}>
            {reports?.map((p) => (
              <div key={p.reportId} className={s.card}>
                <div className={s.cardTop}>
                  <Badge tone={REPORT_STATUS[p.status].tone}>{REPORT_STATUS[p.status].label}</Badge>
                  <span className="small muted">{REPORT_REASON[p.reason]} · {mdhm(p.reportedAt)} 신고</span>
                </div>
                <p className={s.quote}>{p.reviewContent || '(내용 없는 리뷰)'}</p>
                {p.status !== 'PENDING' && (
                  <p className="small muted">관리자 처리 {mdhm(p.processedAt)}{p.processNote && ` · ${p.processNote}`}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {reportTarget && (
        <ReportModal review={reportTarget} onClose={() => setReportTarget(null)}
          onSubmit={async (body) => {
            await reportReview(storeId, reportTarget.reviewId, body);
            setReportTarget(null);
            reload();
            reloadReports();
          }} />
      )}
    </div>
  );
}

function ReviewCard({ r, storeId, onChanged, onReport }) {
  const toast = useToast();
  const [mode, setMode] = useState(null); // 'write' | 'edit'
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function act(fn, msg) {
    setBusy(true);
    try { await fn(); toast(msg); setMode(null); onChanged(); } catch (e) {
      if (e.code === 'REPLY_EXISTS') { toast('이미 답글이 있어요. 수정으로 바꿔 주세요.', 'error'); onChanged(); } else toast(e.message, 'error');
    } finally { setBusy(false); }
  }

  return (
    <article className={`${s.card} ${r.hidden ? s.hidden : ''}`}>
      <div className={s.cardTop}>
        <b>{r.writerName}</b>
        <span className={s.starsSm}>{stars(r.rating)}</span>
        <span className="small muted">{ymd(r.createdAt)}</span>
        {r.hidden && <Badge tone="gray">숨김 처리됨</Badge>}
        {r.report && <Badge tone={REPORT_STATUS[r.report.status].tone}>신고 {REPORT_STATUS[r.report.status].label}</Badge>}
        {!r.hidden && !r.report && <button type="button" className={s.reportBtn} onClick={onReport}>신고</button>}
      </div>
      <p className={s.menus}>{r.orderedMenus}</p>
      {r.content ? <p className={s.content}>{r.content}</p> : <p className="muted small">별점만 남긴 리뷰예요</p>}
      {r.hidden && <p className="caption">숨김 리뷰는 손님에게 보이지 않고 평균 별점에서도 빠져요. 답글과 신고는 할 수 없어요.</p>}

      {r.reply && mode !== 'edit' && (
        <div className={s.reply}>
          <div className={s.replyHead}>
            <b>사장님 답글</b>
            <span className="small muted">{mdhm(r.reply.createdAt)}</span>
            {!r.hidden && (
              <span className={s.replyActions}>
                <Button variant="text" size="sm" onClick={() => { setText(r.reply.content); setMode('edit'); }}>수정</Button>
                <Button variant="text" size="sm" disabled={busy} onClick={() => act(() => deleteReply(storeId, r.reviewId), '답글을 삭제했어요')}>삭제</Button>
              </span>
            )}
          </div>
          <p>{r.reply.content}</p>
        </div>
      )}

      {!r.hidden && !r.reply && mode !== 'write' && (
        <Button variant="ghost" size="sm" onClick={() => { setText(''); setMode('write'); }}>답글 달기</Button>
      )}

      {mode && (
        <div className={s.replyForm}>
          <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="손님에게 감사 인사를 남겨 보세요" autoFocus />
          <div className={s.replyFormFoot}>
            <span className="caption num">{text.length} / 1000</span>
            <div>
              <Button variant="text" size="sm" onClick={() => setMode(null)}>취소</Button>
              <Button size="sm" disabled={busy || !text.trim()}
                onClick={() => act(() => (mode === 'write' ? createReply(storeId, r.reviewId, text) : updateReply(storeId, r.reviewId, text)), mode === 'write' ? '답글을 달았어요' : '답글을 고쳤어요')}>
                {mode === 'write' ? '등록' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function ReportModal({ review, onSubmit, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('ABUSE');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try { await onSubmit({ reason, content }); toast('신고했어요. 관리자가 확인한 뒤 결과를 알려드려요'); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Modal open title="리뷰 신고" desc="신고만으로 리뷰가 숨겨지지는 않아요. 관리자가 확인한 뒤 숨김 여부를 정해요." onClose={onClose}>
      <p className={s.quote}>{review.content || '(별점만 남긴 리뷰)'}</p>
      <div className={s.modalForm}>
        <Field label="사유">
          <Chips options={Object.entries(REPORT_REASON).map(([v, l]) => ({ value: v, label: l }))} value={reason} onChange={setReason} />
        </Field>
        <Field label="신고 내용" required hint="최대 300자">
          <textarea className="textarea" value={content} onChange={(e) => setContent(e.target.value)} maxLength={300} placeholder="어떤 점이 문제인지 적어 주세요" />
        </Field>
      </div>
      <ModalActions>
        <Button variant="ghost" size="md" onClick={onClose}>취소</Button>
        <Button variant="danger" size="md" disabled={busy || !content.trim()} onClick={submit}>신고하기</Button>
      </ModalActions>
    </Modal>
  );
}
