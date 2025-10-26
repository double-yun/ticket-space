# Ticket Space Specification

## Intro

- 추첨 기반 우선 순위 티켓팅 시스템
- 양도 및 재판매 불가한 Soul Bound Token (SBT, EIP-5192)
- Passkey 기반 기기 고정 인증 및 복구 코드(12단어) 기반 계정 복구
- 내부 자체 포인트 시스템 (오프체인 DB)
- 카카오 로그인 시 Privy Smart Wallet 자동 생성
- PortOne 결제를 통한 포인트 충전 및 차감

## Flow

### Lottery Purchase

1. **추첨 신청 (`POST /api/lottery/apply`)**
   - 프론트는 `roundId`만 전달하며 JWT 인증 필수.
   - 서버는 `LotteryRound.status === OPEN`이며 `applicationDeadline` 이전인지 확인 후, 최초 신청 시 `LotteryApplication.createLottery(eventId, deadline)`을 호출해 온체인 라운드를 만든다.
   - `LotteryApplication` 레코드를 `status=APPLIED`, `paymentStatus=PENDING`, `walletAddress` 포함으로 생성하고, 백그라운드에서 `submitApplicationFor(user.walletAddress, eventId)`를 호출해 체인에 기록한다. 완료 후 `applicationTxHash`를 DB에 저장한다.
2. **신청 마감**
   - `applicationDeadline` 이후 프론트 버튼 비활성화.
   - 관리자/스케줄러는 추첨 전에 `/api/lottery/rounds/[roundId]/draw`를 호출한다. (자동 스케줄러는 아직 없음, 수동 호출 필요)
3. **추첨 실행 (`executeDraw`)**
   - 라운드 상태를 `CLOSED`로 만들고, 온체인 `getApplicants(eventId)` 결과와 DB를 매칭하여 Fisher-Yates 셔플로 우선순위를 부여한다.
   - 셔플된 address 배열을 `keccak256`으로 해시해 `LotteryApplication.setDrawResult(eventId, resultHash)`를 **단 한 번** 호출하고 `LotteryRound.status=DRAWN`, `resultHash`, `drawnAt`을 갱신한다.
4. **당첨자 확정 (`markWinners`)**
   - 이벤트 `ticketCount` 만큼 상위 priority 신청자의 `status=WON`, `pointAmount=event.price`로 업데이트한다.
   - `paymentDeadline`은 아직 어디에서도 설정되지 않아 항상 `null`이다. (→ 미구현 P1)
5. **자동 결제 및 발행 (`processAutoPayment` / `POST /api/lottery/rounds/[roundId]/auto-pay`)**
   - `status=WON` 신청자 순서대로 `purchaseTicketWithPoints`를 호출한다.
   - 성공 시 `paymentStatus=PAID`, `status=PAID`, 티켓 레코드 생성, 포인트 차감 및 `PointHistory` 기록.
   - 실패 시 `paymentStatus=FAILED`, `status=EXPIRED`로 갱신하며 다음 priority로 넘어간다.
   - `purchaseTicketWithPoints` 내부에서 사용자의 공개키를 AES-256-GCM으로 암호화한 뒤 `TicketSBT.mint(address,uint256,bytes encryptedPubKey)`를 호출한다. 체인에서 `tokenId`를 파싱해 DB `Ticket.tokenId`/`txHash`/`encryptedPublicKey`를 업데이트한다.
6. **환불/차순위 처리**
   - 아직 구현되지 않았다. (미구현 P2 참고)

### Direct Purchase

1. **구매 요청 (`POST /api/tickets/purchase`)**
   - Body: `{ eventId }`. JWT 인증 필수.
   - `purchaseTicketWithPoints`가 이벤트/포인트/지갑 유효성 검사 후 포인트 차감 + `PointHistory`/`Ticket` 레코드를 트랜잭션으로 생성한다.
2. **SBT 발행**
   - 위 자동 결제와 동일하게 백그라운드에서 `TicketSBT.mint`를 호출하며 암호화된 공개키를 온체인과 DB 모두에 저장한다.
