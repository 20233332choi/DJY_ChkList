# DJY 공유 체크리스트

## 실행

```bash
cd /mnt/f/DJYchkList
npm start
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## ngrok 공유

서버를 켠 상태에서 다른 터미널을 열고 실행합니다.

```bash
ngrok http 3000
```

ngrok이 표시하는 `https://...ngrok-free.app` 주소를 공유하면 됩니다.

## 파일

- `data.json`: 체크리스트 품목과 체크 상태 저장
- `server.js`: 공유 상태 API와 실시간 갱신 서버
- `public/`: 화면 파일
