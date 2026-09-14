# 업무달력 배포와 Firebase 안내

기준: 2026-09-15. 이 문서는 현재 React + Vite 앱에 맞춘 설정 안내입니다. Firebase 연결 코드는 구현되어 있습니다. 실제 Firebase 프로젝트의 설정·연결 검증과 Cloudflare 배포는 아직 수행하지 않았습니다.

## 1. 현재 저장 방식

본인의 PC와 휴대전화에서 같은 일정을 공유하려면 **Firebase Authentication + Cloud Firestore**를 설정하세요. 연결 코드는 포함되어 있고, 환경 변수 네 값을 모두 넣은 빌드에서 Google 로그인과 클라우드 저장이 활성화됩니다. 사이트 호스팅은 Cloudflare Pages에서 맡습니다.

설정 값이 없으면 기존 브라우저 저장 모드로 실행합니다. 일부 값만 있으면 설정 누락 안내를 표시합니다. 각 Google 계정은 별도 달력을 가지며, 제공된 보안 규칙은 본인 UID만 허용하도록 되어 있습니다. 다른 사람 초대·공동 편집은 이번 연결의 범위가 아닙니다.

**기존 일정 이전:** 로컬 주소에서 JSON 백업을 내보냅니다. Firebase 설정 후 최종 HTTPS 도메인에 로그인하고 **백업 및 가져오기**에서 확인 후 가져옵니다. 가져오기는 로그인한 계정의 달력을 전체 교체하며 다른 기기에도 반영됩니다. 브라우저의 기존 일정은 자동으로 업로드하지 않습니다.

Firebase 설정 전에는 로컬 주소, pages.dev 주소, 사용자 지정 도메인별로 브라우저 데이터가 다릅니다. 설정 후에는 같은 Firebase 프로젝트와 Google 계정이면 같은 클라우드 데이터를 읽습니다.

## 2. GitHub에서 Cloudflare Pages로 배포

저장소: `sirlma111216-boop/newday`. `package.json`이 저장소 최상위에 있는 구성을 기준으로 합니다.

1. Cloudflare 대시보드 → **Workers & Pages** → **Create application** → **Pages**로 이동합니다.
2. Git 저장소 가져오기/연결 메뉴에서 GitHub를 연결합니다. GitHub 권한 선택 화면에서 `newday` 저장소 접근을 허용합니다.
3. `newday`를 선택하고 아래 값을 입력합니다. 메뉴 문구가 조금 다르면 **Pages의 Git 통합** 경로를 선택하세요.

| 항목 | 값 |
| --- | --- |
| 프로젝트 이름 | `newday` 또는 사용 가능한 이름 |
| 프로덕션 브랜치 | `main` |
| 프레임워크 | `React (Vite)`; 없으면 `None` 후 직접 입력 |
| 루트 디렉터리 | 비워 두기 — 저장소 최상위 |
| 빌드 명령 | `npm run build` |
| 빌드 출력 디렉터리 | `dist` |
| 환경 변수 | `NODE_VERSION` = `24.19.0` |

`.node-version`에도 같은 버전을 지정했습니다. 브라우저 저장 모드에는 추가 키가 필요하지 않습니다. **기기 간 공유를 사용하려면 아래 Firebase 환경 변수 네 개를 빌드 환경에도 입력하세요.** Cloudflare가 의존성을 설치한 뒤 빌드합니다. `npm start`는 로컬 미리보기 서버이므로 Pages 빌드 명령으로 넣지 않습니다. 별도 Wrangler 설정이나 Workers 실행 서버도 필요하지 않습니다.

4. **Save and Deploy**를 누릅니다. 빌드 성공 후 발급된 `https://<프로젝트명>.pages.dev`에서 달력을 확인합니다.
5. 이후 `main` 브랜치에 코드를 push하면 연결된 Pages 프로젝트가 자동으로 다시 빌드·배포합니다.

