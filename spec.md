# Ticket Space Specification

## Intro

- 추첨 기반 우선 순위 티켓팅 시스템
- 양도 및 재판매 불가한 Soul Bound Token \(SBT, EIP\-5192\)
- 내부 자체 포인트 시스템 \(오프체인 DB\)
- 카카오로 로그인 및 회원가입, 자동 Privy Wallet 생성
- PortOne 라이브러리를 통해 결제 후 포인트 충전

## Flow

### Lottery Purchase

1. 추첨 신청 \(프론트 \-\> 백엔드\)
  1. `/api/lottery/apply` 호출
2. 신청 처리 \(백엔드\)
  1. 백엔드 서버가 해당 요청을 받아 유효성 검증
  2. DB의 `LotteryApplication` 테이블에 신청 내역 저장
  3. 백엔드 서비스 월렛이 `LotteryApplication.sol` 컨트랙트의 `submitApplication()` 함수를 호출하여 온체인에 신청 기록 \(서버가 가스비 부담\)
3. 신청 마감
  1. 프론트엔드: 마감시간부터 신청 버튼 비활성화 \(TODO: 트랜잭션 시간 소요 되므로 몇 분 전부터 비활성화\)
  2. 스마트 컨트랙트: `deadline` 이후 `submitApplication` 트랜잭션 `revert`
4. 추첨 실행 \(백엔드, 체인 기록\)
  1. 마감 n분 후 백엔드 서버에서 추첨 로직 실행
  2. `getApplicants()`로 온체인에서 신청자 목록을 가져와 공정하게 셔플하여 우선순위 부여
  3. 추첨 결과\(우선순위\)는 DB `LotteryApplication` 테이블에만 저장 \(프라이버시\)
  4. 전체 결과 리스트의 `Keccak256` 해시값을 `setDrawResult()`를 통해 온체인에 기록 \(투명성, 조작 방지\)
5. 결제 기회 부여
  1. 판매할 티켓 수량\(n\)만큼 1순위부터 n순위까지 동시 자동 결제 활성화
  2. DB `LotteryApplication`의 `status`를 `WON`으로 수정\.
  3. `paymentDeadline`을 `now() + 1시간`으로 업데이트는 미정
6. 자동 결제
  1. 1순위부터 n순위까지 해당 티켓이 Direct Purchase와 같은 로직으로 구매
  2. DB에서 사용자 포인트 차감 및 `PointHistory` 기록
  3. 비동기로 백엔드 서비스 월렛이 `TicketSBT.sol` 컨트랙트의 `mint()` 함수를 호출하여 사용자 지갑으로 SBT 발행
  4. 발행이 완료되면 DB `Ticket` 테이블에 `tokenId` 및 `txHash` 등 발행 정보 저장
7. TODO: 환불
  1. `TicketSBT.sol`의 `burn()` 함수를 호출하여 티켓 소각
  2. DB에서 사용자 포인트 100% 환불
  3. 다음 예비 순위 1명 자동 결제

### Direct Purchase

1. 구매 신청 \(프론트 \-\> 백엔드\)
  1. `api/tickets/purchase` 호출
2. 구매 처리 \(백엔드\)
  1. 유효성 검증
  2. 포인트 차감 및 DB에 티켓 생성
  3. 비동기로 백엔드 서비스 월렛이 `TicketSBT.sol` 컨트랙트의 `mint()` 함수를 호출하여 사용자 지갑으로 SBT 발행
  4. 발행이 완료되면 DB `Ticket` 테이블에 `tokenId` 및 `txHash` 등 발행 정보 저장

### Ticket Scan

1. QR 코드 생성
  1. 유저는 티켓 목록에서 사용할 티켓을 선택해 QR 코드 보기 선택
  2. QR 코드에는 timestamp, 티켓 정보가 JSON 형식으로 저장
2. QR 코드 스캔
  1. 관리자는 `/admin/scan` 페이지를 접속해 스캔하기 선택
  2. 서버의 현재 시간과 QR 코드에 담긴 timestamp를 비교하여 15초가 지났는지 검사
  3. 올바른 코드일 시 티켓 DB에 사용처리

