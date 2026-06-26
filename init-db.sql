CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) DEFAULT NULL COMMENT '密码，一键登录/邮箱登录用户可为空',
    nickname VARCHAR(50),
    avatar VARCHAR(500),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    apple_id VARCHAR(100) UNIQUE COMMENT 'Apple Sign In 用户标识',
    email_verified_at TIMESTAMP NULL COMMENT '邮箱验证时间',
    login_type VARCHAR(20) DEFAULT 'username' COMMENT '注册/登录方式：username/phone/email/apple',
    vip_level INT DEFAULT 0,
    vip_expire_at TIMESTAMP NULL,
    daily_quota INT DEFAULT 50,
    used_quota INT DEFAULT 0,
    daily_image_quota INT DEFAULT NULL COMMENT '每日图片生成限额，NULL 表示使用系统默认',
    used_image_quota INT DEFAULT 0 COMMENT '今日已用图片生成次数',
    image_quota_reset_at TIMESTAMP NULL COMMENT '图片配额重置时间',
    status INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_phone (phone),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    title VARCHAR(200),
    agent_id BIGINT,
    model VARCHAR(50) DEFAULT 'deepseek-v4-pro',
    status INT DEFAULT 1,
    is_pinned BOOLEAN DEFAULT FALSE,
    last_message_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_time (user_id, last_message_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    content LONGTEXT,
    content_type VARCHAR(20) DEFAULT 'text',
    parent_id BIGINT,
    model VARCHAR(50),
    tokens_used INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed',
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversation (conversation_id, created_at),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agents (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    creator_id BIGINT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar VARCHAR(500),
    system_prompt LONGTEXT NOT NULL,
    welcome_message VARCHAR(500),
    category VARCHAR(50),
    is_official BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    use_count INT DEFAULT 0,
    rating DECIMAL(2,1) DEFAULT 5.0,
    status INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_settings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNIQUE NOT NULL,
    theme VARCHAR(10) DEFAULT 'auto',
    font_size VARCHAR(10) DEFAULT 'medium',
    auto_play BOOLEAN DEFAULT FALSE,
    language VARCHAR(10) DEFAULT 'zh-CN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS documents (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    filename VARCHAR(255),
    original_name VARCHAR(255),
    file_url VARCHAR(500),
    file_type VARCHAR(100),
    file_size BIGINT,
    parse_status VARCHAR(20) DEFAULT 'pending',
    parse_result LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS paintings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    image_url VARCHAR(500),
    width INT DEFAULT 1024,
    height INT DEFAULT 1024,
    style VARCHAR(50),
    seed BIGINT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS image_models (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '显示名称',
    provider VARCHAR(20) NOT NULL COMMENT '厂商标识：ark（火山方舟）',
    model_id VARCHAR(100) NOT NULL COMMENT '上游模型 ID',
    description TEXT COMMENT '描述',
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    supported_sizes JSON DEFAULT NULL COMMENT '支持尺寸档位数组，如 ["1K","2K"]',
    supported_styles JSON DEFAULT NULL COMMENT '支持风格数组',
    config JSON DEFAULT NULL COMMENT '额外配置，如 steps/quality',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active),
    INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS system_settings (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT NOT NULL,
    `description` TEXT,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_settings (`key`, `value`, `description`) VALUES
('default_daily_image_quota', '10', '默认每日图片生成次数'),
('image_generation_enabled', 'true', '是否启用图片生成功能')
ON DUPLICATE KEY UPDATE `key` = `key`;

INSERT INTO image_models (name, provider, model_id, description, is_active, is_default, sort_order, supported_sizes, supported_styles) VALUES
('豆包文生图', 'ark', 'doubao-seedream-5.0-lite', '火山方舟豆包文生图模型，支持 1K/2K 高清出图', TRUE, TRUE, 0, '["1K","2K"]', '["通用","写实","动漫","油画"]')
ON DUPLICATE KEY UPDATE name = name;

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
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO ai_models (name, provider, model_id, description, is_default, is_active, supports_vision, supports_web_search, max_tokens, sort_order) VALUES
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
('Kimi K2.6',         'ark', 'kimi-k2.6',            '月之暗面 Kimi K2.6 长文本对话模型',           FALSE, TRUE, FALSE, FALSE, 8192, 10)
ON DUPLICATE KEY UPDATE name = name;

INSERT INTO agents (name, description, system_prompt, welcome_message, category, is_official, is_public) VALUES
('编程助手', '专业的编程助手，帮你写代码、Debug、解释技术概念', '你是一个专业的编程助手，擅长解释代码原理、调试和修复Bug、代码优化建议、算法设计。回答要简洁，代码块使用Markdown格式。', '你好！我是你的编程助手，有什么代码问题可以问我~', '编程开发', TRUE, TRUE),
('文案大师', '帮你写各种文案、文章、邮件、社交媒体内容', '你是一位资深文案策划，擅长撰写各类文案、文章、邮件、社交媒体内容。风格多变，可以根据用户需求调整语气和风格。', '你好！需要写什么文案？告诉我主题和风格，我来帮你！', '写作创作', TRUE, TRUE),
('学习导师', '耐心解答各学科问题，帮你梳理知识体系', '你是一位耐心的学习导师，擅长用通俗易懂的方式解释复杂的知识点。你会引导用户思考，而不是直接给答案。', '你好！我是你的学习导师，有什么知识想了解的？', '教育培训', TRUE, TRUE),
('翻译专家', '精准翻译多种语言，保持原文语气和风格', '你是一位专业翻译，精通中英互译。翻译时保持原文的语气和风格，对于文化差异的内容会做适当本地化处理。', '你好！需要翻译什么内容？告诉我源语言和目标语言。', '语言翻译', TRUE, TRUE)
ON DUPLICATE KEY UPDATE name = name;

-- ========================================================
-- 后台管理系统扩展表
-- ========================================================

CREATE TABLE IF NOT EXISTS knowledge_bases (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS knowledge_base_id BIGINT NULL AFTER user_id,
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE AFTER parse_status,
    ADD COLUMN IF NOT EXISTS metadata JSON DEFAULT NULL AFTER parse_result,
    ADD COLUMN IF NOT EXISTS chunk_count INT DEFAULT 0 AFTER parse_status,
    ADD COLUMN IF NOT EXISTS parse_error TEXT DEFAULT NULL AFTER chunk_count,
    ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMP NULL AFTER parse_error,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD INDEX idx_kb (knowledge_base_id);

-- 文档分块表（存储切块文本 + embedding 向量）
CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    knowledge_base_id BIGINT NULL,
    chunk_index INT NOT NULL DEFAULT 0,
    content MEDIUMTEXT NOT NULL,
    token_count INT DEFAULT 0,
    embedding MEDIUMTEXT NULL COMMENT 'JSON 数组形式的向量',
    embedding_dim INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_document (document_id),
    INDEX idx_kb (knowledge_base_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- 厂商种子：方舟（api_key 留空，待后台或 .env 填充；ON DUPLICATE 不覆盖已填 key）
INSERT INTO model_providers (provider, name, api_key, base_url, is_active, sort_order) VALUES
    ('ark', '火山方舟', '', 'https://ark.cn-beijing.volces.com/api/plan', TRUE, 0)
ON DUPLICATE KEY UPDATE
    name       = VALUES(name),
    base_url   = VALUES(base_url),
    is_active  = VALUES(is_active),
    sort_order = VALUES(sort_order),
    api_key    = api_key;

ALTER TABLE ai_models
    ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0 AFTER max_tokens,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS admin_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    action VARCHAR(50) NOT NULL,
    target_table VARCHAR(50),
    target_id BIGINT,
    detail JSON,
    ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 首页推荐语配置
CREATE TABLE IF NOT EXISTS prompt_suggestions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL COMMENT '显示标题',
    prompt TEXT NOT NULL COMMENT '点击后发送的完整提示词',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO prompt_suggestions (title, prompt, sort_order) VALUES
('预测冠军队，抢万亿Token', '帮我预测一下今年世界杯/电竞比赛的冠军队伍，并给出理由。', 0),
('属于Z世代的“Brain rot”现象', '什么是“Brain rot”？它反映了Z世代怎样的网络文化现象？', 1),
('第一性原理：从本质出发的思考', '用第一性原理的方法，帮我分析一个复杂问题。', 2)
ON DUPLICATE KEY UPDATE title = title;

-- 语音通话厂商配置
CREATE TABLE IF NOT EXISTS voice_providers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    provider VARCHAR(20) NOT NULL UNIQUE COMMENT '厂商标识: openai/gemini/doubao/qwen',
    name VARCHAR(50) NOT NULL COMMENT '显示名称',
    api_key VARCHAR(500) NOT NULL COMMENT '上游 API Key',
    base_url VARCHAR(500) NOT NULL COMMENT '上游 Base URL / WebSocket 域名',
    realtime_model VARCHAR(100) DEFAULT NULL COMMENT '实时模型 ID',
    default_voice VARCHAR(50) DEFAULT NULL COMMENT '默认音色',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    is_current BOOLEAN DEFAULT FALSE COMMENT '是否为当前 App 使用的厂商',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_provider (provider),
    INDEX idx_active (is_active),
    INDEX idx_current (is_current)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO voice_providers (provider, name, api_key, base_url, realtime_model, default_voice, is_active, is_current, sort_order)
VALUES ('qwen', '阿里百炼实时多模态', '', 'wss://dashscope.aliyuncs.com', 'qwen3.5-omni-plus-realtime', 'Tina', TRUE, TRUE, 0)
ON DUPLICATE KEY UPDATE name = name;