근거: [Vite 배포 안내](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/), [Git 통합](https://developers.cloudflare.com/pages/get-started/git-integration/), [Node 버전 지정](https://developers.cloudflare.com/pages/configuration/build-image/).

## 3. 보유 도메인 연결

1. 배포한 Pages 프로젝트 → **Custom domains** → **Set up a domain**을 선택합니다.
2. 보유 도메인 또는 `calendar.보유도메인` 같은 서브도메인을 입력합니다. 기존 홈페이지가 루트 도메인을 사용 중이면 업무달력에는 별도 서브도메인을 사용할 수 있습니다.
3. 해당 DNS 영역이 같은 Cloudflare 계정에 있으면 안내에 따라 CNAME 생성을 확인합니다. DNS를 외부에서 관리하는 서브도메인이라면 `calendar`의 CNAME 대상을 실제 `<프로젝트명>.pages.dev`로 설정합니다.
4. 도메인 상태와 HTTPS 인증서가 활성화된 뒤 접속합니다.

루트 도메인(예: `example.com`)을 연결하려면 해당 도메인의 DNS 영역이 Pages 프로젝트와 같은 Cloudflare 계정에 있고 네임서버가 Cloudflare를 향해야 합니다. **Pages에 도메인을 먼저 등록하세요. DNS CNAME만 만들면 연결 오류가 발생할 수 있습니다.** 보유 도메인을 사용하므로 새 도메인을 구매할 필요는 없습니다.

근거: [Cloudflare 사용자 지정 도메인 공식 안내](https://developers.cloudflare.com/pages/configuration/custom-domains/).

## 4. Firebase 프로젝트 연결

### 콘솔 준비

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트를 만들고 프로젝트 설정 → 내 앱 → 웹 앱을 등록합니다. Firebase Hosting은 필요하지 않습니다.
2. **Authentication → Sign-in method → Google**을 활성화하고 지원 이메일을 지정합니다.
3. **Authentication → Settings → Authorized domains**에 실제 사용할 사용자 지정 도메인과 \*.pages.dev의 실제 호스트명을 등록합니다. 프로토콜과 경로는 제외합니다. 로컬 테스트에는 실제 사용하는 localhost 또는 127.0.0.1도 확인·등록합니다. \* 문자를 넣는 것이 아니라 정확한 호스트를 입력해야 합니다.
4. **Firestore Database → Create database**에서 Standard 데이터베이스를 만들고 가까운 위치를 선택합니다. **프로덕션 모드**로 시작합니다.
5. 웹 앱의 firebaseConfig에서 아래 네 값을 복사합니다.

| 환경 변수 이름 | firebaseConfig의 값 |
| --- | --- |
| VITE_FIREBASE_API_KEY | apiKey |
| VITE_FIREBASE_AUTH_DOMAIN | authDomain |
| VITE_FIREBASE_PROJECT_ID | projectId |
| VITE_FIREBASE_APP_ID | appId |

로컬에서는 .env.example을 .env.local로 복사해 값을 넣습니다. Cloudflare Pages에서는 프로젝트의 **Variables and Secrets / Environment variables**에 네 값을 입력하고 **다시 배포**합니다. Firebase가 제공한 기본 authDomain을 유지합니다. 앱은 Google 팝업 로그인을 사용합니다.

Firebase 웹 API 키는 프로젝트 식별 정보입니다. Vite의 VITE_ 변수는 브라우저 빌드에 포함되므로 비밀 저장용이 아닙니다. 서비스 계정 JSON이나 Admin SDK 비밀 키를 넣지 마세요. .env.local은 Git에서 제외됩니다.

근거: [웹 설정](https://firebase.google.com/docs/web/setup), [Google 로그인](https://firebase.google.com/docs/auth/web/google-signin), [Firestore 시작](https://firebase.google.com/docs/firestore/quickstart), [API 키](https://firebase.google.com/docs/projects/api-keys).

### 본인 UID와 Firestore 규칙

1. 앱에서 Google 로그인을 한 번 합니다. Firestore 접근 권한 오류가 나도 Authentication 로그인은 완료될 수 있습니다.
2. 상단 **계정 정보** 또는 Firebase Authentication 사용자 목록에서 본인의 UID를 복사합니다.
3. 저장소의 [firestore.rules](firestore.rules)에서 REPLACE_WITH_YOUR_UID를 실제 UID로 바꿉니다.
4. Firebase Console → Firestore Database → Rules에 파일 내용 전체를 붙여 넣고 게시합니다. 앱에서 **다시 연결**을 누릅니다.
5. Firestore → Indexes → Single-field에서 collection group **calendar**, field **payload**의 인덱싱 제외를 설정합니다. CLI를 사용한다면 아래 명령이 저장소의 규칙·인덱스 파일을 함께 적용합니다.

```sh
npx firebase-tools login
npx firebase-tools deploy --only firestore --project 실제_PROJECT_ID
```

저장 경로는 **/users/{본인_UID}/calendar/main**입니다. 문서는 payload(JSON 문자열), revision(증가하는 버전), updatedAt(서버 시각)을 가집니다. 업무·일정·링크·준비 사항·알림을 한 번에 저장해 연결 관계가 중간 상태로 남지 않도록 합니다. Firestore 문서 크기를 고려해 JSON은 UTF-8 900KB 이하로 제한합니다. 규모가 커지면 업무·일정별 문서로 나누는 후속 변경이 필요합니다.

규칙은 로그인 UID와 경로 UID, 허용된 본인 UID가 일치할 때만 접근하도록 제한하며 새 저장은 이전 버전 + 1을 요구합니다. 다른 계정으로 로그인하면 접근이 거부됩니다. 모두에게 읽기·쓰기를 허용하는 규칙은 사용하지 마세요.

근거: [보안 규칙](https://firebase.google.com/docs/firestore/security/get-started), [트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions), [실시간 구독](https://firebase.google.com/docs/firestore/query-data/listen).

### 저장·충돌·알림 정책

- 서버의 저장 성공 응답 후에만 화면에 저장 완료를 표시합니다. 오프라인에서는 수정 저장을 거부하고 편집창의 입력을 유지합니다. 오프라인 작업 큐는 아직 없습니다.
- 두 기기가 같은 버전에서 동시에 수정하면 나중 변경을 거부합니다. 편집 중 변경된 업무도 감지하므로 입력 내용을 복사한 뒤 최신 업무를 다시 열어 확인할 수 있습니다. 자동 병합은 하지 않습니다.
- 클라우드 데이터를 브라우저 localStorage에 복사하지 않고 Firestore 영구 오프라인 캐시도 사용하지 않습니다. 로그아웃하면 화면과 구독을 정리합니다. Google 로그인 세션은 Firebase 기본 동작에 따라 유지될 수 있습니다.
- 알림 목록과 읽음 상태는 공유합니다. 서버 트랜잭션으로 중복 발송 기록을 막고, 기록 저장에 성공한 활성 기기에만 브라우저 팝업을 요청합니다. 다른 기기도 앱 안 목록을 볼 수 있습니다.
- Firebase 연결은 서버 예약 알림을 의미하지 않습니다. 앱 종료·절전 중 정시 알림은 여전히 지원 범위가 아닙니다.

## 5. 실제 연결 후 확인할 항목

1. 최종 도메인에서 로그인하고 기존 JSON 백업을 가져옵니다.
2. 같은 Google 계정으로 PC와 휴대전화에 로그인해 업무·기간·링크·체크리스트가 같은지 확인합니다.
3. 한 기기의 변경이 다른 기기에 나타나는지, 동시 편집에서 충돌 안내가 나오는지 확인합니다.
4. 다른 Google 계정과 로그아웃 상태에서 본인 데이터 접근이 거부되는지 확인합니다.
5. 네트워크 연결 해제 시 저장 완료가 표시되지 않고 입력이 유지되는지 확인합니다.
6. 가까운 알림을 두 기기에서 열어 목록 반영·중복 방지·새로고침을 확인합니다.

**검증 구분:** 자동 데이터 모델 검사와 로컬 UI 검증은 실제 Firebase 서버·보안 규칙·다중 기기 통합 검증을 대신하지 않습니다. 프로젝트 설정을 받기 전에는 실제 서버 연동 완료로 표시하지 않습니다. Cloudflare의 빌드·DNS·HTTPS도 별도로 확인해야 합니다.
