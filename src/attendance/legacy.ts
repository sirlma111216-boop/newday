import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, inMemoryPersistence, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { parseRoster } from './model';
// 기존 앱의 공개 웹 설정. Newday 기본 Firebase 앱과 로그인은 분리한다.
const firebaseConfig = {
  apiKey: "AIzaSyA6DVSThrU3OKyi6fARAn_5x97d7mmK_HI",
  authDomain: "attendance-plan-a7b58.firebaseapp.com",
  projectId: "attendance-plan-a7b58",
  storageBucket: "attendance-plan-a7b58.firebasestorage.app",
  messagingSenderId: "123038716462",
  appId: "1:123038716462:web:0243567dd7dd1f161c85bf",
  measurementId: "G-FVDHY6XGQL"
};
export async function readLegacyRoster(email?:string,password?:string) {
  const app=getApps().find(app=>app.name==='newday-attendance-import')??initializeApp(firebaseConfig,'newday-attendance-import');
  const auth=getAuth(app);await setPersistence(auth,inMemoryPersistence);
  try {
    const result=email&&password?await signInWithEmailAndPassword(auth,email,password):await signInWithPopup(auth,new GoogleAuthProvider());
    const snapshot=await getDocFromServer(doc(getFirestore(app),'teachers',result.user.uid));
    if(!snapshot.exists())throw new Error('이 계정에 저장된 학급 정보가 없습니다.');
    const value=snapshot.data();
    // 원본 문서는 읽기만 하며, 출결·설정은 반환하거나 저장하지 않는다.
    return parseRoster({students:value.students??[],classInfo:value.classInfo});
  } finally { await signOut(auth); }
}
