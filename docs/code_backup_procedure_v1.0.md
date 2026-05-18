# 코드 백업·복원 표준 절차 v1.0

> **작성일: 2026-05-18 | 적용 범위: 모든 큰 변경 작업 시작 직전**
>
> CLAUDE.md 메모리 "Root flat 잔재 파일 위험성"(2026-05-03 사고) 재발 방지를 위한 표준화된 백업·복원 절차.

---

## 1. 백업 원칙

### 절대 금지
- **`*.bak.YYYYMMDD` 파일 생성** (예: `scan.py.bak.20260518`)
  - 사유: 서버에 동명 파일이 여러 위치에 존재 가능 → import 경로 정답 파일 판별 혼동
  - 사례: 2026-05-03 `routers/scan.py`와 `routers/scan.py.server_backup`이 혼재해 수정 누락 사고 발생
- **`*_backup.py` 또는 `*_old.py` 파일 생성** (같은 디렉터리 내)
- **`backend/_archive/`, `backend/_old/` 등 backend 내부 보관 디렉터리** (Python import 경로 오염 위험)

### 권장 (이중 백업)
1. **git branch** — 가장 빠른 복원, 모든 파일 자동 추적
2. **외부 디렉터리 백업** — `C:\app_build\aeolab\_backup\YYYYMMDD\` (git 추적 제외, backend/frontend 외부)

---

## 2. 작업 직전 백업 실행 절차

### 2-1. 로컬 백업 (Windows PowerShell, 5분)

```powershell
# 작업 시작 직전, C:\app_build\aeolab 디렉터리에서 실행
cd C:\app_build\aeolab

# Step 1: 현재 작업 중 modified 파일 확인 (untracked·modified 모두 표시)
git status

# Step 2: 진행 중 변경이 있으면 stash로 보관
git stash push -u -m "WIP-before-backup-20260518"

# Step 3: backup 브랜치 생성 (현재 main 상태 보존)
git branch backup/naver-ai-optimization-20260518

# Step 4: stash 복원
git stash pop

# Step 5: 외부 디렉터리에 변경 예정 파일 복사 (이중 안전망)
$BACKUP_DIR = "C:\app_build\aeolab\_backup\20260518"
New-Item -ItemType Directory -Force -Path $BACKUP_DIR

# 변경 예정 파일 목록 (작업별로 갱신)
$FILES = @(
    "backend\services\ai_scanner\naver_scanner.py",
    "backend\services\score_engine.py",
    "backend\services\keyword_taxonomy.py",
    "backend\services\briefing_engine.py",
    "backend\routers\report.py",
    "backend\routers\guide.py",
    "frontend\components\dashboard\AiTabPreviewCard.tsx",
    "frontend\components\dashboard\AiInfoTabStatusCard.tsx",
    "frontend\app\(dashboard)\guide\ai-info-tab\AiInfoTabGuide.tsx"
)

foreach ($f in $FILES) {
    if (Test-Path $f) {
        $dest = Join-Path $BACKUP_DIR (Split-Path $f -Leaf)
        Copy-Item $f $dest
        Write-Host "Backed up: $f -> $dest"
    } else {
        Write-Host "MISSING: $f" -ForegroundColor Yellow
    }
}

# Step 6: .gitignore에 _backup/ 추가 확인
if (-not (Select-String -Path .gitignore -Pattern "^_backup/" -Quiet)) {
    Add-Content .gitignore "_backup/"
    Write-Host "Added _backup/ to .gitignore"
}
```

### 2-2. 서버 백업 (SSH, 3분)

```bash
# 작업 시작 직전 실행
ssh root@115.68.231.57 << 'EOF'
BACKUP_DIR=/var/www/aeolab/_backup/20260518
mkdir -p $BACKUP_DIR

# 변경 예정 파일 백업 (작업별 갱신)
FILES=(
    "backend/services/ai_scanner/naver_scanner.py"
    "backend/services/score_engine.py"
    "backend/services/keyword_taxonomy.py"
    "backend/services/briefing_engine.py"
    "backend/routers/report.py"
    "backend/routers/guide.py"
    "frontend/components/dashboard/AiTabPreviewCard.tsx"
    "frontend/components/dashboard/AiInfoTabStatusCard.tsx"
    "frontend/app/(dashboard)/guide/ai-info-tab/AiInfoTabGuide.tsx"
)

for f in "${FILES[@]}"; do
    src="/var/www/aeolab/$f"
    if [ -f "$src" ]; then
        cp "$src" "$BACKUP_DIR/$(basename $f)"
        echo "Backed up: $f"
    else
        echo "MISSING: $f"
    fi
done

ls -la $BACKUP_DIR
EOF
```

### 2-3. 백업 검증

```powershell
# 로컬: 백업 디렉터리 파일 수 확인
Get-ChildItem C:\app_build\aeolab\_backup\20260518 | Measure-Object | Select-Object -Expand Count

# git branch 확인
git branch -a | Select-String "backup/"
```

```bash
# 서버: 백업 디렉터리 파일 수 확인
ssh root@115.68.231.57 "ls /var/www/aeolab/_backup/20260518 | wc -l"
```

---

## 3. 복원 절차 (사고 시)

### 3-1. 단일 파일 복원 (가장 흔한 경우)

```powershell
# 로컬 git branch 복원
git checkout backup/naver-ai-optimization-20260518 -- backend/services/ai_scanner/naver_scanner.py

