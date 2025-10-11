# Ticket Space

Next\.js와 Capacitor 기반의 블록체인 티켓팅 시스템입니다\.

## 🛠️ 기술 스택

- **Frontend**: Next\.js 15, React 19, TailwindCSS, Material\-UI
- **Mobile**: Capacitor 7
- **Database**: PostgreSQL, Prisma
- **Blockchain**: Alchemy, ethers\.js, viem
- **Authentication**: Kakao OAuth
- **Payment**: PortOne

## 📋 사전 준비

- Node\.js \(v20 이상\)
- pnpm
- Docker \(로컬 PostgreSQL 개발용\)
- Xcode \(iOS 개발용\)
- Android Studio \(Android 개발용\)

## 🚀 시작하기

1. **의존성 설치**

```
pnpm install
```

2. **환경 변수 설정**

`.env.sample` 파일을 복사하여 `.env` 파일을 만들고, 환경에 맞게 변수를 채워주세요\.

```bash
cp .env.sample .env
```

`.env` 파일에서 `DATABASE_URL`을 로컬 개발용으로 설정:

```bash
DATABASE_URL="postgresql://ticketing_user:ticketing_password@localhost:5432/ticketing_db"
```

> **Tip:** `CAPACITOR_SERVER_URL`은 모바일 개발 시 필요하며, 개발용 PC의 IP 주소를 입력해야 합니다\. \(예: `http://192.168.0.10:3000`\)

3. **PostgreSQL 시작 \(Docker\)**

로컬 개발용 PostgreSQL 데이터베이스를 시작합니다\.

```bash
docker-compose up -d
```

4. **데이터베이스 초기 설정**

스키마를 적용하고 초기 데이터를 삽입합니다\.

```bash
# 스키마 적용
pnpm db:push

# 초기 데이터 삽입
pnpm db:seed
```

5. **스키마 변경 후**

`prisma/schema.prisma` 수정 후, 마이그레이션 파일을 생성하고 적용합니다\.

```bash
pnpm db:migrate
```

## 💻 개발

### 웹 개발 서버 실행

```
pnpm dev
```

이제 브라우저에서 `http://localhost:3000`으로 접속할 수 있습니다\.

### 모바일 앱 개발

모바일 앱을 개발하려면 웹 서버\(`pnpm dev`\)가 실행 중이어야 합니다\.

1. **프로젝트 빌드 및 동기화**

```
# 공통
pnpm build

# iOS
pnpm sync:ios

# Android
pnpm sync:android
```

2. **네이티브 IDE 실행**

```
# iOS (Xcode)
pnpm open:ios

# Android (Android Studio)
pnpm open:android
```

## 📜 주요 명령어

### 개발 서버

| 명령어 | 설명 |
| --- | --- |
| `pnpm dev` | 개발 서버를 실행합니다\. |
| `pnpm build` | 프로덕션용으로 프로젝트를 빌드합니다\. |
| `pnpm start` | 빌드된 프로덕션 서버를 실행합니다\. |
| `pnpm lint` | ESLint로 코드를 검사합니다\. |

### 데이터베이스

| 명령어 | 설명 |
| --- | --- |
| `docker-compose up -d` | PostgreSQL 서버를 백그라운드로 시작합니다\. |
| `docker-compose down` | PostgreSQL 서버를 중지합니다\. \(데이터 유지\) |
| `docker-compose down -v` | PostgreSQL 서버를 중지하고 **모든 데이터를 삭제**합니다\. |
| `pnpm db:migrate` | Prisma 데이터베이스 마이그레이션을 실행합니다\. |
| `pnpm db:push` | Prisma 스키마를 DB에 푸시합니다\. \(개발용\) |
| `pnpm db:seed` | 데이터베이스에 초기 데이터를 삽입합니다\. |
| `pnpm db:studio` | Prisma Studio를 실행합니다\. |

### Docker 유틸리티

```bash
# PostgreSQL 로그 확인
docker logs ticketing-postgres

# PostgreSQL에 직접 접속
docker exec -it ticketing-postgres psql -U ticketing_user -d ticketing_db

# Docker 볼륨 확인
docker volume ls
```
