/** 旧留言可能无 ownerId：首次编辑/删除时绑定当前设备 */
export function assertOwnerOrAssign(
  record: { ownerId?: string },
  ownerId: string
): void {
  if (!record.ownerId) {
    record.ownerId = ownerId;
    return;
  }
  if (record.ownerId !== ownerId) {
    throw new Error("Unauthorized or not found");
  }
}
