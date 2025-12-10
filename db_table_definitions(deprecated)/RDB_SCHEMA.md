# PhotoSignature Database Schema

## Overview

This is a database schema for a photo kiosk (photo booth) management system. The system manages kiosk devices, sales transactions, user accounts, and various operational data.

## Table Naming Convention

| Prefix | Meaning | Description |
|--------|---------|-------------|
| MST | Master | Reference/configuration data tables |
| CAD | Card | Card payment transaction tables |
| SAL | Sales | Sales summary tables |
| HIS | History | Historical transaction records |
| LOG | Log | System/device log tables |
| EVE | Event | Event/promotion tables |
| PUS | Push | Push notification tables |
| FORTUNE | Fortune | Fortune telling feature (exception to 3-letter rule) |

Format: `TB_{PREFIX}{NUMBER}` (e.g., TB_MST001, TB_CAD001)

---

## Tables

### TB_MST001 - Kiosk Account Management

Primary table for managing kiosk device accounts.

```sql
CREATE TABLE TB_MST001 (
    USER_ID       VARCHAR(30)   NOT NULL,  -- Device ID (PK)
    HDD_SR        VARCHAR(15)   NOT NULL,  -- Device HDD Serial Number (PK)
    USER_NAME     VARCHAR(50)   NOT NULL,  -- Device name (Store name + sequence) (PK)
    PGM_TYPE      VARCHAR(20),             -- Program type
    USER_GROUP    VARCHAR(30),             -- Store group (FK: TB_MST004.GROUP_ID)
    USER_LEVEL    VARCHAR(5),              -- Account level (MASTER/HIGH/MID/LOW)
    PASSWORD      VARCHAR(20),             -- Password
    THEMA         VARCHAR(5),              -- Popup(character) service enabled
    CREATE_DATE   DATETIME,                -- Created date
    UPDATE_DATE   DATETIME,                -- Last access date
    SORT          INT,                     -- Sort order
    PRIMARY KEY (USER_ID, HDD_SR, USER_NAME)
);
```

---

### TB_MST002 - Print Paper Stock Management

Tracks remaining print paper quantity per device.

```sql
CREATE TABLE TB_MST002 (
    USER_ID        VARCHAR(30)  NOT NULL,  -- Device ID (PK, FK: TB_MST001.USER_ID)
    PRINTING_QTY   INT,                    -- Remaining paper quantity
    DOWN_FLAG      NCHAR(1),               -- Program update flag
    CREATE_DATE    DATETIME,               -- Created date
    UPDATE_DATE    DATETIME,               -- Updated date
    PRIMARY KEY (USER_ID)
);
```

---

### TB_MST003 - Code Management

System-wide code/enum management table.

```sql
CREATE TABLE TB_MST003 (
    CODE_GRP    NVARCHAR(10)  NOT NULL,  -- Code group (PK)
    CODE_ID     NVARCHAR(10)  NOT NULL,  -- Code value (PK)
    CODE_DESC   NVARCHAR(50),            -- Code description
    SORT        INT,                     -- Sort order
    UPDATE_DATE DATETIME,                -- Updated date
    PRIMARY KEY (CODE_GRP, CODE_ID)
);
```

**Code Groups:**

| CODE_GRP | Description | Values |
|----------|-------------|--------|
| 1 | Frame Type | 3CUT, 4cut, 6CUT, 66CUT, 7BODY, HA, STORY, STORY2, LUCK |
| 2 | User Level | MASTER(Admin), HIGH(Distributor), MID(Store), LOW(Individual) |
| 3 | Payment Method | 0(Cash), 1(Card) |
| 4 | QR Selection | 0(None), 1(QR) |
| 5 | Country Code | KOR, JPN, USA, VNM, IDN, PHI, AUS, IND, ARG, CAN, MAX, BRN, UZB |

---

### TB_MST004 - Store Group Management

Manages store groups and their configurations.

