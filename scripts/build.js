#!/usr/bin/env node
/*
 * サイトを組み立てて _site フォルダに出力するスクリプト
 *
 *   node scripts/build.js            … YouTube の最新動画も取りに行く(GitHub Actions ではこちら)
 *   node scripts/build.js --offline  … ネットにつながず組み立てるだけ(手元での確認用)
 *
 * やること
 *   1. サイトのファイルを _site にコピー
 *   2. HTML の {{SITE_URL}} {{BASE_PATH}} を site.config.json の値に置き換え
 *   3. works_data.json から作品ごとの詳細ページ(works/作品ID.html)を作る
 *   4. YouTube の最新動画を取得して Json/youtube_data.json に保存
 *
 * 必要なのは Node.js 18 以上だけ(追加のパッケージは不要)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_site');
const OFFLINE = process.argv.includes('--offline');

// _site にコピーしないもの(ビルド用のファイルや、サイトに不要な物)
const EXCLUDE = new Set(['.git', '.github', '_site', 'scripts', 'templates', 'worker', 'node_modules', 'SETUP.md', 'README.md']);

/* ---------- 小道具 ---------- */

function readJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

function writeOut(file, text) {
  const full = path.join(OUT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/*-翻訳データの文(<br> などを含む)を、meta タグ用の1行の文章にする-*/
function toPlainText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}

/*-改行で区切った文章を、段落(<p>)や箇条書き(<li>)の HTML にする(lang.js の format と同じ)-*/
function format(text, type) {
  if (type !== 'paragraphs' && type !== 'list') return text;
  const tag = type === 'list' ? 'li' : 'p';
  return String(text).split('\n').filter(Boolean).map(function (line) {
    return '<' + tag + '>' + line + '</' + tag + '>';
  }).join('');
}

/*-翻訳キーの文章を入れた要素を作る。最初は日本語で書いておき、言語の切り替えは lang.js が行う-*/
/*-そのキーが translate_data.json に無ければ空文字を返す(=その項目は表示しない)-*/
function textElement(dict, key, tag, attrs, type) {
  const text = dict.ja && dict.ja[key];
  if (text === undefined) return '';
  return '<' + tag + (attrs ? ' ' + attrs : '') + ' data-i18n="' + escapeHTML(key) + '"' +
    (type ? ' data-i18n-format="' + type + '"' : '') + '>' + format(text, type) + '</' + tag + '>';
}

/* ---------- 1. コピー ---------- */

function copySite() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT);
  fs.readdirSync(ROOT).filter(function (name) { return !EXCLUDE.has(name); }).forEach(function (name) {
    fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
  });
}

/* ---------- 2. 置き換え ---------- */

function fillPlaceholders(config) {
  const siteUrl = config.siteUrl.replace(/\/?$/, '/');
  const basePath = new URL(siteUrl).pathname;
  fs.readdirSync(OUT).filter(function (f) { return f.endsWith('.html'); }).forEach(function (f) {
    const full = path.join(OUT, f);
    const html = fs.readFileSync(full, 'utf8')
      .replace(/\{\{SITE_URL\}\}/g, siteUrl)
      .replace(/\{\{BASE_PATH\}\}/g, basePath);
    fs.writeFileSync(full, html);
  });
  return siteUrl;
}

/* ---------- 4. YouTube ---------- */

/*-チャンネルの RSS(APIキー不要、最新15件)から動画一覧を作る-*/
async function fetchYouTube(config) {
  const channelId = config.youtube && config.youtube.channelId;
  if (OFFLINE || !channelId) return [];
  try {
    const res = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + encodeURIComponent(channelId));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const xml = await res.text();
    const unescape = function (s) {
      return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    };
    const pick = function (block, re) { const m = block.match(re); return m ? unescape(m[1]) : ''; };
    return (xml.match(/<entry>[\s\S]*?<\/entry>/g) || []).map(function (entry) {
      const id = pick(entry, /<yt:videoId>([^<]+)<\/yt:videoId>/);
      return {
        id: id,
        title: pick(entry, /<title>([^<]*)<\/title>/),
        url: 'https://www.youtube.com/watch?v=' + id,
        thumbnail: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg',
        published: pick(entry, /<published>([^<]+)<\/published>/)
      };
    });
  } catch (err) {
    console.warn('[youtube] 取得できませんでした:', err.message);
    return [];
  }
}

/* ---------- 3. 作品詳細ページ ---------- */

function section(i18nKey, inner) {
  if (!inner) return '';
  return '      <section class="work-section">\n' +
    '        <h2 data-i18n="' + i18nKey + '">' + i18nKey + '</h2>\n' +
    '        ' + inner + '\n' +
    '      </section>\n';
}

