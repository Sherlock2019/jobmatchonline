import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLinkedInImports, parseJobImportFile } from './job-import.js';

test('parses quoted CSV job exports', () => {
  const jobs = parseJobImportFile('id,title,location,description\n42,"Lead AI Engineer","Ho Chi Minh City","Build AI, safely"', 'jobs.csv', 'greenhouse');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].sourceJobId, '42');
  assert.equal(jobs[0].title, 'Lead AI Engineer');
  assert.match(jobs[0].rawText, /Build AI, safely/);
});

test('parses JSON and XML job feeds', () => {
  const json = parseJobImportFile(JSON.stringify({ jobs: [{ id: 'a1', title: 'Cloud Architect', description: 'Design secure cloud platforms.' }] }), 'jobs.json', 'ashby');
  const xml = parseJobImportFile('<jobs><job><id>x1</id><title>DevOps Engineer</title><description><![CDATA[Own reliable delivery systems.]]></description></job></jobs>', 'jobs.xml', 'custom');
  assert.equal(json[0].title, 'Cloud Architect');
  assert.equal(xml[0].sourceJobId, 'x1');
  assert.equal(xml[0].title, 'DevOps Engineer');
});

test('requires recruiter-supplied content for LinkedIn links without fetching them', () => {
  const jobs = normalizeLinkedInImports([{ url: 'https://www.linkedin.com/jobs/view/123456/', title: 'Data Engineer', description: 'Build reliable data pipelines using SQL, Python, and AWS.' }]);
  assert.equal(jobs[0].sourceJobId, '123456');
  assert.match(jobs[0].rawText, /Python/);
  assert.throws(() => normalizeLinkedInImports([{ url: 'https://www.linkedin.com/jobs/view/123/', description: 'too short' }]), /Paste the description/);
  assert.throws(() => normalizeLinkedInImports([{ url: 'https://example.com/jobs/123', description: 'A sufficiently long description that must never be fetched automatically.' }]), /linkedin\.com/);
});
