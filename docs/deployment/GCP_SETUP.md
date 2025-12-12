# GCP Cloud Run 배포 설정 가이드

## 개요

GitHub `main` 브랜치에 푸시하면 자동으로 GCP Cloud Run에 배포됩니다.

```
git push origin main → GitHub Actions → Cloud Build → Cloud Run
                              ↓
                    Secret Manager (환경변수, X.509 인증서)
```

---

## 1. GCP 프로젝트 설정

### 1.1 필요한 API 활성화

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com
```

### 1.2 Artifact Registry 저장소 생성

```bash
gcloud artifacts repositories create signature \
  --repository-format=docker \
  --location=asia-northeast3 \
  --description="PhotoSignature API images"
```

---

## 2. Secret Manager 설정

### 2.1 MongoDB URI 시크릿 생성

```bash
# MongoDB Atlas 연결 문자열 저장 (X.509 인증)
echo -n "mongodb+srv://photosignature.n9y5gh2.mongodb.net/?authSource=%24external&authMechanism=MONGODB-X509&appName=photosignature" | \
  gcloud secrets create mongodb-uri --data-file=-
```

### 2.2 X.509 인증서 시크릿 생성

```bash
# X.509 인증서 파일을 시크릿으로 저장
gcloud secrets create mongodb-cert --data-file=./X509-cert-5100237222380657527.pem
```

### 2.3 시크릿 버전 확인

```bash
gcloud secrets versions list mongodb-uri
gcloud secrets versions list mongodb-cert
```

---

## 3. Workload Identity Federation 설정

> GitHub Actions에서 GCP에 안전하게 인증하기 위한 설정입니다.
> 서비스 계정 키 파일 없이 OIDC 토큰 기반으로 인증합니다.

### 3.1 서비스 계정 생성

```bash
PROJECT_ID=$(gcloud config get-value project)

gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account"
```

### 3.2 서비스 계정에 권한 부여

```bash
SA_EMAIL="github-actions@${PROJECT_ID}.iam.gserviceaccount.com"

# Cloud Run 배포 권한
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

# Artifact Registry 푸시 권한
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

# Secret Manager 접근 권한
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

# Service Account 사용 권한 (Cloud Run에서 사용)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"
```

### 3.3 Workload Identity Pool 생성

```bash
gcloud iam workload-identity-pools create github-pool \
  --location="global" \
  --display-name="GitHub Actions Pool"
```

### 3.4 OIDC Provider 생성

```bash
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

### 3.5 서비스 계정에 Workload Identity 바인딩

```bash
# YOUR_GITHUB_ORG/YOUR_REPO를 실제 값으로 변경
GITHUB_REPO="YOUR_GITHUB_ORG/signature-mongodb"

gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_REPO}"
```

### 3.6 Provider 전체 이름 확인

```bash
# GitHub Secrets에 저장할 값
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

echo "WIF_PROVIDER: projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo "WIF_SERVICE_ACCOUNT: ${SA_EMAIL}"
```

---

## 4. GitHub Secrets 설정

GitHub 저장소 → Settings → Secrets and variables → Actions에서 다음 시크릿 추가:

| Secret Name | Value | 설명 |
|-------------|-------|------|
| `GCP_PROJECT_ID` | `your-project-id` | GCP 프로젝트 ID |
| `WIF_PROVIDER` | `projects/123.../providers/github-provider` | 3.6에서 확인한 값 |
| `WIF_SERVICE_ACCOUNT` | `github-actions@xxx.iam.gserviceaccount.com` | 3.6에서 확인한 값 |

---

## 5. 수동 배포 (첫 배포 또는 테스트)

### 5.1 로컬에서 Docker 이미지 빌드 및 푸시

```bash
PROJECT_ID=$(gcloud config get-value project)
REGION=asia-northeast3

# 이미지 빌드
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/signature/signature-api:latest .

# Artifact Registry 인증
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# 이미지 푸시
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/signature/signature-api:latest
```

### 5.2 Cloud Run 배포

```bash
gcloud run deploy signature-api \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/signature/signature-api:latest \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-secrets "MONGODB_URI=mongodb-uri:latest" \
  --update-secrets "/secrets/mongodb-cert/cert.pem=mongodb-cert:latest" \
  --set-env-vars "NODE_ENV=production,MONGODB_DB_NAME=photosignature,MONGODB_CERT_PATH=/secrets/mongodb-cert/cert.pem"
```

---

## 6. 배포 확인

```bash
# 서비스 URL 확인
gcloud run services describe signature-api --region asia-northeast3 --format 'value(status.url)'

# 헬스체크
curl https://signature-api-xxxxx.asia-northeast3.run.app/health
```

---

## 7. 로그 확인

```bash
# 실시간 로그 스트리밍
gcloud run logs tail signature-api --region asia-northeast3

# 특정 시간대 로그 조회
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=signature-api" --limit 100
```

---

## 8. 환경별 배포 (선택사항)

### 8.1 staging 환경 추가

`.github/workflows/deploy-staging.yml` 생성:

```yaml
on:
  push:
    branches:
      - dev

env:
  SERVICE_NAME: signature-api-staging
  # ... (나머지 동일)
```

### 8.2 프로덕션 배포 승인 추가

GitHub Environments 설정에서 `production` 환경 생성 후 required reviewers 추가.

---

## 문제 해결

### X.509 인증서 연결 실패

1. Secret Manager에 인증서가 올바르게 저장되었는지 확인
2. Cloud Run 서비스가 Secret에 접근 권한이 있는지 확인
3. 인증서 경로가 `/secrets/mongodb-cert/cert.pem`으로 설정되었는지 확인

### Cold Start 시간이 긴 경우

- `--min-instances 1` 설정으로 최소 1개 인스턴스 유지
- 메모리/CPU 증가 고려

### MongoDB Atlas IP 화이트리스트

Cloud Run은 고정 IP가 없으므로:
1. Atlas에서 **"Allow access from anywhere"** 설정 (0.0.0.0/0)
2. 또는 Cloud NAT를 사용하여 고정 IP 설정 (추가 비용)
