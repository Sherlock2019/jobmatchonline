import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the complete JobsMatchNow product website", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Stop chasing jobs and candidates/);
  assert.match(html, /Let the perfect role—or candidate—chase you/);
  assert.match(html, /Mutual matching for people and teams/);
  assert.match(html, /Start matching/);
  assert.match(html, /See how it works/);
  assert.match(html, /hero-phone\.png/);
  assert.match(html, /Download JobsMatchNow/);
  assert.match(html, /Traditional hiring/);
  assert.match(html, /JobsMatchNow creates alignment/);
  assert.match(html, /connects both sides only when the interest is mutual/);
  assert.match(html, /Geolocation of Opportunities/);
  assert.match(html, /Match nearby/);
  assert.match(html, /Meet for a cup of coffee in your city/);
  assert.match(html, /https:\/\/jobsmatchnow\.com/);
  /* phone-mockup carousel: exact photo slide 1 + browsable screens with nav under the phone */
  assert.match(html, /mutually matched/);           /* image alt text */
  assert.match(html, /Product preview 1 of 30/);    /* carousel aria label */
  assert.match(html, /pc-nav/);                     /* arrows + counter under the phone */
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships accessible platform and store status copy", async () => {
  const html = await (await render()).text();
  assert.match(html, /Install for/i);
  assert.match(html, /Coming to the/i);
  assert.match(html, /Store review/i);
  assert.match(html, /Privacy/);
});
