# 우리반 부동산 (Cloudflare Pages)

지금 Claude에서 쓰는 버전과 같은 화면·기능이고, 입력해 둔 값(9월 시세, 10월 확정 시세, 10월 학생 의견 419건)이 시드 파일에 들어 있어요.
학생 화면에는 가격·순위·다른 친구의 의견이 보이지 않고, 교사 로그인(비밀번호)을 해야 볼 수 있어요.

## 파일
- public/index.html          … 화면 전체 (학생 화면 / 교사 화면)
- functions/api/[[route]].js … 서버 API (평가 저장, 교사 결과 조회, 설정·확정 저장)
- seed/kv-seed.json          … 처음에 한 번 넣을 데이터 (학생 이름·의견이 들어 있어요. 인터넷에 공개되지 않아요)
- wrangler.toml              … Pages 설정 + KV 연결(SEATS)
- .dev.vars.example          … 내 컴퓨터에서 시험할 때 쓰는 비밀번호 예시

## 처음 배포 (Node.js 18 이상, 이 폴더에서 실행)
1. npx wrangler login
2. npx wrangler kv namespace create SEATS
   → 출력된 id를 wrangler.toml의 id 자리에 붙여넣기
3. npx wrangler pages project create oct-realestate --production-branch=main
4. npx wrangler pages secret put ADMIN_PASSWORD --project-name oct-realestate
   → 교사 비밀번호 입력
5. npx wrangler pages deploy
6. 처음 데이터 넣기 (한 번만, 명령어 없이):
   교사 로그인 → 교사 설정 아래 "처음 데이터 불러오기"에서 seed/kv-seed.json 파일을 골라 "불러오기".
   (명령어로 하려면: npx wrangler kv bulk put seed/kv-seed.json --binding SEATS --remote)
7. 나온 주소(https://oct-realestate.pages.dev)를 학생들에게 공유. 교사는 화면 맨 아래 "교사 로그인".

## 데이터를 넣고 나서 확인
교사 로그인 → 10월 탭에서 5-2 자리가 940, 1-2 자리가 260(🔒)으로 보이면 정상이에요.
자리를 누르면 호/불호 합계와 학생별 의견이 나와요. 학생들은 지금 11월을 평가해요.

## 이미 배포했다면 (수정만 다시 올리기)
파일을 교체하고  npx wrangler pages deploy  만 다시 실행하세요. 시드(6번)는 다시 하지 않아도 돼요.

## 사용 흐름 (교사)
1. 교사 설정에서 "학생이 지금 평가하는 달"을 고르면 학생들은 그 달을 평가해요.
2. 평가가 끝난 달은 "○월 시세 확정"을 눌러 가격을 고정해요. 다음 달은 이 가격에서 시작해요.
3. 맨 위 "👀 학생 화면 미리보기"로 학생이 보는 화면을 확인할 수 있어요 (저장되지 않아요).

## 알아둘 점
- 학생 이름이 같으면 같은 자리 평가를 덮어써요. 동명이인은 "김민수A"처럼 구분해 주세요.
- 학생이 저장한 평가가 교사 화면에 보이기까지 최대 1분쯤 걸릴 수 있어요 (새로고침 링크로 바로 확인 가능).
- 내 컴퓨터에서 시험:  cp .dev.vars.example .dev.vars  →  npx wrangler pages dev

## GitHub 저장소로 배포하는 경우
- 저장소가 Public이면 seed 폴더는 올리지 마세요 (학생 이름·의견이 공개돼요). 올릴 것: public, functions, wrangler.toml, README.md, .gitignore
- Cloudflare 대시보드에서 Pages 프로젝트에 ADMIN_PASSWORD(비밀)와 KV 연결(변수 이름 SEATS)을 설정한 뒤, 위 6번의 불러오기 버튼으로 데이터를 넣으세요.
