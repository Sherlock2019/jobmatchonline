import fs from 'node:fs';
import path from 'node:path';

export class JsonStore {
  constructor(filePath, seedFactory) {
    this.filePath = filePath;
    this.seedFactory = seedFactory;
    this.queue = Promise.resolve();
  }

  async init() {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.promises.access(this.filePath);
    } catch {
      await this.write(this.seedFactory());
    }
  }

  async read() {
    return JSON.parse(await fs.promises.readFile(this.filePath, 'utf8'));
  }

  async write(data) {
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2));
    await fs.promises.rename(tempPath, this.filePath);
  }

  transaction(update) {
    const task = this.queue.then(async () => {
      const data = await this.read();
      const result = await update(data);
      await this.write(data);
      return result;
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}
