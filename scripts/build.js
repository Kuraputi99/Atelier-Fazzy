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

/*-改行で区切った文章を <p> に-*/
function paragraphs(text) {
  return String(text || '').split(/\n+/).filter(Boolean)
    .map(function (line) { return '<p>' + escapeHTML(line) + '</p>'; }).join('');
}

/*-日本語と英語を書き分けたブロック({ ja, en } を受け取る)-*/
function langBlocks(value, render) {
  if (!value) return '';
  return ['ja', 'en'].map(function (lang) {
    const text = value[lang] !== undefined ? value[lang] : value.ja;
    return '<div data-lang-only="' + lang + '">' + render(text) + '</div>';
  }).join('');
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

/*-アドオンの導入方法(作品ごとに detail.install が無い時に使う共通の説明)-*/
const DEFAULT_INSTALL = {
  addon: {
    ja: [
      'ダウンロードしたファイル（.mcaddon / .mcpack）を開きます。Minecraft が起動して、自動で取り込まれます。',
      'ワールドの設定を開き、「ビヘイビアパック」や「リソースパック」から作品を有効にします。',
      'ワールドに入って遊びます。作品によっては「実験的な機能」の設定が必要な場合があります。'
    ],
    en: [
      'Open the downloaded file (.mcaddon / .mcpack). Minecraft will start and import it automatically.',
      'Open your world settings and enable the work under "Behavior Packs" or "Resource Packs".',
      'Enter the world and play. Some works may require "Experiments" settings.'
    ]
  }
};

function section(i18nKey, inner) {
  if (!inner) return '';
  return '      <section class="work-section">\n' +
    '        <h2 data-i18n="' + i18nKey + '">' + i18nKey + '</h2>\n' +
    '        ' + inner + '\n' +
    '      </section>\n';
}

function renderDownloads(item) {
  const rows = (item.downloads || []).map(function (dl) {
    const btn = dl.url !== '#'
      ? '<a class="download-btn" href="' + escapeHTML(dl.url.startsWith('http') ? dl.url : '../' + dl.url) + '" target="_blank" rel="noopener">' + dl.label + '</a>'
      : '<span class="download-btn is-disabled" aria-disabled="true">' + dl.label + '</span>';
    return '<div class="download-row">' + btn + '<span class="version-badge">' + escapeHTML(dl.version || '') + '</span></div>';
  }).join('');
  return rows ? '<div class="download-list">' + rows + '</div>' : '';
}

function renderWorkContent(item, dict) {
  const detail = item.detail || {};
  const descJa = (dict.ja && dict.ja[item.descKey]) || '';
  const tags = (item.tags || []).map(function (t) { return '<span class="tag">' + escapeHTML(t) + '</span>'; }).join('');

  const screenshots = (detail.screenshots || []).map(function (src) {
    return '<img src="../' + escapeHTML(src) + '" alt="" loading="lazy">';
  }).join('');

  const video = detail.youtubeId
    ? '<div class="work-video"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(detail.youtubeId) + '" title="YouTube video" allowfullscreen loading="lazy"></iframe></div>'
    : '';

  const install = detail.install || DEFAULT_INSTALL[item.category];
  const installHTML = install ? langBlocks(install, function (steps) {
    return '<ol class="work-steps">' + steps.map(function (s) { return '<li>' + escapeHTML(s) + '</li>'; }).join('') + '</ol>';
  }) : '';

  const changelog = (detail.changelog || []).map(function (c) {
    return '<li><span class="changelog-version">' + escapeHTML(c.version) + '</span>' +
      '<time class="changelog-date">' + escapeHTML(c.date || '') + '</time>' +
      langBlocks(c.text, paragraphs) + '</li>';
  }).join('');

  return '    <section class="work-detail">\n' +
    '      <a class="work-back" href="../works.html" data-i18n="detail.back">detail.back</a>\n' +
    '      <div class="work-hero">\n' +
    '        <div class="card-thumb work-thumb"><img src="../' + escapeHTML(item.image) + '" alt="' + escapeHTML(item.alt || item.title) + '"' + (item.imageClass ? ' class="' + escapeHTML(item.imageClass) + '"' : '') + '></div>\n' +
    '        <div class="work-info">\n' +
    '          <h1 class="work-title">' + escapeHTML(item.title) + '</h1>\n' +
    '          <p class="work-desc" data-i18n="' + escapeHTML(item.descKey) + '">' + descJa + '</p>\n' +
    '          <div class="tag-row">' + tags + '</div>\n' +
    '          <div class="card-meta"><button type="button" class="like-btn" data-like-id="' + escapeHTML(item.id) + '" hidden></button></div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    section('detail.downloads', renderDownloads(item)) +
    section('detail.about', langBlocks(detail.summary, paragraphs)) +
    section('detail.screenshots', screenshots && '<div class="work-screenshots">' + screenshots + '</div>') +
    section('detail.video', video) +
    section('detail.requirements', langBlocks(detail.requirements, paragraphs)) +
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
      DESCRIPTION: escapeHTML(toPlainText(dict.ja && dict.ja[item.descKey])),
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
