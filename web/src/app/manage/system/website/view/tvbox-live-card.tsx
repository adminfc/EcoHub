"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SaveOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { ApiGet, ApiPost } from "@/lib/client-api";
import { useAppMessage } from "@/lib/useAppMessage";
import styles from "./tvbox-config-card.module.less";

export interface TVBoxLive {
  enabled: boolean;
  name: string;
  url: string;
  epg: string;
  logo: string;
  ua: string;
}

export interface TVBoxCustomChannels {
  enabled: boolean;
  name: string;
  epg: string;
  logo: string;
  ua: string;
  content: string;
}

export interface TVBoxLiveConfigPayload {
  lives: TVBoxLive[];
  custom: TVBoxCustomChannels;
}

const MAX_LIVES = 20;
const MAX_NAME_LEN = 64;
const MAX_URL_LEN = 1024;
const MAX_UA_LEN = 256;
const MAX_CHANNELS_BYTES = 256 * 1024;
const DEFAULT_CUSTOM_NAME = "📺 EcoHub 直播频道";
const LIVE_PATH = "/api/provide/tvbox/live";

const CHANNELS_PLACEHOLDER = `央视频道,#genre#
CCTV-1 综合,http://example.com/cctv1.m3u8
CCTV-13 新闻,http://example.com/cctv13.m3u8
卫视频道,#genre#
湖南卫视,http://example.com/hunan.m3u8

（也可直接粘贴以 #EXTM3U 开头的 M3U 列表）`;

const DEFAULT_LIVE_CONFIG: TVBoxLiveConfigPayload = {
  lives: [],
  custom: {
    enabled: false,
    name: DEFAULT_CUSTOM_NAME,
    epg: "",
    logo: "",
    ua: "",
    content: "",
  },
};

const EMPTY_LIVE: TVBoxLive = {
  enabled: true,
  name: "",
  url: "",
  epg: "",
  logo: "",
  ua: "",
};

const str = (v: unknown) => String(v ?? "").trim();

function normalizeLiveConfig(
  raw?: Partial<TVBoxLiveConfigPayload> | null,
): TVBoxLiveConfigPayload {
  const lives = Array.isArray(raw?.lives) ? raw.lives : [];
  const custom = raw?.custom;
  return {
    lives: lives.map((l) => ({
      enabled: Boolean(l?.enabled),
      name: str(l?.name),
      url: str(l?.url),
      epg: str(l?.epg),
      logo: str(l?.logo),
      ua: str(l?.ua),
    })),
    custom: {
      enabled: Boolean(custom?.enabled),
      name: str(custom?.name) || DEFAULT_CUSTOM_NAME,
      epg: str(custom?.epg),
      logo: str(custom?.logo),
      ua: str(custom?.ua),
      content: String(custom?.content ?? "").replace(/\r\n?/g, "\n").trim(),
    },
  };
}

interface ChannelStats {
  format: "M3U" | "TXT";
  groups: number;
  channels: number;
}

function analyzeChannels(content: string): ChannelStats {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines[0]?.toUpperCase().startsWith("#EXTM3U")) {
    const groups = new Set<string>();
    let channels = 0;
    for (const line of lines) {
      if (!line.toUpperCase().startsWith("#EXTINF")) continue;
      channels++;
      const m = line.match(/group-title="([^"]*)"/i);
      if (m?.[1]) groups.add(m[1]);
    }
    return { format: "M3U", groups: groups.size, channels };
  }
  let groups = 0;
  let channels = 0;
  for (const line of lines) {
    const idx = line.indexOf(",");
    if (idx <= 0) continue;
    const value = line.slice(idx + 1).trim();
    if (value === "#genre#") groups++;
    else if (value) channels++;
  }
  return { format: "TXT", groups, channels };
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

interface LiveExtraFieldsProps {
  value: { epg: string; logo: string; ua: string };
  disabled: boolean;
  onChange: (key: "epg" | "logo" | "ua", v: string) => void;
}

function LiveExtraFields({ value, disabled, onChange }: LiveExtraFieldsProps) {
  return (
    <Flex gap={8} wrap>
      <Input
        style={{ flex: "1 1 240px" }}
        disabled={disabled}
        maxLength={MAX_URL_LEN}
        allowClear
        prefix={<Typography.Text type="secondary">EPG</Typography.Text>}
        placeholder="https://epg.example.com/?ch={name}&date={date}"
        value={value.epg}
        onChange={(e) => onChange("epg", e.target.value)}
      />
      <Input
        style={{ flex: "1 1 240px" }}
        disabled={disabled}
        maxLength={MAX_URL_LEN}
        allowClear
        prefix={<Typography.Text type="secondary">台标</Typography.Text>}
        placeholder="https://logo.example.com/{name}.png"
        value={value.logo}
        onChange={(e) => onChange("logo", e.target.value)}
      />
      <Input
        style={{ flex: "1 1 200px" }}
        disabled={disabled}
        maxLength={MAX_UA_LEN}
        allowClear
        prefix={<Typography.Text type="secondary">UA</Typography.Text>}
        placeholder="可选，播放请求 User-Agent"
        value={value.ua}
        onChange={(e) => onChange("ua", e.target.value)}
      />
    </Flex>
  );
}

