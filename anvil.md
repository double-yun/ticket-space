# Anvil 블록체인 개발 환경 문제 해결 가이드

이 문서는 Ticketing System 프로젝트에서 발생한 Anvil 관련 문제들과 해결 방법을 정리합니다.

## 발생했던 주요 문제들

### 1. 웹 앱에서 Anvil에 연결할 수 없는 문제

**에러 메시지:**
```
Error: connect ECONNREFUSED 172.18.0.2:8545
```

**원인:**
Anvil이 기본적으로 `127.0.0.1:8545`에서만 리스닝하고 있어서, Docker 컨테이너 간 통신이 불가능했음.

**해결 방법:**
`anvil/Dockerfile`을 수정하여 모든 인터페이스에서 리스닝하도록 설정:

```dockerfile
# 기존 (문제 있음)
CMD ["anvil", "--host", "0.0.0.0", "--port", "8545", "--chain-id", "31337"]

# 수정됨 (해결됨)
ENTRYPOINT ["anvil"]
CMD ["--host", "0.0.0.0", "--port", "8545", "--chain-id", "31337"]
```

### 2. 컨트랙트 배포가 실제로 브로드캐스트되지 않는 문제

**증상:**
- `forge create` 명령어 실행 시 트랜잭션 정보는 출력되지만 "Deployed to:" 메시지가 나타나지 않음
- nonce가 증가하지 않음 (0x0에서 변하지 않음)
- 실제 블록체인에 컨트랙트가 배포되지 않음

**원인:**
Foundry가 기본적으로 "dry run" 모드로 실행되어 실제 트랜잭션을 브로드캐스트하지 않음.

**해결 방법:**
`forge create` 대신 `forge script`를 사용하여 배포:

```bash
# 문제가 있던 방법
forge create --rpc-url http://localhost:8545 --private-key <KEY> src/Ticket.sol:TicketSBT --constructor-args ...

# 해결된 방법
forge script script/deploy.s.sol --rpc-url http://localhost:8545 --private-key <KEY> --broadcast -vvv
```

### 3. 웹 앱 환경 변수 캐싱 문제

**증상:**
`.env.local` 파일을 업데이트해도 웹 앱이 이전 CONTRACT_ADDRESS를 계속 사용

**원인:**
Docker 컨테이너의 환경 변수 캐싱 및 애플리케이션 레벨 캐싱

**해결 방법:**
컨테이너 완전 재시작:
```bash
docker-compose stop web
docker-compose up -d web
```

## 정상 작동 확인 방법

### 1. Anvil 연결 테스트
```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545
```

**예상 응답:**
```json
{"jsonrpc":"2.0","id":1,"result":"0x0"}
```

### 2. 컨트랙트 배포 확인
```bash
# 트랜잭션 카운트 확인 (배포 후 0x0에서 증가해야 함)
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getTransactionCount","params":["0xf39fd6e51aad88f6f4ce6ab8827279cffFb92266", "latest"],"id":1}' \
  http://localhost:8545
```

### 3. 웹 앱 API 테스트
```bash
curl "http://localhost:3000/api/balance?address=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
```

**성공 시 예상 응답:**
```json
{
  "success": true,
  "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "ethBalance": "9998.9981",
  "nftBalance": "0",
  "totalSupply": "0"
}
```

## 블록체인 상태 유지하기

- Anvil 컨테이너는 `/data/anvil-state.json` 파일을 사용해 체인 상태를 저장하고 불러옵니다.
- `docker-compose down` 이후 다시 `docker-compose up -d`를 실행해도 `anvil-data` 볼륨 덕분에 이전 트랜잭션과 컨트랙트가 유지됩니다.
- 상태를 초기화하고 싶다면 `docker volume rm ticketing-system_anvil-data` 명령으로 볼륨을 삭제하거나, 컨테이너 내부의 `/data/anvil-state.json` 파일을 지우세요.

## 컨트랙트 배포 단계별 가이드

### 1. Anvil 시작 확인
```bash
docker-compose up -d anvil
docker-compose logs anvil
```

Anvil이 `0.0.0.0:8545`에서 리스닝하고 있는지 확인.

### 2. 컨트랙트 컴파일
```bash
docker-compose exec anvil sh -c "cd /workspace/contracts && forge build"
```

### 3. 컨트랙트 배포
```bash
docker-compose exec anvil sh -c "cd /workspace/contracts && FOUNDRY_DISABLE_NIGHTLY_WARNING=true forge script script/deploy.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast -vvv"
```

### 4. 배포된 컨트랙트 주소 확인
배포 출력에서 다음과 같은 메시지 확인:
```
== Logs ==
  TicketSBT contract deployed at: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.
```

### 5. 환경 변수 업데이트
`.env.local` 파일의 `CONTRACT_ADDRESS`를 새로운 주소로 업데이트:
```
CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

### 6. 웹 앱 재시작
```bash
docker-compose restart web
```

## 트러블슈팅 체크리스트

문제가 발생했을 때 다음 순서로 확인:

1. **Anvil 상태 확인**
   - `docker-compose ps` - Anvil 컨테이너가 실행 중인지
   - `docker-compose logs anvil` - 0.0.0.0:8545에서 리스닝하는지

2. **네트워크 연결 확인**
   - 호스트에서 `curl http://localhost:8545` RPC 호출 테스트
   - 웹 컨테이너에서 anvil 컨테이너로의 연결 확인

3. **컨트랙트 배포 확인**
   - nonce 확인으로 실제 트랜잭션 전송 여부 확인
   - `forge script` 사용하여 실제 브로드캐스트 실행

4. **환경 변수 확인**
   - `.env.local`의 `CONTRACT_ADDRESS`가 정확한지
   - 웹 컨테이너 재시작 후 새 환경 변수 적용 확인

## 참고사항

- Anvil 기본 계정: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- 해당 계정의 Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- Chain ID: `31337`
- 기본 잔액: 각 계정마다 10,000 ETH

## 최종 확인된 작동하는 설정

### docker-compose.yml
```yaml
services:
  anvil:
    build: ./anvil
    ports:
      - "8545:8545"
    volumes:
      - ./anvil:/workspace
    command: ["--host", "0.0.0.0", "--port", "8545", "--chain-id", "31337"]
```

### anvil/Dockerfile
```dockerfile
FROM ghcr.io/foundry-rs/foundry:latest
WORKDIR /workspace
COPY . .
RUN cd contracts && forge install --no-commit
ENTRYPOINT ["anvil"]
CMD ["--host", "0.0.0.0", "--port", "8545", "--chain-id", "31337"]
```

### .env.local
```
CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
ANVIL_RPC_URL=http://localhost:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

이 설정으로 웹 앱에서 Anvil 블록체인에 성공적으로 연결하고 컨트랙트와 상호작용할 수 있습니다.