# 또는 외부 백업 복원
Copy-Item C:\app_build\aeolab\_backup\20260518\naver_scanner.py C:\app_build\aeolab\backend\services\ai_scanner\
```

```bash
# 서버 복원
ssh root@115.68.231.57 "cp /var/www/aeolab/_backup/20260518/naver_scanner.py /var/www/aeolab/backend/services/ai_scanner/ && pm2 restart aeolab-backend"
```

### 3-2. 전체 복원 (배포 전 마지막 안전망)

```powershell
# 로컬 전체 복원 (branch checkout 방식)
git checkout backup/naver-ai-optimization-20260518
# 검토 후 main으로 force reset 또는 cherry-pick
```

```bash
# 서버 전체 복원
ssh root@115.68.231.57 << 'EOF'
cd /var/www/aeolab
for f in _backup/20260518/*; do
    name=$(basename $f)
    # 원본 위치 찾아서 복원 (수동 매핑 필요)
    case $name in
        naver_scanner.py) cp $f backend/services/ai_scanner/ ;;
        score_engine.py) cp $f backend/services/ ;;
        keyword_taxonomy.py) cp $f backend/services/ ;;
        briefing_engine.py) cp $f backend/services/ ;;
        report.py) cp $f backend/routers/ ;;
        guide.py) cp $f backend/routers/ ;;
        AiTabPreviewCard.tsx) cp $f frontend/components/dashboard/ ;;
        AiInfoTabStatusCard.tsx) cp $f frontend/components/dashboard/ ;;
        AiInfoTabGuide.tsx) cp $f frontend/app/\(dashboard\)/guide/ai-info-tab/ ;;
    esac
done
pm2 restart all
EOF
```

### 3-3. 부분 복원 (특정 함수만 되돌리기)

git history 활용:
```powershell
# 1줄짜리 변경만 되돌리기
git log --oneline -5 backend/services/score_engine.py
git checkout <commit-hash> -- backend/services/score_engine.py
# 또는
git diff backup/naver-ai-optimization-20260518 main -- backend/services/score_engine.py
```

---

## 4. 백업 디렉터리 정리

### 보관 기간
- **단기 (1주)**: `_backup/YYYYMMDD/` — 작업 직후 안정성 확인 기간
- **중기 (1개월)**: git branch `backup/<topic>-YYYYMMDD` — 모니터링 기간
- **장기**: main 브랜치 git history (영구)

### 정리 스크립트 (1개월 후)

```powershell
# 1개월 이전 _backup 디렉터리 삭제 (로컬)
Get-ChildItem C:\app_build\aeolab\_backup -Directory |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddMonths(-1) } |
  Remove-Item -Recurse -Force
```

```bash
# 서버 동일 정리
ssh root@115.68.231.57 "find /var/www/aeolab/_backup -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;"
```

### git branch 정리

```bash
# 머지 완료 후 1개월 경과한 backup 브랜치 삭제
git branch -d backup/naver-ai-optimization-20260518  # 머지된 경우
git branch -D backup/naver-ai-optimization-20260518  # 강제 (사용 주의)
```

---

## 5. 작업 종류별 백업 체크리스트

### 백엔드 단일 파일 수정
- [ ] git branch 생성 (`backup/<topic>-YYYYMMDD`)
- [ ] 외부 디렉터리에 해당 파일 1개 복사
- [ ] 서버 동일 위치 백업
- [ ] 변경 후 SSH grep 검증

### 백엔드 다중 파일 + 신규 모듈
- [ ] git branch 생성
- [ ] 외부 디렉터리에 변경 예정 파일 전체 + 신규 모듈 자리 표시
- [ ] 서버 동일 위치 백업
- [ ] DB 마이그레이션 있으면 `pg_dump` 스키마 백업
- [ ] PM2 restart 후 error.log 60줄 확인

### 프론트엔드 단일 컴포넌트
- [ ] git branch 생성
- [ ] 외부 디렉터리 백업
- [ ] 서버 빌드 직전 백업
- [ ] 빌드 성공 후 PM2 restart

### DB 마이그레이션
- [ ] git branch 생성 (`scripts/supabase_schema.sql` 백업)
- [ ] Supabase Dashboard에서 현재 스키마 export → `_backup/YYYYMMDD/schema.sql`
- [ ] ALTER 실행 전 영향 행 수 SELECT COUNT 확인
- [ ] graceful fallback 코드 확인 (컬럼 부재 시 동작)

---

## 6. 백업 누락 시 대응

만약 백업 없이 변경한 경우:
1. **즉시 변경 중단**
2. `git stash push -u -m "EMERGENCY-uncommitted"` 또는 `git diff > emergency_patch.diff`
3. git history 확인 — 최근 commit으로 되돌릴 수 있는지
4. 서버 백업 디렉터리에 동명 파일 있는지 확인 (`_backup/*/` 또는 `_archive/` 등)
5. CLAUDE.md "Root flat 잔재 파일 위험성" 메모리 재확인

---

## 7. 자동화 권장 사항 (미래)

- pre-commit hook: `_backup/` 디렉터리 자동 생성 + 변경 파일 사전 복사
- post-deploy hook: 서버 측 자동 백업 + 30일 후 자동 정리
- GitHub Actions: backup branch 자동 push (origin 보호)

---

## 8. 변경 이력

| 일자 | 변경 |
|------|------|
| 2026-05-18 | v1.0 신규 작성 — 2026-05-03 root flat 잔재 사고 재발 방지 |

---

*다음 갱신: 자동화 hook 도입 시 / 새 사고 패턴 발견 시*
