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

### 2.4 Cloud Run 기본 서비스 계정에 Secret 접근 권한 부여

```bash
gcloud projects add-iam-policy-binding $(gcloud config get-value project) --member="serviceAccount:$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

---

## 3. Workload Identity Federation 설정

> GitHub Actions에서 GCP에 안전하게 인증하기 위한 설정입니다.
> 서비스 계정 키 파일 없이 OIDC 토큰 기반으로 인증합니다.

### 3.1 서비스 계정 생성

```bash
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account"
```

### 3.2 서비스 계정에 권한 부여

```bash
# Cloud Run 배포 권한
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:github-actions@$(gcloud config get-value project).iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Artifact Registry 푸시 권한
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:github-actions@$(gcloud config get-value project).iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Secret Manager 접근 권한
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:github-actions@$(gcloud config get-value project).iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Service Account 사용 권한 (Cloud Run에서 사용)
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:github-actions@$(gcloud config get-value project).iam.gserviceaccount.com" \
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
gcloud iam service-accounts add-iam-policy-binding "github-actions@$(gcloud config get-value project).iam.gserviceaccount.com" --role="roles/iam.workloadIdentityUser" --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/yoongi-photosignature/signature-api"
```

### 3.6 Provider 전체 이름 확인

```bash
# GitHub Secrets에 저장할 값
echo "WIF_PROVIDER: projects/$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo "WIF_SERVICE_ACCOUNT: github-actions@$(gcloud config get-value project).iam.gserviceaccount.com"
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
# 이미지 빌드 (Cloud Run은 linux/amd64 필요)
docker build --platform linux/amd64 -t asia-northeast3-docker.pkg.dev/$(gcloud config get-value project)/signature/signature-api:latest .

# Artifact Registry 인증
gcloud auth configure-docker asia-northeast3-docker.pkg.dev

# 이미지 푸시
docker push asia-northeast3-docker.pkg.dev/$(gcloud config get-value project)/signature/signature-api:latest
```

### 5.2 Cloud Run 배포

```bash
gcloud run deploy signature-api \
  --image asia-northeast3-docker.pkg.dev/$(gcloud config get-value project)/signature/signature-api:latest \
  --region asia-northeast3 \
  --platform managed \
  --no-allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --set-secrets "MONGODB_URI=mongodb-uri:latest,/secrets/mongodb-cert/cert.pem=mongodb-cert:latest" \
  --set-env-vars "NODE_ENV=production,MONGODB_DB_NAME=photosignature,MONGODB_CERT_PATH=/secrets/mongodb-cert/cert.pem"
```

---

## 6. API Gateway 설정 (키오스크 인증)

API Gateway를 통해 API Key 기반 인증을 적용합니다.

```
키오스크 → [API Gateway] → Cloud Run
            (API Key 검증)    (실제 로직)
```

### 6.1 API 활성화

```bash
gcloud services enable apigateway.googleapis.com servicecontrol.googleapis.com servicemanagement.googleapis.com
```

### 6.2 API Gateway용 서비스 계정 생성

```bash
gcloud iam service-accounts create api-gateway --display-name="API Gateway Service Account"

# Cloud Run 호출 권한 부여
gcloud run services add-iam-policy-binding signature-api --region=asia-northeast3 --member="serviceAccount:api-gateway@$(gcloud config get-value project).iam.gserviceaccount.com" --role=roles/run.invoker
```

### 6.3 OpenAPI 스펙 파일 생성

`api-spec.yaml` 파일 생성:

```yaml
swagger: "2.0"
info:
  title: Signature API Gateway
  version: "1.0.0"
schemes:
  - https
produces:
  - application/json
x-google-backend:
  address: CLOUD_RUN_URL
  deadline: 30.0
security:
  - api_key: []
securityDefinitions:
  api_key:
    type: apiKey
    name: x-api-key
    in: header
