'use client';

// 메뉴 관리: M-01 목록, M-05 삭제, M-06 품절·판매 재개, M-13 순서 저장, M-14~M-17 분류 관리
import Link from 'next/link';
import { useState } from 'react';
import {
  createCategory, deleteCategory, deleteMenu, getMenus, saveMenuOrder, setSaleStatus, updateCategory,
} from '@/lib/owner/api';
import { won } from '@/lib/owner/format';
import { useLoad } from '@/lib/owner/hooks';
import { useStore } from '@/lib/owner/store-context';
import {
  Badge, Button, Empty, Field, Loading, Modal, ModalActions, Switch, useToast,
} from '@/components/owner/ui';
import s from './menus.styles';

const move = (arr, i, d) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export default function MenusPage() {
  const { storeId, reloadStore } = useStore();
  const toast = useToast();
  const { data, reload, setData } = useLoad(() => getMenus(storeId), [storeId]);
  const [edited, setEdited] = useState(null); // 순서를 바꾼 사본 (저장 전)
  const [showCats, setShowCats] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const cats = edited ?? data;
  const dirty = edited !== null;
  const edit = (next) => setEdited(next);
  const setCats = (fn) => (edited ? setEdited(fn) : setData(fn(data)));

  async function toggleSale(menu) {
    const next = menu.saleStatus === 'ON_SALE' ? 'SOLD_OUT' : 'ON_SALE';
    try {
      await setSaleStatus(storeId, menu.menuId, next);
      setCats((cs) => cs.map((c) => ({ ...c, menus: c.menus.map((m) => (m.menuId === menu.menuId ? { ...m, saleStatus: next } : m)) })));
      toast(next === 'SOLD_OUT' ? `${menu.menuName} 품절 처리했어요` : `${menu.menuName} 다시 팔아요`);
      reloadStore();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function saveOrder() {
    const payload = {
      categories: cats.map((c, i) => ({ categoryId: c.categoryId, seq: i + 1 })),
      items: cats.flatMap((c) => c.menus.map((m, i) => ({ menuId: m.menuId, categoryId: c.categoryId, seq: i + 1 }))),
    };
    try {
      const fresh = await saveMenuOrder(storeId, payload);
      setData(fresh);
      setEdited(null);
      toast('순서를 저장했어요');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function confirmDelete() {
    try {
      await deleteMenu(storeId, toDelete.menuId);
      toast(`${toDelete.menuName}을(를) 삭제했어요`);
      setToDelete(null);
      setEdited(null);
      reload();
      reloadStore();
    } catch (e) { toast(e.message, 'error'); }
  }

  if (!cats) return <Loading />;
  const total = cats.reduce((n, c) => n + c.menus.length, 0);
  const soldOut = cats.reduce((n, c) => n + c.menus.filter((m) => m.saleStatus === 'SOLD_OUT').length, 0);

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <h1>메뉴 관리</h1>
          <p className="muted small">메뉴 {total}개 · 품절 {soldOut}개 · 분류 {cats.length}개</p>
        </div>
        <div className={s.headActions}>
          <Button variant="ghost" onClick={() => setShowCats(true)}>분류 관리</Button>
          <Link href={`/owner/${storeId}/menus/new`}><Button tabIndex={-1}>+ 메뉴 등록</Button></Link>
        </div>
      </div>

      {cats.length === 0 && (
        <Empty mark="+">먼저 메뉴 분류를 만들어 주세요 (예: 대표 메뉴, 사이드, 음료)</Empty>
      )}

      {cats.map((c, ci) => (
        <section key={c.categoryId} className={s.cat}>
          <div className={s.catHead}>
            <h2>{c.categoryName} <span className={s.catCount}>{c.menus.length}</span></h2>
            <div className={s.order}>
              <button type="button" aria-label="분류 위로" disabled={ci === 0} onClick={() => edit(move(cats, ci, -1))}>↑</button>
              <button type="button" aria-label="분류 아래로" disabled={ci === cats.length - 1} onClick={() => edit(move(cats, ci, 1))}>↓</button>
            </div>
          </div>
          {c.menus.length === 0 && <p className={s.none}>이 분류에 메뉴가 없어요</p>}
          {c.menus.map((m, mi) => (
            <div key={m.menuId} className={`${s.row} ${m.saleStatus === 'SOLD_OUT' ? s.soldOut : ''}`}>
              <div className={s.order}>
                <button type="button" aria-label="위로" disabled={mi === 0}
                  onClick={() => edit(cats.map((x, i) => (i === ci ? { ...x, menus: move(x.menus, mi, -1) } : x)))}>↑</button>
                <button type="button" aria-label="아래로" disabled={mi === c.menus.length - 1}
                  onClick={() => edit(cats.map((x, i) => (i === ci ? { ...x, menus: move(x.menus, mi, 1) } : x)))}>↓</button>
              </div>
              <Link href={`/owner/${storeId}/menus/${m.menuId}`} className={s.rowMain}>
                <div className={s.rowTop}>
                  <span className={s.menuName}>{m.menuName}</span>
                  {m.saleStatus === 'SOLD_OUT' && <Badge tone="red">품절</Badge>}
                  {m.optionGroupCount > 0 && <Badge tone="gray">옵션 {m.optionGroupCount}</Badge>}
                </div>
                {m.description && <p className={s.desc}>{m.description}</p>}
              </Link>
              <span className={`price ${s.menuPrice}`}>{won(m.price)}</span>
              <div className={s.sale}>
                <span className="small muted">{m.saleStatus === 'ON_SALE' ? '판매중' : '품절'}</span>
                <Switch on={m.saleStatus === 'ON_SALE'} label={`${m.menuName} 판매`} onChange={() => toggleSale(m)} />
              </div>
              <div className={s.rowActions}>
                <Link href={`/owner/${storeId}/menus/${m.menuId}`}><Button variant="text" size="sm" tabIndex={-1}>수정</Button></Link>
                <Button variant="text" size="sm" onClick={() => setToDelete(m)}>삭제</Button>
              </div>
            </div>
          ))}
        </section>
      ))}

      {dirty && (
        <div className={s.saveBar}>
          <span>순서를 바꿨어요</span>
          <div className={s.saveBtns}>
            <Button variant="text" size="sm" onClick={() => setEdited(null)}>되돌리기</Button>
            <Button variant="mint" size="sm" onClick={saveOrder}>순서 저장</Button>
          </div>
        </div>
      )}

      <Modal open={!!toDelete} title={toDelete ? `‘${toDelete.menuName}’ 메뉴를 삭제할까요?` : ''} desc="옵션도 함께 삭제돼요. 이미 들어온 주문에는 영향이 없어요." onClose={() => setToDelete(null)}>
        <ModalActions>
          <Button variant="ghost" size="md" onClick={() => setToDelete(null)}>취소</Button>
          <Button variant="danger" size="md" onClick={confirmDelete}>삭제</Button>
        </ModalActions>
      </Modal>

      {showCats && <CategoryModal storeId={storeId} cats={cats} onClose={() => setShowCats(false)} onChanged={() => { setEdited(null); reload(); }} />}
    </div>
  );
}

function CategoryModal({ storeId, cats, onClose, onChanged }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // { categoryId, name }
  const [toDelete, setToDelete] = useState(null);
  const notEmpty = '메뉴가 남아 있는 분류는 지울 수 없어요. 메뉴를 옮기거나 지운 뒤 다시 시도해 주세요.';

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createCategory(storeId, { categoryName: name.trim() });
      setName('');
      toast('분류를 추가했어요');
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function rename() {
    try {
      await updateCategory(storeId, editing.categoryId, { categoryName: editing.name.trim() });
      setEditing(null);
      toast('이름을 바꿨어요');
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function remove(c) {
    setToDelete(null);
    try {
      await deleteCategory(storeId, c.categoryId);
      toast(`${c.categoryName} 분류를 삭제했어요`);
      onChanged();
    } catch (err) { toast(err.code === 'CATEGORY_NOT_EMPTY' ? notEmpty : err.message, 'error'); }
  }

  if (toDelete) {
    return (
      <Modal open title={`‘${toDelete.categoryName}’ 분류를 삭제할까요?`} onClose={() => setToDelete(null)}>
        <ModalActions>
          <Button variant="ghost" size="md" autoFocus onClick={() => setToDelete(null)}>취소</Button>
          <Button variant="danger" size="md" onClick={() => remove(toDelete)}>삭제</Button>
        </ModalActions>
      </Modal>
    );
  }

  return (
    <Modal open wide title="메뉴 분류 관리" desc="손님 화면에 이 순서대로 보여요. 순서는 메뉴 관리 화면의 ↑↓로 바꿔요." onClose={onClose}>
      <div className={s.catList}>
        {cats.map((c) => (
          <div key={c.categoryId} className={s.catItem}>
            {editing?.categoryId === c.categoryId ? (
              <>
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={50} autoFocus />
                <Button size="sm" onClick={rename} disabled={!editing.name.trim()}>저장</Button>
                <Button variant="text" size="sm" onClick={() => setEditing(null)}>취소</Button>
              </>
            ) : (
              <>
                <span className={s.catItemName}>{c.categoryName}</span>
                <span className="small muted">메뉴 {c.menus.length}</span>
                <Button variant="text" size="sm" onClick={() => setEditing({ categoryId: c.categoryId, name: c.categoryName })}>이름 변경</Button>
                <Button variant="text" size="sm" onClick={() => (c.menus.length ? toast(notEmpty, 'error') : setToDelete(c))}>삭제</Button>
              </>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={add} className={s.catAdd}>
        <Field label="새 분류">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 세트 메뉴" maxLength={50} />
        </Field>
        <Button type="submit" disabled={!name.trim()}>추가</Button>
      </form>
      <ModalActions>
        <Button variant="ghost" size="md" onClick={onClose}>닫기</Button>
      </ModalActions>
    </Modal>
  );
}
