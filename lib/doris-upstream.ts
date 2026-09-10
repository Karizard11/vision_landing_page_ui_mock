const localDorisService = "http://127.0.0.1:8788";

export function dorisUpstream(path: string) {
  const base = (process.env.DORIS_API_BASE_URL || localDorisService).replace(/\/+$/,"");
  return new URL(path.replace(/^\/+/,""),`${base}/`);
}