paths:
  /:
    get:
      operationId: root
      responses:
        200:
          description: OK
  /health:
    get:
      operationId: health
      responses:
        200:
          description: OK
  /api/sales:
    post:
      operationId: createSale
      responses:
        201:
          description: Created
  /api/sales/{id}:
    get:
      operationId: getSale
      parameters:
        - name: id
          in: path
          required: true
          type: string
      responses:
        200:
          description: OK
  /api/sales/{id}/refund:
    put:
      operationId: refundSale
      parameters:
        - name: id
          in: path
          required: true
          type: string
      responses:
        200:
          description: OK
  /api/settlement/monthly:
    get:
      operationId: monthlySettlement
      responses:
        200:
          description: OK
  /api/settlement/domestic:
    get:
      operationId: domesticSettlement
      responses:
        200:
          description: OK
  /api/settlement/overseas:
    get:
      operationId: overseasSettlement
      responses:
        200:
          description: OK
```

### 6.4 Cloud Run URL로 스펙 파일 업데이트

```bash
# Cloud Run URL 가져오기
CLOUD_RUN_URL=$(gcloud run services describe signature-api --region asia-northeast3 --format 'value(status.url)')

# 스펙 파일의 CLOUD_RUN_URL 치환
sed -i '' "s|CLOUD_RUN_URL|${CLOUD_RUN_URL}|g" api-spec.yaml
```

### 6.5 API Config 생성

```bash
gcloud api-gateway api-configs create config-v1 \
  --api=signature-api \
  --openapi-spec=api-spec.yaml \
  --project=$(gcloud config get-value project) \
  --backend-auth-service-account=api-gateway@$(gcloud config get-value project).iam.gserviceaccount.com
```

> **처음 실행 시 API 먼저 생성:**
> ```bash
> gcloud api-gateway apis create signature-api --project=$(gcloud config get-value project)
> ```

### 6.6 Gateway 배포

```bash
gcloud api-gateway gateways create signature-gateway \
  --api=signature-api \
  --api-config=config-v1 \
  --location=asia-northeast1 \
  --project=$(gcloud config get-value project)
```

### 6.7 Managed Service 활성화

```bash
# API의 managed service 이름 확인
gcloud api-gateway apis describe signature-api --format='value(managedService)'

# managed service 활성화 (위에서 확인한 값 사용)
gcloud services enable $(gcloud api-gateway apis describe signature-api --format='value(managedService)')
```

### 6.8 API Key 생성

```bash
# API Keys 서비스 활성화
gcloud services enable apikeys.googleapis.com

# API Key 생성
gcloud beta services api-keys create --display-name="Kiosk API Key" --project=$(gcloud config get-value project)
```

### 6.9 API Key에 API 제한 설정

```bash
# 생성된 API Key의 UID 확인
gcloud beta services api-keys list --format="table(uid,displayName)"

# API Key에 우리 API만 허용하도록 제한 (UID를 실제 값으로 교체)
gcloud beta services api-keys update <API_KEY_UID> --api-target=service=$(gcloud api-gateway apis describe signature-api --format='value(managedService)')
```

### 6.10 Gateway URL 확인

```bash
gcloud api-gateway gateways describe signature-gateway --location=asia-northeast1 --format='value(defaultHostname)'
```

### 6.11 테스트

```bash
# Gateway URL과 API Key를 변수로 설정
GATEWAY_URL=$(gcloud api-gateway gateways describe signature-gateway --location=asia-northeast1 --format='value(defaultHostname)')
API_KEY=$(gcloud beta services api-keys list --format="value(keyString)" --limit=1)

# 헬스체크
curl -H "x-api-key: ${API_KEY}" "https://${GATEWAY_URL}/health"
```

---

## 7. 배포 확인

```bash
# Cloud Run URL 확인 (직접 접근 불가, API Gateway 통해서만 접근)
gcloud run services describe signature-api --region asia-northeast3 --format 'value(status.url)'

# API Gateway URL 확인
gcloud api-gateway gateways describe signature-gateway --location=asia-northeast1 --format='value(defaultHostname)'

# 헬스체크 (API Gateway 통해)
curl -H "x-api-key: $(gcloud beta services api-keys list --format='value(keyString)' --limit=1)" "https://$(gcloud api-gateway gateways describe signature-gateway --location=asia-northeast1 --format='value(defaultHostname)')/health"
```

---

## 8. 로그 확인

```bash
# 실시간 로그 스트리밍
gcloud beta run services logs tail signature-api --region asia-northeast3

# 특정 시간대 로그 조회
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=signature-api" --limit 100
```

---

## 9. 환경별 배포 (선택사항)

### 9.1 staging 환경 추가

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

### 9.2 프로덕션 배포 승인 추가

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