## Contracts

### TicketSBT

- 암표 거래를 방지하기 위한 SBT 티켓
- ERC721, EIP\-5192 표준을 따르고 OpenZeppelin 라이브러리 사용
- `mint`, `burn` 가능
- 이외 모든 전송, 승인 기능을 막아 암표 거래를 막음\.

### LotteryApplication

추첨 신청자 온체인 기록 및 추첨 결과 무결성 보장

- **createLottery\(eventId, deadline\)** `onlyOwner`
  - 새로운 추첨 라운드 생성
  - 이벤트 ID 및 신청 마감 시간 설정
- **submitApplication\(eventId\)** `external`
  - **누구나 호출 가능**한 public 함수
  - 사용자가 직접 자신의 지갑으로 호출, `msg.sender`가 신청자로 기록
  - 마감 시간 전에만 신청 가능, 중복 신청 차단
- **submitApplicationFor\(user, eventId\)** `onlyOwner`
  - 백엔드 서버가 사용자 **대신** 신청 제출
  - `onlyOwner` 제한, 지정된 백엔드 월렛만 호출 가능
  - 사용자 지갑 주소를 파라미터로 받아 신청자 등록
- **getApplicants\(eventId\)** `view`
  - 특정 이벤트의 모든 신청자 지갑 주소 목록 반환
- **setDrawResult\(eventId, resultHash\)** `onlyOwner`
  - 추첨 결과 해시값 **단 한 번만** 저장
  - `ResultAlreadySet` 에러로 결과가 이미 설정된 경우 재설정 차단
  - **온체인에 영구 기록**, 서버의 사후 조작 불가
- **hasApplied\(eventId, applicant\)**: 특정 주소 신청 여부 확인
- **getApplicantsCount\(eventId\)**: 신청자 수 조회
- **getLottery\(eventId\)**: 추첨 정보\(eventId, deadline, resultHash\) 조회

## Database

### User

id, walletAddress, privyUserId, privyWalletId, pointBalance, name, email, kakaoId, phoneNumber, phoneVerified, birthDate, gender

### Event

id, title, description, ticketCount, price, deadline, saleStart, status

- status: `DRAFT` / `PUBLISHED` / `CLOSED`

### LotteryRound

id, eventId, roundNumber, status, resultHash, drawnAt, applicationDeadline

- status: `OPEN` / `CLOSED` / `DRAWN`

### LotteryApplication

id, roundId, userId, walletAddress, priority, status, paymentStatus, applicationTxHash, pointAmount, paymentDeadline

- status: `APPLIED` / `WON` / `PAID` / `EXPIRED` / `CANCELLED`
- paymentStatus: `PENDING` / `PAID` / `FAILED` / `REFUNDED`

### Ticket

id, applicationId, eventId, userId, tokenId, txHash, used, refunded, issuedAt

### PointHistory

id, userId, amount, type, description

- type: `CHARGE` / `USE` / `ADJUST`

## Onchain vs Offchain

| **저장 위치** | **데이터** | **목적** |
| --- | --- | --- |
| **온체인 \(블록체인\)** | • 추첨 신청자 목록 \(`address[]`\)   • 추첨 결과 해시 \(`bytes32`\)   • 티켓 소유권 \(SBT\) | **투명성, 공정성 증명, 위변조 방지** |
| **오프체인 \(DB\)** | • **우선순위 상세 정보**   • 포인트 잔액 및 내역   • 결제 마감 시간   • 이벤트 상세 정보   • 사용자 개인정보 | **프라이버시, 빠른 조회, 가스비 절약, 암거래 방지** |

## 미구현 기능

### P0

- 마감 시간 이후 백엔드가 Lottery 신청자 대상으로 우선순위 부여 추첨
- 당첨자 자동 결제 후 minting

### P1

### P2

- 환불 후 차우선순위 유저 자동결제

### P3

### P4

- **Paymaster**: 현재는 백엔드 서비스 월렛이 가스비를 부담하므로 필요성 낮음
- **알림 시스템**: 당첨, 결제 마감 등 사용자 알림