function renderDownloads(item, dict) {
  const rows = (item.downloads || []).map(function (dl) {
    const btn = dl.url !== '#'
      ? textElement(dict, 'download.' + dl.type, 'a', 'class="download-btn" href="' + escapeHTML(dl.url.startsWith('http') ? dl.url : '../' + dl.url) + '" target="_blank" rel="noopener"')
      : textElement(dict, 'download.' + dl.type, 'span', 'class="download-btn is-disabled" aria-disabled="true"');
    return '<div class="download-row">' + btn + '<span class="version-badge">' + escapeHTML(dl.version || '') + '</span></div>';
  }).join('');
  return rows ? '<div class="download-list">' + rows + '</div>' : '';
}

function renderWorkContent(item, dict) {
  const detail = item.detail || {};
  const key = 'work.' + item.id + '.';
  const tags = (item.tags || []).map(function (t) { return '<span class="tag">' + escapeHTML(t) + '</span>'; }).join('');

  const screenshots = (detail.screenshots || []).map(function (src) {
    return '<img src="../' + escapeHTML(src) + '" alt="" loading="lazy">';
  }).join('');

  const video = detail.youtubeId
    ? '<div class="work-video"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(detail.youtubeId) + '" title="YouTube video" allowfullscreen loading="lazy"></iframe></div>'
    : '';

  // 導入方法：作品ごとの文章(work.作品ID.install)が無ければ、タグ共通の文章(detail.install.タグ名の小文字)を使う
  const hasText = function (k) { return dict.ja && dict.ja[k] !== undefined; };
  const tagInstallKey = (item.tags || []).map(function (tag) { return 'detail.install.' + tag.toLowerCase(); }).find(hasText);
  const installKey = hasText(key + 'install') ? key + 'install' : tagInstallKey;
  const installHTML = textElement(dict, installKey, 'ol', 'class="work-steps"', 'list');

  const changelog = (detail.changelog || []).map(function (c) {
    return '<li><span class="changelog-version">' + escapeHTML(c.version) + '</span>' +
      '<time class="changelog-date">' + escapeHTML(c.date || '') + '</time>' +
      textElement(dict, key + 'changelog.' + c.version, 'div', '', 'paragraphs') + '</li>';
  }).join('');

  return '    <section class="work-detail">\n' +
    '      <a class="work-back" href="../works.html" data-i18n="detail.back">detail.back</a>\n' +
    '      <div class="work-hero">\n' +
    '        <div class="card-thumb work-thumb"><img src="../' + escapeHTML(item.image) + '" alt="' + escapeHTML(item.title) + '"></div>\n' +
    '        <div class="work-info">\n' +
    '          <h1 class="work-title">' + escapeHTML(item.title) + '</h1>\n' +
    '          ' + textElement(dict, key + 'desc', 'p', 'class="work-desc"') + '\n' +
    '          <div class="tag-row">' + tags + '</div>\n' +
    '          <div class="card-meta"><button type="button" class="like-btn" data-like-id="' + escapeHTML(item.id) + '" hidden></button></div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    section('detail.downloads', renderDownloads(item, dict)) +
    section('detail.about', textElement(dict, key + 'summary', 'div', '', 'paragraphs')) +
    section('detail.screenshots', screenshots && '<div class="work-screenshots">' + screenshots + '</div>') +
    section('detail.video', video) +
    section('detail.requirements', textElement(dict, key + 'requirements', 'div', '', 'paragraphs')) +
    section('detail.install', installHTML) +
    section('detail.changelog', changelog && '<ul class="work-changelog">' + changelog + '</ul>') +
    '    </section>';
}

function buildWorkPages(items, dict, siteUrl) {
  const template = fs.readFileSync(path.join(ROOT, 'templates', 'work.html'), 'utf8');
  items.forEach(function (item) {
    if (!/^[a-z0-9-]+$/.test(item.id || '')) {
      throw new Error('作品の id は小文字の英数字とハイフンだけにしてください: ' + item.title);
    }
    const values = {
      TITLE: escapeHTML(item.title),
      DESCRIPTION: escapeHTML(toPlainText(dict.ja && dict.ja['work.' + item.id + '.desc'])),
      PAGE_URL: siteUrl + 'works/' + item.id + '.html',
      OG_IMAGE: siteUrl + (item.ogImage || 'Images/ogp.png'),
      TWITTER_CARD: 'summary_large_image',
      CONTENT: renderWorkContent(item, dict)
    };
    const html = template
      .replace(/^<!-- 作品詳細ページのひな形.*\n<!-- \{\{\.\.\.\}\}.*\n/m, '')
      .replace(/\{\{(\w+)\}\}/g, function (all, key) { return key in values ? values[key] : all; });
    writeOut(path.join('works', item.id + '.html'), html);
  });
}

/* ---------- 実行 ---------- */

(async function main() {
  const config = readJSON('site.config.json');
  const items = readJSON('Json/works_data.json').items;
  const dict = readJSON('Json/translate_data.json');

  copySite();
  const siteUrl = fillPlaceholders(config);

  const videos = await fetchYouTube(config);
  writeOut('Json/youtube_data.json', JSON.stringify({ updated: new Date().toISOString(), items: videos }, null, 2));

  buildWorkPages(items, dict, siteUrl);

  console.log('完了: _site に出力しました(作品ページ ' + items.length + ' 件、動画 ' + videos.length + ' 件)');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
