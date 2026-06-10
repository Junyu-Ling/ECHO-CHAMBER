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

  // 切换到新预览：先停掉旧的（不重置 activeUrl 的通知，避免闪烁）
  if (audio) {
    audio.pause();
    audio.onended = null;
    audio = null;
  }

  const el = new Audio(url);
  audio = el;
  activeUrl = url;
  // 立即通知 UI 进入「播放中」状态，避免音频加载延迟造成「点了没反应」
  notify();
  el.onended = () => stopPreviewIf(url);
  void el.play().catch(() => {
    // 仅当这次播放仍是当前激活的才回滚（防止快速切换时误停新的）
    if (audio === el) stopPreview();
  });
  return true;
}
