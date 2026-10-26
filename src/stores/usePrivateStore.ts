import { useEffect, useRef, useState } from 'react';
import { getFirestore, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth } from '../firebase';
import { cloudError } from '../cloudModel';


export function usePrivateStore<T>(collection: 'apps' | 'vault', empty: () => T, parse: (value: unknown) => T, uid?: string) {
  const LOCAL_KEY = 'newday-' + collection + '-v1';
  const [data,setData] = useState(empty), [revision,setRevision] = useState(0), [ready,setReady] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState(''), [attempt,setAttempt] = useState(0);
  const current = useRef({ revision:0, ready:false, busy:false, active:false });
  useEffect(()=>{
    const state = {revision:0,ready:false,busy:false,active:true}; current.current=state; setReady(false); setError(''); setData(empty()); setRevision(0);
    const receive = (value: any) => {
      if (!state.active) return;
      try { const next = value ? parse(JSON.parse(value.payload)) : empty(); const rev = value?.revision ?? 0;
        if (!Number.isSafeInteger(rev) || rev<0) throw new Error('저장소 데이터 버전을 확인할 수 없습니다.');
        if(rev<state.revision) return; state.revision=rev; state.ready=true; setRevision(rev); setData(next); setReady(true); setError('');
      } catch(e) { state.ready=false; setReady(false); setError(cloudError(e)); }
    };
    let stop = ()=>{};
    if(uid && auth) {
      stop=onSnapshot(doc(getFirestore(auth.app),'users',uid,collection,'main'),{includeMetadataChanges:true},snap=>{
        if(!snap.metadata.fromCache && !snap.metadata.hasPendingWrites) receive(snap.exists()?snap.data():null);
      }, e=>{state.ready=false; setReady(false); setError(cloudError(e));});
    } else {
      const load=()=>{try {const raw=localStorage.getItem(LOCAL_KEY);receive(raw?JSON.parse(raw):null);}catch(e){setError(cloudError(e));}};
      load(); const changed=(e:StorageEvent)=>{if(e.key===LOCAL_KEY)load();}; window.addEventListener('storage',changed);stop=()=>window.removeEventListener('storage',changed);
    }
    return ()=>{state.active=false;stop();};
  },[uid,attempt,collection,empty,parse]);
  async function commit(next: T, expected = revision) {
    const state=current.current;
    if(!state.ready || state.busy || (uid && !navigator.onLine)) {setError('연결 상태를 확인하고 저장이 끝난 뒤 다시 시도해 주세요.');return false;}
    state.busy=true;setBusy(true);
    try {
      const clean=parse(next),payload=JSON.stringify(clean);
      if(new TextEncoder().encode(payload).length>900000)throw new Error('저장소 저장 한도(약 900KB)를 넘었습니다. 백업 후 오래된 항목을 정리해 주세요.');
      if(uid && auth) {
        const db=getFirestore(auth.app), ref=doc(db,'users',uid,collection,'main');
        await runTransaction(db,async tx=>{const snapshot=await tx.get(ref); const actual=snapshot.exists()?snapshot.data().revision:0;
          if(actual!==expected)throw new Error('다른 화면에서 저장소 자료가 변경됐습니다. 입력 내용을 확인한 뒤 창을 다시 열어 저장해 주세요.');
          tx.set(ref,{payload,revision:expected+1,updatedAt:serverTimestamp()});});
      } else {
        const raw=localStorage.getItem(LOCAL_KEY);const actual=raw?JSON.parse(raw).revision:0;
        if(actual!==expected)throw new Error('다른 창에서 저장소 자료가 변경됐습니다. 다시 열어 확인해 주세요.');
        localStorage.setItem(LOCAL_KEY,JSON.stringify({payload,revision:expected+1}));
      }
      if(state.active && state.revision<=expected+1){state.revision=expected+1;setRevision(expected+1);setData(clean);setError('');}return state.active;
    }catch(e){if(state.active)setError(cloudError(e));return false;}finally{state.busy=false;if(state.active)setBusy(false);}
  }
  return {data,revision,ready,busy,error,setError,commit,retry:()=>setAttempt(n=>n+1),cloud:!!uid};
}