```sql
CREATE TABLE TB_MST004 (
    GRADE        VARCHAR(30)   NOT NULL,  -- Group grade (PK)
    GROUP_ID     VARCHAR(30)   NOT NULL,  -- Group ID (PK)
    GROUP_PASS   VARCHAR(30),             -- Group password
    GROUP_NAME   VARCHAR(40),             -- Group name
    GROUP_PHONE  VARCHAR(10),             -- Owner phone number
    NATION_CODE  VARCHAR(10),             -- Country code (FK: TB_MST003 where CODE_GRP=5)
    STORE_RATE   NUMERIC(3,1),            -- Store server fee rate
    TOKEN_KEY    VARCHAR(200),            -- Push notification token
    VAT          CHAR(1),                 -- VAT enabled flag
    CREATE_DATE  DATETIME,                -- Created date
    UPDATE_DATE  DATETIME,                -- Updated date
    PRIMARY KEY (GRADE, GROUP_ID)
);
```

---

### TB_MST005 - Notice Management

Stores system announcements/notices.

```sql
CREATE TABLE TB_MST005 (
    SEQ_NO          INT           NOT NULL,  -- Sequence number (PK)
    NOTICE_DATE     VARCHAR(10)   NOT NULL,  -- Notice date (PK)
    NOTICE_TITLE    VARCHAR(100)  NOT NULL,  -- Notice title (PK)
    NOTICE_COMMENT  VARCHAR(500),            -- Notice content
    CREATE_USER     VARCHAR(20),             -- Created by
    CREATE_DATE     DATETIME,                -- Created date
    UPDATE_DATE     DATETIME,                -- Updated date
    PRIMARY KEY (SEQ_NO, NOTICE_DATE, NOTICE_TITLE)
);
```

---

### TB_MST006 - Popup (Character) Management

Manages character/popup store collaborations and revenue sharing.

```sql
CREATE TABLE TB_MST006 (
    CODE_GRP    NVARCHAR(10)  NOT NULL,  -- Category (PK)
    CODE_ID     NVARCHAR(10)  NOT NULL,  -- Character sequence (PK)
    CODE_NAME   NVARCHAR(10),            -- Character code
    CODE_DESC   NVARCHAR(50),            -- Character name
    FD_ROOT     NVARCHAR(200),           -- File path
    SORT        INT,                     -- Sort order
    STORE_RATE  NUMERIC(5,2),            -- Store revenue rate (%)
    CORP_RATE   NUMERIC(5,2),            -- Corporate revenue rate (%)
    POPUP_RATE  NUMERIC(5,2),            -- Popup store contract rate (%)
    KENT        CHAR(1),                 -- Celebrity collaboration flag
    PRIMARY KEY (CODE_GRP, CODE_ID)
);
```

---

### TB_MST007 - Exchange Rate Management

Monthly exchange rates by country.

```sql
CREATE TABLE TB_MST007 (
    WORK_MM      VARCHAR(7)    NOT NULL,  -- Month (YYYY-MM) (PK)
    NATION_CODE  CHAR(3)       NOT NULL,  -- Country code (PK, FK: TB_MST003 where CODE_GRP=5)
    EX_RATE      NUMERIC(15,7),           -- Exchange rate
    PRIMARY KEY (WORK_MM, NATION_CODE)
);
```

---

### TB_CAD001 - Card Sales Records

Stores card payment transaction details.

```sql
CREATE TABLE TB_CAD001 (
    USER_ID          VARCHAR(30)  NOT NULL,  -- Device ID (PK, FK: TB_MST001.USER_ID)
    SEQ_NO           INT          NOT NULL,  -- Sequence number (PK)
    WORK_DATE        VARCHAR(10)  NOT NULL,  -- Date (YYYY-MM-DD) (PK)
    PRINT_CNT        INT,                    -- Number of photos taken
    CARD_NO          VARCHAR(30),            -- Card number (masked)
    RECEIPT_PAY      INT,                    -- Payment amount
    RECEIPT_DATE     VARCHAR(30),            -- Payment datetime
    RECEIPT_NO       VARCHAR(30),            -- Receipt number
    RECEIPT_TAX_TXT  VARCHAR(200),           -- VAT details
    CANCEL_YN        BIT,                    -- Cancellation flag
    IN_DATE          DATETIME,               -- Created date
    PRIMARY KEY (USER_ID, SEQ_NO, WORK_DATE)
);
```

