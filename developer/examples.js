// PLATFORM §6.6：脱敏的本地 wrangler dev 响应与请求示例。
// 生成来源：_work/v2/api-examples.json；完整密钥、密码及会话凭据已移除。
export const documentationExamples = {
  "capturedAt": "2026-10-13T12:22:14.087Z",
  "examples": [
    {
      "label": "创建read Key",
      "authentication": "web_session",
      "request": {
        "method": "POST",
        "path": "/api/keys",
        "body": {
          "name": "round2 read",
          "project": "exchange",
          "scopes": [
            "read"
          ],
          "expiresDays": 30,
          "acceptDisclaimer": true
        }
      },
      "response": {
        "status": 201,
        "headers": {

        },
        "body": {
          "id": "x5rm2jwq3j",
          "name": "round2 read",
          "prefix": "gk_x5rm2jwq3j",
          "scopes": [
            "read"
          ],
          "project": "exchange",
          "created": 1791894071036,
          "expires": 1794486071036,
          "lastUsed": null,
          "revoked": false
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/keys\" \\",
        "  -H \"Cookie: <SESSION_COOKIE>\" -H \"Origin: https://game.inc.re\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "name": "round2 read",
        "project": "exchange",
        "scopes": [
          "read"
        ],
        "expiresDays": 30,
        "acceptDisclaimer": true,
        "password": "<PASSWORD>"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/keys\"",
        "headers = {\"Cookie\": os.environ[\"GAME_SESSION_COOKIE\"], \"Origin\": \"https://g" +
          "ame.inc.re\"}",
        "payload = json.loads('''",
        "{",
        "  \"name\": \"round2 read\",",
        "  \"project\": \"exchange\",",
        "  \"scopes\": [",
        "    \"read\"",
        "  ],",
        "  \"expiresDays\": 30,",
        "  \"acceptDisclaimer\": true,",
        "  \"password\": \"<PASSWORD>\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "read读取account",
      "authentication": "api_key",
      "request": {
        "method": "GET",
        "path": "/api/v1/account"
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "64370cda-2e04-482e-ae62-2c315d2367d1",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "9",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1499",
          "X-Account-Quota-Remaining": "2999"
        },
        "body": {
          "serverTime": 1791894071299,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": false,
            "streak": 0,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "20",
            "cap": "50",
            "total": "0",
            "days": 0
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "0",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "0"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 0,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "0",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": false
            }
          },
          "futures": {
            "wallet": "0",
            "locked": "0",
            "leverage": {

            },
            "positions": [

            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [

            ],
            "trades": [

            ],
            "ledger": [

            ]
          },
          "notices": [

          ],
          "totalUSD": "0",
          "totalCNY": "0",
          "fx": {
            "rate": "6.6921",
            "rateTime": 1791894048000
          },
          "valuation": {
            "rate": "6.6921",
            "rateTime": 1791894048000
          }
        }
      },
      "curl": [
        "curl -X GET \"https://game.inc.re/api/v1/account\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\""
      ],
      "requestJsonForCurl": null,
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/account\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "response = requests.get(url, headers=headers, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "read读取crypto quote",
      "authentication": "api_key",
      "request": {
        "method": "GET",
        "path": "/api/v1/quote?market=crypto&symbol=BTC_USDT"
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "44abd9ff-dd63-4188-8d36-827f401813e2",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "8",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1498",
          "X-Account-Quota-Remaining": "2998"
        },
        "body": {
          "market": "crypto",
          "symbol": "BTC_USDT",
          "last": "83224",
          "bid": "83223.9",
          "ask": "83224",
          "time": 1791894070898
        }
      },
      "curl": [
        "curl -X GET \"https://game.inc.re/api/v1/quote?market=crypto&symbol=BTC_USDT\"" +
          " \\",
        "  -H \"Authorization: Bearer <API_KEY>\""
      ],
      "requestJsonForCurl": null,
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/quote?market=crypto&symbol=BTC_USDT\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "response = requests.get(url, headers=headers, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "read下单拒绝",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/orders",
        "body": {
          "market": "crypto_spot",
          "clientId": "f55b200f-4ddf-44ee-800d-e97eb357afe9",
          "symbol": "BTC_USDT",
          "side": "buy",
          "type": "market",
          "qty": "0.0001"
        }
      },
      "response": {
        "status": 403,
        "headers": {
          "X-Request-Id": "6b0bcf66-6ef9-4ab2-a66a-8ab1896a4dd4",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "9",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1497",
          "X-Account-Quota-Remaining": "2997"
        },
        "body": {
          "error": "scope_denied",
          "message": "密钥权限不足"
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/orders\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "market": "crypto_spot",
        "clientId": "f55b200f-4ddf-44ee-800d-e97eb357afe9",
        "symbol": "BTC_USDT",
        "side": "buy",
        "type": "market",
        "qty": "0.0001"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/orders\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"market\": \"crypto_spot\",",
        "  \"clientId\": \"f55b200f-4ddf-44ee-800d-e97eb357afe9\",",
        "  \"symbol\": \"BTC_USDT\",",
        "  \"side\": \"buy\",",
        "  \"type\": \"market\",",
        "  \"qty\": \"0.0001\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "创建trade Key",
      "authentication": "web_session",
      "request": {
        "method": "POST",
        "path": "/api/keys",
        "body": {
          "name": "round2 trade",
          "project": "exchange",
          "scopes": [
            "read",
            "trade"
          ],
          "expiresDays": 90,
          "acceptDisclaimer": true
        }
      },
      "response": {
        "status": 201,
        "headers": {

        },
        "body": {
          "id": "jpvsie2omu",
          "name": "round2 trade",
          "prefix": "gk_jpvsie2omu",
          "scopes": [
            "read",
            "trade"
          ],
          "project": "exchange",
          "created": 1791894071764,
          "expires": 1799670071764,
          "lastUsed": null,
          "revoked": false
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/keys\" \\",
        "  -H \"Cookie: <SESSION_COOKIE>\" -H \"Origin: https://game.inc.re\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "name": "round2 trade",
        "project": "exchange",
        "scopes": [
          "read",
          "trade"
        ],
        "expiresDays": 90,
        "acceptDisclaimer": true,
        "password": "<PASSWORD>"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/keys\"",
        "headers = {\"Cookie\": os.environ[\"GAME_SESSION_COOKIE\"], \"Origin\": \"https://g" +
          "ame.inc.re\"}",
        "payload = json.loads('''",
        "{",
        "  \"name\": \"round2 trade\",",
        "  \"project\": \"exchange\",",
        "  \"scopes\": [",
        "    \"read\",",
        "    \"trade\"",
        "  ],",
        "  \"expiresDays\": 90,",
        "  \"acceptDisclaimer\": true,",
        "  \"password\": \"<PASSWORD>\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "列出Key元数据",
      "authentication": "web_session",
      "request": {
        "method": "GET",
        "path": "/api/keys"
      },
      "response": {
        "status": 200,
        "headers": {

        },
        "body": {
          "keys": [
            {
              "id": "x5rm2jwq3j",
              "name": "round2 read",
              "prefix": "gk_x5rm2jwq3j",
              "scopes": [
                "read"
              ],
              "project": "exchange",
              "created": 1791894071036,
              "expires": 1794486071036,
              "lastUsed": 1791894071126,
              "revoked": false
            },
            {
              "id": "jpvsie2omu",
              "name": "round2 trade",
              "prefix": "gk_jpvsie2omu",
              "scopes": [
                "read",
                "trade"
              ],
              "project": "exchange",
              "created": 1791894071764,
              "expires": 1799670071764,
              "lastUsed": null,
              "revoked": false
            }
          ]
        }
      },
      "curl": [
        "curl -X GET \"https://game.inc.re/api/keys\" \\",
        "  -H \"Cookie: <SESSION_COOKIE>\" -H \"Origin: https://game.inc.re\""
      ],
      "requestJsonForCurl": null,
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/keys\"",
        "headers = {\"Cookie\": os.environ[\"GAME_SESSION_COOKIE\"], \"Origin\": \"https://g" +
          "ame.inc.re\"}",
        "response = requests.get(url, headers=headers, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "API钱包换汇划入A股",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/transfer",
        "body": {
          "from": "wallet",
          "to": "ashare",
          "amount": "20"
        }
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "000b2965-10d4-45e4-82ca-3139863f1107",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "9",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1499",
          "X-Account-Quota-Remaining": "2996"
        },
        "body": {
          "serverTime": 1791894071936,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "0",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "0"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 0,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "133.57",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": false
            }
          },
          "futures": {
            "wallet": "0",
            "locked": "0",
            "leverage": {

            },
            "positions": [

            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [

            ],
            "trades": [

            ],
            "ledger": [
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ],
          "rate": "6.6921",
          "rateTime": 1791894048000,
          "fee": "0.04",
          "received": "133.57"
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/transfer\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "from": "wallet",
        "to": "ashare",
        "amount": "20"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/transfer\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"from\": \"wallet\",",
        "  \"to\": \"ashare\",",
        "  \"amount\": \"20\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "真实A股报价 sh601005",
      "authentication": "api_key",
      "request": {
        "method": "GET",
        "path": "/api/v1/quote?market=ashare&symbol=sh601005"
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "d72ed957-d7c8-4ba4-b4dc-4bee4e9dd75a",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "7",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1496",
          "X-Account-Quota-Remaining": "2995"
        },
        "body": {
          "market": "ashare",
          "symbol": "sh601005",
          "last": "1.2",
          "bid": "1.2",
          "ask": "1.21",
          "time": 1791879278000,
          "limitUp": "1.33",
          "limitDown": "1.09",
          "status": "休市"
        }
      },
      "curl": [
        "curl -X GET \"https://game.inc.re/api/v1/quote?market=ashare&symbol=sh601005\"" +
          " \\",
        "  -H \"Authorization: Bearer <API_KEY>\""
      ],
      "requestJsonForCurl": null,
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/quote?market=ashare&symbol=sh601005\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "response = requests.get(url, headers=headers, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "闭市市价单拒绝",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/orders",
        "body": {
          "market": "ashare",
          "code": "sh601005",
          "side": "buy",
          "type": "market",
          "qty": "100",
          "clientId": "01c97603-4d4d-446c-a59b-2f0d82fb364c"
        }
      },
      "response": {
        "status": 422,
        "headers": {
          "X-Request-Id": "d0ce0b6a-63db-4553-a581-bf2cc241abca",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "8",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1498",
          "X-Account-Quota-Remaining": "2994"
        },
        "body": {
          "error": "market_closed",
          "message": "当前不在交易时段"
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/orders\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "market": "ashare",
        "code": "sh601005",
        "side": "buy",
        "type": "market",
        "qty": "100",
        "clientId": "01c97603-4d4d-446c-a59b-2f0d82fb364c"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/orders\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"market\": \"ashare\",",
        "  \"code\": \"sh601005\",",
        "  \"side\": \"buy\",",
        "  \"type\": \"market\",",
        "  \"qty\": \"100\",",
        "  \"clientId\": \"01c97603-4d4d-446c-a59b-2f0d82fb364c\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "trade Key A股限价预埋",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/orders",
        "body": {
          "market": "ashare",
          "code": "sh601005",
          "side": "buy",
          "type": "limit",
          "price": "1.09",
          "qty": "100",
          "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c"
        }
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "d39b94f0-1c0a-4b16-afe3-81666d4924cb",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "7",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1497",
          "X-Account-Quota-Remaining": "2993"
        },
        "body": {
          "serverTime": 1791894072070,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "0",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "0"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 1,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "19.56",
              "locked": "114.01"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "0",
            "locked": "0",
            "leverage": {

            },
            "positions": [

            ]
          },
          "openOrders": [
            {
              "id": "A1",
              "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
              "market": "ashare",
              "code": "sh601005",
              "symbol": "sh601005",
              "name": "重庆钢铁",
              "side": "buy",
              "type": "limit",
              "price": "1.09",
              "qty": "100",
              "filled": "0",
              "executedQuote": "0",
              "avgPrice": "0",
              "fee": "0",
              "feeAsset": "CNY",
              "status": "new",
              "lock": {
                "asset": "CNY",
                "amount": "114.01"
              },
              "createdAt": 1791894072070,
              "updatedAt": 1791894072070,
              "checkFrom": 1791941400000,
              "expiresAt": 1791961200000,
              "preplaced": true
            }
          ],
          "recent": {
            "orders": [

            ],
            "trades": [

            ],
            "ledger": [
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ],
          "order": {
            "id": "A1",
            "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
            "market": "ashare",
            "code": "sh601005",
            "symbol": "sh601005",
            "name": "重庆钢铁",
            "side": "buy",
            "type": "limit",
            "price": "1.09",
            "qty": "100",
            "filled": "0",
            "executedQuote": "0",
            "avgPrice": "0",
            "fee": "0",
            "feeAsset": "CNY",
            "status": "new",
            "lock": {
              "asset": "CNY",
              "amount": "114.01"
            },
            "createdAt": 1791894072070,
            "updatedAt": 1791894072070,
            "checkFrom": 1791941400000,
            "expiresAt": 1791961200000,
            "preplaced": true
          }
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/orders\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "market": "ashare",
        "code": "sh601005",
        "side": "buy",
        "type": "limit",
        "price": "1.09",
        "qty": "100",
        "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/orders\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"market\": \"ashare\",",
        "  \"code\": \"sh601005\",",
        "  \"side\": \"buy\",",
        "  \"type\": \"limit\",",
        "  \"price\": \"1.09\",",
        "  \"qty\": \"100\",",
        "  \"clientId\": \"e90ee7cb-f7b4-4246-8f15-3e6b7974b75c\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "读取open委托",
      "authentication": "api_key",
      "request": {
        "method": "GET",
        "path": "/api/v1/orders?status=open&market=ashare"
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "dd882009-c06f-4f0a-886f-8ef96d07d7e1",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "6",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1495",
          "X-Account-Quota-Remaining": "2992"
        },
        "body": {
          "orders": [
            {
              "id": "A1",
              "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
              "market": "ashare",
              "code": "sh601005",
              "symbol": "sh601005",
              "name": "重庆钢铁",
              "side": "buy",
              "type": "limit",
              "price": "1.09",
              "qty": "100",
              "filled": "0",
              "executedQuote": "0",
              "avgPrice": "0",
              "fee": "0",
              "feeAsset": "CNY",
              "status": "new",
              "lock": {
                "asset": "CNY",
                "amount": "114.01"
              },
              "createdAt": 1791894072070,
              "updatedAt": 1791894072070,
              "checkFrom": 1791941400000,
              "expiresAt": 1791961200000,
              "preplaced": true
            }
          ]
        }
      },
      "curl": [
        "curl -X GET \"https://game.inc.re/api/v1/orders?status=open&market=ashare\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\""
      ],
      "requestJsonForCurl": null,
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/orders?status=open&market=ashare\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "response = requests.get(url, headers=headers, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "API撤销预埋单",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/orders/cancel",
        "body": {
          "market": "ashare",
          "id": "A1"
        }
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "74ebe789-b91a-4018-983b-750f9a949916",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "6",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1496",
          "X-Account-Quota-Remaining": "2991"
        },
        "body": {
          "serverTime": 1791894072133,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "0",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "0"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 1,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "133.57",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "0",
            "locked": "0",
            "leverage": {

            },
            "positions": [

            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [
              {
                "id": "A1",
                "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
                "market": "ashare",
                "code": "sh601005",
                "symbol": "sh601005",
                "name": "重庆钢铁",
                "side": "buy",
                "type": "limit",
                "price": "1.09",
                "qty": "100",
                "filled": "0",
                "executedQuote": "0",
                "avgPrice": "0",
                "fee": "0",
                "feeAsset": "CNY",
                "status": "canceled",
                "lock": {
                  "asset": "CNY",
                  "amount": "0"
                },
                "createdAt": 1791894072070,
                "updatedAt": 1791894072133,
                "checkFrom": 1791941400000,
                "expiresAt": 1791961200000,
                "preplaced": true
              }
            ],
            "trades": [

            ],
            "ledger": [
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ]
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/orders/cancel\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "market": "ashare",
        "id": "A1"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/orders/cancel\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"market\": \"ashare\",",
        "  \"id\": \"A1\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "读取历史委托",
      "authentication": "api_key",
      "request": {
        "method": "GET",
        "path": "/api/v1/orders?status=history&market=ashare"
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "3c519f73-4a16-48d9-bc9a-85655334e710",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "5",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1494",
          "X-Account-Quota-Remaining": "2990"
        },
        "body": {
          "orders": [
            {
              "id": "A1",
              "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
              "market": "ashare",
              "code": "sh601005",
              "symbol": "sh601005",
              "name": "重庆钢铁",
              "side": "buy",
              "type": "limit",
              "price": "1.09",
              "qty": "100",
              "filled": "0",
              "executedQuote": "0",
              "avgPrice": "0",
              "fee": "0",
              "feeAsset": "CNY",
              "status": "canceled",
              "lock": {
                "asset": "CNY",
                "amount": "0"
              },
              "createdAt": 1791894072070,
              "updatedAt": 1791894072133,
              "checkFrom": 1791941400000,
              "expiresAt": 1791961200000,
              "preplaced": true
            }
          ]
        }
      },
      "curl": [
        "curl -X GET \"https://game.inc.re/api/v1/orders?status=history&market=ashare\"" +
          " \\",
        "  -H \"Authorization: Bearer <API_KEY>\""
      ],
      "requestJsonForCurl": null,
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/orders?status=history&market=ashare\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "response = requests.get(url, headers=headers, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "A股现金换回钱包",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/transfer",
        "body": {
          "from": "ashare",
          "to": "wallet",
          "amount": "133.57"
        }
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "c10e0c2d-cbc6-4413-952f-d18200eecd9e",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "5",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1495",
          "X-Account-Quota-Remaining": "2989"
        },
        "body": {
          "serverTime": 1791894072252,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "0",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "19.91900898"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 1,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "0",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "0",
            "locked": "0",
            "leverage": {

            },
            "positions": [

            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [
              {
                "id": "A1",
                "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
                "market": "ashare",
                "code": "sh601005",
                "symbol": "sh601005",
                "name": "重庆钢铁",
                "side": "buy",
                "type": "limit",
                "price": "1.09",
                "qty": "100",
                "filled": "0",
                "executedQuote": "0",
                "avgPrice": "0",
                "fee": "0",
                "feeAsset": "CNY",
                "status": "canceled",
                "lock": {
                  "asset": "CNY",
                  "amount": "0"
                },
                "createdAt": 1791894072070,
                "updatedAt": 1791894072133,
                "checkFrom": 1791941400000,
                "expiresAt": 1791961200000,
                "preplaced": true
              }
            ],
            "trades": [

            ],
            "ledger": [
              {
                "t": 1791894072252,
                "kind": "fx_fee",
                "asset": "CNY",
                "amount": "-0.27",
                "note": "换汇费",
                "market": "ashare"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_in",
                "asset": "USD",
                "amount": "19.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_out",
                "asset": "CNY",
                "amount": "-133.3",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ],
          "rate": "6.6921",
          "rateTime": 1791894048000,
          "fee": "0.27",
          "received": "19.91900898"
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/transfer\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "from": "ashare",
        "to": "wallet",
        "amount": "133.57"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/transfer\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"from\": \"ashare\",",
        "  \"to\": \"wallet\",",
        "  \"amount\": \"133.57\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "划入合约$3",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/transfer",
        "body": {
          "from": "wallet",
          "to": "futures",
          "amount": "3"
        }
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "3c69056d-b266-454a-96ce-7e5919bf0171",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "4",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1494",
          "X-Account-Quota-Remaining": "2988"
        },
        "body": {
          "serverTime": 1791894072293,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "0",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "16.91900898"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 1,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "0",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "3",
            "locked": "0",
            "leverage": {

            },
            "positions": [

            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [
              {
                "id": "A1",
                "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
                "market": "ashare",
                "code": "sh601005",
                "symbol": "sh601005",
                "name": "重庆钢铁",
                "side": "buy",
                "type": "limit",
                "price": "1.09",
                "qty": "100",
                "filled": "0",
                "executedQuote": "0",
                "avgPrice": "0",
                "fee": "0",
                "feeAsset": "CNY",
                "status": "canceled",
                "lock": {
                  "asset": "CNY",
                  "amount": "0"
                },
                "createdAt": 1791894072070,
                "updatedAt": 1791894072133,
                "checkFrom": 1791941400000,
                "expiresAt": 1791961200000,
                "preplaced": true
              }
            ],
            "trades": [

            ],
            "ledger": [
              {
                "t": 1791894072293,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "3",
                "note": "划转",
                "market": "futures"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-3",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "fx_fee",
                "asset": "CNY",
                "amount": "-0.27",
                "note": "换汇费",
                "market": "ashare"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_in",
                "asset": "USD",
                "amount": "19.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_out",
                "asset": "CNY",
                "amount": "-133.3",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ],
          "rate": "1",
          "rateTime": null,
          "fee": "0",
          "received": "3"
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/transfer\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "from": "wallet",
        "to": "futures",
        "amount": "3"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/transfer\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"from\": \"wallet\",",
        "  \"to\": \"futures\",",
        "  \"amount\": \"3\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "账户复查",
      "authentication": "api_key",
      "request": {
        "method": "GET",
        "path": "/api/v1/account"
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "3c028fd6-d066-42c8-8896-392b7e99893e",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "4",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1493",
          "X-Account-Quota-Remaining": "2987"
        },
        "body": {
          "serverTime": 1791894072334,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "0",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "16.91900898"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 1,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "0",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "3",
            "locked": "0",
            "leverage": {

            },
            "positions": [

            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [
              {
                "id": "A1",
                "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
                "market": "ashare",
                "code": "sh601005",
                "symbol": "sh601005",
                "name": "重庆钢铁",
                "side": "buy",
                "type": "limit",
                "price": "1.09",
                "qty": "100",
                "filled": "0",
                "executedQuote": "0",
                "avgPrice": "0",
                "fee": "0",
                "feeAsset": "CNY",
                "status": "canceled",
                "lock": {
                  "asset": "CNY",
                  "amount": "0"
                },
                "createdAt": 1791894072070,
                "updatedAt": 1791894072133,
                "checkFrom": 1791941400000,
                "expiresAt": 1791961200000,
                "preplaced": true
              }
            ],
            "trades": [

            ],
            "ledger": [
              {
                "t": 1791894072293,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "3",
                "note": "划转",
                "market": "futures"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-3",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "fx_fee",
                "asset": "CNY",
                "amount": "-0.27",
                "note": "换汇费",
                "market": "ashare"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_in",
                "asset": "USD",
                "amount": "19.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_out",
                "asset": "CNY",
                "amount": "-133.3",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ],
          "totalUSD": "19.91900898",
          "totalCNY": "133.29",
          "fx": {
            "rate": "6.6921",
            "rateTime": 1791894048000
          },
          "valuation": {
            "rate": "6.6921",
            "rateTime": 1791894048000
          }
        }
      },
      "curl": [
        "curl -X GET \"https://game.inc.re/api/v1/account\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\""
      ],
      "requestJsonForCurl": null,
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/account\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "response = requests.get(url, headers=headers, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "钱包其余划入现货",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/transfer",
        "body": {
          "from": "wallet",
          "to": "spot",
          "amount": "16.91900898"
        }
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "543a587d-00dd-4785-acaf-a7c804198e06",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "3",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1493",
          "X-Account-Quota-Remaining": "2986"
        },
        "body": {
          "serverTime": 1791894072353,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "16.91900898",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "0"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 1,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "0",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "3",
            "locked": "0",
            "leverage": {

            },
            "positions": [

            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [
              {
                "id": "A1",
                "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
                "market": "ashare",
                "code": "sh601005",
                "symbol": "sh601005",
                "name": "重庆钢铁",
                "side": "buy",
                "type": "limit",
                "price": "1.09",
                "qty": "100",
                "filled": "0",
                "executedQuote": "0",
                "avgPrice": "0",
                "fee": "0",
                "feeAsset": "CNY",
                "status": "canceled",
                "lock": {
                  "asset": "CNY",
                  "amount": "0"
                },
                "createdAt": 1791894072070,
                "updatedAt": 1791894072133,
                "checkFrom": 1791941400000,
                "expiresAt": 1791961200000,
                "preplaced": true
              }
            ],
            "trades": [

            ],
            "ledger": [
              {
                "t": 1791894072353,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "16.91900898",
                "note": "划转",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-16.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "3",
                "note": "划转",
                "market": "futures"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-3",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "fx_fee",
                "asset": "CNY",
                "amount": "-0.27",
                "note": "换汇费",
                "market": "ashare"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_in",
                "asset": "USD",
                "amount": "19.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_out",
                "asset": "CNY",
                "amount": "-133.3",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ],
          "rate": "1",
          "rateTime": null,
          "fee": "0",
          "received": "16.91900898"
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/transfer\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "from": "wallet",
        "to": "spot",
        "amount": "16.91900898"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/transfer\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"from\": \"wallet\",",
        "  \"to\": \"spot\",",
        "  \"amount\": \"16.91900898\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "trade Key市价买入0.0001 BTC",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/orders",
        "body": {
          "market": "crypto_spot",
          "symbol": "BTC_USDT",
          "side": "buy",
          "type": "market",
          "qty": "0.0001",
          "clientId": "d9f9dea2-989d-4f64-a1fd-9f85de01dfa5"
        }
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "3d5c77ee-6d48-47ce-9b8a-952be9991133",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "2",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1492",
          "X-Account-Quota-Remaining": "2985"
        },
        "body": {
          "serverTime": 1791894072392,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "8.59660898",
                "locked": "0"
              },
              {
                "asset": "BTC",
                "free": "0.0000999",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "0"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 2,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "0",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "3",
            "locked": "0",
            "leverage": {

            },
            "positions": [

            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [
              {
                "id": "S2",
                "clientId": "d9f9dea2-989d-4f64-a1fd-9f85de01dfa5",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "avgPrice": "83224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "status": "filled",
                "reduceOnly": false,
                "tp": null,
                "sl": null,
                "leverage": null,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894072392,
                "triggeredAt": null,
                "updatedAt": 1791894072392,
                "checkFrom": 1791894072392,
                "executedQuote": "8.3224"
              },
              {
                "id": "A1",
                "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
                "market": "ashare",
                "code": "sh601005",
                "symbol": "sh601005",
                "name": "重庆钢铁",
                "side": "buy",
                "type": "limit",
                "price": "1.09",
                "qty": "100",
                "filled": "0",
                "executedQuote": "0",
                "avgPrice": "0",
                "fee": "0",
                "feeAsset": "CNY",
                "status": "canceled",
                "lock": {
                  "asset": "CNY",
                  "amount": "0"
                },
                "createdAt": 1791894072070,
                "updatedAt": 1791894072133,
                "checkFrom": 1791941400000,
                "expiresAt": 1791961200000,
                "preplaced": true
              }
            ],
            "trades": [
              {
                "id": "S2-0-1791894072392",
                "orderId": "S2",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "price": "83224",
                "qty": "0.0001",
                "quote": "8.3224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "role": "taker",
                "t": 1791894072392
              }
            ],
            "ledger": [
              {
                "t": 1791894072392,
                "kind": "fee",
                "asset": "BTC",
                "amount": "-0.0000001",
                "note": "手续费",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "16.91900898",
                "note": "划转",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-16.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "3",
                "note": "划转",
                "market": "futures"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-3",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "fx_fee",
                "asset": "CNY",
                "amount": "-0.27",
                "note": "换汇费",
                "market": "ashare"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_in",
                "asset": "USD",
                "amount": "19.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_out",
                "asset": "CNY",
                "amount": "-133.3",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ],
          "order": {
            "id": "S2",
            "clientId": "d9f9dea2-989d-4f64-a1fd-9f85de01dfa5",
            "market": "spot",
            "symbol": "BTC_USDT",
            "side": "buy",
            "type": "market",
            "price": null,
            "stopPrice": null,
            "stopDir": null,
            "qty": "0.0001",
            "quoteQty": null,
            "filled": "0.0001",
            "avgPrice": "83224",
            "fee": "0.0000001",
            "feeAsset": "BTC",
            "status": "filled",
            "reduceOnly": false,
            "tp": null,
            "sl": null,
            "leverage": null,
            "lock": {
              "asset": "USDT",
              "amount": "0"
            },
            "createdAt": 1791894072392,
            "triggeredAt": null,
            "updatedAt": 1791894072392,
            "checkFrom": 1791894072392,
            "executedQuote": "8.3224"
          }
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/orders\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "market": "crypto_spot",
        "symbol": "BTC_USDT",
        "side": "buy",
        "type": "market",
        "qty": "0.0001",
        "clientId": "d9f9dea2-989d-4f64-a1fd-9f85de01dfa5"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/orders\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"market\": \"crypto_spot\",",
        "  \"symbol\": \"BTC_USDT\",",
        "  \"side\": \"buy\",",
        "  \"type\": \"market\",",
        "  \"qty\": \"0.0001\",",
        "  \"clientId\": \"d9f9dea2-989d-4f64-a1fd-9f85de01dfa5\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "读取现货成交",
      "authentication": "api_key",
      "request": {
        "method": "GET",
        "path": "/api/v1/trades?market=crypto_spot"
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "a6bb8093-1f00-4d92-b493-fa7cb8dd2882",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "3",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1492",
          "X-Account-Quota-Remaining": "2984"
        },
        "body": {
          "trades": [
            {
              "id": "S2-0-1791894072392",
              "orderId": "S2",
              "market": "spot",
              "symbol": "BTC_USDT",
              "side": "buy",
              "price": "83224",
              "qty": "0.0001",
              "quote": "8.3224",
              "fee": "0.0000001",
              "feeAsset": "BTC",
              "role": "taker",
              "t": 1791894072392
            }
          ]
        }
      },
      "curl": [
        "curl -X GET \"https://game.inc.re/api/v1/trades?market=crypto_spot\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\""
      ],
      "requestJsonForCurl": null,
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/trades?market=crypto_spot\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "response = requests.get(url, headers=headers, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "API设合约杠杆",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/futures/leverage",
        "body": {
          "symbol": "BTC_USDT",
          "leverage": 10
        }
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "7d4e974a-5740-47ff-a1ba-60fa63212c8d",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "1",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1491",
          "X-Account-Quota-Remaining": "2983"
        },
        "body": {
          "serverTime": 1791894072543,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "8.59660898",
                "locked": "0"
              },
              {
                "asset": "BTC",
                "free": "0.0000999",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "0"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 2,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "0",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "3",
            "locked": "0",
            "leverage": {
              "BTC_USDT": 10
            },
            "positions": [

            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [
              {
                "id": "S2",
                "clientId": "d9f9dea2-989d-4f64-a1fd-9f85de01dfa5",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "avgPrice": "83224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "status": "filled",
                "reduceOnly": false,
                "tp": null,
                "sl": null,
                "leverage": null,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894072392,
                "triggeredAt": null,
                "updatedAt": 1791894072392,
                "checkFrom": 1791894072392,
                "executedQuote": "8.3224"
              },
              {
                "id": "A1",
                "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
                "market": "ashare",
                "code": "sh601005",
                "symbol": "sh601005",
                "name": "重庆钢铁",
                "side": "buy",
                "type": "limit",
                "price": "1.09",
                "qty": "100",
                "filled": "0",
                "executedQuote": "0",
                "avgPrice": "0",
                "fee": "0",
                "feeAsset": "CNY",
                "status": "canceled",
                "lock": {
                  "asset": "CNY",
                  "amount": "0"
                },
                "createdAt": 1791894072070,
                "updatedAt": 1791894072133,
                "checkFrom": 1791941400000,
                "expiresAt": 1791961200000,
                "preplaced": true
              }
            ],
            "trades": [
              {
                "id": "S2-0-1791894072392",
                "orderId": "S2",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "price": "83224",
                "qty": "0.0001",
                "quote": "8.3224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "role": "taker",
                "t": 1791894072392
              }
            ],
            "ledger": [
              {
                "t": 1791894072392,
                "kind": "fee",
                "asset": "BTC",
                "amount": "-0.0000001",
                "note": "手续费",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "16.91900898",
                "note": "划转",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-16.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "3",
                "note": "划转",
                "market": "futures"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-3",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "fx_fee",
                "asset": "CNY",
                "amount": "-0.27",
                "note": "换汇费",
                "market": "ashare"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_in",
                "asset": "USD",
                "amount": "19.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_out",
                "asset": "CNY",
                "amount": "-133.3",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ]
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/futures/leverage\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "symbol": "BTC_USDT",
        "leverage": 10
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/futures/leverage\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"symbol\": \"BTC_USDT\",",
        "  \"leverage\": 10",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "API真实合约市价开仓",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/orders",
        "body": {
          "market": "crypto_futures",
          "symbol": "BTC_USDT",
          "side": "buy",
          "type": "market",
          "qty": "0.0001",
          "clientId": "99caef12-8235-4df7-98d6-3256cd1c5a39"
        }
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "2cc59230-b8e3-4022-a845-6b8df897032e",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "9",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1490",
          "X-Account-Quota-Remaining": "2982"
        },
        "body": {
          "serverTime": 1791894132960,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "8.59660898",
                "locked": "0"
              },
              {
                "asset": "BTC",
                "free": "0.0000999",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "0"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 3,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "0",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "2.16393145",
            "locked": "0",
            "leverage": {
              "BTC_USDT": 10
            },
            "positions": [
              {
                "symbol": "BTC_USDT",
                "side": "long",
                "qty": "0.0001",
                "entry": "83190.9",
                "margin": "0.831909",
                "leverage": 10,
                "mmr": "0.003",
                "tp": null,
                "sl": null,
                "openedAt": 1791894132960,
                "checkFrom": 1791894132960,
                "updatedAt": 1791894132960,
                "liq": "75097.101303911735205617"
              }
            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [
              {
                "id": "F3",
                "clientId": "99caef12-8235-4df7-98d6-3256cd1c5a39",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "buy",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "executedQuote": "8.31909",
                "avgPrice": "83190.9",
                "fee": "0.00415955",
                "feeAsset": "USDT",
                "status": "filled",
                "reduceOnly": false,
                "tp": null,
                "sl": null,
                "leverage": 10,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894132960,
                "triggeredAt": null,
                "updatedAt": 1791894132960,
                "checkFrom": 1791894132960
              },
              {
                "id": "S2",
                "clientId": "d9f9dea2-989d-4f64-a1fd-9f85de01dfa5",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "avgPrice": "83224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "status": "filled",
                "reduceOnly": false,
                "tp": null,
                "sl": null,
                "leverage": null,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894072392,
                "triggeredAt": null,
                "updatedAt": 1791894072392,
                "checkFrom": 1791894072392,
                "executedQuote": "8.3224"
              },
              {
                "id": "A1",
                "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
                "market": "ashare",
                "code": "sh601005",
                "symbol": "sh601005",
                "name": "重庆钢铁",
                "side": "buy",
                "type": "limit",
                "price": "1.09",
                "qty": "100",
                "filled": "0",
                "executedQuote": "0",
                "avgPrice": "0",
                "fee": "0",
                "feeAsset": "CNY",
                "status": "canceled",
                "lock": {
                  "asset": "CNY",
                  "amount": "0"
                },
                "createdAt": 1791894072070,
                "updatedAt": 1791894072133,
                "checkFrom": 1791941400000,
                "expiresAt": 1791961200000,
                "preplaced": true
              }
            ],
            "trades": [
              {
                "id": "F3-1791894132960-3",
                "orderId": "F3",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "buy",
                "qty": "0.0001",
                "price": "83190.9",
                "quote": "8.31909",
                "fee": "0.00415955",
                "feeAsset": "USDT",
                "role": "taker",
                "realizedPnl": "0",
                "t": 1791894132960
              },
              {
                "id": "S2-0-1791894072392",
                "orderId": "S2",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "price": "83224",
                "qty": "0.0001",
                "quote": "8.3224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "role": "taker",
                "t": 1791894072392
              }
            ],
            "ledger": [
              {
                "t": 1791894132960,
                "kind": "fee",
                "asset": "USDT",
                "amount": "-0.00415955",
                "note": "手续费",
                "market": "futures"
              },
              {
                "t": 1791894072392,
                "kind": "fee",
                "asset": "BTC",
                "amount": "-0.0000001",
                "note": "手续费",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "16.91900898",
                "note": "划转",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-16.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "3",
                "note": "划转",
                "market": "futures"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-3",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "fx_fee",
                "asset": "CNY",
                "amount": "-0.27",
                "note": "换汇费",
                "market": "ashare"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_in",
                "asset": "USD",
                "amount": "19.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_out",
                "asset": "CNY",
                "amount": "-133.3",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ],
          "order": {
            "id": "F3",
            "clientId": "99caef12-8235-4df7-98d6-3256cd1c5a39",
            "market": "futures",
            "symbol": "BTC_USDT",
            "side": "buy",
            "type": "market",
            "price": null,
            "stopPrice": null,
            "stopDir": null,
            "qty": "0.0001",
            "quoteQty": null,
            "filled": "0.0001",
            "executedQuote": "8.31909",
            "avgPrice": "83190.9",
            "fee": "0.00415955",
            "feeAsset": "USDT",
            "status": "filled",
            "reduceOnly": false,
            "tp": null,
            "sl": null,
            "leverage": 10,
            "lock": {
              "asset": "USDT",
              "amount": "0"
            },
            "createdAt": 1791894132960,
            "triggeredAt": null,
            "updatedAt": 1791894132960,
            "checkFrom": 1791894132960
          }
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/orders\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "market": "crypto_futures",
        "symbol": "BTC_USDT",
        "side": "buy",
        "type": "market",
        "qty": "0.0001",
        "clientId": "99caef12-8235-4df7-98d6-3256cd1c5a39"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/orders\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"market\": \"crypto_futures\",",
        "  \"symbol\": \"BTC_USDT\",",
        "  \"side\": \"buy\",",
        "  \"type\": \"market\",",
        "  \"qty\": \"0.0001\",",
        "  \"clientId\": \"99caef12-8235-4df7-98d6-3256cd1c5a39\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "API仓位止盈止损",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/futures/tpsl",
        "body": {
          "symbol": "BTC_USDT",
          "tp": "99830",
          "sl": "66552"
        }
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "63282f58-5c8c-45dc-8286-5bbc73c286cf",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "8",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1489",
          "X-Account-Quota-Remaining": "2981"
        },
        "body": {
          "serverTime": 1791894133347,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "8.59660898",
                "locked": "0"
              },
              {
                "asset": "BTC",
                "free": "0.0000999",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "0"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 3,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "0",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "2.16393145",
            "locked": "0",
            "leverage": {
              "BTC_USDT": 10
            },
            "positions": [
              {
                "symbol": "BTC_USDT",
                "side": "long",
                "qty": "0.0001",
                "entry": "83190.9",
                "margin": "0.831909",
                "leverage": 10,
                "mmr": "0.003",
                "tp": "99830",
                "sl": "66552",
                "openedAt": 1791894132960,
                "checkFrom": 1791894133347,
                "updatedAt": 1791894133347,
                "liq": "75097.101303911735205617"
              }
            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [
              {
                "id": "F3",
                "clientId": "99caef12-8235-4df7-98d6-3256cd1c5a39",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "buy",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "executedQuote": "8.31909",
                "avgPrice": "83190.9",
                "fee": "0.00415955",
                "feeAsset": "USDT",
                "status": "filled",
                "reduceOnly": false,
                "tp": null,
                "sl": null,
                "leverage": 10,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894132960,
                "triggeredAt": null,
                "updatedAt": 1791894132960,
                "checkFrom": 1791894132960
              },
              {
                "id": "S2",
                "clientId": "d9f9dea2-989d-4f64-a1fd-9f85de01dfa5",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "avgPrice": "83224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "status": "filled",
                "reduceOnly": false,
                "tp": null,
                "sl": null,
                "leverage": null,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894072392,
                "triggeredAt": null,
                "updatedAt": 1791894072392,
                "checkFrom": 1791894072392,
                "executedQuote": "8.3224"
              },
              {
                "id": "A1",
                "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
                "market": "ashare",
                "code": "sh601005",
                "symbol": "sh601005",
                "name": "重庆钢铁",
                "side": "buy",
                "type": "limit",
                "price": "1.09",
                "qty": "100",
                "filled": "0",
                "executedQuote": "0",
                "avgPrice": "0",
                "fee": "0",
                "feeAsset": "CNY",
                "status": "canceled",
                "lock": {
                  "asset": "CNY",
                  "amount": "0"
                },
                "createdAt": 1791894072070,
                "updatedAt": 1791894072133,
                "checkFrom": 1791941400000,
                "expiresAt": 1791961200000,
                "preplaced": true
              }
            ],
            "trades": [
              {
                "id": "F3-1791894132960-3",
                "orderId": "F3",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "buy",
                "qty": "0.0001",
                "price": "83190.9",
                "quote": "8.31909",
                "fee": "0.00415955",
                "feeAsset": "USDT",
                "role": "taker",
                "realizedPnl": "0",
                "t": 1791894132960
              },
              {
                "id": "S2-0-1791894072392",
                "orderId": "S2",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "price": "83224",
                "qty": "0.0001",
                "quote": "8.3224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "role": "taker",
                "t": 1791894072392
              }
            ],
            "ledger": [
              {
                "t": 1791894132960,
                "kind": "fee",
                "asset": "USDT",
                "amount": "-0.00415955",
                "note": "手续费",
                "market": "futures"
              },
              {
                "t": 1791894072392,
                "kind": "fee",
                "asset": "BTC",
                "amount": "-0.0000001",
                "note": "手续费",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "16.91900898",
                "note": "划转",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-16.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "3",
                "note": "划转",
                "market": "futures"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-3",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "fx_fee",
                "asset": "CNY",
                "amount": "-0.27",
                "note": "换汇费",
                "market": "ashare"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_in",
                "asset": "USD",
                "amount": "19.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_out",
                "asset": "CNY",
                "amount": "-133.3",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ]
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/futures/tpsl\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "symbol": "BTC_USDT",
        "tp": "99830",
        "sl": "66552"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/futures/tpsl\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"symbol\": \"BTC_USDT\",",
        "  \"tp\": \"99830\",",
        "  \"sl\": \"66552\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "API真实合约市价平仓",
      "authentication": "api_key",
      "request": {
        "method": "POST",
        "path": "/api/v1/futures/close",
        "body": {
          "symbol": "BTC_USDT",
          "type": "market",
          "clientId": "8bd7bd59-bef2-44f5-87c8-4db53b9740bd"
        }
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "cd24000c-248c-4f83-b7dc-8700fb4ed710",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "7",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1488",
          "X-Account-Quota-Remaining": "2980"
        },
        "body": {
          "serverTime": 1791894133565,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "8.59660898",
                "locked": "0"
              },
              {
                "asset": "BTC",
                "free": "0.0000999",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "0"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 4,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "0",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "2.99167091",
            "locked": "0",
            "leverage": {
              "BTC_USDT": 10
            },
            "positions": [

            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [
              {
                "id": "F4",
                "clientId": "8bd7bd59-bef2-44f5-87c8-4db53b9740bd",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "sell",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "executedQuote": "8.31908",
                "avgPrice": "83190.8",
                "fee": "0.00415954",
                "feeAsset": "USDT",
                "status": "filled",
                "reduceOnly": true,
                "tp": null,
                "sl": null,
                "leverage": 10,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894133565,
                "triggeredAt": null,
                "updatedAt": 1791894133565,
                "checkFrom": 1791894133565
              },
              {
                "id": "F3",
                "clientId": "99caef12-8235-4df7-98d6-3256cd1c5a39",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "buy",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "executedQuote": "8.31909",
                "avgPrice": "83190.9",
                "fee": "0.00415955",
                "feeAsset": "USDT",
                "status": "filled",
                "reduceOnly": false,
                "tp": null,
                "sl": null,
                "leverage": 10,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894132960,
                "triggeredAt": null,
                "updatedAt": 1791894132960,
                "checkFrom": 1791894132960
              },
              {
                "id": "S2",
                "clientId": "d9f9dea2-989d-4f64-a1fd-9f85de01dfa5",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "avgPrice": "83224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "status": "filled",
                "reduceOnly": false,
                "tp": null,
                "sl": null,
                "leverage": null,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894072392,
                "triggeredAt": null,
                "updatedAt": 1791894072392,
                "checkFrom": 1791894072392,
                "executedQuote": "8.3224"
              },
              {
                "id": "A1",
                "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
                "market": "ashare",
                "code": "sh601005",
                "symbol": "sh601005",
                "name": "重庆钢铁",
                "side": "buy",
                "type": "limit",
                "price": "1.09",
                "qty": "100",
                "filled": "0",
                "executedQuote": "0",
                "avgPrice": "0",
                "fee": "0",
                "feeAsset": "CNY",
                "status": "canceled",
                "lock": {
                  "asset": "CNY",
                  "amount": "0"
                },
                "createdAt": 1791894072070,
                "updatedAt": 1791894072133,
                "checkFrom": 1791941400000,
                "expiresAt": 1791961200000,
                "preplaced": true
              }
            ],
            "trades": [
              {
                "id": "F4-1791894133565-4",
                "orderId": "F4",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "sell",
                "qty": "0.0001",
                "price": "83190.8",
                "quote": "8.31908",
                "fee": "0.00415954",
                "feeAsset": "USDT",
                "role": "taker",
                "realizedPnl": "-0.00001",
                "t": 1791894133565
              },
              {
                "id": "F3-1791894132960-3",
                "orderId": "F3",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "buy",
                "qty": "0.0001",
                "price": "83190.9",
                "quote": "8.31909",
                "fee": "0.00415955",
                "feeAsset": "USDT",
                "role": "taker",
                "realizedPnl": "0",
                "t": 1791894132960
              },
              {
                "id": "S2-0-1791894072392",
                "orderId": "S2",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "price": "83224",
                "qty": "0.0001",
                "quote": "8.3224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "role": "taker",
                "t": 1791894072392
              }
            ],
            "ledger": [
              {
                "t": 1791894133565,
                "kind": "fee",
                "asset": "USDT",
                "amount": "-0.00415954",
                "note": "手续费",
                "market": "futures"
              },
              {
                "t": 1791894133565,
                "kind": "realized_pnl",
                "asset": "USDT",
                "amount": "-0.00001",
                "note": "已实现盈亏",
                "market": "futures"
              },
              {
                "t": 1791894132960,
                "kind": "fee",
                "asset": "USDT",
                "amount": "-0.00415955",
                "note": "手续费",
                "market": "futures"
              },
              {
                "t": 1791894072392,
                "kind": "fee",
                "asset": "BTC",
                "amount": "-0.0000001",
                "note": "手续费",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "16.91900898",
                "note": "划转",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-16.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "3",
                "note": "划转",
                "market": "futures"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-3",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "fx_fee",
                "asset": "CNY",
                "amount": "-0.27",
                "note": "换汇费",
                "market": "ashare"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_in",
                "asset": "USD",
                "amount": "19.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_out",
                "asset": "CNY",
                "amount": "-133.3",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ],
          "order": {
            "id": "F4",
            "clientId": "8bd7bd59-bef2-44f5-87c8-4db53b9740bd",
            "market": "futures",
            "symbol": "BTC_USDT",
            "side": "sell",
            "type": "market",
            "price": null,
            "stopPrice": null,
            "stopDir": null,
            "qty": "0.0001",
            "quoteQty": null,
            "filled": "0.0001",
            "executedQuote": "8.31908",
            "avgPrice": "83190.8",
            "fee": "0.00415954",
            "feeAsset": "USDT",
            "status": "filled",
            "reduceOnly": true,
            "tp": null,
            "sl": null,
            "leverage": 10,
            "lock": {
              "asset": "USDT",
              "amount": "0"
            },
            "createdAt": 1791894133565,
            "triggeredAt": null,
            "updatedAt": 1791894133565,
            "checkFrom": 1791894133565
          }
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/v1/futures/close\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "symbol": "BTC_USDT",
        "type": "market",
        "clientId": "8bd7bd59-bef2-44f5-87c8-4db53b9740bd"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/futures/close\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "payload = json.loads('''",
        "{",
        "  \"symbol\": \"BTC_USDT\",",
        "  \"type\": \"market\",",
        "  \"clientId\": \"8bd7bd59-bef2-44f5-87c8-4db53b9740bd\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "最后account估值",
      "authentication": "api_key",
      "request": {
        "method": "GET",
        "path": "/api/v1/account"
      },
      "response": {
        "status": 200,
        "headers": {
          "X-Request-Id": "79990a17-4e9c-4665-bc8b-848038e8fb51",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "9",
          "X-Daily-Quota-Limit": "1500",
          "X-Daily-Quota-Remaining": "1491",
          "X-Account-Quota-Remaining": "2979"
        },
        "body": {
          "serverTime": 1791894133900,
          "partial": false,
          "checkin": {
            "today": "2026-10-13",
            "checkedToday": true,
            "streak": 1,
            "dayIndex": 0,
            "rewards": [
              "20",
              "25",
              "30",
              "35",
              "40",
              "45",
              "50"
            ],
            "nextReward": "25",
            "cap": "50",
            "total": "20",
            "days": 1
          },
          "spot": {
            "balances": [
              {
                "asset": "USDT",
                "free": "8.59660898",
                "locked": "0"
              },
              {
                "asset": "BTC",
                "free": "0.0000999",
                "locked": "0"
              }
            ]
          },
          "wallet": {
            "usd": "0"
          },
          "disclaimerAt": 1791894071011,
          "agent": {
            "ordersToday": 4,
            "day": "2026-10-13"
          },
          "ashare": {
            "cash": {
              "free": "0",
              "locked": "0"
            },
            "watch": [

            ],
            "holdings": [

            ],
            "market": {
              "status": "closed",
              "nextOpen": 1791941400000,
              "checked": true
            }
          },
          "futures": {
            "wallet": "2.99167091",
            "locked": "0",
            "leverage": {
              "BTC_USDT": 10
            },
            "positions": [

            ]
          },
          "openOrders": [

          ],
          "recent": {
            "orders": [
              {
                "id": "F4",
                "clientId": "8bd7bd59-bef2-44f5-87c8-4db53b9740bd",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "sell",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "executedQuote": "8.31908",
                "avgPrice": "83190.8",
                "fee": "0.00415954",
                "feeAsset": "USDT",
                "status": "filled",
                "reduceOnly": true,
                "tp": null,
                "sl": null,
                "leverage": 10,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894133565,
                "triggeredAt": null,
                "updatedAt": 1791894133565,
                "checkFrom": 1791894133565
              },
              {
                "id": "F3",
                "clientId": "99caef12-8235-4df7-98d6-3256cd1c5a39",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "buy",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "executedQuote": "8.31909",
                "avgPrice": "83190.9",
                "fee": "0.00415955",
                "feeAsset": "USDT",
                "status": "filled",
                "reduceOnly": false,
                "tp": null,
                "sl": null,
                "leverage": 10,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894132960,
                "triggeredAt": null,
                "updatedAt": 1791894132960,
                "checkFrom": 1791894132960
              },
              {
                "id": "S2",
                "clientId": "d9f9dea2-989d-4f64-a1fd-9f85de01dfa5",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "type": "market",
                "price": null,
                "stopPrice": null,
                "stopDir": null,
                "qty": "0.0001",
                "quoteQty": null,
                "filled": "0.0001",
                "avgPrice": "83224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "status": "filled",
                "reduceOnly": false,
                "tp": null,
                "sl": null,
                "leverage": null,
                "lock": {
                  "asset": "USDT",
                  "amount": "0"
                },
                "createdAt": 1791894072392,
                "triggeredAt": null,
                "updatedAt": 1791894072392,
                "checkFrom": 1791894072392,
                "executedQuote": "8.3224"
              },
              {
                "id": "A1",
                "clientId": "e90ee7cb-f7b4-4246-8f15-3e6b7974b75c",
                "market": "ashare",
                "code": "sh601005",
                "symbol": "sh601005",
                "name": "重庆钢铁",
                "side": "buy",
                "type": "limit",
                "price": "1.09",
                "qty": "100",
                "filled": "0",
                "executedQuote": "0",
                "avgPrice": "0",
                "fee": "0",
                "feeAsset": "CNY",
                "status": "canceled",
                "lock": {
                  "asset": "CNY",
                  "amount": "0"
                },
                "createdAt": 1791894072070,
                "updatedAt": 1791894072133,
                "checkFrom": 1791941400000,
                "expiresAt": 1791961200000,
                "preplaced": true
              }
            ],
            "trades": [
              {
                "id": "F4-1791894133565-4",
                "orderId": "F4",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "sell",
                "qty": "0.0001",
                "price": "83190.8",
                "quote": "8.31908",
                "fee": "0.00415954",
                "feeAsset": "USDT",
                "role": "taker",
                "realizedPnl": "-0.00001",
                "t": 1791894133565
              },
              {
                "id": "F3-1791894132960-3",
                "orderId": "F3",
                "market": "futures",
                "symbol": "BTC_USDT",
                "side": "buy",
                "qty": "0.0001",
                "price": "83190.9",
                "quote": "8.31909",
                "fee": "0.00415955",
                "feeAsset": "USDT",
                "role": "taker",
                "realizedPnl": "0",
                "t": 1791894132960
              },
              {
                "id": "S2-0-1791894072392",
                "orderId": "S2",
                "market": "spot",
                "symbol": "BTC_USDT",
                "side": "buy",
                "price": "83224",
                "qty": "0.0001",
                "quote": "8.3224",
                "fee": "0.0000001",
                "feeAsset": "BTC",
                "role": "taker",
                "t": 1791894072392
              }
            ],
            "ledger": [
              {
                "t": 1791894133565,
                "kind": "fee",
                "asset": "USDT",
                "amount": "-0.00415954",
                "note": "手续费",
                "market": "futures"
              },
              {
                "t": 1791894133565,
                "kind": "realized_pnl",
                "asset": "USDT",
                "amount": "-0.00001",
                "note": "已实现盈亏",
                "market": "futures"
              },
              {
                "t": 1791894132960,
                "kind": "fee",
                "asset": "USDT",
                "amount": "-0.00415955",
                "note": "手续费",
                "market": "futures"
              },
              {
                "t": 1791894072392,
                "kind": "fee",
                "asset": "BTC",
                "amount": "-0.0000001",
                "note": "手续费",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "16.91900898",
                "note": "划转",
                "market": "spot"
              },
              {
                "t": 1791894072353,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-16.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_in",
                "asset": "USDT",
                "amount": "3",
                "note": "划转",
                "market": "futures"
              },
              {
                "t": 1791894072293,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-3",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "fx_fee",
                "asset": "CNY",
                "amount": "-0.27",
                "note": "换汇费",
                "market": "ashare"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_in",
                "asset": "USD",
                "amount": "19.91900898",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894072252,
                "kind": "transfer_out",
                "asset": "CNY",
                "amount": "-133.3",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "fx_fee",
                "asset": "USD",
                "amount": "-0.04",
                "note": "换汇费",
                "market": "wallet"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_in",
                "asset": "CNY",
                "amount": "133.57",
                "note": "划转",
                "market": "ashare"
              },
              {
                "t": 1791894071936,
                "kind": "transfer_out",
                "asset": "USD",
                "amount": "-19.96",
                "note": "划转",
                "market": "wallet"
              },
              {
                "t": 1791894071902,
                "kind": "checkin",
                "asset": "USD",
                "amount": "20",
                "note": "每日签到",
                "market": "wallet"
              }
            ]
          },
          "notices": [

          ],
          "totalUSD": "19.90219765",
          "totalCNY": "133.18",
          "fx": {
            "rate": "6.6921",
            "rateTime": 1791894079000
          },
          "valuation": {
            "rate": "6.6921",
            "rateTime": 1791894079000
          }
        }
      },
      "curl": [
        "curl -X GET \"https://game.inc.re/api/v1/account\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\""
      ],
      "requestJsonForCurl": null,
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/account\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "response = requests.get(url, headers=headers, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "读取Key调用日志",
      "authentication": "web_session",
      "request": {
        "method": "GET",
        "path": "/api/keys/log?id=jpvsie2omu"
      },
      "response": {
        "status": 200,
        "headers": {

        },
        "body": {
          "logs": [
            {
              "time": 1791894133560,
              "method": "POST",
              "path": "/api/v1/futures/close",
              "status": 200,
              "ip": "127.0.0.0/24"
            },
            {
              "time": 1791894133341,
              "method": "POST",
              "path": "/api/v1/futures/tpsl",
              "status": 200,
              "ip": "127.0.0.0/24"
            },
            {
              "time": 1791894132943,
              "method": "POST",
              "path": "/api/v1/orders",
              "status": 200,
              "ip": "127.0.0.0/24"
            },
            {
              "time": 1791894072537,
              "method": "POST",
              "path": "/api/v1/futures/leverage",
              "status": 200,
              "ip": "127.0.0.0/24"
            },
            {
              "time": 1791894072385,
              "method": "POST",
              "path": "/api/v1/orders",
              "status": 200,
              "ip": "127.0.0.0/24"
            },
            {
              "time": 1791894072347,
              "method": "POST",
              "path": "/api/v1/transfer",
              "status": 200,
              "ip": "127.0.0.0/24"
            },
            {
              "time": 1791894072284,
              "method": "POST",
              "path": "/api/v1/transfer",
              "status": 200,
              "ip": "127.0.0.0/24"
            },
            {
              "time": 1791894072243,
              "method": "POST",
              "path": "/api/v1/transfer",
              "status": 200,
              "ip": "127.0.0.0/24"
            },
            {
              "time": 1791894072126,
              "method": "POST",
              "path": "/api/v1/orders/cancel",
              "status": 200,
              "ip": "127.0.0.0/24"
            },
            {
              "time": 1791894072063,
              "method": "POST",
              "path": "/api/v1/orders",
              "status": 200,
              "ip": "127.0.0.0/24"
            },
            {
              "time": 1791894072030,
              "method": "POST",
              "path": "/api/v1/orders",
              "status": 422,
              "ip": "127.0.0.0/24"
            },
            {
              "time": 1791894071929,
              "method": "POST",
              "path": "/api/v1/transfer",
              "status": 200,
              "ip": "127.0.0.0/24"
            }
          ]
        }
      },
      "curl": [
        "curl -X GET \"https://game.inc.re/api/keys/log?id=jpvsie2omu\" \\",
        "  -H \"Cookie: <SESSION_COOKIE>\" -H \"Origin: https://game.inc.re\""
      ],
      "requestJsonForCurl": null,
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/keys/log?id=jpvsie2omu\"",
        "headers = {\"Cookie\": os.environ[\"GAME_SESSION_COOKIE\"], \"Origin\": \"https://g" +
          "ame.inc.re\"}",
        "response = requests.get(url, headers=headers, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "删除trade Key",
      "authentication": "web_session",
      "request": {
        "method": "POST",
        "path": "/api/keys/delete",
        "body": {
          "id": "jpvsie2omu"
        }
      },
      "response": {
        "status": 200,
        "headers": {

        },
        "body": {
          "ok": true,
          "id": "jpvsie2omu",
          "deleted": true
        }
      },
      "curl": [
        "curl -X POST \"https://game.inc.re/api/keys/delete\" \\",
        "  -H \"Cookie: <SESSION_COOKIE>\" -H \"Origin: https://game.inc.re\" \\",
        "  -H \"Content-Type: application/json\" --data @request.json"
      ],
      "requestJsonForCurl": {
        "id": "jpvsie2omu"
      },
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/keys/delete\"",
        "headers = {\"Cookie\": os.environ[\"GAME_SESSION_COOKIE\"], \"Origin\": \"https://g" +
          "ame.inc.re\"}",
        "payload = json.loads('''",
        "{",
        "  \"id\": \"jpvsie2omu\"",
        "}",
        "''')",
        "response = requests.post(url, headers=headers, json=payload, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    },
    {
      "label": "删除后立即401",
      "authentication": "api_key",
      "request": {
        "method": "GET",
        "path": "/api/v1/account"
      },
      "response": {
        "status": 401,
        "headers": {
          "X-Request-Id": "57a160cb-d6f3-438b-99d6-f5fd8537e0ec",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "10"
        },
        "body": {
          "error": "invalid_api_key",
          "message": "API 密钥无效"
        }
      },
      "curl": [
        "curl -X GET \"https://game.inc.re/api/v1/account\" \\",
        "  -H \"Authorization: Bearer <API_KEY>\""
      ],
      "requestJsonForCurl": null,
      "python": [
        "import os, json, requests",
        "url = \"https://game.inc.re/api/v1/account\"",
        "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
        "response = requests.get(url, headers=headers, timeout=15)",
        "print(response.status_code)",
        "data = response.json()",
        "data.pop(\"key\", None)",
        "print(data)"
      ]
    }
  ],
  "agentLoopPython": [
    "import os, time, uuid, requests",
    "api = \"https://game.inc.re/api/v1\"",
    "headers = {\"Authorization\": \"Bearer \" + os.environ[\"GAME_API_KEY\"]}",
    "while True:",
    "    account = requests.get(api + \"/account\", headers=headers, timeout=15)",
    "    account.raise_for_status()",
    "    quote = requests.get(api + \"/quote\", params={\"market\": \"crypto\", \"symbol" +
      "\": \"BTC_USDT\"},",
    "                         headers=headers, timeout=15)",
    "    quote.raise_for_status()",
    "    free = next(x[\"free\"] for x in account.json()[\"spot\"][\"balances\"] if x[\"" +
      "asset\"] == \"USDT\")",
    "    if float(free) > float(quote.json()[\"ask\"]) * 0.0001 * 1.01:",
    "        intent = {\"market\": \"crypto_spot\", \"symbol\": \"BTC_USDT\", \"side\": \"bu" +
      "y\",",
    "                  \"type\": \"market\", \"qty\": \"0.0001\", \"clientId\": str(uuid.uu" +
      "id4())}",
    "        result = requests.post(api + \"/orders\", json=intent, headers=headers" +
      ", timeout=15)",
    "        result.raise_for_status()",
    "    time.sleep(60)"
  ]
};
