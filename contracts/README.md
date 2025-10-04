# Contracts (Foundry)

이 디렉터리는 TicketSBT 컨트랙트와 Foundry 기반 배포 스크립트를 담습니다. 로컬 Anvil 대신 Alchemy Sepolia 같은 외부 RPC로 직접 배포하는 사용성을 기준으로 정리했습니다.

## 사전 준비

- [Foundry](https://book.getfoundry.sh/getting-started/installation) 설치 (`forge`, `cast` 포함)
- `jq` 설치 (배포 아티팩트 파싱용)
- 배포에 사용할 프라이빗 키와 RPC URL 환경 변수를 준비합니다. 예시:

```bash
# ~/.zshrc 또는 터미널에서 export
export RPC_URL="https://eth-sepolia.g.alchemy.com/v2/<API_KEY>"
export DEPLOYER_PRIVATE_KEY="0x..."      # 배포자 프라이빗 키 (0x 접두사 포함)
# 선택: export CHAIN_ID=11155111          # 자동 감지가 실패할 때 지정
```

## 기본 명령어

```bash
# 컴파일
forge build

# 테스트 실행
forge test

# 포맷팅
forge fmt
```

## 배포

루트 디렉터리에서 아래 스크립트를 실행하면 빌드·배포·ABI 업데이트를 한 번에 수행합니다.

```bash
./scripts/deploy-contract.sh
```

스크립트는 다음을 순서대로 실행합니다.

1. `contracts` 디렉터리에서 `forge build`
2. `forge script script/deploy.s.sol --broadcast`
3. 최신 배포 로그에서 컨트랙트 주소를 읽어 `web/.env.local`의 `CONTRACT_ADDRESS`를 갱신 (자동 수정을 원치 않으면 `WEB_UPDATE_ENV=false ./scripts/deploy-contract.sh`)
4. `out/TicketSBT.sol/TicketSBT.json`의 ABI를 추출해 `web/lib/blockchain/ticket-abi.ts`를 재생성

직접 명령으로 배포하고 싶다면 다음 예시를 사용할 수 있습니다.

```bash
forge script script/deploy.s.sol \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast -vv
```

성공 시 `broadcast/deploy.s.sol/<CHAIN_ID>/run-latest.json`에 트랜잭션 로그가 남으며, 마지막 `contractAddress`가 실 배포 주소입니다.

## 폴더 구조

```
contracts/
├─ src/                 # Solidity 컨트랙트
├─ script/              # 배포/도구용 Foundry 스크립트
├─ test/                # forge test 파일
├─ lib/                 # 외부 라이브러리 (openzeppelin 등)
├─ broadcast/           # forge script 실행 로그
├─ foundry.toml         # Foundry 설정
└─ foundry.lock         # 라이브러리 잠금 파일
```

추가 라이브러리나 remapping이 필요하면 `forge install`과 `foundry.toml`을 적절히 수정하세요.