---

### TB_EVE001 - Event Coupon Management

Manages promotional coupons.

```sql
CREATE TABLE TB_EVE001 (
    EVENT_HDD    NVARCHAR(20)  NOT NULL,  -- Device ID (PK)
    SEQ          INT           NOT NULL,  -- Sequence number (PK)
    COUPON_N     NVARCHAR(50)  NOT NULL,  -- Coupon number (PK)
    USE_YN       NCHAR(1),                -- Used flag (Y/N)
    USED_SHOP    NVARCHAR(50),            -- Store where used
    USE_TIP      INT,                     -- Coupon discount amount
    CREATE_DATE  DATETIME,                -- Created date
    UPDATE_DATE  DATETIME,                -- Updated date
    END_DATE     DATETIME,                -- Expiration date
    PRIMARY KEY (EVENT_HDD, SEQ, COUPON_N)
);
```

---

### TB_FORTUNE - Fortune Management

Stores fortune telling content.

```sql
CREATE TABLE TB_FORTUNE (
    FORTUNE_ID    VARCHAR(10)   NOT NULL,  -- Fortune type (PK)
    FORTUNE_NO    INT           NOT NULL,  -- Fortune number (PK)
    FORTUNE_NOTE  VARCHAR(300),            -- Fortune content
    PRIMARY KEY (FORTUNE_ID, FORTUNE_NO)
);
```

---

### TB_HIS003 - Sales History

Detailed sales transaction history.

> **Note:** Column names may not match their actual usage due to feature additions over time.

```sql
CREATE TABLE TB_HIS003 (
    USER_ID       VARCHAR(15)  NOT NULL,  -- Device ID (PK, FK: TB_MST001.USER_ID)
    SEQ_NO        INT          NOT NULL,  -- Sequence number (PK)
    WORK_DATE     VARCHAR(10)  NOT NULL,  -- Date (YYYY-MM-DD) (PK)
    RUN_QTY       INT,                    -- Number of photo sessions
    SALES_QTY     INT,                    -- Number of prints
    SALES_AMOUNT  INT,                    -- Sales amount
    DANGA         INT,                    -- Unit price
    COLOR4        INT,                    -- Background color selection
    COLORW        INT,                    -- Popup/character selection
    FILLTER4      INT,                    -- Filter number
    FILLTERW      INT,                    -- Payment method (0:Cash, 1:Card)
    RESHOOT       INT,                    -- Reshoot count (deprecated)
    QRSHOOT       INT,                    -- QR selection flag
    ROUL_AMOUNT   INT,                    -- Roulette discount amount
    USE_COUPON    INT,                    -- Coupon used flag
    FRAMES        VARCHAR(10),            -- Frame type (FK: TB_MST003 where CODE_GRP=1)
    CREATE_DATE   DATETIME,               -- Created date
    UPDATE_DATE   DATETIME,               -- Updated date
    PRIMARY KEY (USER_ID, SEQ_NO, WORK_DATE)
);
```

---

### TB_LOG001 - Device Log Management

Stores device operation logs and errors.

```sql
CREATE TABLE TB_LOG001 (
    SEQ_NO       INT          NOT NULL,  -- Sequence number (PK)
    USER_ID      VARCHAR(20)  NOT NULL,  -- Device ID (PK, FK: TB_MST001.USER_ID)
    WORK_DATE    NCHAR(10),              -- Date (YYYY-MM-DD)
    FUNC_NAME    VARCHAR(50),            -- Log location/function name
    FUNC_DETAIL  VARCHAR(500),           -- Log details
    KOLAVO       NCHAR(10),              -- Popup code (character)
    BGIMG        INT,                    -- Background selection
    IMGFILLTER   INT,                    -- Filter selection
    IMGFRAMES    VARCHAR(10),            -- Frame selection
    QRON         VARCHAR(10),            -- QR selection flag
    ERRLOG       VARCHAR(500),           -- Error log (exception details)
    BIGO1        VARCHAR(50),            -- Remark 1
    BIGO2        VARCHAR(50),            -- Remark 2
    BIGO3        VARCHAR(50),            -- Remark 3
    CREATE_DATE  DATETIME,               -- Created date
    PRIMARY KEY (SEQ_NO, USER_ID)
);
```

