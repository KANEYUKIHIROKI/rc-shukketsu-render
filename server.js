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
async function postJson(urlString, data) {
  const response = await fetch(urlString, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data),
    redirect: "follow"
  });

  const body = await response.text();

  return {
    statusCode: response.status,
    body: body
  };
}


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
