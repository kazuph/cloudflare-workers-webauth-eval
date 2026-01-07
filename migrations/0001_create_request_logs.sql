-- Request Logs Table
-- フルログ: 全リクエスト情報を保存

CREATE TABLE IF NOT EXISTS request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,          -- UUID
  timestamp TEXT NOT NULL,           -- ISO8601
  method TEXT NOT NULL,              -- GET, POST, etc.
  path TEXT NOT NULL,                -- /auth/hs256/login
  status INTEGER NOT NULL,           -- HTTP status code
  latency_ms INTEGER NOT NULL,       -- Response time in ms
  user_id TEXT,                      -- Authenticated user ID (nullable)
  algorithm TEXT,                    -- hs256, rs256, es256 (nullable)
  token_type TEXT,                   -- access, refresh (nullable)
  ip TEXT,                           -- Client IP
  user_agent TEXT,                   -- User-Agent header
  error_message TEXT,                -- Error message if any (nullable)
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path);
CREATE INDEX IF NOT EXISTS idx_request_logs_status ON request_logs(status);
