# Alchemy Sepolia 연결 가이드

이 문서는 Ticketing System 웹 애플리케이션을 Anvil 로컬 네트워크 대신 Alchemy가 제공하는 Sepolia 테스트넷과 스마트 월렛으로 동작시키는 방법을 정리합니다.

## 1. 필수 환경 변수

`web` 프로젝트의 실행 환경(.env.local 등)에 아래 항목을 설정하세요.

| 변수 | 설명 |
| --- | --- |
| `CHAIN_ID=11155111` | 기본 네트워크를 Sepolia로 고정합니다. (`config/contracts.json`의 `defaultNetwork`와 일치) |
| `ALCHEMY_API_KEY` 또는 `ALCHEMY_RPC_URL` *(또는 `NEXT_PUBLIC_` 접두어)* | Alchemy Sepolia RPC 엔드포인트. URL을 직접 넣거나 API 키만 넣으면 `https://eth-sepolia.g.alchemy.com/v2/<API_KEY>` 형식으로 조합됩니다. |
| `RPC_URL` *(선택, `NEXT_PUBLIC_RPC_URL` 포함)* | Alchemy 외 다른 RPC를 강제로 쓰고 싶을 때 명시합니다. 지정하면 Alchemy 관련 설정보다 우선합니다. |
| `SMART_WALLET_OWNER_PRIVATE_KEY` | Alchemy 스마트 월렛의 오너 서명자 프라이빗 키(0x-prefix). 이 키에 충분한 Sepolia ETH가 있어야 합니다. |
| `CONTRACT_ADDRESS` *(또는 `NEXT_PUBLIC_CONTRACT_ADDRESS`)* | Sepolia에 배포된 Ticket 컨트랙트 주소. 자동 탐지는 비활성화되어 있으므로 반드시 지정해야 합니다. |
| `MINT_TARGET_ADDRESS` *(선택)* | `/api/mint` 테스트 엔드포인트에서 NFT를 부여할 대상 주소. 기본값은 예시 계정이므로 실제 계정을 지정하는 것이 좋습니다. |
| `ALCHEMY_GAS_POLICY_ID` *(선택)* | Alchemy Gas Manager를 사용할 경우 정책 ID를 설정합니다. 설정하지 않으면 스마트 월렛이 자체 ETH로 가스를 지불합니다. |

`.env.local` 예시는 아래와 같습니다. 환경 변수를 Next.js 클라이언트에서도 사용하려면 동일한 값에 `NEXT_PUBLIC_` 접두어를 붙여 추가하세요.

```bash
CHAIN_ID=11155111
ALCHEMY_API_KEY=your-alchemy-api-key
SMART_WALLET_OWNER_PRIVATE_KEY=0xyourdeployerprivatekey
CONTRACT_ADDRESS=0xyourdeployedticketaddress
MINT_TARGET_ADDRESS=0xrecipientaddress
# 선택 사항
# ALCHEMY_GAS_POLICY_ID=gas-policy-id
# RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-alchemy-api-key
```

> 참고: 기존 `ANVIL_RPC_URL`, `ANVIL_PRIVATE_KEY`, `PRIVATE_KEY`는 로컬 개발 전용으로 유지되며, `CHAIN_ID`가 31337일 때만 사용됩니다.

## 2. 컨피그 파일 확인

`config/contracts.json`의 `defaultNetwork`가 `11155111`로 변경되었습니다. Sepolia용 `Ticket` 컨트랙트 주소를 확인해 JSON에 기록하거나, 환경 변수 `CONTRACT_ADDRESS`가 이를 대체하도록 설정하세요.

```json
{
  "networks": {
    "11155111": {
      "name": "Sepolia Testnet",
      "rpcUrl": null,
      "contracts": {
        "Ticket": {
          "address": "0x...",
          "deployedAt": "2024-...",
          "autoDiscover": false
        }
      }
    }
  },
  "defaultNetwork": "11155111"
}
```

## 3. 스마트 월렛 동작 방식

- 서버 사이드 API(`/api/wallet/fund`, `/api/tickets/purchase`, `/api/mint`)는 Chain ID가 11155111일 때 Alchemy Light Account 클라이언트를 통해 트랜잭션을 전송합니다.
- 로컬 네트워크(Chain ID 31337)에서는 기존과 동일하게 Anvil 계정으로 트랜잭션을 실행합니다.
- 스마트 월렛은 최초 트랜잭션 시 자동으로 배포되며, Gas Manager를 설정하지 않았다면 충분한 Sepolia ETH가 필요합니다.

## 4. 체크리스트

1. Sepolia에 Ticket 컨트랙트를 배포하고 주소를 확보합니다.
2. `.env.local` 등에 필수 환경 변수를 설정합니다.
3. (선택) Gas Manager를 사용할 경우 Alchemy 대시보드에서 정책 ID를 발급받아 `ALCHEMY_GAS_POLICY_ID`에 설정합니다.
4. `pnpm dev` 또는 Docker 환경을 재시작하여 새로운 환경 변수가 반영되었는지 확인합니다.

## 5. 문제 해결

- **스마트 월렛 초기화 오류**: `SMART_WALLET_OWNER_PRIVATE_KEY`가 0x로 시작하는지, Sepolia에 충분한 ETH가 있는지 확인하세요.
- **트랜잭션 불발**: Alchemy 대시보드 프로젝트가 Sepolia를 지원하도록 구성되었는지, API 키/엔드포인트가 올바른지 확인합니다.
- **Gas Manager 실패**: 정책에 등록된 컨트랙트 주소, 지갑 주소가 정확한지 확인하고 정책이 활성화되어 있는지 점검하세요.

필요 시 기존 `../anvil.md` 문서를 참고하여 로컬 개발 환경과 병행 설정할 수 있습니다.
