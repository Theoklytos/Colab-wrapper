// bookmarklet.js — CSS injection bookmarklet generator
//
// Generates a javascript: URL that, when saved as a browser bookmark
// and tapped while Colab is open, injects the mobile CSS stylesheet.
//
// The bookmarklet:
//   1. Fetches the hosted CSS from this server via CORS
//   2. Injects it as a <style> element into Colab's <head>
//   3. Shows a toast confirmation
//   4. Is idempotent — tapping again toggles the CSS on/off
//   5. Falls back to inline critical CSS if the fetch fails

// CSS variant → filename mapping
const VARIANT_FILES = {
  mobile: 'colab-mobile.css',
  amoled: 'colab-amoled.css',
  font:   'colab-font.css',
  // 'all' fetches all three and combines
};

/**
 * Get the base URL of this PWA server.
 * When running on localhost via Termux, this is http://localhost:3000.
 */
function getBaseUrl() {
  return `${location.protocol}//${location.host}`;
}

/**
 * Build the bookmarklet source code for a given variant.
 * This is the code that will run inside Colab's page context.
 * @param {'mobile'|'amoled'|'font'|'all'} variant
 * @returns {string} Unencoded JavaScript source
 */
function buildBookmarkletSource(variant) {
  const base = getBaseUrl();
  const styleId = `colab-mobile-css-${variant}`;

  // For 'all', we fetch and inject all three CSS files
  const fetchUrls = variant === 'all'
    ? [
        `${base}/colab-css/colab-mobile.css`,
        `${base}/colab-css/colab-amoled.css`,
        `${base}/colab-css/colab-font.css`,
      ]
    : [`${base}/colab-css/${VARIANT_FILES[variant]}`];

  // Build the bookmarklet as a minified IIFE
  // We build it as a readable string; encoding happens below
  return `(function(){
var id="${styleId}";
var el=document.getElementById(id);
if(el){el.disabled=!el.disabled;toast(el.disabled?"CSS disabled":"CSS enabled");return;}
var urls=${JSON.stringify(fetchUrls)};
Promise.all(urls.map(function(u){return fetch(u,{mode:"cors"}).then(function(r){return r.text();});}))
.then(function(texts){
var s=document.createElement("style");
s.id=id;
s.textContent=texts.join("\\n");
document.head.appendChild(s);
toast("Colab mobile CSS applied ✓");
})
.catch(function(){
var s=document.createElement("style");
s.id=id;
s.textContent="body,#notebook{min-width:unset!important;max-width:100vw!important}.cm-editor,.CodeMirror{font-size:15px!important}button,[role=button]{min-height:44px!important}";
document.head.appendChild(s);
toast("CSS applied (offline fallback)");
});
function toast(msg){
var t=document.createElement("div");
t.id="colab-mobile-css-toast";
t.textContent=msg;
Object.assign(t.style,{position:"fixed",bottom:"80px",left:"50%",transform:"translateX(-50%)",background:"#f9ab00",color:"#000",padding:"10px 20px",borderRadius:"24px",fontFamily:"system-ui,sans-serif",fontSize:"14px",fontWeight:"600",zIndex:"999999",boxShadow:"0 4px 16px rgba(0,0,0,.4)",whiteSpace:"nowrap",pointerEvents:"none",opacity:"1",transition:"opacity .3s"});
var old=document.getElementById("colab-mobile-css-toast");
if(old)old.remove();
document.body.appendChild(t);
setTimeout(function(){t.style.opacity="0";setTimeout(function(){t.remove();},300);},3000);
}
})();`;
}

/**
 * Encode the bookmarklet source as a javascript: URL.
 * @param {string} source
 * @returns {string} bookmarklet: URL starting with "javascript:"
 */
function encodeBookmarklet(source) {
  // Remove newlines and excessive whitespace, then URI-encode
  const minified = source.replace(/\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return 'javascript:' + encodeURIComponent(minified);
}

/**
 * Initialize the bookmarklet UI section.
 * Binds variant chip selection and copy button.
 */
export function renderBookmarklet(variant = 'mobile') {
  const copyBtn     = document.getElementById('copy-bookmarklet-btn');
  const preview     = document.getElementById('bookmarklet-preview');
  const variantChips = document.querySelectorAll('.chip[data-variant]');

  let currentVariant = variant;

  function updatePreview() {
    const source = buildBookmarkletSource(currentVariant);
    const encoded = encodeBookmarklet(source);

    if (preview) {
      // Show truncated version
      const truncated = encoded.length > 80
        ? encoded.slice(0, 77) + '…'
        : encoded;
      preview.textContent = truncated;
    }

    return encoded;
  }

  // Variant chip selection
  variantChips.forEach(chip => {
    chip.addEventListener('click', () => {
      variantChips.forEach(c => c.classList.remove('chip--active'));
      chip.classList.add('chip--active');
      currentVariant = chip.dataset.variant;
      updatePreview();
    });
  });

  // Copy to clipboard
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const encoded = updatePreview();
      try {
        await navigator.clipboard.writeText(encoded);
        const original = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = original; }, 2000);
        showToast('Bookmarklet copied to clipboard');
      } catch (_) {
        // Clipboard API may be blocked — select the text for manual copy
        if (preview) {
          preview.textContent = encoded;
          const range = document.createRange();
          range.selectNodeContents(preview);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        showToast('Copy failed — code selected for manual copy');
      }
    });
  }

  // Initial render
  updatePreview();
}

/**
 * Quick toast for bookmarklet actions.
 * Delegates to the global showToast in app.js if available.
 */
function showToast(msg) {
  if (window.__colabShowToast) {
    window.__colabShowToast(msg);
  }
}
