/*-翻訳データの読み込みと言語切替を担当-*/
/*-言語が変わるたびに 'af:langchange' イベントを送り、他のスクリプトに知らせる-*/
/*-文章はすべて Json/translate_data.json に置き、HTML では data-i18n="キー" で指定する-*/
/*-data-i18n-format="paragraphs" / "list" を付けると、改行(\n)ごとに段落 / 箇条書きにする-*/
document.addEventListener('DOMContentLoaded', function () {
  const STORAGE_KEY = 'atelier-fazzy-lang';
  const langButtons = document.querySelectorAll('.lang-btn');
  let dict = null;
  let currentLang = getInitialLang();

  /*-最初の言語を決める(保存済みの言語 → HTMLで選択中のボタン → 英語 の順)-*/
  function getInitialLang() {
    const saved = loadLang();
    if (saved === 'ja' || saved === 'en') return saved;
    const activeBtn = document.querySelector('.lang-btn.is-active');
    return activeBtn ? activeBtn.getAttribute('data-lang') : 'en';
  }

  /*-保存した言語の読み書き(プライベートブラウズ等で使えない場合は無視)-*/
  function loadLang() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function saveLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { }
  }

  /*-キーから今の言語の文章を取り出す(英語が無いキーは日本語で代わりに表示)-*/
  function t(key) {
    if (!dict) return undefined;
    const text = dict[currentLang] && dict[currentLang][key];
    return text !== undefined ? text : (dict.ja && dict.ja[key]);
  }

  /*-改行で区切った文章を、段落(<p>)や箇条書き(<li>)の HTML にする-*/
  function format(text, type) {
    if (type !== 'paragraphs' && type !== 'list') return text;
    const tag = type === 'list' ? 'li' : 'p';
    return String(text).split('\n').filter(Boolean).map(function (line) {
      return '<' + tag + '>' + line + '</' + tag + '>';
    }).join('');
  }

  // 他のスクリプトからも使えるようにする
  AF.t = t;
  AF.format = format;

  /*-data-i18n 属性のある要素を、選んだ言語の文章に置き換える-*/
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const text = t(el.getAttribute('data-i18n'));
      if (text !== undefined) el.innerHTML = format(text, el.getAttribute('data-i18n-format'));
    });
  }

  /*-<html> に今の言語を書き込む-*/
  function updateDocumentLang() {
    document.documentElement.lang = currentLang;
    document.documentElement.setAttribute('data-lang', currentLang);
  }

  /*-選んだ言語のボタンだけを選択中にする-*/
  function updateLangButtons() {
    langButtons.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang') === currentLang);
    });
  }

  /*-言語を切り替える-*/
  function changeLang(lang) {
    if (!dict) return;
    currentLang = lang;
    applyTranslations();
    updateDocumentLang();
    updateLangButtons();
    saveLang(lang);

    // 後から読み込まれたスクリプトでも今の言語を参照できるように残しておく
    AF.lang = currentLang;
    AF.dict = dict;

    // 他のスクリプトに言語が変わったことを知らせる
    document.dispatchEvent(new CustomEvent('af:langchange', {
      detail: { lang: currentLang, dict: dict }
    }));
  }

  /*-言語ボタンを押下して切り替える-*/
  langButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      changeLang(btn.getAttribute('data-lang'));
    });
  });

  /*-翻訳データを読み込む(非同期)-*/
  AF.loadJSON('Json/translate_data.json')
    .then(function (json) {
      dict = json;
      changeLang(currentLang);
    })
    .catch(function (err) {
      console.error('Failed to load translate_data.json', err);
    });
});
