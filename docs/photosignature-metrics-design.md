# PhotoSignature Kiosk System - MongoDB Schema Design

## 1. 개요 (Overview)

본 문서는 포토부스 키오스크 시스템의 NoSQL(MongoDB) 데이터베이스 설계 명세서입니다. 
기존 RDB 구조의 한계를 넘어, **비즈니스 인사이트(매출/선호도)**와 **시스템 안정성(대용량 로그/Crash 분석)**을 동시에 확보하는 것을 목표로 합니다.

### 1.1 핵심 설계 전략 (Key Strategies)
1.  **Session-Based Tracking**: 사용자의 시작부터 종료(또는 이탈)까지를 하나의 `session_id`로 묶어 분석합니다.
2.  **Denormalization (비정규화)**: 읽기 성능 최적화를 위해 트랜잭션 문서 내에 결제 및 상품 상세 정보를 포함(Embedding)합니다.
3.  **High-Volume Log Handling**: 클릭, 터치 등 빈번한 이벤트는 클라이언트에서 버퍼링(Buffering) 후 전송하며, MongoDB의 고속 쓰기 및 TTL 기능을 활용합니다.

---

## 2. Collections Schema

### 2.1 `kiosks` (기기 및 상태 관리)
* **용도**: 기기 정보, 매장 정보, 실시간 하드웨어 상태(Heartbeat) 관리.
* **특징**: 기기별로 상이한 설정을 JSON 객체로 유연하게 저장 (RDB의 TB_MST001, 002, 004 통합).

```json
{
  "_id": "ObjectId(...)",
  "kiosk_id": "K001-DEVICE-01",      // Unique Key (Serial Number)
  "device_name": "홍대점 1호기",
  
  // 매장 그룹 정보 (변경 빈도가 낮으므로 Embedding)
  "group_info": {
    "group_id": "GRP_HONGDAE",
    "group_name": "홍대 직영점",
    "country_code": "KOR",
    "currency": "KRW",
    "owner_contact": "010-1234-5678"
  },

  // 실시간 상태 (Heartbeat 주기로 업데이트)
  "status": {
    "is_online": true,
    "last_active": "2024-05-20T14:30:00Z",
    "paper_qty": 350,                 // 용지 부족 알림 트리거
    "printer_status": "OK",           // OK, JAM, EMPTY, ERROR
    "app_version": "v2.5.1",
    "disk_usage_percent": 45
  },

  // 기기별 설정값
  "config": {
    "theme_enabled": true,            // 캐릭터 팝업 사용 여부
    "active_promotions": ["EVENT_SUMMER"],
    "prices_override": {              // 지점별 가격 정책 예외 처리
        "4cut": 5000,
        "6cut": 6000
    }
  },
  
  "created_at": "2023-01-01T00:00:00Z",
  "updated_at": "2024-05-20T14:30:00Z"
}