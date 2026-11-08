import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { VideoBackground } from "@/components/video-background";
import appCss from "../styles.css?url";

const APP_NAME = "Cửa hàng điện lạnh Vân An";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Phần mềm quản lý kho hàng đa nền tảng là cộng sự số một cho mọi Doanh nghiệp lớn/nhỏ. Quản lý kho linh kiện, phiếu sửa chữa, bảo hành và hóa đơn.",
      },
      { name: "theme-color", content: "#0B0F19" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
    ],
    links: [
      { rel: "icon", type: "image/jpeg", href: "/media/logo-vanan.jpg" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/media/logo-vanan.jpg" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="vi" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <VideoBackground />
        <PreviewHostBridge />
        <div className="app-content">
          <AuthProvider>
            <Outlet />
          </AuthProvider>
        </div>
        <Scripts />
      </body>
    </html>
  ),
});
