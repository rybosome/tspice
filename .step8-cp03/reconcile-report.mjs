import { readFileSync, writeFileSync } from "node:fs";

const queuePath = "data/expansion-queue.json";
const queue = JSON.parse(readFileSync(queuePath, "utf8"));
const restored = queue.batches.filter(({ checkpoint }) => [1, 2].includes(checkpoint?.number));
if (restored.length !== 29) throw new Error("Unexpected checkpoint 01/02 batch count");
for (const batch of restored) {
  if (batch.status !== "landed") throw new Error(`Unexpected status for ${batch.id}`);
  batch.nextAction = "The original source head is reachable from main.";
  batch.deliveryNote += " PR #787 restored source ancestry on main at c64657a17082936c03be189ccff2287b21b0b30c.";
}
writeFileSync(queuePath, JSON.stringify(queue, null, 2) + "\n");

const docsPath = "docs/step8-expansion.md";
const original = readFileSync(docsPath, "utf8");
const previous = "The squash merges left the original source heads outside main.";
const current = "[PR #787](https://github.com/rybosome/tspice/pull/787) then restored all 29 original source heads with a merge commit.";
const priorNext = "Its merge commit will make all 49 original source heads from checkpoints 01–03 reachable from main.";
const currentNext = "Its merge commit will make the 20 additional original source heads reachable from main.";
if (!original.includes(previous) || !original.includes(priorNext)) throw new Error("Checkpoint text changed");
writeFileSync(docsPath, original.replace(previous, current).replace(priorNext, currentNext));