interface TVBoxLiveCardProps {
  canWrite: boolean;
}

export default function TVBoxLiveCard({ canWrite }: TVBoxLiveCardProps) {
  const [data, setData] = useState<TVBoxLiveConfigPayload>(DEFAULT_LIVE_CONFIG);
  const [draft, setDraft] = useState<TVBoxLiveConfigPayload>(DEFAULT_LIVE_CONFIG);
  const [isEditing, setIsEditing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const { message } = useAppMessage();

  const loadData = useCallback(async () => {
    setFetching(true);
    try {
      const resp = await ApiGet("/manage/config/tvbox/live");
      if (resp.code === 0 && resp.data) {
        const normalized = normalizeLiveConfig(resp.data);
        setData(normalized);
        setDraft(normalized);
      }
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const hasDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(data),
    [draft, data],
  );

  const current = isEditing ? draft : data;
  const disabled = !isEditing || !canWrite;
  const contentBytes = useMemo(
    () => byteLength(current.custom.content),
    [current.custom.content],
  );
  const stats = useMemo(
    () => analyzeChannels(current.custom.content),
    [current.custom.content],
  );
  const overLimit = contentBytes > MAX_CHANNELS_BYTES;

  const setCustom = <K extends keyof TVBoxCustomChannels>(
    key: K,
    value: TVBoxCustomChannels[K],
  ) => setDraft((prev) => ({ ...prev, custom: { ...prev.custom, [key]: value } }));

  const setLive = <K extends keyof TVBoxLive>(
    index: number,
    key: K,
    value: TVBoxLive[K],
  ) =>
    setDraft((prev) => ({
      ...prev,
      lives: prev.lives.map((l, i) => (i === index ? { ...l, [key]: value } : l)),
    }));

  const handleCancel = () => {
    setDraft(data);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!canWrite) return;
    const normalized = normalizeLiveConfig(draft);
    if (byteLength(normalized.custom.content) > MAX_CHANNELS_BYTES) {
      message.error(`自定义频道列表超过 ${MAX_CHANNELS_BYTES / 1024} KB 上限`);
      return;
    }
    if (normalized.custom.enabled && !normalized.custom.content) {
      message.error("已开启自定义频道，请填写频道列表");
      return;
    }
    const missingURL = normalized.lives.findIndex((l) => !l.url);
    if (missingURL >= 0) {
      message.error(`第 ${missingURL + 1} 条直播源未填写地址`);
      return;
    }
    setSaving(true);
    try {
      const resp = await ApiPost("/manage/config/tvbox/live/update", normalized);
      if (resp.code === 0) {
        message.success(resp.msg || "直播配置已保存");
        await loadData();
        setIsEditing(false);
      } else {
        message.error(resp.msg || "保存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      className={styles.card}
      title={
        <Space size={8} align="center">
          <VideoCameraOutlined style={{ color: "var(--ant-color-primary)" }} />
          <span>直播电视频道</span>
        </Space>
      }
      extra={
        <Space size={8} align="center">
          {isEditing ? (
            <>
              <Button size="small" disabled={saving} onClick={handleCancel}>
                取消
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<SaveOutlined />}
                disabled={!canWrite || !hasDirty || overLimit}
                loading={saving}
                onClick={handleSave}
              >
                保存配置
              </Button>
            </>
          ) : (
            <Button
              size="small"
              type="primary"
              icon={<EditOutlined />}
              disabled={!canWrite}
              onClick={() => {
                setDraft(data);
                setIsEditing(true);
              }}
            >
              编辑
            </Button>
          )}
        </Space>
      }
    >
      <Spin spinning={fetching} description="正在加载直播配置...">
        <Flex vertical gap={20}>
          <Typography.Text type="secondary">
            配置后会写入 /api/provide/tvbox 的 lives 字段，TVBox、影视仓等客户端的「直播」入口即可看到这些频道。
            EPG / 台标地址支持 {"{name}"}（频道名）与 {"{date}"}（日期）占位符。
            {canWrite ? "" : "仅超级管理员可修改。"}
          </Typography.Text>

          {/* 自定义频道列表 */}
          <Flex vertical gap={12}>
            <Flex align="center" justify="space-between">
              <Flex vertical gap={4}>
                <Typography.Text strong>自定义频道列表</Typography.Text>
                <Typography.Text type="secondary">
                  由本站托管频道列表，订阅地址为 {LIVE_PATH}（自动附带订阅密钥）
                </Typography.Text>
              </Flex>
              <Switch
                disabled={disabled}
                checked={current.custom.enabled}
                checkedChildren="开启"
                unCheckedChildren="关闭"
                onChange={(checked) => setCustom("enabled", checked)}
              />
            </Flex>

            {current.custom.enabled && (
              <>
                <div className={styles.field}>
                  <Typography.Text>线路名称</Typography.Text>
                  <Input
                    disabled={disabled}
                    maxLength={MAX_NAME_LEN}
                    placeholder={DEFAULT_CUSTOM_NAME}
                    value={current.custom.name}
                    onChange={(e) => setCustom("name", e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <Flex justify="space-between" align="baseline" wrap gap={8}>
                    <Typography.Text>频道列表</Typography.Text>
                    <Space size={4} wrap>
                      <Tag>{stats.format}</Tag>
                      <Tag>{stats.groups} 个分组</Tag>
                      <Tag color={stats.channels > 0 ? "blue" : undefined}>
                        {stats.channels} 个频道
                      </Tag>
                      <Typography.Text type={overLimit ? "danger" : "secondary"}>
                        {(contentBytes / 1024).toFixed(1)}/{MAX_CHANNELS_BYTES / 1024} KB
                      </Typography.Text>
                    </Space>
                  </Flex>
                  <Input.TextArea
                    disabled={disabled}
                    status={overLimit ? "error" : undefined}
                    autoSize={{ minRows: 8, maxRows: 20 }}
                    spellCheck={false}
                    style={{ fontFamily: "var(--ant-font-family-code, monospace)", fontSize: 13 }}
                    placeholder={CHANNELS_PLACEHOLDER}
                    value={current.custom.content}
                    onChange={(e) => setCustom("content", e.target.value)}
                  />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    TXT 格式：「分组名,#genre#」开始一个分组，其后每行「频道名,播放地址」；同一频道多个地址可用 # 分隔或写多行。
                  </Typography.Text>
                </div>
                <LiveExtraFields
                  value={current.custom}
                  disabled={disabled}
                  onChange={(key, v) => setCustom(key, v)}
                />
              </>
            )}
          </Flex>

          {/* 外部直播源 */}
          <Flex vertical gap={12}>
            <Flex align="center" justify="space-between">
              <Flex vertical gap={4}>
                <Typography.Text strong>外部直播源</Typography.Text>
                <Typography.Text type="secondary">
                  引用第三方 TXT / M3U 直播源地址，以 / 开头的站内路径会自动补全为订阅域名
                </Typography.Text>
              </Flex>
              <Button
                size="small"
                icon={<PlusOutlined />}
                disabled={disabled || current.lives.length >= MAX_LIVES}
                onClick={() =>
                  setDraft((prev) => ({ ...prev, lives: [...prev.lives, { ...EMPTY_LIVE }] }))
                }
              >
                添加直播源
              </Button>
            </Flex>

            {current.lives.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无外部直播源"
              />
            ) : (
              current.lives.map((live, index) => (
                <Card key={index} size="small" type="inner">
                  <Flex vertical gap={8}>
                    <Flex gap={8} align="center" wrap>
                      <Switch
                        size="small"
                        disabled={disabled}
                        checked={live.enabled}
                        onChange={(checked) => setLive(index, "enabled", checked)}
                      />
                      <Input
                        style={{ flex: "1 1 160px" }}
                        disabled={disabled}
                        maxLength={MAX_NAME_LEN}
                        placeholder={`📺 直播 ${index + 1}`}
                        value={live.name}
                        onChange={(e) => setLive(index, "name", e.target.value)}
                      />
                      <Input
                        style={{ flex: "3 1 280px" }}
                        disabled={disabled}
                        maxLength={MAX_URL_LEN}
                        status={isEditing && !live.url.trim() ? "warning" : undefined}
                        placeholder="https://example.com/live.m3u 或 .txt"
                        value={live.url}
                        onChange={(e) => setLive(index, "url", e.target.value)}
                      />
                      <Button
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        disabled={disabled}
                        aria-label="删除直播源"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            lives: prev.lives.filter((_, i) => i !== index),
                          }))
                        }
                      />
                    </Flex>
                    <LiveExtraFields
                      value={live}
                      disabled={disabled}
                      onChange={(key, v) => setLive(index, key, v)}
                    />
                  </Flex>
                </Card>
              ))
            )}
          </Flex>
        </Flex>
      </Spin>
    </Card>
  );
}
