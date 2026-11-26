# 블루 아카이브 총력전 시뮬레이터

학생 6명을 편성하고 EX 스킬의 사용 순서와 대상을 정한 뒤 단계별로 연습하는 팬 도구입니다.

## GitHub Pages 배포

1. 이 폴더의 내용을 GitHub 저장소의 `main` 브랜치에 올립니다. `dist`와 `.github/workflows`를 포함합니다.
2. 저장소의 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택합니다.
3. **Actions → Deploy to GitHub Pages → Run workflow**에서 `main`으로 첫 배포를 실행합니다. 이후 `main`에 푸시하면 자동으로 배포됩니다.
4. 배포가 완료되면 **Settings → Pages**에서 사이트 주소를 확인할 수 있습니다. 프로젝트 사이트의 기본 주소는 `https://<GitHub-계정>.github.io/<저장소>/` 형식입니다.

워크플로는 `dist` 안의 정적 파일을 바로 배포합니다. 학생 데이터와 아이콘도 해당 폴더에 포함되어 있습니다.

일반 GitHub Pages 사이트는 인터넷에 공개됩니다. 비공개 저장소에 대한 Pages 지원과 사이트 접근 제어는 [GitHub Pages 요금제 및 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)에서 확인할 수 있습니다.

## 로컬에서 열기

`dist/index.html`을 브라우저에서 엽니다. 편성과 진행 상태는 접속한 주소의 브라우저 저장소에 저장됩니다.

## 데이터 출처

- 한국어 학생 데이터 및 아이콘 [SchaleDB](https://github.com/SchaleDB/SchaleDB)
- 리오와 키사키 데이터 및 아이콘 [SchaleDB 포크](https://github.com/nico0748/SchaleDB)
