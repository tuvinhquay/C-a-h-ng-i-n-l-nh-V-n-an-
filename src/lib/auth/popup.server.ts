/** Retired OAuth popup endpoint; sign-in now uses the app's access key. */
export async function handleAuthPopupRequest(): Promise<Response> {
  return new Response("Đăng nhập qua nhà cung cấp ngoài đã được tắt. Hãy dùng mã bí mật.", {
    status: 410,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
