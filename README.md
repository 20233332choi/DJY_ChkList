# DJY 공유 체크리스트

장비 체크리스트를 여러 사람이 동시에 사용할 수 있는 간단한 Node.js 웹앱입니다. 데이터는 별도 DB 없이 `data.json`에 저장됩니다.

## 필요 조건

- Node.js 18 이상
- Git
- ngrok 공유를 쓸 경우 ngrok 계정과 authtoken

## 처음 실행

```bash
git clone git@github.com:20233332choi/DJY_ChkList.git
cd DJY_ChkList
npm start
```

브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:3000
```

처음 접속하면 이름을 한 번 입력합니다. 입력한 이름은 해당 브라우저에 저장되고, 앱 화면에서는 변경 버튼을 제공하지 않습니다.

## ngrok으로 외부 공유

`.env.example`을 `.env`로 복사한 뒤 ngrok 토큰을 넣습니다.

```env
PORT=3000
NGROK_AUTHTOKEN=여기에_토큰_입력
```

그 다음 실행합니다.

```bash
npm run share
```

앱 서버와 ngrok 터널이 같이 실행됩니다. ngrok이 표시하는 `https://...ngrok-free.app` 주소를 다른 사용자에게 공유하면 됩니다.

`ngrok` 또는 `ngrok.exe`가 PATH에 있으면 자동으로 사용합니다. 다른 위치에 설치했다면 `.env`에 아래 값을 추가합니다.

```env
NGROK_BIN=/path/to/ngrok
```

예약 도메인을 쓰는 경우에는 아래 값을 추가할 수 있습니다.

```env
NGROK_DOMAIN=your-domain.ngrok-free.app
```

## 주요 기능

- 품목 체크/해제
- 여러 브라우저 실시간 동기화
- 품목/카테고리 추가, 수정, 삭제, 순서 변경
- 체크한 사람 이름 표시
- 체크, 체크 해제, 품목 추가, 카테고리 추가 로그 기록
- 상세 로그는 `로그 보기` 화면에서 확인

## 파일 구조

- `server.js`: API 서버와 실시간 이벤트 처리
- `data.json`: 체크리스트 상태와 로그 저장 파일
- `public/`: 브라우저 화면 파일
- `scripts/start-with-ngrok.sh`: 앱 서버와 ngrok을 같이 실행하는 스크립트
- `.env.example`: ngrok 설정 예시
- `.gitignore`: `.env`와 불필요한 로컬 파일 제외

## 다른 컴퓨터에서 실행할 때

1. 저장소를 clone합니다.
2. Node.js 18 이상이 설치되어 있는지 확인합니다.
3. `npm start`를 실행합니다.
4. 외부 공유가 필요하면 `.env.example`을 `.env`로 복사하고 ngrok 토큰을 넣은 뒤 `npm run share`를 실행합니다.

이 프로젝트는 외부 npm 패키지를 사용하지 않으므로 `npm install` 없이도 실행됩니다.

## 주의 사항

- `data.json` 하나에 상태를 저장하므로 서버 프로세스는 하나만 실행하세요.
- 여러 사용자가 브라우저로 동시에 접속하는 것은 괜찮습니다.
- `.env`에는 ngrok 토큰이 들어가므로 GitHub에 올리지 않습니다.
- 이름 고정은 브라우저 저장소 기반입니다. 강한 인증이나 사칭 방지가 필요한 구조는 아닙니다.