---

### TB_PUS001 - Push Notification Test

Test table for push notifications.

```sql
CREATE TABLE TB_PUS001 (
    TARGET_NAME  NVARCHAR(50)  NOT NULL,  -- Group ID (PK)
    PUSH_DATE    NVARCHAR(20)  NOT NULL,  -- Date (PK)
    TEST1        INT,                     -- Test field 1
    TEST2        NVARCHAR(50),            -- Test field 2
    CREATE_DATE  DATETIME,                -- Created by (mislabeled)
    UPDATE_DATE  DATETIME,                -- Created date (mislabeled)
    PRIMARY KEY (TARGET_NAME, PUSH_DATE)
);
```

---

### TB_SAL002 - Sales Summary

Aggregated sales data for faster calendar-view queries.

```sql
CREATE TABLE TB_SAL002 (
    USER_ID       VARCHAR(15)  NOT NULL,  -- Device ID (PK, FK: TB_MST001.USER_ID)
    SEQ_NO        INT          NOT NULL,  -- Sequence number (PK)
    WORK_DATE     VARCHAR(10)  NOT NULL,  -- Date (YYYY-MM-DD) (PK)
    RUN_QTY       INT,                    -- Number of photo sessions
    SALES_QTY     INT,                    -- Number of prints
    SALES_AMOUNT  INT,                    -- Total sales amount
    CREATE_DATE   DATETIME,               -- Created date
    UPDATE_DATE   DATETIME,               -- Updated date
    PRIMARY KEY (USER_ID, SEQ_NO, WORK_DATE)
);
```

---

## Entity Relationships

```
TB_MST001 (Kiosk Account)
    │
    ├──< TB_MST002 (Paper Stock)      [1:1 via USER_ID]
    ├──< TB_CAD001 (Card Sales)       [1:N via USER_ID]
    ├──< TB_HIS003 (Sales History)    [1:N via USER_ID]
    ├──< TB_SAL002 (Sales Summary)    [1:N via USER_ID]
    └──< TB_LOG001 (Device Logs)      [1:N via USER_ID]

TB_MST004 (Store Group)
    │
    └──< TB_MST001 (Kiosk Account)    [1:N via USER_GROUP = GROUP_ID]

TB_MST003 (Code Master)
    │
    ├──> TB_MST004.NATION_CODE        [CODE_GRP = 5]
    ├──> TB_MST007.NATION_CODE        [CODE_GRP = 5]
    ├──> TB_HIS003.FRAMES             [CODE_GRP = 1]
    └──> TB_MST001.USER_LEVEL         [CODE_GRP = 2]

TB_MST006 (Character/Popup)
    │
    └──> TB_MST001.THEMA              [Character service flag]
```

---

## Common Query Patterns

### Get daily sales for a device
```sql
SELECT WORK_DATE, SUM(SALES_AMOUNT) as total_sales
FROM TB_HIS003
WHERE USER_ID = '{device_id}'
GROUP BY WORK_DATE
ORDER BY WORK_DATE DESC;
```

### Get device info with store group
```sql
SELECT m.*, g.GROUP_NAME, g.NATION_CODE
FROM TB_MST001 m
LEFT JOIN TB_MST004 g ON m.USER_GROUP = g.GROUP_ID;
```

### Get code values by group
```sql
SELECT CODE_ID, CODE_DESC
FROM TB_MST003
WHERE CODE_GRP = '{group_id}'
ORDER BY SORT;
```
