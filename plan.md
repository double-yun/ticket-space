🎫 티켓팅 시스템 최종 명세서 (v3 - 현행)





이 문서는 현재 프로젝트의 실제 코드베이스를 기반으로 작성된 최신 기술 명세입니다.



1. 시스템 개요







코어 로직: Lottery(추첨) 기반 우선순위 티켓팅 시스템



티켓 형태: 양도 및 재판매가 불가능한 Soul Bound Token (SBT, EIP-5192)



결제 수단: 내부 포인트 시스템 (오프체인 DB)



아키텍처: 하이브리드 방식 (DB + 블록체인)



핵심 변경점 (v2 → v3): 추첨 신청 주체가 사용자에서 백엔드 서비스 월렛으로 변경되어, 사용자는 신청 시 가스비를 부담하지 않습니다.



2. 전체 플로우







추첨 신청 (사용자 → 백엔드)





사용자가 프론트엔드에서 '추첨 신청' 버튼 클릭



백엔드 API /api/lottery/apply 호출 (가스비 없음)



신청 처리 (백엔드 → 블록체인)





백엔드 서버가 해당 요청을 받아 유효성 검증



백엔드 서비스 월렛이 LotteryApplication.sol 컨트랙트의 submitApplication() 함수를 호출하여 온체인에 신청 기록 (서버가 가스비 부담)



DB의 LotteryApplication 테이블에 신청 내역 저장



신청 마감





프론트엔드: 마감 5분 전부터 신청 버튼 비활성화



스마트 컨트랙트: deadline 이후 submitApplication 트랜잭션 revert



추첨 실행 (서버)





마감 5분 후, 백엔드 서버에서 추첨 로직 실행



getApplicants()로 온체인에서 신청자 목록을 가져와 공정하게 셔플하여 우선순위 부여



추첨 결과(우선순위)는 DB LotteryApplication 테이블에만 저장 (프라이버시)



전체 결과 리스트의 Keccak256 해시값을 setDrawResult()를 통해 온체인에 기록 (투명성, 조작 방지)



결제 기회 부여





판매할 티켓 수량(n)만큼 1순위부터 n순위까지 동시 결제 기회 활성화



DB LotteryApplication의 status를 WON으로, paymentDeadline을 now() + 1시간으로 업데이트



포인트 결제 및 SBT 발행





사용자가 프론트엔드에서 '포인트로 결제' 버튼 클릭



백엔드 API /api/payment/execute 호출



DB에서 사용자 포인트 차감 및 PointHistory 기록



백엔드 서비스 월렛이 TicketSBT.sol 컨트랙트의 mint() 함수를 호출하여 사용자 지갑으로 SBT 발행



DB Ticket 테이블에 tokenId 및 txHash 등 발행 정보 저장



환불 (V2 이후 구현)





TicketSBT.sol의 burn() 함수를 호출하여 티켓 소각



DB에서 사용자 포인트 100% 환불



다음 예비 순위 1명에게 1시간의 결제 기회 부여



3. 스마트 컨트랙트 (contracts/src/)







3.1. LotteryApplication.sol



추첨 신청자를 온체인에 기록하고 추첨 결과의 무결성을 보장합니다. 모든 주요 함수는 onlyOwner로 제한되어 백엔드 서비스 월렛만 호출 가능합니다.





createLottery(eventId, deadline): 새로운 추첨 라운드를 생성합니다.



submitApplication(eventId): (v3 변경) 이제 external이지만, 실제로는 백엔드 서버가 사용자를 대신해 호출합니다. msg.sender가 신청자로 기록됩니다.





향후 개선 제안: submitApplicationFor(address user, uint256 eventId) 형태로 변경하고 AccessControl을 도입하여 지정된 백엔드 월렛만 호출할 수 있도록 개선할 수 있습니다.



getApplicants(eventId): 특정 이벤트의 모든 신청자 지갑 주소 목록을 반환합니다.



setDrawResult(eventId, resultHash): 추첨 결과의 해시값을 저장하여 서버의 조작 가능성을 차단합니다.



3.2. TicketSBT.sol



양도가 불가능한 SBT(ERC721) 티켓입니다. EIP-5192 표준을 구현하여 locked 상태를 가집니다.





SBT 특징: _update() 훅을 오버라이드하여 mint(발행), burn(소각) 외의 모든 전송(transferFrom, safeTransferFrom 등)을 원천적으로 차단합니다.



mint(to, eventId): onlyOwner 권한을 가진 백엔드 서비스 월렛이 호출하여 사용자(to)에게 티켓을 발행합니다.



burn(tokenId): onlyOwner 권한으로 티켓을 소각합니다. (환불 기능에 사용 예정)



locked(tokenId): EIP-5192 인터페이스 함수. 민팅 후 항상 true를 반환합니다.



4. 데이터베이스 구조 (prisma/schema.prisma)









테이블 (모델)



주요 필드



설명





User



id, walletAddress, privyUserId, pointBalance



사용자 정보, 지갑 주소, Privy ID, 포인트 잔액





Event



id, title, ticketCount, price, deadline



이벤트 정보, 티켓 수량/가격, 추첨 신청 마감 시간





LotteryRound



id, eventId, status, resultHash, applicationDeadline



이벤트에 속한 각 추첨 회차 정보 (OPEN/CLOSED/DRAWN)





LotteryApplication



id, roundId, userId, priority, status, paymentDeadline



신청자 정보, 추첨 후 부여된 우선순위, 결제 상태/마감시간





Ticket



id, applicationId, userId, tokenId, txHash



발행된 티켓 정보. 온체인 tokenId와 DB 데이터를 매핑





PointHistory



id, userId, amount, type



포인트 충전/사용/조정 내역 (CHARGE/USE/ADJUST)



5. 온체인 vs 오프체인 데이터









저장 위치



데이터



목적





온체인 (블록체인)



• 추첨 신청자 목록 (address[])
• 추첨 결과 해시 (bytes32)
• 티켓 소유권 (SBT)



투명성, 공정성 증명, 위변조 방지





오프체인 (DB)



• 우선순위 상세 정보
• 포인트 잔액 및 내역
• 결제 마감 시간
• 이벤트 상세 정보
• 사용자 개인정보



프라이버시, 빠른 조회, 가스비 절약, 암거래 방지



6. MVP (v3) 범위







✅ 포함된 기능







백엔드 대리 추첨 신청: 사용자는 가스비 없이 신청



오프체인 추첨 및 결과 해시 온체인 기록



DB 기반 포인트 결제 시스템



우선순위 기반 결제 기회 관리 (1시간 타이머)



SBT(ERC721, EIP-5192) 발행 (양도 불가)



❌ 제외된 기능 (향후 버전)







환불 기능: 컨트랙트에는 burn 기능이 있으나, 백엔드 로직 및 정책 미구현



알림 시스템: 당첨, 결제 마감 등 사용자 알림



ETH 등 외부 화폐 직접 결제



온체인 PointLedger: 모든 포인트 내역을 온체인에 기록하여 투명성 강화



Paymaster: 현재는 백엔드 서비스 월렛이 가스비를 부담하므로 필요성 낮음