3. **응답**
   - `ticket.id`, `transactionHash(임시 0x)`, `tokenId(임시 0)`, `user.pointBalance` 등을 반환한다. 실제 `tokenId/txHash`는 백그라운드 완료 후 DB에서 조회된다.

### Ticket Scan

1. **QR 코드 생성**
   - 사용자 앱이 `tokenId`, `transactionHash`, `userId`, `timestamp` 등을 포함한 JSON을 QR로 노출한다.
2. **검증 (`POST /api/tickets/verify`)**
   - 서버는 전송된 `timestamp`가 ±15초 이내인지 확인한다.
   - `tokenId/txHash`로 티켓을 조회하고 `used` 여부를 검사한다.
   - `Ticket.encryptedPublicKey`를 `TICKET_ENCRYPTION_KEY`로 복호화해 현재 `User.publicKey`와 비교한다. 불일치 시 403으로 차단한다.
   - 통과 시 `used=true`로 업데이트하여 입장을 허용한다.

## Key API Endpoints

| Endpoint | Method | 설명 |
| --- | --- | --- |
| `/api/lottery/apply` | POST | 라운드별 추첨 신청, DB 기록 후 `submitApplicationFor` 백그라운드 실행 |
| `/api/lottery/applications` | GET | 사용자별 추첨 신청/당첨/결제 상태 목록 조회 |
| `/api/lottery/rounds/[roundId]/draw` | POST | 마감 후 추첨 + 우선순위 부여 + `setDrawResult` + 자동 결제까지 일괄 실행 |
| `/api/lottery/rounds/[roundId]/auto-pay` | POST | 당첨자에 대한 자동 결제만 재시도 (관리자 secret 헤더 지원) |
| `/api/tickets/purchase` | POST | 즉시 구매. 포인트 차감 → 티켓 생성 → `TicketSBT.mint` 백그라운드 호출 |
| `/api/tickets/verify` | POST | QR 스캔 데이터 검증 및 사용 처리 |
| `/api/purchases` / `/api/purchases/[ticketId]` | GET | 사용자 티켓 목록/상세 조회 |
| `/api/auth/kakao/check` | POST | 기기에 개인키가 없을 때 서버 계정 존재 여부 확인 |
| `/api/auth/kakao/register` | POST | Passkey/복구코드/Privy 지갑 포함 신규 가입 |
| `/api/auth/challenge` | POST | Passkey 로그인용 60초 챌린지 발급 |
| `/api/auth/verify` | POST | 챌린지 서명 검증 후 JWT 발급 |
| `/api/auth/generate-recovery` | POST | 공개키가 등록된 계정에 1회용 12단어 복구 코드 생성 |
| `/api/auth/recover/verify` | POST | 전화번호/이메일 + 복구 코드 검증, `RecoveryAttempt` 및 `PublicKeyHistory` 작성 |
| `/api/auth/recover/update-key` | POST | 새 기기에서 생성한 공개키로 `User.publicKey` 업데이트 |
| `/api/points/charge` | POST | PortOne 결제 조회 후 포인트 충전 (PortOne Secret API 호출) |

## Contracts

### TicketSBT (`contracts/src/Ticket.sol`)

- `mint(address to, uint256 eventId, bytes encryptedPubKey)` : 오직 소유자(백엔드 서비스 월렛)만 호출 가능. 발행 시 `tokenIdToEventId`, `encryptedPublicKeys[tokenId]` 저장 후 `Locked` 이벤트 발생.
- `burn(uint256 tokenId)` : 소유자 전용 소각. 잠금 상태와 암호화 키 삭제.
- `locked(uint256 tokenId)` : EIP-5192 표준 구현, 항상 true.
- `getEncryptedPublicKey(uint256 tokenId)` : 티켓에 기록된 암호화된 공개키 반환.
- 전송 및 승인 관련 함수(`_update`, `approve`, `setApprovalForAll`)는 모두 `SoulBoundTokenTransferBlocked` 오류로 막는다.
- `totalSupply()` : 현재 발행된 토큰 수를 반환.

