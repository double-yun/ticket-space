# 📱 모바일 앱 설정 가이드

## 암표 방지 시스템 구현 계획

### 1. 기술 스택
- **프레임워크**: Capacitor + Next.js
- **플랫폼**: Android, iOS
- **인증**: 카카오톡 + SMS

### 2. 필요한 패키지 설치

```bash
# 카카오 로그인 플러그인
pnpm add @capacitor-community/kakao-login

# SMS 자동 읽기 (Android)
pnpm add @capacitor-community/sms-retriever

# 디바이스 정보
pnpm add @capacitor/device

# 생체 인증
pnpm add @capacitor-community/biometric-auth
```

### 3. 암표 방지 프로세스

#### 회원가입/로그인
1. 카카오톡 앱으로 로그인 (웹뷰X, 네이티브 SDK)
2. 휴대폰 번호 입력
3. SMS 인증 (자동 읽기)
4. 카카오톡 계정의 번호와 SMS 인증 번호 비교
5. 일치하면 가입/로그인 허용

#### 티켓 구매
1. 로그인 상태 확인
2. 디바이스 ID 확인
3. 티켓 구매 진행
4. 블록체인에 기록

#### 티켓 사용
1. QR 코드 표시
2. SMS 재인증 요구
3. 등록된 번호와 일치 확인
4. 생체 인증 (선택)
5. 티켓 활성화

### 4. Android 빌드

```bash
# Android 플랫폼 추가
npx cap add android

# Android Studio에서 열기
npx cap open android

# 빌드 및 실행
npx cap run android
```

### 5. iOS 빌드

```bash
# iOS 플랫폼 추가
npx cap add ios

# Xcode에서 열기
npx cap open ios

# 빌드 및 실행
npx cap run ios
```

### 6. 배포

#### Android (Google Play)
1. AAB 파일 생성
2. Play Console에 업로드
3. 심사 대기 (1-2일)

#### iOS (App Store)
1. IPA 파일 생성
2. App Store Connect 업로드
3. 심사 대기 (3-7일)

### 7. 개발 명령어

```bash
# 개발 서버 실행
pnpm run dev

# 정적 빌드 (앱용)
pnpm run build
pnpm run export

# Capacitor 동기화
npx cap sync

# 라이브 리로드 (개발용)
npx cap run android --livereload --external
```

### 8. 주의사항

- 카카오 개발자 콘솔에서 Android/iOS 패키지명 등록
- SMS 인증 서비스 연동 (예: Twilio, 알리고)
- 앱 서명 인증서 관리
- 개인정보 처리방침 준비