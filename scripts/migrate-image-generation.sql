-- ========================================================
-- 2025-06-23 图片生成与配额限制迁移脚本
-- ========================================================

-- 1. 用户表增加图片生成配额字段
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS daily_image_quota INT DEFAULT NULL COMMENT '每日图片生成限额，NULL 表示使用系统默认',
    ADD COLUMN IF NOT EXISTS used_image_quota INT DEFAULT 0 COMMENT '今日已用图片生成次数',
    ADD COLUMN IF NOT EXISTS image_quota_reset_at TIMESTAMP NULL COMMENT '图片配额重置时间';

-- 2. 绘图模型配置表
CREATE TABLE IF NOT EXISTS image_models (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '显示名称',
    provider VARCHAR(20) NOT NULL COMMENT '厂商标识：doubao/openai/qwen 等',
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

-- 3. 系统设置表（存储默认配额等全局配置）
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

-- 4. 默认豆包绘图模型
INSERT INTO image_models (name, provider, model_id, description, is_default, supported_sizes, supported_styles) VALUES
('豆包文生图', 'doubao', 'doubao-image-generation-model', '火山方舟/豆包文生图模型', TRUE, '["1024x1024", "1536x1024", "1024x1536", "2048x2048"]', '["通用", "写实", "动漫", "油画"]')
ON DUPLICATE KEY UPDATE name = name;
