"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Flex,
  Input,
  Space,
  Spin,
  Switch,
  Typography,
} from "antd";
import { DesktopOutlined, EditOutlined, SaveOutlined } from "@ant-design/icons";
import { ApiGet, ApiPost } from "@/lib/client-api";
import { useAppMessage } from "@/lib/useAppMessage";
import styles from "./tvbox-config-card.module.less";

export interface TVBoxConfigPayload {
  siteName: string;
  sourceName: string;
  hideSources: boolean;
  spider: string;
  wallpaper: string;
  logo: string;
}

const SOURCE_NAME_PLACEHOLDER = "{name}";

const DEFAULT_TVBOX_CONFIG: TVBoxConfigPayload = {
  siteName: "🌟 EcoHub 私人影视库全量",
  sourceName: `📡 ${SOURCE_NAME_PLACEHOLDER}`,
  hideSources: false,
  spider: "",
  wallpaper: "",
  logo: "",
};

const MAX_NAME_LEN = 64;
const MAX_URL_LEN = 512;

function normalizeTVBoxConfig(
  raw?: Partial<TVBoxConfigPayload> | null,
): TVBoxConfigPayload {
  return {
    siteName: String(raw?.siteName ?? "").trim() || DEFAULT_TVBOX_CONFIG.siteName,
    sourceName:
      String(raw?.sourceName ?? "").trim() || DEFAULT_TVBOX_CONFIG.sourceName,
    hideSources: Boolean(raw?.hideSources),
    spider: String(raw?.spider ?? "").trim(),
    wallpaper: String(raw?.wallpaper ?? "").trim(),
    logo: String(raw?.logo ?? "").trim(),
  };
}

function previewSourceName(template: string): string {
  const tpl = template.trim() || DEFAULT_TVBOX_CONFIG.sourceName;
  const withPlaceholder = tpl.includes(SOURCE_NAME_PLACEHOLDER)
    ? tpl
    : `${tpl} ${SOURCE_NAME_PLACEHOLDER}`;
  return withPlaceholder.split(SOURCE_NAME_PLACEHOLDER).join("非凡(FF)");
}

const URL_FIELDS: {
  key: "spider" | "wallpaper" | "logo";
  label: string;
  placeholder: string;
  help: string;
}[] = [
  {
    key: "spider",
    label: "爬虫 Jar（spider）",
    placeholder: "https://example.com/spider.jar 或 /spider.jar",
    help: "影视仓等客户端在 spider 为空时会提示「jar下载失败」，填写任意可用 jar 即可。支持 ;md5;校验值 后缀。jar 会在电视端执行代码，请只填写可信地址。",
  },
  {
    key: "wallpaper",
    label: "壁纸（wallpaper）",
    placeholder: "https://example.com/wallpaper.jpg",
    help: "客户端背景图，留空则使用客户端默认壁纸。",
  },
  {
    key: "logo",
    label: "Logo（logo）",
    placeholder: "https://example.com/logo.png",
    help: "客户端首页 Logo，留空则使用客户端默认。",
  },
];

interface TVBoxConfigCardProps {
  canWrite: boolean;
}

