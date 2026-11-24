import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const chrome = spawn("google-chrome", [
  "--headless", "--no-sandbox", "--disable-dev-shm-usage",
  "--remote-debugging-port=9323", "--remote-allow-origins=*",
  `--user-data-dir=${process.env.RUNNER_TEMP}/step8-chrome`,
  "http://127.0.0.1:8328",
], { stdio: ["ignore", "ignore", "inherit"] });

let socket;
try {
  let page;
  for (let elapsed = 0; elapsed < 30; elapsed++) {
    try {
      const tabs = await fetch("http://127.0.0.1:9323/json/list").then((r) => r.json());
      page = tabs.find((tab) => tab.type === "page" && tab.url.includes(":8328"));
      if (page) break;
    } catch {
      if (chrome.exitCode !== null) throw new Error(`Chrome exited with ${chrome.exitCode}`);
    }
    await setTimeout(1000);
  }
  assert(page, "Chromium did not load the probe page");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const expression = 'document.querySelector("#result")?.textContent';
  let result;
  for (let id = 1; id <= 30; id++) {
    result = await new Promise((resolve) => {
      const update = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        socket.removeEventListener("message", update);
        resolve(message.result?.result?.value);
      };
      socket.addEventListener("message", update);
      socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression } }));
    });
    if (/^(PASS|FAIL) /.test(result ?? "")) break;
    await setTimeout(1000);
  }
  console.log(result);
  assert(result?.startsWith("PASS "), "Integrated Chromium worker did not pass");
} finally {
  socket?.close();
  chrome.kill();
}
