"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Input } from "antd";
import { LockOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";
import { DEFAULT_SITE_NAME } from "@/lib/project";
import { ApiPost } from "@/lib/client-api";
import { useAppMessage } from "@/lib/useAppMessage";
import { useSiteConfig } from "@/components/common/SiteGuard";
import styles from "@/app/login/view/index.module.less";

const fieldClassNames = { affixWrapper: styles.field };

/** 只允许跳回本站路径，避免 /\evil.com 之类的外链跳转 */
function resolveRedirect(raw: string | null): string {
  if (!raw) return "/";
  try {
    const target = new URL(raw, window.location.origin);
    if (target.origin !== window.location.origin) return "/";
    if (target.pathname.startsWith("/unlock")) return "/";
    return target.pathname + target.search + target.hash;
  } catch {
    return "/";
  }
}

export default function UnlockPageView() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { message } = useAppMessage();
  const { config: siteInfo } = useSiteConfig();

  const [redirectParam, setRedirectParam] = useState<string | null>(null);

  useEffect(() => {
    setRedirectParam(new URLSearchParams(window.location.search).get("redirect"));
  }, []);

  const handleUnlock = async () => {
    if (!password.trim()) {
      message.warning("请输入观看密码");
      return;
    }

    setLoading(true);
    try {
      const resp = await ApiPost("/view/unlock", { password });
      if (resp.code === 0) {
        message.success("验证成功");
        // 整页跳转，让服务端布局带上新 Cookie 重新校验
        window.location.href = resolveRedirect(redirectParam);
      } else {
        message.error(resp.msg || "验证失败");
      }
    } finally {
      setLoading(false);
    }
  };

  const displaySiteName = siteInfo?.siteName || DEFAULT_SITE_NAME;
  const loginHref = redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : "/login";

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.siteName}>{displaySiteName}</div>
          <div className={styles.subTitle}>请输入观看密码</div>
        </div>

        <div className={styles.form}>
          <Input.Password
            size="large"
            placeholder="观看密码"
            autoFocus
            prefix={<LockOutlined className={styles.fieldIcon} />}
            classNames={fieldClassNames}
            iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={handleUnlock}
          />
          <Button
            type="primary"
            size="large"
            loading={loading}
            onClick={handleUnlock}
            className={styles.btn}
            block
          >
            进入观看
          </Button>
        </div>

        <div className={styles.footer}>
          <span>输入一次后本设备将保持可观看，密码变更后需重新输入</span>
          <Link href={loginHref} className={styles.githubLink}>
            管理员登录
          </Link>
        </div>
      </div>
    </div>
  );
}