export default function TVBoxConfigCard({ canWrite }: TVBoxConfigCardProps) {
  const [data, setData] = useState<TVBoxConfigPayload>(DEFAULT_TVBOX_CONFIG);
  const [draft, setDraft] = useState<TVBoxConfigPayload>(DEFAULT_TVBOX_CONFIG);
  const [isEditing, setIsEditing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const { message } = useAppMessage();

  const loadData = useCallback(async () => {
    setFetching(true);
    try {
      const resp = await ApiGet("/manage/config/tvbox");
      if (resp.code === 0 && resp.data) {
        const normalized = normalizeTVBoxConfig(resp.data);
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

  const hasDirty = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(data);
  }, [draft, data]);

  const handleCancel = () => {
    setDraft(data);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!canWrite) return;
    setSaving(true);
    try {
      const normalized = normalizeTVBoxConfig(draft);
      const resp = await ApiPost("/manage/config/tvbox/update", normalized);
      if (resp.code === 0) {
        message.success(resp.msg || "TVBox 配置已保存");
        // 以服务端清洗结果为准（如模板缺少 {name} 时自动补全）
        await loadData();
        setIsEditing(false);
      } else {
        message.error(resp.msg || "保存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  const currentValues = isEditing ? draft : data;
  const disabled = !isEditing || !canWrite;

  return (
    <Card
      className={styles.card}
      title={
        <Space size={8} align="center">
          <DesktopOutlined style={{ color: "var(--ant-color-primary)" }} />
          <span>TVBox 订阅配置</span>
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
                disabled={!canWrite || !hasDirty}
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
      <Spin spinning={fetching} description="正在加载 TVBox 配置...">
        <Flex vertical gap={16}>
          <Typography.Text type="secondary">
            定制 /api/provide/tvbox 输出给 TVBox、影视仓等客户端的线路名称与资源地址。
            {canWrite ? "" : "仅超级管理员可修改。"}
          </Typography.Text>

          {/* 全量线路名称 */}
          <div className={styles.field}>
            <Flex justify="space-between" align="baseline">
              <Typography.Text strong>全量线路名称</Typography.Text>
              <Typography.Text type="secondary">
                {currentValues.siteName.length}/{MAX_NAME_LEN}
              </Typography.Text>
            </Flex>
            <Input
              disabled={disabled}
              maxLength={MAX_NAME_LEN}
              placeholder={DEFAULT_TVBOX_CONFIG.siteName}
              value={currentValues.siteName}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, siteName: e.target.value }))
              }
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              聚合全部采集源的主线路名称，留空恢复默认。
            </Typography.Text>
          </div>

          {/* 采集源线路开关 */}
          <Flex align="center" justify="space-between">
            <Flex vertical gap={4}>
              <Typography.Text strong>输出单个采集源线路</Typography.Text>
              <Typography.Text type="secondary">
                关闭后只保留全量线路，不再为每个已启用的采集源单独生成线路
              </Typography.Text>
            </Flex>
            <Switch
              disabled={disabled}
              checked={!currentValues.hideSources}
              checkedChildren="开启"
              unCheckedChildren="关闭"
              onChange={(checked) =>
                setDraft((prev) => ({ ...prev, hideSources: !checked }))
              }
            />
          </Flex>

          {/* 采集源线路名称模板 */}
          {!currentValues.hideSources && (
            <div className={styles.field}>
              <Flex justify="space-between" align="baseline">
                <Typography.Text strong>采集源线路名称</Typography.Text>
                <Typography.Text type="secondary">
                  预览：{previewSourceName(currentValues.sourceName)}
                </Typography.Text>
              </Flex>
              <Input
                disabled={disabled}
                maxLength={MAX_NAME_LEN}
                placeholder={DEFAULT_TVBOX_CONFIG.sourceName}
                value={currentValues.sourceName}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, sourceName: e.target.value }))
                }
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {SOURCE_NAME_PLACEHOLDER} 会替换为采集源名称；不含 {SOURCE_NAME_PLACEHOLDER}
                时作为前缀使用，留空恢复默认。
              </Typography.Text>
            </div>
          )}

          {URL_FIELDS.map((field) => (
            <div key={field.key} className={styles.field}>
              <Typography.Text strong>{field.label}</Typography.Text>
              <Input
                disabled={disabled}
                maxLength={MAX_URL_LEN}
                allowClear
                placeholder={field.placeholder}
                value={currentValues[field.key]}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {field.help} 以 / 开头的站内路径会自动补全为订阅时访问的域名。
              </Typography.Text>
            </div>
          ))}
        </Flex>
      </Spin>
    </Card>
  );
}
