/*-ホームの「おしらせ」と「YouTube の最新動画」を表示する-*/
/*-youtube_data.json は build.js が GitHub Actions 上で自動で作る(手元で開いた時は無いので、リンクだけ表示)-*/
document.addEventListener('DOMContentLoaded', function () {
  const newsList = document.getElementById('news-list');
  const videoList = document.getElementById('video-list');
  const NEWS_LIMIT = 5;
  const VIDEO_LIMIT = 3;

  let news = null;
  let videos = null;
  let lang = null;
  let dict = null;

  function t(key) {
    return (dict && dict[lang] && dict[lang][key]) || '';
  }

  /* ---------- おしらせ ---------- */

  function renderNews() {
    if (!newsList || !news || !lang) return;
    newsList.innerHTML = '';
    if (!news.length) {
      newsList.innerHTML = '<p class="empty-text">' + t('news.empty') + '</p>';
      return;
    }
    news.slice(0, NEWS_LIMIT).forEach(function (item) {
      const row = document.createElement(item.link ? 'a' : 'div');
      row.className = 'news-item';
      if (item.link) row.href = AF.root + item.link;

      const date = document.createElement('time');
      date.className = 'news-date';
      date.dateTime = item.date;
      date.textContent = item.date.replace(/-/g, '.');

      const text = document.createElement('span');
      text.className = 'news-text';
      text.textContent = item.text[lang] || item.text.ja || '';

      row.appendChild(date);
      row.appendChild(text);
      newsList.appendChild(row);
    });
  }

  /* ---------- YouTube ---------- */

  function renderVideos() {
    if (!videoList || !videos || !lang) return;
    videoList.innerHTML = '';
    if (!videos.length) {
      videoList.innerHTML = '<p class="empty-text">' + t('youtube.empty') + '</p>';
      return;
    }
    videos.slice(0, VIDEO_LIMIT).forEach(function (video) {
      const card = document.createElement('a');
      card.className = 'video-card';
      card.href = video.url;
      card.target = '_blank';
      card.rel = 'noopener';

      const img = document.createElement('img');
      img.src = video.thumbnail;
      img.alt = '';
      img.loading = 'lazy';

      const title = document.createElement('span');
      title.className = 'video-title';
      title.textContent = video.title;

      card.appendChild(img);
      card.appendChild(title);
      videoList.appendChild(card);
    });
  }

  function setupYouTubeLinks(config) {
    const channelUrl = (config.youtube && config.youtube.channelUrl) || '';
    const channelLink = document.getElementById('youtube-channel-link');
    const postsLink = document.getElementById('youtube-posts-link');
    // YouTube の「投稿」は公式APIで取得できないので、チャンネルの投稿タブへのリンクにする
    if (channelLink) channelLink.href = channelUrl;
    if (postsLink) postsLink.href = channelUrl.replace(/\/+$/, '') + '/posts';
  }

  /* ---------- 読み込み ---------- */

  document.addEventListener('af:langchange', function (e) {
    lang = e.detail.lang;
    dict = e.detail.dict;
    renderNews();
    renderVideos();
  });

  AF.loadJSON('Json/news_data.json')
    .then(function (json) { news = json.items; renderNews(); })
    .catch(function (err) { console.error('Failed to load news_data.json', err); });

  AF.loadJSON('Json/youtube_data.json')
    .then(function (json) { videos = json.items || []; })
    .catch(function () { videos = []; })
    .then(renderVideos);

  AF.config.then(setupYouTubeLinks);
});
