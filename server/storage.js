/**
 * Durable file storage: local disk stays the hot path (uploads are written and
 * processed locally), and when S3 is configured each file is mirrored to the
 * bucket and restored on startup — so uploads survive an instance replacement.
 * Additive and safe: with no S3 env, behaviour is unchanged (local only).
 */
import fs from 'node:fs';
import path from 'node:path';

const BUCKET = process.env.S3_BUCKET;
export function s3Enabled() { return Boolean(BUCKET && process.env.AWS_ACCESS_KEY_ID); }

let clientPromise;
async function s3() {
  clientPromise ||= import('@aws-sdk/client-s3').then((m) => ({ m, client: new m.S3Client({ region: process.env.S3_REGION || 'ap-southeast-1' }) }));
  return clientPromise;
}

function keyFor(localPath, uploadsRoot) {
  return path.relative(uploadsRoot, localPath).split(path.sep).join('/');
}

/** Fire-and-forget upload of a local file to S3 (mirror). Never throws. */
export async function mirrorToS3(localPath, uploadsRoot) {
  if (!s3Enabled()) return;
  try {
    const { m, client } = await s3();
    const Body = await fs.promises.readFile(localPath);
    await client.send(new m.PutObjectCommand({ Bucket: BUCKET, Key: keyFor(localPath, uploadsRoot), Body }));
  } catch (error) { console.error('[s3] mirror failed:', error.message); }
}

/** On startup, upload any local files that aren't in the bucket yet (back up
 *  pre-existing uploads the first time S3 is enabled). */
export async function backupToS3(uploadsRoot) {
  if (!s3Enabled()) return;
  try {
    const { m, client } = await s3();
    const present = new Set();
    let token;
    do {
      const out = await client.send(new m.ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }));
      for (const obj of out.Contents || []) present.add(obj.Key);
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);
    const walk = async (dir) => {
      let entries = [];
      try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else if (!present.has(keyFor(full, uploadsRoot))) await mirrorToS3(full, uploadsRoot);
      }
    };
    await walk(uploadsRoot);
  } catch (error) { console.error('[s3] backup failed:', error.message); }
}

/** On startup, download any bucket objects missing from the local uploads dir. */
export async function restoreFromS3(uploadsRoot) {
  if (!s3Enabled()) return;
  try {
    const { m, client } = await s3();
    let token;
    let restored = 0;
    do {
      const out = await client.send(new m.ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }));
      for (const obj of out.Contents || []) {
        const dest = path.join(uploadsRoot, obj.Key);
        try { await fs.promises.access(dest); continue; } catch { /* missing → restore */ }
        await fs.promises.mkdir(path.dirname(dest), { recursive: true });
        const res = await client.send(new m.GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
        await fs.promises.writeFile(dest, Buffer.from(await res.Body.transformToByteArray()));
        restored += 1;
      }
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);
    if (restored) console.log(`[s3] restored ${restored} file(s) from ${BUCKET}`);
  } catch (error) { console.error('[s3] restore failed:', error.message); }
}
