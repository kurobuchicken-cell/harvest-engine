export interface FetchOutcome {
  httpStatus: number | null;
  // 保存用の生バイト列(変化検知時にgzip保存する対象)
  raw: Buffer | null;
  // ハッシュ計算用の正規化済みデータ。html/json/rssはテキスト、pdfは生バイナリそのもの
  normalized: string | Buffer | null;
  error?: string;
}
