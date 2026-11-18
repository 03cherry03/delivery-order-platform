'use client';

// 메뉴 등록·수정 + 옵션 관리
// M-02 상세, M-03 등록, M-04 수정, M-07~M-09 옵션 그룹, M-10~M-12 옵션, M-14 분류 목록
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  createMenu, createOption, createOptionGroup, deleteOption, deleteOptionGroup, getCategories, getMenu,
  updateMenu, updateOption, updateOptionGroup,
} from '@/lib/owner/api';
import { won } from '@/lib/owner/format';
import { useLoad } from '@/lib/owner/hooks';
import { useStore } from '@/lib/owner/store-context';
import {
  Badge, Button, Card, Chips, Field, Loading, Modal, ModalActions, useToast,
} from '@/components/owner/ui';
import s from './menu.styles';

export default function MenuEditPage() {
  const { menuId } = useParams();
  const isNew = menuId === 'new';
  const { storeId } = useStore();
  const router = useRouter();
  const toast = useToast();
  const { data: categories } = useLoad(() => getCategories(storeId), [storeId]);
  const { data: menu, reload, setData: setMenu } = useLoad(() => (isNew ? null : getMenu(storeId, menuId)), [storeId, menuId]);
  const [draft, setDraft] = useState(null); // 사장이 고치는 중인 값 (없으면 서버 값)
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const base = isNew
    ? (categories ? { categoryId: categories[0]?.categoryId ?? '', menuName: '', price: '', description: '' } : null)
    : (menu ? { categoryId: menu.categoryId, menuName: menu.menuName, price: String(menu.price), description: menu.description || '' } : null);
  const form = draft ?? base;
  const set = (k) => (e) => setDraft({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    const body = { categoryId: Number(form.categoryId), menuName: form.menuName, price: form.price === '' ? null : Number(form.price), description: form.description };
    try {
      if (isNew) {
        const created = await createMenu(storeId, body);
        toast('메뉴를 등록했어요. 필요하면 옵션을 추가하세요');
        router.replace(`/owner/${storeId}/menus/${created.menuId}`);
      } else {
        const updated = await updateMenu(storeId, menuId, body);
        setMenu(updated);
        setDraft(null);
        toast('저장했어요');
      }
    } catch (err) {
      setErrors(err.fields || {});
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!categories || !form) return <Loading />;

  return (
    <div className={s.page}>
      <Link href={`/owner/${storeId}/menus`} className="muted small">‹ 메뉴 목록</Link>
      <h1>{isNew ? '메뉴 등록' : form.menuName || '메뉴 수정'}</h1>

      {categories.length === 0 ? (
        <Card><p className="muted">먼저 메뉴 관리 화면에서 분류를 만들어 주세요.</p></Card>
      ) : (
        <Card title="기본 정보">
          <form className={s.form} onSubmit={save}>
            <Field label="분류" required error={errors.categoryId}>
              <select className="select" value={form.categoryId} onChange={set('categoryId')}>
                {categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>)}
              </select>
            </Field>
            <Field label="메뉴명" required error={errors.menuName} hint="최대 50자">
              <input className="input" value={form.menuName} onChange={set('menuName')} maxLength={50} placeholder="후라이드치킨" />
            </Field>
            <Field label="가격(원)" required error={errors.price}>
              <input className="input num" type="number" min="0" step="100" value={form.price} onChange={set('price')} placeholder="18000" />
            </Field>
            <Field label="설명" hint="최대 300자" error={errors.description}>
              <textarea className="textarea" value={form.description} onChange={set('description')} maxLength={300} placeholder="손님에게 보여줄 메뉴 설명" />
            </Field>
            <div className={s.formActions}>
              <Button type="submit" size="md" disabled={busy}>{isNew ? '등록하기' : '저장'}</Button>
            </div>
          </form>
        </Card>
      )}

      {!isNew && menu && <OptionGroups storeId={storeId} menu={menu} reload={reload} />}
      {isNew && <p className="caption">옵션(부위 선택, 사이드 추가 등)은 메뉴를 등록한 뒤 추가할 수 있어요.</p>}
    </div>
  );
}

function OptionGroups({ storeId, menu, reload }) {
  const toast = useToast();
  const [groupModal, setGroupModal] = useState(null); // null | { mode: 'new' } | { mode: 'edit', group }
  const [confirm, setConfirm] = useState(null);

  async function act(fn, msg) {
    try { await fn(); if (msg) toast(msg); reload(); return true; } catch (e) {
      toast(e.code === 'REQUIRED_GROUP_EMPTY' ? '필수 옵션 그룹에는 옵션이 하나 이상 있어야 해요. 그룹을 통째로 지우거나 필수를 해제하세요.' : e.message, 'error');
      return false;
    }
  }

  return (
    <Card title={`옵션 그룹 ${menu.optionGroups.length}`} action={<Button variant="ghost" size="sm" onClick={() => setGroupModal({ mode: 'new' })}>+ 옵션 그룹</Button>}>
      {menu.optionGroups.length === 0 && <p className="muted small">옵션이 없는 메뉴예요. 부위 선택이나 사이드 추가가 있다면 옵션 그룹을 만들어 주세요.</p>}
      <div className={s.groups}>
        {menu.optionGroups.map((g) => (
          <div key={g.optionGroupId} className={s.group}>
            <div className={s.groupHead}>
              <div className={s.groupTitle}>
                <b>{g.groupName}</b>
                <Badge tone={g.required ? 'orange' : 'gray'}>{g.required ? '필수' : '선택'}</Badge>
                <span className="small muted">최대 {g.maxSelect}개</span>
              </div>
              <div>
                <Button variant="text" size="sm" onClick={() => setGroupModal({ mode: 'edit', group: g })}>수정</Button>
                <Button variant="text" size="sm" onClick={() => setConfirm(g)}>삭제</Button>
              </div>
            </div>
            {g.options.map((o) => (
              <OptionRow key={o.optionId} option={o}
                onSave={(patch) => act(() => updateOption(storeId, o.optionId, patch), '옵션을 저장했어요')}
                onDelete={() => act(() => deleteOption(storeId, o.optionId), '옵션을 삭제했어요')} />
            ))}
            <AddOption onAdd={(opt) => act(() => createOption(storeId, g.optionGroupId, opt), '옵션을 추가했어요')} />
          </div>
        ))}
      </div>

      {groupModal && (
        <GroupModal
          group={groupModal.group}
          onClose={() => setGroupModal(null)}
          onSubmit={async (body) => {
            const done = groupModal.mode === 'new'
              ? await act(() => createOptionGroup(storeId, menu.menuId, body), '옵션 그룹을 만들었어요')
              : await act(() => updateOptionGroup(storeId, groupModal.group.optionGroupId, body), '옵션 그룹을 저장했어요');
            if (done) setGroupModal(null);
          }}
        />
      )}
      <Modal open={!!confirm} title="옵션 그룹을 삭제할까요?" desc={confirm ? `${confirm.groupName}과(와) 안의 옵션이 함께 삭제돼요.` : ''} onClose={() => setConfirm(null)}>
        <ModalActions>
          <Button variant="ghost" size="md" onClick={() => setConfirm(null)}>취소</Button>
          <Button variant="danger" size="md" onClick={async () => { await act(() => deleteOptionGroup(storeId, confirm.optionGroupId), '옵션 그룹을 삭제했어요'); setConfirm(null); }}>삭제</Button>
        </ModalActions>
      </Modal>
    </Card>
  );
}

function OptionRow({ option, onSave, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const startEdit = () => { setName(option.optionName); setPrice(String(option.price)); setEdit(true); };
  if (edit) {
    return (
      <div className={s.optRow}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="옵션 이름" />
        <input className={`input num ${s.priceInput}`} type="number" min="0" step="100" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="추가 금액" />
        <Button size="sm" disabled={!name.trim() || price === ''} onClick={async () => { if (await onSave({ optionName: name, price: Number(price) })) setEdit(false); }}>저장</Button>
        <Button variant="text" size="sm" onClick={() => setEdit(false)}>취소</Button>
      </div>
    );
  }
  return (
    <div className={s.optRow}>
      <span className={s.optName}>{option.optionName}</span>
      <span className="num muted">{option.price > 0 ? `+${won(option.price)}` : '추가금 없음'}</span>
      <Button variant="text" size="sm" onClick={startEdit}>수정</Button>
      <Button variant="text" size="sm" onClick={onDelete}>삭제</Button>
    </div>
  );
}

function AddOption({ onAdd }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  return (
    <form className={`${s.optRow} ${s.addRow}`} onSubmit={async (e) => {
      e.preventDefault();
      if (await onAdd({ optionName: name, price: Number(price) })) { setName(''); setPrice('0'); }
    }}>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="새 옵션 이름" aria-label="새 옵션 이름" />
      <input className={`input num ${s.priceInput}`} type="number" min="0" step="100" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="추가 금액" />
      <Button type="submit" variant="ghost" size="sm" disabled={!name.trim() || price === ''}>추가</Button>
    </form>
  );
}

function GroupModal({ group, onSubmit, onClose }) {
  const [groupName, setGroupName] = useState(group?.groupName || '');
  const [required, setRequired] = useState(group?.required ?? true);
  const [maxSelect, setMaxSelect] = useState(String(group?.maxSelect ?? 1));
  const [options, setOptions] = useState(group ? [] : [{ optionName: '', price: '0' }]);

  function submit() {
    const body = { groupName, required, maxSelect: Number(maxSelect) };
    if (!group) body.options = options.filter((o) => o.optionName.trim()).map((o) => ({ optionName: o.optionName, price: Number(o.price || 0) }));
    onSubmit(body);
  }

  return (
    <Modal open wide title={group ? '옵션 그룹 수정' : '옵션 그룹 만들기'} onClose={onClose}>
      <div className={s.form}>
        <Field label="그룹 이름" required>
          <input className="input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="예: 부위 선택, 사이드 추가" autoFocus />
        </Field>
        <Field label="손님 선택">
          <Chips options={[{ value: true, label: '필수로 골라야 해요' }, { value: false, label: '골라도 되고 안 골라도 돼요' }]} value={required} onChange={setRequired} />
        </Field>
        <Field label="최대 선택 수" hint="1이면 하나만 고를 수 있어요">
          <input className="input num" type="number" min="1" value={maxSelect} onChange={(e) => setMaxSelect(e.target.value)} />
        </Field>
        {!group && (
          <Field label="옵션 (나중에 추가해도 돼요)">
            <div className={s.newOpts}>
              {options.map((o, i) => (
                <div key={i} className={s.optRow}>
                  <input className="input" value={o.optionName} placeholder="옵션 이름" aria-label="옵션 이름"
                    onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, optionName: e.target.value } : x)))} />
                  <input className={`input num ${s.priceInput}`} type="number" min="0" step="100" value={o.price} aria-label="추가 금액"
                    onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                  {options.length > 1 && <Button variant="text" size="sm" onClick={() => setOptions(options.filter((_, j) => j !== i))}>빼기</Button>}
                </div>
              ))}
              <Button variant="text" size="sm" onClick={() => setOptions([...options, { optionName: '', price: '0' }])}>+ 옵션 한 줄 더</Button>
            </div>
          </Field>
        )}
      </div>
      <ModalActions>
        <Button variant="ghost" size="md" onClick={onClose}>취소</Button>
        <Button size="md" disabled={!groupName.trim() || !(Number(maxSelect) >= 1)} onClick={submit}>{group ? '저장' : '만들기'}</Button>
      </ModalActions>
    </Modal>
  );
}
