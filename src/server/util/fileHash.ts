import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

export type FileFingerprintInput = {
  hash: string;
  mtimeMs: bigint;
  size: bigint;
};

export async function getFileStatFingerprint(filePath: string) {
  const fileStat = await stat(filePath);
  return {
    mtimeMs: BigInt(Math.trunc(fileStat.mtimeMs)),
    size: BigInt(fileStat.size),
  };
}

export async function getFileFingerprint(filePath: string): Promise<FileFingerprintInput> {
  const { mtimeMs, size } = await getFileStatFingerprint(filePath);
  const hash = await hashFile(filePath);

  return {
    hash,
    mtimeMs,
    size,
  };
}

function hashFile(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', chunk => {
      hash.update(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
  });
}
