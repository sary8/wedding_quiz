import { existsSync } from "fs";
import { writeFile, readFile, unlink, readdir, stat, mkdir } from "fs/promises";
import { join } from "path";
import type { StorageDriver } from "./driver.js";

// ローカルディスク実装（従来の ./uploads 挙動をそのまま移設）
export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly dir: string) {}

  async save(filename: string, data: Buffer): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, filename), data);
  }

  async read(filename: string): Promise<Buffer | null> {
    const filepath = join(this.dir, filename);
    if (!existsSync(filepath)) return null;
    return readFile(filepath);
  }

  async delete(filename: string): Promise<void> {
    await unlink(join(this.dir, filename)).catch(() => {});
  }

  async totalSize(): Promise<number> {
    if (!existsSync(this.dir)) return 0;
    const files = await readdir(this.dir);
    let total = 0;
    for (const file of files) {
      const fileStat = await stat(join(this.dir, file)).catch(() => null);
      if (fileStat?.isFile()) total += fileStat.size;
    }
    return total;
  }
}
