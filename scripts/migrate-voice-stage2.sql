-- ========================================================
-- 2026-06-26 阶段二：语音收敛方舟 Plan（TTS/ASR 编排 + 音色库）
-- 目的：建 tts_voices 表 + 导入音色 + voice_providers 改方舟行
-- 幂等可重跑
-- ========================================================

SET NAMES utf8mb4;

-- --------------------------------------------------------
-- 1. tts_voices 音色库表
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS tts_voices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    speaker VARCHAR(100) NOT NULL COMMENT 'TTS speaker ID（VoiceType）',
    name VARCHAR(100) NOT NULL COMMENT '中文名',
    gender VARCHAR(10) DEFAULT NULL COMMENT '男/女',
    age VARCHAR(20) DEFAULT NULL COMMENT '年龄层',
    description VARCHAR(500) DEFAULT NULL,
    avatar VARCHAR(500) DEFAULT NULL COMMENT '头像 URL',
    trial_url VARCHAR(500) DEFAULT NULL COMMENT '试听音频 URL',
    emoji VARCHAR(20) DEFAULT NULL COMMENT '音色 Emoji',
    is_exposed BOOLEAN DEFAULT FALSE COMMENT '是否暴露给 App 用户选择',
    is_default BOOLEAN DEFAULT FALSE COMMENT '是否为 App 默认音色',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_speaker (speaker),
    INDEX idx_exposed (is_exposed),
    INDEX idx_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 已有表补字段（兼容旧库）
SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tts_voices' AND COLUMN_NAME='avatar')=0,'ALTER TABLE tts_voices ADD COLUMN avatar VARCHAR(500) DEFAULT NULL COMMENT ''头像 URL'' AFTER description','SELECT 1')); PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tts_voices' AND COLUMN_NAME='age')=0,'ALTER TABLE tts_voices ADD COLUMN age VARCHAR(20) DEFAULT NULL AFTER gender','SELECT 1')); PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tts_voices' AND COLUMN_NAME='emoji')=0,'ALTER TABLE tts_voices ADD COLUMN emoji VARCHAR(20) DEFAULT NULL COMMENT ''音色 Emoji'' AFTER trial_url','SELECT 1')); PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;


-- --------------------------------------------------------
-- 2. 导入音色（来自音色数据.json，10 条，含头像/介绍/试听/Emoji）
--    重跑幂等：ON DUPLICATE 不覆盖 is_exposed/is_default（保留后台勾选）
-- --------------------------------------------------------
INSERT INTO tts_voices (speaker, name, gender, age, description, avatar, trial_url, emoji, is_exposed, is_default, sort_order) VALUES
('zh_female_vv_uranus_bigtts','Vivi 2.0','女','青年','语调平稳、咬字柔和、自带治愈安抚力的女声音色','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/avatar/vivi_v2.png','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_vv_uranus_bigtts.wav','💐','1','1','0'),
('zh_female_xiaohe_uranus_bigtts','小何 2.0','女','青年','声线甜美有活力的妹妹，活泼开朗，笑容明媚。','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/avatar/小何.png','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_xiaohe_uranus_bigtts.mp3','','1','0','1'),
('zh_male_wennuanahu_uranus_bigtts','温暖阿虎/Alvin 2.0','男','青年','声线阳光温暖、语气亲切，活力满满的少年音','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/avatar/温暖阿虎.png','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_wennuanahu_uranus_bigtts.mp3','','1','0','2'),
('zh_male_jieshuoxiaoming_uranus_bigtts','解说小明 2.0','男','青年','语速明快、中气十足，充满激情与感染力的解说男声','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/avatar/解说小明.png','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_jieshuoxiaoming_uranus_bigtts.mp3','','1','0','3'),
('zh_female_wenroumama_uranus_bigtts','温柔妈妈 2.0','女','中年','语调舒缓、咬字温润，自带母性柔光的治愈女声','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/avatar/温柔妈妈_副本.png','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_wenroumama_uranus_bigtts.mp3','','1','0','4'),
('zh_female_qiaopinv_uranus_bigtts','俏皮女声 2.0','女','青年','语调灵动跳脱、元气满满，古灵精怪的少女音','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/avatar/俏皮女声.png','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_qiaopinv_uranus_bigtts.mp3','','0','0','5'),
('zh_female_shaoergushi_uranus_bigtts','少儿故事 2.0','女','青年','语调活泼、声线亲切，适配儿童故事的治愈女声','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/avatar/少儿故事.png','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_shaoergushi_uranus_bigtts.mp3','','0','0','6'),
('zh_male_guanggaojieshuo_uranus_bigtts','广告解说 2.0','男','青年','语调明快、感染力拉满，专业感十足的解说音','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/avatar/广告解说.png','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_male_guanggaojieshuo_uranus_bigtts.mp3','','0','0','7'),
('zh_female_gujie_uranus_bigtts','顾姐 2.0','女','青年','声线干练、气场强大，飒爽独立的大女主音','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/avatar/顾姐.png','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_gujie_uranus_bigtts.mp3','','0','0','8'),
('zh_female_wuzetian_uranus_bigtts','武则天 2.0','女','中年','声线威严、气场拉满，自带帝王霸气的御姐音','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/avatar/武则天.png','https://lf3-static.bytednsdoc.com/obj/eden-cn/lm_hz_ihsph/ljhwZthlaukjlkulzlp/portal/bigtts/zh_female_wuzetian_uranus_bigtts.mp3','','0','0','9')
ON DUPLICATE KEY UPDATE name=VALUES(name), gender=VALUES(gender), age=VALUES(age), description=VALUES(description), avatar=VALUES(avatar), trial_url=VALUES(trial_url), emoji=VALUES(emoji);


-- --------------------------------------------------------
-- 3. voice_providers 改为方舟行（保留现有 api_key）
-- --------------------------------------------------------
DELETE FROM voice_providers WHERE provider IN ('openai','gemini','doubao','qwen');

INSERT INTO voice_providers (provider, name, api_key, base_url, realtime_model, default_voice, is_active, is_current, sort_order) VALUES
('ark', '火山方舟 Agent Plan 语音', '', 'wss://openspeech.bytedance.com', 'doubao-seed-tts-2.0', 'zh_female_vv_uranus_bigtts', TRUE, TRUE, 0)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    base_url = VALUES(base_url),
    realtime_model = VALUES(realtime_model),
    default_voice = VALUES(default_voice),
    is_current = TRUE;
