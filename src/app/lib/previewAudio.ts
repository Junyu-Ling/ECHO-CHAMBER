/** 全站仅允许一首预览同时播放 */
type Listener = (activeUrl: string | null) => void;

let audio: HTMLAudioElement | null = null;
let activeUrl: string | null = null;
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) fn(activeUrl);
}

export function subscribePreview(listener: Listener) {
  listeners.add(listener);
  listener(activeUrl);
  return () => listeners.delete(listener);
}

export function stopPreview() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio.onended = null;
    audio = null;
  }
  activeUrl = null;
  notify();
}

export function stopPreviewIf(url: string) {
  if (activeUrl === url) stopPreview();
}

/** 播放指定预览；若已在播同一首则停止。返回是否正在播放该 URL */
export function togglePreview(url: string): boolean {
  if (activeUrl === url && audio) {
    stopPreview();
    return false;
  }

  stopPreview();
  audio = new Audio(url);
  activeUrl = url;
  audio.onended = () => stopPreview();
  void audio.play().then(notify).catch(() => stopPreview());
  return true;
}
