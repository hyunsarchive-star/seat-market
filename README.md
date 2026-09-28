# 10월 부동산 (Cloudflare Pages)

## 구조
- public/index.html          … 화면 전체 (학생/교사 화면)
- functions/api/[[route]].js … 서버 API (평가 저장, 교사 결과 조회, 9월 시세 저장)
- wrangler.toml              … Pages 설정 + KV 바인딩(SEATS)
- .dev.vars.example          … 로컬 테스트용 교사 비밀번호 예시

## 배포 (Wrangler)
1. Node.js 18+ 설치 후 이 폴더에서:  npx wrangler login
2. KV 만들기:  npx wrangler kv namespace create SEATS
   → 출력된 id를 wrangler.toml의 id에 붙여넣기
3. 프로젝트 만들기:  npx wrangler pages project create oct-realestate --production-branch=main
4. 교사 비밀번호 등록:  npx wrangler pages secret put ADMIN_PASSWORD --project-name oct-realestate
5. 배포:  npx wrangler pages deploy
6. 주소(https://oct-realestate.pages.dev)를 학생에게 공유. 교사는 화면 맨 아래 "교사 로그인".

## 로컬 테스트
cp .dev.vars.example .dev.vars  →  npx wrangler pages dev
