// ACCOUNT §3：GET /api/v1/spec 的真实本地抓取样例（2026-10-14，凭据为占位符）。
export const specExamples = [
  {
    "label": "read读取现货规格",
    "authentication": "api_key",
    "request": {
      "method": "GET",
      "path": "/api/v1/spec?market=crypto_spot&symbol=BTC_USDT"
    },
    "response": {
      "status": 200,
      "headers": {
        "X-Account-Quota-Remaining": "2988",
        "X-Daily-Quota-Limit": "1500",
        "X-Daily-Quota-Remaining": "1488",
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "9",
        "X-Request-Id": "8305e3a8-910c-4199-9751-4096a88a33a8"
      },
      "body": {
        "market": "crypto_spot",
        "symbol": "BTC_USDT",
        "pricePrecision": 1,
        "amountPrecision": 6,
        "minQuoteAmount": "3",
        "minBaseAmount": "0.000001",
        "feeRate": "0.001",
        "feeAsset": {
          "buy": "基础币",
          "sell": "USDT"
        },
        "tradable": true
      }
    },
    "curl": [
      "curl -X GET \"https://game.inc.re/api/v1/spec?market=crypto_spot&symbol=BTC_USDT\" \\",
      "  -H \"Authorization: Bearer <API_KEY>\""
    ],
    "requestJsonForCurl": null,
    "python": [
      "import os, json, requests",
      "url = \"https://game.inc.re/api/v1/spec?market=crypto_spot&symbol=BTC_USDT\"",
      "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
      "response = requests.get(url, headers=headers, timeout=15)",
      "print(response.status_code)",
      "print(response.json())"
    ]
  },
  {
    "label": "read读取合约规格",
    "authentication": "api_key",
    "request": {
      "method": "GET",
      "path": "/api/v1/spec?market=crypto_futures&symbol=BTC_USDT"
    },
    "response": {
      "status": 200,
      "headers": {
        "X-Account-Quota-Remaining": "2987",
        "X-Daily-Quota-Limit": "1500",
        "X-Daily-Quota-Remaining": "1487",
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "8",
        "X-Request-Id": "1177ec5b-3b55-4a84-9114-4affa1e0c3e2"
      },
      "body": {
        "market": "crypto_futures",
        "symbol": "BTC_USDT",
        "quantoMultiplier": "0.0001",
        "orderPriceRound": "0.1",
        "leverageMin": 1,
        "leverageMax": 125,
        "maintenanceRate": "0.003",
        "makerFee": "0.0002",
        "takerFee": "0.0005",
        "markPrice": "83188",
        "fundingRate": "0.0001",
        "fundingIntervalSeconds": 28800
      }
    },
    "curl": [
      "curl -X GET \"https://game.inc.re/api/v1/spec?market=crypto_futures&symbol=BTC_USDT\" \\",
      "  -H \"Authorization: Bearer <API_KEY>\""
    ],
    "requestJsonForCurl": null,
    "python": [
      "import os, json, requests",
      "url = \"https://game.inc.re/api/v1/spec?market=crypto_futures&symbol=BTC_USDT\"",
      "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
      "response = requests.get(url, headers=headers, timeout=15)",
      "print(response.status_code)",
      "print(response.json())"
    ]
  },
  {
    "label": "read读取A股规格",
    "authentication": "api_key",
    "request": {
      "method": "GET",
      "path": "/api/v1/spec?market=ashare&symbol=sh600519"
    },
    "response": {
      "status": 200,
      "headers": {
        "X-Account-Quota-Remaining": "2986",
        "X-Daily-Quota-Limit": "1500",
        "X-Daily-Quota-Remaining": "1486",
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "7",
        "X-Request-Id": "fd88f1d2-3199-44f6-910a-af8ce4242e8f"
      },
      "body": {
        "market": "ashare",
        "symbol": "sh600519",
        "name": "贵州茅台",
        "board": "主板",
        "buyLot": {
          "min": 100,
          "step": 100
        },
        "sellRule": "卖出数量须为 100 股整数倍，或等于全部可卖数量（一次清空零股）",
        "tick": "0.01",
        "limitUp": "1402.38",
        "limitDown": "1147.4",
        "tPlus": 1,
        "suspended": false,
        "fees": {
          "commission": "0.00025",
          "commissionMinCNY": "5",
          "transfer": "0.00001",
          "stampOnSell": "0.0005"
        },
        "sessions": [
          "09:30-11:30",
          "13:00-15:00"
        ],
        "timeZone": "Asia/Shanghai"
      }
    },
    "curl": [
      "curl -X GET \"https://game.inc.re/api/v1/spec?market=ashare&symbol=sh600519\" \\",
      "  -H \"Authorization: Bearer <API_KEY>\""
    ],
    "requestJsonForCurl": null,
    "python": [
      "import os, json, requests",
      "url = \"https://game.inc.re/api/v1/spec?market=ashare&symbol=sh600519\"",
      "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
      "response = requests.get(url, headers=headers, timeout=15)",
      "print(response.status_code)",
      "print(response.json())"
    ]
  }
];
