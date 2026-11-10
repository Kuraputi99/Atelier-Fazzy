/*-全ページ共通の小道具。他のスクリプトより先に読み込む-*/
/*-ページの階層(<body data-root="../"> など)を見て、JSONなどの読み込み先を合わせる-*/
window.AF = (function () {
  const root = document.body.getAttribute('data-root') || '';
  const cache = {};

  /*-サイトのルートから見たパスで JSON を読み込む(同じファイルは1回だけ取りに行く)-*/
  function loadJSON(path) {
    if (!cache[path]) {
      cache[path] = fetch(root + path).then(function (res) {
        if (!res.ok) throw new Error(path + ': ' + res.status);
        return res.json();
      });
    }
    return cache[path];
  }

  /*-文字列をHTMLに安全に埋め込むための変換-*/
  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  return {
    root: root,
    loadJSON: loadJSON,
    escapeHTML: escapeHTML,
    config: loadJSON('site.config.json').catch(function () { return {}; })
  };
})();
