const express = require("express");
const https = require("https");

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 10000;

/**
 * Apps Script の WebアプリURL
 * ここに Render から転送します
 */
const APPS_SCRIPT_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbymuVEV4Gd-j6Gbk9c4xlVW5-gMpx83a-NGn83IJMRKOeEDCtzZ23NqsHSQrmLQqByc/exec";

/**
 * JSON を POST 送信する共通関数
 */
function postJson(urlString, data, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error("リダイレクト回数が多すぎます。"));
      return;
    }

    const url = new URL(urlString);
    const body = JSON.stringify(data);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = "";

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", async () => {
        const redirectStatusList = [301, 302, 303, 307, 308];
        const location = res.headers.location;

        if (redirectStatusList.includes(res.statusCode) && location) {
          try {
            const nextUrl = new URL(location, urlString).toString();

            console.log("===== リダイレクト検出 =====");
            console.log("元URL:", urlString);
            console.log("転送先URL:", nextUrl);
            console.log("statusCode:", res.statusCode);

            const redirectedResult = await postJson(
              nextUrl,
              data,
              redirectCount + 1
            );

            resolve(redirectedResult);
            return;
          } catch (error) {
            reject(error);
            return;
          }
        }

        resolve({
          statusCode: res.statusCode,
          body: responseBody
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(body);
    req.end();
  });
}


/**
 * Render 側の動作確認用
 */
app.get("/", (req, res) => {
  res.status(200).send("RC出欠管理 Renderサーバー稼働中");
});

/**
 * LINE Webhook を受け取る入口
 */
app.post("/", async (req, res) => {
  try {
    console.log("===== LINE Webhook受信 =====");
    console.log(JSON.stringify(req.body, null, 2));

    const events = Array.isArray(req.body.events) ? req.body.events : [];

    /**
     * 検証時など、events が空でも 200 を返す
     */
    if (events.length === 0) {
      return res.status(200).json({
        status: "ok",
        message: "no events"
      });
    }

    /**
     * 受け取った events を順に処理する
     */
    for (const event of events) {
      /**
       * テキストメッセージ以外は無視
       */
      if (event.type !== "message") continue;
      if (!event.message) continue;
      if (event.message.type !== "text") continue;

      /**
       * 個人ユーザー以外は今は対象外
       */
      if (!event.source) continue;
      if (event.source.type !== "user") continue;

      const lineUserId = String(event.source.userId || "").trim();
      const text = String(event.message.text || "").trim();

      if (!lineUserId) continue;
      if (!text) continue;

      /**
       * Apps Script に渡すデータ
       */
      const payload = {
        lineUserId: lineUserId,
        text: text
      };

      console.log("===== Apps Script 送信 =====");
      console.log(JSON.stringify(payload, null, 2));

      const result = await postJson(APPS_SCRIPT_WEB_APP_URL, payload);

      console.log("===== Apps Script 応答 =====");
      console.log("statusCode:", result.statusCode);
      console.log("body:", result.body);
    }

    /**
     * LINE には必ず 200 を返す
     */
    return res.status(200).json({
      status: "ok"
    });

  } catch (error) {
    console.error("Webhook処理エラー:", error);

    /**
     * エラー時でも LINE 側には 200 を返す
     * 再送地獄を避けるため
     */
    return res.status(200).json({
      status: "ok",
      message: "error handled"
    });
  }
});

/**
 * Render 上でサーバー起動
 */
app.listen(PORT, () => {
  console.log(`RC出欠管理サーバー起動: port=${PORT}`);
});
