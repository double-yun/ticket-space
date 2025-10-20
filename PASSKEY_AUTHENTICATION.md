# PassKey 기반 암표 거래 방지 시스템

## 개요

생체 인증 기반 비대칭키 암호화로 계정 판매 및 양도를 통한 암표 거래를 원천 차단합니다.

### 핵심 원리

```
개인키: 기기 HSM에 추출 불가능하게 저장 → 다른 기기 로그인 불가
공개키: DB + 블록체인(SBT)에 저장 → 계정 복구 시 불일치 감지
```

---

## 기술 스택

| 구분 | 기술 | 설명 |
|------|------|------|
| **키 저장소** | Android Keystore / iOS Keychain | Hardware-backed 보안 저장소 (HSM) |
| **키 알고리즘** | ECDSA P-256 (secp256r1) | 256비트 타원곡선 암호화 |
| **서명 알고리즘** | SHA256withECDSA | SHA-256 해시 + ECDSA 서명 |
| **생체 인증** | BiometricPrompt / LocalAuthentication | 지문/안면 인식 (매번 인증) |
| **토큰 표준** | EIP-5192 (Soul Bound Token) | 전송 불가능한 SBT |

---

## Flow

### 1. Account Creation (계정 생성)

1. **키 페어 생성 요청** (프론트 → 클라이언트 플러그인)
   1. `SecureKeyPlugin.generateKeyPair(userId)` 호출
2. **생체 인증** (클라이언트)
   1. BiometricPrompt 실행 (지문/얼굴 인식)
3. **키 페어 생성** (기기 HSM)
   1. ECDSA P-256 알고리즘으로 키 페어 생성
   2. 개인키: Android Keystore / iOS Keychain에 **추출 불가능**하게 저장
   3. 공개키: Base64 인코딩하여 반환
4. **공개키 등록** (프론트 → 백엔드)
   1. `/api/auth/kakao/register` 호출
   2. 백엔드 서버가 `User.publicKey` DB에 저장
5. **복구 코드 생성** (선택)
   1. `/api/auth/generate-recovery` 호출
   2. 128비트 랜덤 엔트로피로 **12단어 복구 코드** 생성
   3. SHA-256 해시만 DB에 저장 (평문 저장 안 함)
   4. 복구 코드를 **1회만** 화면 표시 (재조회 불가)

---

### 2. Login Authentication (로그인)

1. **Challenge 요청** (프론트 → 백엔드)
   1. `/api/auth/challenge` 호출
2. **Challenge 생성** (백엔드)
   1. `SHA256(timestamp + random)` 형식의 challenge 생성
   2. DB `AuthChallenge` 테이블에 저장 (유효기간: 60초, 1회용)
3. **Challenge 서명** (프론트 → 클라이언트 플러그인)
   1. `SecureKeyPlugin.signData(userId, challenge)` 호출
   2. 생체 인증 실행
   3. 기기 HSM의 개인키로 challenge 서명 (SHA256withECDSA)
   4. Base64 인코딩된 서명 반환
4. **서명 검증** (프론트 → 백엔드)
   1. `/api/auth/verify` 호출 (challenge + signature)
   2. DB에서 사용자 공개키 조회
   3. `crypto.verify()`로 서명 검증
   4. Challenge 만료/재사용 여부 확인
5. **JWT 발급** (백엔드 → 프론트)
   1. 검증 성공 시 JWT 토큰 발급 (유효기간: 7일)

**보안 장치**:
- Challenge는 1회용 (재사용 차단)
- 60초 후 자동 만료
- 서명 검증 실패 = 다른 기기 = 로그인 차단

---

### 3. Ticket Purchase (티켓 구매)

1. **티켓 구매** (Direct Purchase / Lottery 자동 결제)
   1. 포인트 차감 및 DB에 티켓 생성
2. **공개키 암호화** (백엔드)
   1. DB에서 현재 사용자 공개키 조회
   2. AES-256-CBC로 공개키 암호화
3. **SBT 발행** (백엔드 → 블록체인)
   1. `TicketSBT.mint(address, eventId, encryptedPublicKey)` 호출
   2. 암호화된 공개키를 SBT에 영구 기록
   3. `tokenId` 및 `txHash` 반환
4. **DB 업데이트** (백엔드)
   1. `Ticket.tokenId`, `Ticket.encryptedPublicKey` 저장

**핵심**: 티켓 구매 시점의 공개키를 암호화하여 블록체인에 영구 저장

---

### 4. Ticket Verification (티켓 사용)

1. **QR 코드 제시** (사용자)
   1. QR 코드에 `tokenId`, `userId`, `timestamp` 포함
2. **티켓 조회** (관리자 → 백엔드)
   1. `/api/tickets/verify` 호출
   2. DB에서 티켓 조회 (암호화된 공개키 포함)
