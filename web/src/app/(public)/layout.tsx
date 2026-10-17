import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import PublicLayoutView from "./layout-view";
import { serverGet } from "@/lib/server-api";

interface ViewStatus {
  privateAccess: boolean;
  unlocked: boolean;
}

interface NavItem {
  id: string;
  name: string;
}

async function verifyPublicAccess() {
  const cookieStore = await cookies();
  const hasAuth = cookieStore.has("ecohub_auth_token");
  if (hasAuth) return;

  let locked = false;
  try {
    // 私有化时校验观看密码凭证（密码修改后旧凭证失效）
    const resp = await serverGet<ViewStatus>("/view/status");
    if (resp.code === 0 && resp.data?.privateAccess && !resp.data.unlocked) {
      locked = true;
    }
  } catch {
    // 忽略请求异常
  }

  if (locked) {
    const headerStore = await headers();
    const currentPath = headerStore.get("x-current-path");
    if (currentPath && currentPath.startsWith("/") && !currentPath.startsWith("//")) {
      redirect(`/unlock?redirect=${encodeURIComponent(currentPath)}`);
    } else {
      redirect("/unlock");
    }
  }
}

async function getNavList(): Promise<NavItem[]> {
  try {
    const response = await serverGet<NavItem[]>("/navCategory");
    if (response.code === 0 && Array.isArray(response.data)) {
      return response.data;
    }
  } catch {
    // 导航失败时用空列表，避免把可恢复错误打到客户端 overlay
  }

  return [];
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await verifyPublicAccess();

  const navList = await getNavList();

  return <PublicLayoutView navList={navList}>{children}</PublicLayoutView>;
}
