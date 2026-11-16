# 인생재판소 — 웹퍼블리싱 패키지 (PBLⅠ 10주차 · v0.2 픽셀 에디션)

싸움을 이기는 앱 말고, 싸움을 끝내는 게임. 사소한 갈등과 사소한 잘못을 AI 픽셀 법정에서 끝내는 서비스의 10주차 초안입니다.

| 파일 | 내용 |
|---|---|
| `index.html` | 사업소개 랜딩페이지 (픽셀 스타일) |
| `app.html` | 알고리즘 프로토타입 — 픽셀 법정 게임 (같이 재판 · 혼자 사연 접수 · 자수하기) |
| `deck.html` | 상품소개 HTML 슬라이드 13장 (←/→ 키, 클릭, 스와이프 · 인쇄하면 PDF) |
| `fonts/` | 갈무리(Galmuri11) 픽셀 폰트 + 라이선스(SIL OFL) |
| `favicon.svg`, `netlify.toml`, `.nojekyll` | 배포 설정 |

빌드 과정이 없는 정적 사이트라서 이 폴더를 그대로 올리면 됩니다.

## 방법 A. Netlify Drop (가장 빠름)
1. https://app.netlify.com/drop 접속 → 로그인
2. 이 폴더(`인생재판소_site`) 전체를 끌어다 놓기
3. 생성된 주소 확인 → Site configuration → Change site name 으로 이름 변경

## 방법 B. GitHub Pages
1. 새 저장소(Public) 생성 → Add file → Upload files 로 폴더 안 파일 전부 업로드(`fonts` 폴더 포함)
2. Settings → Pages → Deploy from a branch → main / (root) → Save
3. `https://<아이디>.github.io/<저장소>/` 확인

## 방법 C. GitHub + Netlify 자동 배포 (팀 작업 추천)
GitHub 저장소를 Netlify에서 Import → Build command 비움, Publish directory `.`

## 게임 방법
- PRESS START → 모드 선택(↑↓ 또는 클릭) → 예시 사건 선택 → 개정!
- 대화창 클릭 / Space 로 대사 넘기기, AUTO 자동 진행, “이의 있음!”으로 추가 진술
- 자수하기 모드는 마지막에 **최후 진술**을 입력하면 형량에 반영(정상참작 / 괘씸죄)
- 판결 후 **형 집행 퀘스트**: 사과문·반성문 AI 심사, 양심 코인 벌금, 쓰레기 줍기 미니게임, 잔소리, 괘씸죄 룰렛
- 레벨·코인·칭호·재판 기록은 이 브라우저에만 저장됩니다(기록부에서 초기화 가능)
- **엔진** 버튼: 판결 계산 과정 공개 · **LLM 모드**: Claude API 키 입력(메모리에만 보관, 시연용)

인생재판소는 엔터테인먼트·관계 중재 서비스이며 법률·심리 상담을 대신하지 않습니다.