### LotteryApplication (`contracts/src/LotteryApplication.sol`)

- `createLottery(eventId, deadline)` : 이벤트별 단일 라운드 생성. 이미 존재하면 `InvalidEventId`.
- `submitApplication(eventId)` / `submitApplicationFor(user, eventId)` : 마감 전 신청자 추가, 중복 시 `AlreadySubmitted`.
- `getApplicants(eventId)` / `getApplicantsCount(eventId)` : 신청자 주소 배열 및 개수 조회.
- `getLottery(eventId)` : `(eventId, deadline, resultHash)` 반환.
- `hasApplied(eventId, applicant)` : 특정 주소가 신청했는지 확인.
- `setDrawResult(eventId, resultHash)` : 최초 1회 추첨 결과 해시 기록. 재호출 시 `ResultAlreadySet`.

## Database (Prisma)

### User (`users`)
- `id (cuid)`, `name`, `email(+verified)`, `image`
- `kakaoId`, `phoneNumber`, `phoneVerified`, `birthDate`, `gender`
- `walletAddress`, `privyUserId`, `privyWalletId`
- `pointBalance`
- Passkey 필드: `publicKey (Base64)`, `keyAlgorithm`(기본 `ECDSA_P256`), `keyCreatedAt`, `deviceInfo`
- 복구 필드: `recoveryCodeHash`, `recoveryCodeCreatedAt`
- Timestamps: `createdAt`, `updatedAt`

### Event (`events`)
- `title`, `description`, `ticketCount`, `price`, `deadline`, `saleStart`
- 운영/공간 정보: `seatCapacity`, `eventStartAt`, `eventEndAt`, `doorsOpenAt`, `venueName`, `venueAddress`, `seatLayoutSummary`
- 추첨 일정: `lotteryApplicationDeadline`, `lotteryResultAnnouncementAt`
- `status` (`DRAFT/PUBLISHED/CLOSED`), `createdAt`, `updatedAt`

### LotteryRound (`lottery_rounds`)
- `eventId`, `roundNumber`, `status` (`OPEN/CLOSED/DRAWN`), `applicationDeadline`
- `resultHash`, `drawnAt`, `createdAt`, `updatedAt`

### LotteryApplication (`lottery_applications`)
- `roundId`, `userId`, `walletAddress`
- `priority`, `applicationTxHash`
- `status` (`APPLIED/WON/PAID/EXPIRED/CANCELLED`)
- `paymentStatus` (`PENDING/PAID/FAILED/REFUNDED`)
- `paymentDeadline` (현재 항상 null), `pointAmount`
- `createdAt`, `updatedAt`, `ticket` 1:1 관계

### Ticket (`tickets`)
- `applicationId`, `eventId`, `userId`
- `tokenId (BigInt)`, `txHash`, `used`, `refunded`
- `encryptedPublicKey` (AES-256-GCM Base64 문자열)
- `issuedAt`, `updatedAt`

### PointHistory (`point_history`)
- `userId`, `amount`, `type (CHARGE/USE/ADJUST)`, `description`, `createdAt`

### AuthChallenge (`auth_challenges`)
- `userId`, `challenge`(unique), `expiresAt`, `used`, `createdAt`

### PublicKeyHistory (`public_key_history`)
- `userId`, `publicKey`, `keyAlgorithm`, `reason` (`INITIAL/RECOVERY/ROTATION` 등), `deviceInfo`, `createdAt`

### RecoveryAttempt (`recovery_attempts`)
- `userId`, `success`, `ipAddress`, `userAgent`, `createdAt`

## Passkey & Wallet Onboarding

