# Ticket Space

Blockchain Ticketing system with Next.js and Capacitor

## Prerequisites

- **Node.js** (v20 or up)
- **pnpm**
- **Xcode** (for iOS)
- **Android Studio** (for Android)

## Get started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Fill in environment variables

```bash
cp .env.sample .env
```

CAPACITOR_SERVER_URL은 다음과 같은 방법으로 설정할 수 있습니다:
- macOS / Linux: `ifconfig | grep "inet " | grep -v 127.0.0.1`
- Windows: `ipconfig`

### 3. Set database

```bash
pnpm db:migrate
pnpm db:seed
```

### 4. Run development server

```bash
pnpm dev
```

## Mobile Development

### iOS

1. **개발 서버 설정**

`.env` 파일의 `CAPACITOR_SERVER_URL`을 노트북의 IP 주소로 지정합니다:

```env
CAPACITOR_SERVER_URL=http://192.168.0.27:3000
```

2. **iOS 프로젝트와 동기화**

```bash
pnpm build
npx cap sync ios
```

3. **Xcode 열기**

```bash
npx cap open ios
```

### Android

1. **Android 프로젝트와 동기화**

```bash
pnpm build
npx cap sync android
```

2. **Android Studio 열기**

```bash
npx cap open android
```

## 사용 가능한 명령어

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 실행 |
| `pnpm build` | 프로덕션 빌드 생성 |
| `pnpm start` | 프로덕션 서버 실행 |
| `pnpm lint` | ESLint 검사 |
| `pnpm db:migrate` | Prisma 마이그레이션 실행 |
| `pnpm db:seed` | 초기 데이터 삽입 |
| `pnpm db:studio` | Prisma Studio 실행 |

## 기술 스택

- **Frontend**: Next.js 15, React 19, TailwindCSS, Material-UI
- **Mobile**: Capacitor 7
- **Database**: PostgreSQL, Prisma
- **Blockchain**: Alchemy, ethers.js, viem
- **Authentication**: Kakao OAuth
- **Payment**: PortOne

## 개발 팁

- 모바일 기기와 노트북이 같은 네트워크에 연결되어 있어야 합니다
- Kakao OAuth의 Redirect URI는 Next.js 설정 및 Kakao 개발자 콘솔 모두 동일해야 합니다
- `.env`의 `CAPACITOR_SERVER_URL`이 올바르지 않으면 모바일에서 서버에 연결되지 않습니다
