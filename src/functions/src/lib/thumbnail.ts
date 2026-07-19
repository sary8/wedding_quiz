import sharp from "sharp";

export interface ThumbnailOptions {
  /** 出力幅(px)。既定320。元画像がこれより小さければ拡大しない。 */
  width?: number;
  /** WebP品質(0-100)。既定80。 */
  quality?: number;
}

/**
 * 画像バッファを指定幅のWebPサムネイルに変換する。
 * .rotate() で EXIF の向き情報を反映してから縮小する（スマホ縦撮り対策）。
 */
export async function generateThumbnail(input: Buffer, opts: ThumbnailOptions = {}): Promise<Buffer> {
  const width = opts.width ?? 320;
  const quality = opts.quality ?? 80;
  return await sharp(input)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}
