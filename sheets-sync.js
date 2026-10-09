/* ส่งผ่าน form/iframe และรอใบตอบรับจาก Apps Script ไม่ใช้ no-cors เป็นหลักฐานว่าบันทึกแล้ว */
const SheetsSync = (() => {
  const pending = new Map();
  const storageKey = 'prakaew-exam-pending-v1';
  const endpoint = () => typeof SHEETS_WEB_APP_URL === 'string' ? SHEETS_WEB_APP_URL.trim() : '';
  const configured = () => /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint());
  const newId = () => crypto.randomUUID();
  function keep(payload) {
    try { sessionStorage.setItem(storageKey, JSON.stringify(payload)); } catch (_) {}
  }
  function recall() {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch (_) { return null; }
  }
  function forget() {
    try { sessionStorage.removeItem(storageKey); } catch (_) {}
  }
  function isGoogleOrigin(origin) {
    try {
      const u = new URL(origin);
      return u.protocol === 'https:' && (u.hostname === 'script.google.com' ||
        u.hostname === 'script.googleusercontent.com' || u.hostname.endsWith('-script.googleusercontent.com'));
    } catch (_) { return false; }
  }
  window.addEventListener('message', event => {
    const data = event.data;
    if (!isGoogleOrigin(event.origin) || !data || data.type !== 'prakaew-sheet-receipt') return;
    const task = pending.get(data.requestId);
    if (!task || data.attemptId !== task.attemptId) return;
    task.complete(data);
  });
  function send(payload) {
    if (!configured()) return Promise.reject(new Error('ครูยังไม่ได้ตั้งค่าระบบบันทึกคะแนน กรุณาแคปผลคะแนนและแจ้งครู'));
    keep(payload);
    return new Promise((resolve, reject) => {
      const requestId = newId();
      const iframe = document.createElement('iframe');
      iframe.name = 'receipt_' + requestId.replaceAll('-', '');
      iframe.hidden = true;
      iframe.setAttribute('title', 'ช่องทางรับใบยืนยันการบันทึกคะแนน');
      const form = document.createElement('form');
      form.method = 'POST'; form.action = endpoint(); form.target = iframe.name; form.hidden = true;
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = 'payload';
      input.value = JSON.stringify({...payload, requestId});
      form.append(input);
      let timer;
      const cleanup = () => {
        clearTimeout(timer); pending.delete(requestId); form.remove(); iframe.remove();
      };
      pending.set(requestId, {
        attemptId: payload.attemptId,
        complete(data) {
          cleanup();
          if (data.ok === true && Number.isInteger(data.score) && data.score >= 0 && data.score <= 20 &&
              data.maxScore === 20 && typeof data.savedAt === 'string' && !Number.isNaN(Date.parse(data.savedAt))) {
            forget(); resolve(data);
          } else reject(new Error(data.error || 'ใบยืนยันไม่ถูกต้อง กรุณาลองส่งอีกครั้ง'));
        }
      });
      timer = setTimeout(() => {
        cleanup();
        reject(new Error('ยังไม่ได้รับใบยืนยันการบันทึก กรุณาตรวจอินเทอร์เน็ตแล้วกดส่งคะแนนอีกครั้ง ระบบใช้รหัสเดิมเพื่อป้องกันแถวซ้ำ'));
      }, 45000);
      document.body.append(iframe, form);
      try { form.submit(); } catch (_) { cleanup(); reject(new Error('ส่งข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง')); }
    });
  }
  return {configured, newId, keep, recall, forget, send};
})();
