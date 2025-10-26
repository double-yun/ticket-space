- **Frontend / Mobile**
  - Next.js 15.5.2 (App Router) – 단일 코드베이스에서 페이지와 API 라우트를 함께 구성해 웹/하이브리드 UI를 렌더링함.
  - React 19.1.0 – 대화형 컴포넌트와 훅 기반 상태 관리로 티켓, 이벤트, 복구 화면을 구축함.
  - Tailwind CSS 4 – 전역 유틸리티 클래스로 빠르게 스타일을 통일하고 반응형 레이아웃을 구성함.
  - Capacitor 7.4.3 (core/android/ios) – Next 앱을 iOS/Android 래퍼로 빌드하고 App/Clipboard/Camera 등 네이티브 API를 노출함.
  - capacitor-kakao-login-plugin 3.0.0 – 모바일 환경에서 카카오 OAuth SDK를 캡슐화해 네이티브 로그인 플로우를 제공함.
  - lucide-react 0.544.0 – 경량 아이콘 세트를 사용해 페이지, 내비게이션, QR 모달 등에 일관된 시각 요소를 제공함.

- **Backend & API**
  - Next.js Route Handlers – `src/app/api/**` 전반을 통해 인증, 추첨, 티켓, 포인트 등의 REST/JSON 엔드포인트를 제공함.
  - TypeScript 5.x + tsx 4.20.5 – 런타임 트랜스파일 없이 타입 안정성을 유지하며 seed·테스트 스크립트를 실행함.

- **Database & ORM**
  - PostgreSQL 16 (docker-compose) – 사용자, 이벤트, 추첨 라운드, 티켓, 포인트 내역 등 영속 데이터를 저장함.
  - Prisma 6.16.1 – `prisma/schema.prisma`로 스키마를 선언하고 마이그레이션·쿼리를 타입 세이프하게 생성함.

- **Blockchain / Smart Contract**
  - Foundry (forge/anvil/cast) – `contracts/` 디렉터리의 Solidity 소스(TicketSBT, LotteryApplication)를 빌드·테스트함.
  - LotteryApplication.sol – 추첨 신청자·마감·결과 해시를 온체인에 기록해 공정성을 증명함.
  - viem 2.37.3 – API 라우트에서 컨트랙트 읽기/쓰기, 트랜잭션 시뮬레이션, 계정 파생을 처리함.
  - Alchemy RPC 구성 (`ALCHEMY_RPC_URL`) – 메인넷/세폴리아 접근을 위해 관리형 RPC 엔드포인트를 사용함.

- **Auth & Security**
  - Capacitor SecureKeyPlugin – 네이티브 HSM에서 ECDSA 키쌍을 생성하고 생체 인증 기반 Passkey 흐름을 강제함.
  - Kakao OAuth (카카오 REST + 모바일 플러그인) – 기본 소셜 로그인으로 사용자 식별과 프로필 수집을 담당함.
  - Firebase Auth 12.2.1 – reCAPTCHA 기반 SMS 인증으로 전화번호 검증 및 계정 복구 시 본인 확인을 수행함.
  - jsonwebtoken 9.0.2 – 7일 만료 JWT를 발급/검증해 API 접근 권한을 관리함.
  - @privy-io/server-auth 1.6.0 – 카카오 계정 생성 시 Privy 지갑을 발급해 온체인 월렛 주소를 안전하게 연동함.

- **Payment / 포인트 결제**
  - @portone/browser-sdk 0.1.0 – 클라이언트에서 포인트 충전 결제 창을 호출하고 결제 ID를 획득함.
  - PortOne REST 연동 (`/api/points/charge`) – 서버에서 `PORTONE_SECRET_API_KEY`로 결제 상태를 검증하고 포인트를 적립함.
  - purchaseTicketWithPoints 모듈 – 포인트 차감, `PointHistory` 기록, 티켓 생성, SBT 민팅 트리거를 하나의 원자적 흐름으로 처리함.

- **Infra / DevOps**
  - Docker Compose + postgres:16-alpine – 로컬 개발용 DB 컨테이너와 퍼시스턴트 볼륨을 손쉽게 관리함.
  - pnpm 9.15.9 – 워크스페이스 전반의 의존성 관리와 빌드/동기화 스크립트 실행을 담당함.
  - Capacitor CLI 7.4.3 – `pnpm sync:*`, `open:*` 스크립트로 네이티브 프로젝트를 동기화하고 IDE를 구동함.
  - tsx 4.20.5 – Prisma seed, 추첨 테스트 등 TypeScript 스크립트를 별도 번들 없이 실행함.

- **Anti-scalping (암표 방지 기술 요소)**
  - SecureKey 기반 Passkey 로그인 – 기기별 ECDSA 키와 생체 인증으로 계정 공유·위임을 차단함.
  - AES-256-GCM 공개키 암호화 – 티켓 구매 시 사용자 공개키를 암호화해 온체인/DB에 저장, 복구·양도 시 불일치를 감지함.
  - TicketSBT.sol (EIP-5192) – 전송·승인을 전부 revert해 발급된 티켓 SBT의 양도 및 재판매를 근본적으로 막음.
  - `/api/tickets/verify` QR 검증 – 스캔 시 복호화된 공개키와 현재 Passkey를 비교해 다른 기기에서의 사용 시도를 즉시 거부함.