3. **공개키 비교** (백엔드)
   1. 현재 사용자 공개키 조회 (`User.publicKey`)
   2. 티켓에 저장된 공개키 복호화 (`decrypt(encryptedPublicKey)`)
   3. **원본 공개키 vs 현재 공개키 비교**
4. **검증 결과**
   - **일치**: 사용 허용 (`Ticket.used = true`)
   - **불일치**: 사용 차단 (계정 복구됨 = 암표 거래)

**핵심**: 공개키 불일치 = 계정 변경 감지 = 티켓 무효화

---

### 5. Account Recovery (계정 복구)

**시나리오**: 기기 분실/변경으로 개인키 접근 불가

1. **복구 코드 검증** (프론트 → 백엔드)
   1. `/api/auth/recover/verify` 호출 (전화번호/이메일 + 12단어 복구 코드)
   2. 입력한 복구 코드를 SHA-256 해시로 변환
   3. DB의 `User.recoveryCodeHash`와 비교
   4. 검증 성공 시 이전 공개키를 `PublicKeyHistory` 테이블에 백업
2. **새 키 페어 생성** (프론트 → 새 기기)
   1. 새 기기에서 생체 인증 + 키 페어 생성
   2. 새 개인키는 새 기기 HSM에 저장
3. **공개키 업데이트** (프론트 → 백엔드)
   1. `/api/auth/recover/update-key` 호출
   2. 새 공개키로 `User.publicKey` 업데이트
   3. `User.keyCreatedAt` 타임스탬프 갱신

**복구 후 효과**:
```
기존 티켓 SBT: encrypt(PubKey_A) ← 블록체인에 영구 저장
현재 DB: PubKey_B ← 새 공개키
  ↓
티켓 사용 시: PubKey_A ≠ PubKey_B
  ↓
결과: ❌ 모든 기존 티켓 자동 무효화
```

**보안 장치**:
- 복구 시도 실패/성공 모두 로그 기록 (`RecoveryAttempt` 테이블)
- 이전 공개키는 `PublicKeyHistory`에 영구 보존
- IP 주소, User-Agent 기록으로 의심스러운 복구 추적 가능

---

## 암표 거래 방지 메커니즘

### 시나리오 1: 계정 정보 판매

```
판매자: 계정 ID/비밀번호 판매
  ↓
구매자: 로그인 시도 → Challenge 발급
  ↓
구매자 기기: ❌ 개인키 없음 (판매자 기기 HSM에만 존재)
  ↓
결과: ❌ 서명 생성 불가 → 로그인 실패
```

### 시나리오 2: 복구 코드 판매

```
[티켓 구매 시점]
판매자 공개키: PubKey_A
  ↓
SBT에 저장: encrypt(PubKey_A) → 블록체인 영구 기록

[복구 코드 판매 후]
구매자: 복구 코드로 계정 복구
  ↓
서버: 새로운 키 페어 생성
  ↓
DB 공개키: PubKey_A → PubKey_B (업데이트)

[티켓 사용 시도]
티켓 공개키: decrypt(encryptedKey) = PubKey_A
현재 공개키: PubKey_B
  ↓
비교 결과: PubKey_A ≠ PubKey_B
  ↓
결과: ❌ 티켓 사용 차단 (계정 변경 감지)
```

**핵심**: 복구 시 새 공개키 생성 → SBT 공개키와 불일치 → **모든 기존 티켓 자동 무효화**

### 시나리오 3: SBT 전송 시도

```
공격자: SBT 토큰 전송 시도
  ↓
스마트 컨트랙트: EIP-5192 전송 차단
  ↓
결과: ❌ revert SoulBoundTokenTransferBlocked()
```

---

## 보안 강도 요약

| 공격 유형 | 방어 메커니즘 | 결과 |
|----------|--------------|------|
| **계정 판매** | 개인키 = HSM에만 존재 (추출 불가) | ❌ 로그인 불가 |
| **복구 코드 판매** | 복구 시 새 공개키 → SBT 공개키 불일치 | ❌ 티켓 사용 불가 |
| **SBT 전송** | EIP-5192 전송 차단 (블록체인 강제) | ❌ 전송 불가 |
| **서명 재생 공격** | Challenge 1회용 + 60초 TTL | ❌ 재사용 차단 |

---

## 데이터 저장 위치

| 저장 위치 | 데이터 | 목적 |
|----------|--------|------|
| **기기 HSM** | 개인키 (추출 불가) | 다른 기기 로그인 차단 |
| **DB** | 공개키, AuthChallenge | 서명 검증, 빠른 조회 |
| **블록체인 (SBT)** | 암호화된 공개키 | 위변조 방지, 계정 복구 감지 |

---
