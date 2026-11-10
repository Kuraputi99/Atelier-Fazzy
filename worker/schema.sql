-- いいね機能のデータベース(Cloudflare D1)の表
-- likes     : 作品ごとのいいね数
-- like_log  : 同じ人が同じ日に何度も押せないようにする記録(IPアドレスは暗号化した形で保存)
CREATE TABLE IF NOT EXISTS likes (
  work_id TEXT PRIMARY KEY,
  count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS like_log (
  work_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  day     TEXT NOT NULL,
  PRIMARY KEY (work_id, ip_hash, day)
);
