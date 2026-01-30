(function () {
  var s = document.currentScript;
  if (!s) return;

  var storeId = s.getAttribute('data-store-id');
  if (!storeId) {
    console.error('[Temuulel] data-store-id attribute is required');
    return;
  }

  // Derive base URL from script src (works in dev/staging/prod)
  var baseUrl = s.getAttribute('data-base-url') || s.src.replace(/\/widget\.js.*$/, '');

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.src = baseUrl + '/embed/' + encodeURIComponent(storeId);
  iframe.title = 'Chat Widget';
  iframe.setAttribute('allow', 'clipboard-write');

  // Start small — closed state, just the chat bubble
  iframe.style.cssText =
    'position:fixed;bottom:0;right:0;border:none;' +
    'z-index:2147483647;background:transparent;' +
    'width:80px;height:80px;' +
    'color-scheme:auto;';

  document.body.appendChild(iframe);

  // Detect mobile (viewport <= 640px, matches Tailwind sm breakpoint)
  function isMobile() {
    return window.innerWidth <= 640;
  }

  // Listen for resize messages from ChatWidget
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'temuulel-widget') {
      if (e.data.isOpen) {
        if (isMobile()) {
          iframe.style.width = '100%';
          iframe.style.height = '100%';
        } else {
          iframe.style.width = '420px';
          iframe.style.height = '560px';
        }
      } else {
        iframe.style.width = '80px';
        iframe.style.height = '80px';
      }
    }
  });
})();
