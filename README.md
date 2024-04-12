# Firebase Admin Proxy

Firbase Admin Proxy 是一個用於執行 Firebase Admin SDK API 簡易任務的代理伺服器，提供了一個 RESTful API 介面，用於管理 Firebase 專案的用戶、憑證、文件等資源。

代理伺服器的設定檔位於 `config.json`，請參照 `config.json.example` 根據實際情況修改設定檔內容。
修改過的設定檔會在重啟伺服器後生效。

| 項目 | 說明 |
| --- | --- |
| `port` | 伺服器監聽的埠號 |
| `projects` | Firebase 專案 ID 的陣列 |
| `clients` | OAuth Client Credentials 的陣列 |
| `clients[i].id` | OAuth Client ID |
| `clients[i].secret` | OAuth Client Secret，這裡儲存的是加密過後的密碼，請參考使用 [5.1 加密密碼](#51-加密密碼) 工具將密碼加密 |
| `clients[i].scopes` | 該用戶可存取的 Firebase 專案 ID |
| `ipWhiteList` | 允許存取的 IP 位址清單 |
| `ssl.key` | SSL 金鑰檔案的路徑 |
| `ssl.cert` | SSL 憑證檔案 (.pem) 的路徑 |

# 使用方法

## 1. 設定應用程式

### 1.1 伺服器設定檔 config.json

複製 `config.json.example` 並命名為 `config.json`，根據實際情況修改設定檔內容。

```bash
cd [project_dir]
cp config.json.example config.json
```

### 1.2 JWT 金鑰檔案

建立 RS256 金鑰檔案，用於 JWT 簽章，並存放在 `<project_dir>/keys/firebase_admin_proxy_auth.key`。

```bash
cd [project_dir]
openssl genrsa -out keys/firebase_admin_proxy_auth.key 2048
```

## 2. 執行伺服器

執行以下的指令，在 Docker 中啟動 Firebase Admin Proxy 伺服器的容器。

```bash
cd [project_dir]
docker-compose up -d
```

## 3. 取得 OAuth Access Token

透過 OAuth API 取得 OAuth Access Token，用於後續的 API 請求驗證，詳見 [1.1 取得 OAuth Access Token](#11-取得-oauth-access-token)。

## 4. 設定專案的服務帳戶憑證

第一次操作專案前，需要設定專案的服務帳戶憑證，詳見 [2.1 設定專案的服務帳戶憑證](#21-設定專案的服務帳戶憑證)。

## 5. 開始操作 Firebase API

至此已完成 Firebase Admin Proxy 的設定，可以開始操作 Firebase API 了。


# API 文件

## 1. OAuth API

### 1.1 取得 OAuth Access Token

透過 Client Credentials Grant 取得 OAuth Access Token，用於後續的 API 請求驗證。

```http
POST /token
```

#### 請求

```x-www-form-urlencoded
grant_type: client_credentials
client_id: <client_id>
client_secret: <client_secret>
```

#### 回應

```json
{
  "access_token": "<access_token>",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## 2. 應用程式設定 API

### 2.1 設定專案的服務帳戶憑證

設定專案的服務帳戶憑證。
取得服務帳戶憑證，請至 Firebase Console > 專案設定 > 服務帳戶 > 產生新的私密金鑰。  
或是另外[創建一個服務帳戶](https://console.cloud.google.com/iam-admin/serviceaccounts)，並將其加入專案，授予適當的權限並下載私密金鑰。

```http
POST /credentials
```

#### 請求

**Headers**

```headers
Authorization: Bearer <access_token>
X-Project-ID: <project_id>
```

**Body**

```json
{
  "key": "<service_account_key_json_string>"
}
```

## 3. Firebase Authentication API

### 3.1 查詢用戶列表

查詢 Firebase Authentication 中的用戶列表。

```http
GET /auth/user
```

#### 請求

**Headers**

```headers
Authorization: Bearer <access_token>
X-Project-ID: <project_id>
```

#### 回應

```json
[
  {
    "uid": "aCi78jQVTUQALjo2fUr392veml53",
    "email": "foo@bar.io",
    "emailVerified": false,
    "disabled": false,
    "metadata": {
      "lastSignInTime": null,
      "creationTime": "Tue, 09 Apr 2024 07:21:36 GMT",
      "lastRefreshTime": null
    },
    "tokensValidAfterTime": "Tue, 09 Apr 2024 07:21:36 GMT",
    "providerData": [
      {
        "uid": "foo@bar.io",
        "email": "foo@bar.io",
        "providerId": "password"
      }
    ]
  }
]
```

### 3.2 查詢指定用戶資訊

查詢 Firebase Authentication 中的指定用戶資訊。

```http
GET /auth/user/:uid
```

#### 請求

**Headers**

```headers
Authorization: Bearer <access_token>
X-Project-ID: <project_id>
```

#### 回應

```json
{
  "uid": "aCi78jQVTUQALjo2fUr392veml53",
  "email": "foo@bar.io",
  "emailVerified": false,
  "disabled": false,
  "metadata": {
    "lastSignInTime": null,
    "creationTime": "Tue, 09 Apr 2024 07:21:36 GMT",
    "lastRefreshTime": null
  },
  "tokensValidAfterTime": "Tue, 09 Apr 2024 07:21:36 GMT",
  "providerData": [
    {
      "uid": "foo@bar.io",
      "email": "foo@bar.io",
      "providerId": "password"
    }
  ]
}
```

### 3.3 創建用戶

創建 Firebase Authentication 中的用戶。

```http
POST /auth/user
```

#### 請求

**Headers**

```headers
Authorization: Bearer <access_token>
X-Project-ID: <project_id>
Content-Type: application/json
```

**Body**

```json
{
  "email": "foo@bar.io",
  "uid": "aCi78jQVTUQALjo2fUr392veml53"
}
```

#### 回應

```headers
Status: 204 No Content
```

### 3.4 刪除用戶

刪除 Firebase Authentication 中的用戶。

```http
DELETE /auth/user/:uid
```

#### 請求

**Headers**

```headers
Authorization: Bearer <access_token>
X-Project-ID: <project_id>
```

#### 回應

```headers
Status: 204 No Content
```

### 3.5 發行自訂令牌

發行 Firebase Authentication 中的自訂令牌 (custom token)。

```http
GET /auth/custom-token/:uid
```

#### 請求

**Headers**

```headers
Authorization: Bearer <access_token>
X-Project-ID: <project_id>
```

#### 回應

```json
{
  "token": "<custom_token>"
}
```

### 3.6 驗證 ID 令牌

驗證 Firebase Authentication 中的 ID 令牌 (ID token)。

```http
POST /auth/id-token/verify
```

#### 請求

**Headers**

```headers
Authorization: Bearer <access_token>
X-Project-ID: <project_id>
Content-Type: application/json
```

**Body**

```json
{
  "idToken": "<id_token>"
}
```

#### 回應

```json
```


## 4. FireStore API

### 4.1 讀取文件

讀取 FireStore 中的文件內容。

```http
GET /fs/doc
```

#### 請求

**Headers**

```headers
Authorization: Bearer <access_token>
X-Project-ID: <project_id>
```

**Query Parameters**

```query
path: <path>
```

#### 回應

JSON 格式的文件內容。

```json
{
  "userId": "0qyff6a2ntiz0fqh",
  "endAt": {
    "_seconds": 1694999400,
    "_nanoseconds": 683000000
  },
  "startAt": {
    "_seconds": 1694998873,
    "_nanoseconds": 416000000
  }
}
```


### 4.2 寫入文件

寫入 FireStore 中的文件內容。

```http
POST /fs/doc
```

#### 請求

**Headers**

```headers
Authorization: Bearer <access_token>
X-Project-ID: <project_id>
Content-Type: application/json
```

**Query Parameters**

```query
path: <path>
```

**Body**

待寫入的文件內容。

```json
{
  "userId": "0qyff6a2ntiz0fqh",
}
```

#### 回應

```headers
Status: 204 No Content
```



## 5. Utility

本應用程式也提供一些 CLI 的工具


### 5.1 加密密碼

對密碼進行加密，加密後的密碼可儲存在 `<project_dir>/config.json` 作為之後 OAuth Client Credentials 使用。

```bash
cd [project_dir]
node util.js encrypt-password [plain_text_password]
```


### 5.2 比對密碼

比對明文密碼是否正確。

```bash
cd [project_dir]
node util.js compare-password [plain_text_password] [encrypted_password]
```
