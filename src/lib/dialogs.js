export function notify(message, options = {}) {
  if (typeof window === 'undefined') return Promise.resolve();

  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('mc3_dialog', {
      detail: {
        type: 'alert',
        title: options.title || 'Heads up',
        message,
        confirmLabel: options.confirmLabel || 'OK',
        resolve
      }
    }));
  });
}

export function confirmAction(message, options = {}) {
  if (typeof window === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('mc3_dialog', {
      detail: {
        type: 'confirm',
        title: options.title || 'Confirm',
        message,
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        tone: options.tone || 'default',
        resolve
      }
    }));
  });
}