### Account Creation
1. 카카오 OAuth 완료 후 클라이언트는 `SecureKeyPlugin`으로 Passkey 지원 여부와 생체 인증 가능 여부를 확인한다.
2. `generateKeyPair(kakaoId)`로 기기 HSM 안에 개인키를 생성하고 Base64 공개키와 `getDeviceInfo()` 결과를 얻는다.
3. `POST /api/auth/kakao/register` 호출 시 다음 필드를 전달한다: `kakaoId`, `name`, `email`, `phoneNumber`, `phoneVerified`, `publicKey`, `keyAlgorithm`, `deviceInfo` 등.
4. 서버는 `generateWallet`로 Privy Smart Wallet을 생성하여 `walletAddress/privyUserId/privyWalletId`를 저장한다.
5. `generateRecoveryCode()`로 12단어 복구 코드를 만들고 SHA-256 해시만 DB에 저장한 뒤, 평문 코드를 1회 응답한다.

### Login
1. 앱이 `hasPrivateKey(kakaoId)`로 현재 기기에 개인키가 있는지 확인한다. 서버 계정이 있지만 키가 없으면 로그인 자체를 막는다.
2. `POST /api/auth/challenge` → `AuthChallenge` 레코드 생성(유효기간 60초, 1회용).
3. `SecureKeyPlugin.signData(kakaoId, challenge)`로 생체 인증 후 서명한 값을 `POST /api/auth/verify`에 전달한다.
4. 서버는 `verifySignature`로 ECDSA P-256 서명을 검증하고 성공 시 JWT를 발급한다.

### Recovery
1. 공개키가 등록된 계정만 `POST /api/auth/generate-recovery`로 복구 코드 생성 가능(계정당 1회).
2. 기기 분실 시 `POST /api/auth/recover/verify`에 전화번호/이메일과 12단어 코드를 보내고, 서버는 `RecoveryAttempt`와 `PublicKeyHistory`를 기록한다.
3. 새 기기에서 Passkey를 다시 생성한 후 `POST /api/auth/recover/update-key`로 `newPublicKey`와 `deviceInfo`를 제출하면 `User.publicKey`, `keyCreatedAt`, `deviceInfo`가 갱신된다. 기존 티켓은 공개키 불일치로 자동 무효화된다.

### Ticket Binding & Verification
1. 티켓 구매/자동 결제 시 `purchaseTicketWithPoints`가 `User.publicKey`를 AES-256-GCM(`TICKET_ENCRYPTION_KEY`)으로 암호화한다.
2. 암호문을 DB(`Ticket.encryptedPublicKey`)와 `TicketSBT.mint`의 세 번째 파라미터(바이트 배열)로 함께 저장한다.
3. `/api/tickets/verify`는 티켓에 저장된 암호문을 복호화해 현재 DB 공개키와 비교한다. 복구 또는 계정 양도가 발생했으면 불일치로 입장이 거부된다.

## Onchain vs Offchain

| 저장 위치 | 데이터 | 목적 |
| --- | --- | --- |
| 온체인 (LotteryApplication) | 신청자 address 배열, 신청 마감 `deadline`, 추첨 결과 `resultHash` | 추첨 공정성, 위변조 방지 |
| 온체인 (TicketSBT) | SBT 소유권, `tokenId→eventId`, 암호화된 공개키(bytes) | 티켓 양도 차단 및 공개키 고정 증명 |
| 오프체인 (DB) | 우선순위/결제 상태, 포인트 잔액 및 `PointHistory`, 이벤트 메타데이터 | 프라이버시, 빠른 조회 |
| 오프체인 (DB) | 사용자 Passkey/복구 정보, `Ticket.encryptedPublicKey` Base64 백업 | 기기 고정 인증, 복구 시 추적 |

## 미구현 기능

### P0
- (코드 기준) 별도 P0 미구현 항목 없음.

### P1
- 당첨자용 `paymentDeadline` 자동 설정/관리 로직 부재. 현재 어떤 흐름에서도 마감 시간을 기록하지 않는다 → 결제 유예 정책 미구현.

### P2
- 환불 시나리오 및 환불 후 차순위 자동 결제 (기존 예비 순위 승격) 미구현.

### P4
- Paymaster 연동 (현재 서비스 월렛이 가스비 부담)
- 사용자 알림 시스템 (당첨, 결제 마감 등)
