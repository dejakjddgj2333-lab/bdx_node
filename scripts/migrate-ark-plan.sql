-- ========================================================
-- 2026-06-26 火山方舟 Agent Plan 收敛迁移脚本（Task 6）
-- 目的：清旧厂商数据，插入方舟模型种子（对话/图片/厂商配置）
-- 特性：幂等可重跑，结果一致
-- 不涉及：voice_providers（阶段二语音重构）、document_chunks（后台逐个重算，Task 3）
-- 执行：在目标库手动执行 mysql -u<user> -p <db> < scripts/migrate-ark-plan.sql
-- ========================================================

SET NAMES utf8mb4;

-- --------------------------------------------------------
-- 0. 幂等 DDL：确保表与列存在（兼容任意状态的旧库）
--    CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS 对已是最新结构的库为 no-op
-- --------------------------------------------------------

-- 对话模型表
CREATE TABLE IF NOT EXISTS ai_models (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    supports_vision BOOLEAN DEFAULT FALSE,
    supports_web_search BOOLEAN DEFAULT FALSE,
    max_tokens INT DEFAULT 4096,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 补 sort_order / updated_at（旧库可能缺失；新库已具备，IF NOT EXISTS 为 no-op）
ALTER TABLE ai_models
    ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0 AFTER max_tokens,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 绘图模型表
CREATE TABLE IF NOT EXISTS image_models (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '显示名称',
    provider VARCHAR(20) NOT NULL COMMENT '厂商标识：ark（火山方舟）',
    model_id VARCHAR(100) NOT NULL COMMENT '上游模型 ID',
    description TEXT COMMENT '描述',
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    supported_sizes JSON DEFAULT NULL COMMENT '支持尺寸数组，如 ["1024x1024"]',
    supported_styles JSON DEFAULT NULL COMMENT '支持风格数组',
    config JSON DEFAULT NULL COMMENT '额外配置，如 steps/quality',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active),
    INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 厂商配置表
CREATE TABLE IF NOT EXISTS model_providers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    provider VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_provider (provider),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 1. DML：清理旧厂商 + 插入方舟种子
--    DDL 会隐式提交，无法回滚；DML 段用事务包裹保证原子性
-- --------------------------------------------------------

START TRANSACTION;

-- 1.1 model_providers：清旧厂商行
--     注意：不删 'ark' 行，避免覆盖后台已填的 api_key（用下方 UPSERT 更新非 key 字段）
DELETE FROM model_providers
    WHERE provider IN ('deepseek','qwen','claude','doubao','moonshot','qianfan','zhipu','xinghuo','minimax');

-- 1.2 model_providers：插入/更新方舟行
--     api_key 留空，待后台或 .env 填充；ON DUPLICATE 时不覆盖已填 key
INSERT INTO model_providers (provider, name, api_key, base_url, is_active, sort_order) VALUES
    ('ark', '火山方舟', '', 'https://ark.cn-beijing.volces.com/api/plan', TRUE, 0)
ON DUPLICATE KEY UPDATE
    name       = VALUES(name),
    base_url   = VALUES(base_url),
    is_active  = VALUES(is_active),
    sort_order = VALUES(sort_order),
    api_key    = api_key;  -- 保留后台已填的 key，重跑不覆盖

-- 1.3 ai_models：清旧厂商 + 方舟旧行
--     ai_models 无 UNIQUE 约束（model_id 不唯一），先删后插保证重跑幂等
DELETE FROM ai_models
    WHERE provider IN ('deepseek','qwen','claude','doubao','openai','moonshot','qianfan','zhipu','xinghuo','minimax','ark');

-- 1.4 ai_models：插入 11 个方舟 Plan 对话模型
--     全部 provider='ark'、is_active=TRUE、supports_vision=FALSE、max_tokens=8192
--     仅 doubao-seed-2.0-pro 开联网搜索（supports_web_search=TRUE，走 responses 接口）
INSERT INTO ai_models
    (name, provider, model_id, description, is_default, is_active, supports_vision, supports_web_search, max_tokens, sort_order)
VALUES
    ('豆包 Seed 2.0 Pro', 'ark', 'doubao-seed-2.0-pro',  '字节豆包旗舰对话模型，综合能力强，支持联网搜索', TRUE,  TRUE, FALSE, TRUE,  8192, 0),
    ('豆包 Seed 2.0 Code','ark', 'doubao-seed-2.0-code', '豆包编程专用模型，擅长代码生成与调试',        FALSE, TRUE, FALSE, FALSE, 8192, 1),
    ('豆包 Seed 2.0 Lite','ark', 'doubao-seed-2.0-lite', '豆包轻量版本，响应快、成本低',               FALSE, TRUE, FALSE, FALSE, 8192, 2),
    ('豆包 Seed 2.0 Mini','ark', 'doubao-seed-2.0-mini', '豆包最小体积版本，适合轻量场景',             FALSE, TRUE, FALSE, FALSE, 8192, 3),
    ('GLM-5.2',           'ark', 'glm-5.2',              '智谱 GLM 5.2 通用对话模型',                   FALSE, TRUE, FALSE, FALSE, 8192, 4),
    ('Kimi K2.7 Code',    'ark', 'kimi-k2.7-code',       '月之暗面 Kimi K2.7 编程增强模型',             FALSE, TRUE, FALSE, FALSE, 8192, 5),
    ('DeepSeek V4 Pro',   'ark', 'deepseek-v4-pro',      'DeepSeek V4 Pro 旗舰对话模型',                FALSE, TRUE, FALSE, FALSE, 8192, 6),
    ('DeepSeek V4 Flash', 'ark', 'deepseek-v4-flash',    'DeepSeek V4 Flash 轻量快速模型',              FALSE, TRUE, FALSE, FALSE, 8192, 7),
    ('MiniMax M3',        'ark', 'minimax-m3',           'MiniMax M3 通用对话模型',                     FALSE, TRUE, FALSE, FALSE, 8192, 8),
    ('MiniMax M2.7',      'ark', 'minimax-m2.7',         'MiniMax M2.7 对话模型',                       FALSE, TRUE, FALSE, FALSE, 8192, 9),
    ('Kimi K2.6',         'ark', 'kimi-k2.6',            '月之暗面 Kimi K2.6 长文本对话模型',           FALSE, TRUE, FALSE, FALSE, 8192, 10);

-- 1.5 image_models：清旧占位行（原 '豆包文生图' your-doubao-endpoint-id）+ 方舟旧行
DELETE FROM image_models
    WHERE provider IN ('doubao','openai','qwen','ark');

-- 1.6 image_models：插入方舟豆包文生图（默认，1K/2K）
INSERT INTO image_models
    (name, provider, model_id, description, is_active, is_default, sort_order, supported_sizes, supported_styles)
VALUES
    ('豆包文生图', 'ark', 'doubao-seedream-5.0-lite', '火山方舟豆包文生图模型，支持 1K/2K 高清出图', TRUE, TRUE, 0, '["1K","2K"]', '["通用","写实","动漫","油画"]');

COMMIT;

-- ========================================================
-- 迁移完成说明
-- - model_providers：仅剩 ark 行；旧厂商已清；api_key 留空待后台/.env 填充
-- - ai_models：11 个方舟 Plan 模型；默认 doubao-seed-2.0-pro；仅 pro 开联网搜索
-- - image_models：默认豆包文生图（doubao-seedream-5.0-lite，1K/2K）
-- - voice_providers：未改动（阶段二语音重构）
-- - document_chunks：未改动（后台逐个重算向量，Task 3 处理）
-- ========================================================
