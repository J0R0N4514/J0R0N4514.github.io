(() => {
  const $ = id => document.getElementById(id);
  const tg = window.Telegram?.WebApp;
  try { tg?.ready(); tg?.expand(); tg?.setHeaderColor?.('#6f91d7'); } catch (_) {}

  let apps = [], categories = [], suppliers = [], activeCategory = null;
  let current = null, chosen = null;
  const fallback = { apps: [] };
  const url = path => new URL(path, document.baseURI).href;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const normalizeUsername = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
  const telegramUser = tg?.initDataUnsafe?.user || null;

  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => $('toast').classList.remove('show'), 2600);
  }

  function placeholder(name) {
    return 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#fff"/><text x="50%" y="60%" text-anchor="middle" font-size="48">${esc(String(name || 'A').slice(0, 1))}</text></svg>`
    );
  }

  function page(id) {
    ['catalog', 'detail', 'profile', 'supportpage'].forEach(key => $(key).classList.toggle('hidden', key !== id));
    $('tabcat').classList.toggle('active', id === 'catalog' || id === 'detail');
    $('tabprofile').classList.toggle('active', id === 'profile' || id === 'supportpage');
    $('q').parentElement.style.visibility = id === 'profile' || id === 'supportpage' ? 'hidden' : 'visible';
    window.scrollTo(0, 0);
  }

  function supplierForCurrentUser() {
    if (!telegramUser) return null;
    const id = telegramUser.id == null ? '' : String(telegramUser.id);
    const username = normalizeUsername(telegramUser.username);
    // Telegram ID is the stable key. Username is a fallback for older account records.
    return suppliers.find(s => id && String(s.telegram_user_id || '') === id)
      || suppliers.find(s => username && normalizeUsername(s.telegram_username) === username)
      || null;
  }

  function supplierAvatar(supplier) {
    if (supplier?.avatar) return url(supplier.avatar);
    const idMatches = telegramUser && supplier?.telegram_user_id && String(supplier.telegram_user_id) === String(telegramUser.id);
    const usernameMatches = telegramUser?.username && normalizeUsername(supplier?.telegram_username) === normalizeUsername(telegramUser.username);
    if ((idMatches || usernameMatches) && telegramUser.photo_url) return telegramUser.photo_url;
    return 'assets/branding/default-avatar.png';
  }

  function renderProfile() {
    const supplier = supplierForCurrentUser();
    const fullName = [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(' ');
    $('user').textContent = supplier?.display_name || fullName || 'Гость Telegram';
    $('username').textContent = telegramUser?.username ? '@' + telegramUser.username : 'Telegram';
    $('avatar').src = supplierAvatar(supplier);
    $('navavatar').src = supplierAvatar(supplier);
    $('avatar').onerror = () => { $('avatar').src = 'assets/branding/default-avatar.png'; };
    $('navavatar').onerror = () => { $('navavatar').src = 'assets/branding/default-avatar.png'; };
    $('profileRole').textContent = supplier ? 'ПОСТАВЩИК' : 'ПОЛЬЗОВАТЕЛЬ';
    $('profileRole').classList.toggle('supplier-role', Boolean(supplier));
    $('publicationCount').textContent = supplier
      ? String(apps.filter(app => (app.vendors || []).some(v =>
          (supplier.telegram_user_id && String(v.telegram_user_id || '') === String(supplier.telegram_user_id)) ||
          (supplier.telegram_username && normalizeUsername(v.telegram_username) === normalizeUsername(supplier.telegram_username)) ||
          v.name === supplier.display_name
        )).length)
      : '—';
    $('profileStatus').textContent = supplier ? 'Поставщик' : 'Пользователь';
    $('supplier').classList.toggle('hidden', Boolean(supplier));
    $('publish').textContent = supplier ? 'Управление публикациями ↗' : 'Опубликовать новое ↗';
  }

  function render() {
    const query = $('q').value.trim().toLowerCase();
    let found = apps.filter(app => [app.name, app.category, app.short, app.description,
      ...(app.vendors || []).map(v => v.name)].join(' ').toLowerCase().includes(query));
    if (activeCategory && !query) found = found.filter(app => app.category === activeCategory);
    const root = $('list');
    root.innerHTML = '';
    $('empty').classList.toggle('hidden', found.length > 0);
    found.forEach(app => {
      const row = document.createElement('article');
      row.className = 'app';
      const image = document.createElement('img');
      image.src = app.icon ? url(app.icon) : placeholder(app.name);
      image.alt = app.name + ' — иконка';
      image.onerror = () => { image.src = placeholder(app.name); };
      const info = document.createElement('div');
      info.className = 'appinfo';
      info.innerHTML = `<h3>${esc(app.name)}</h3><p>${esc(app.short || 'Описание не добавлено')}</p><button class="installbtn">Установить</button>`;
      row.append(image, info);
      row.onclick = event => { if (!event.target.closest('button')) openApp(app); };
      info.querySelector('button').onclick = event => { event.stopPropagation(); install(app); };
      root.append(row);
    });
    renderCategoryNav();
  }

  function renderCategoryNav() {
    const nav = $('categoryNav');
    nav.innerHTML = '';
    const source = categories.length ? categories : [...new Set(apps.map(a => a.category))].map(name => ({ name }));
    source.forEach(category => {
      const button = document.createElement('button');
      button.className = 'category-chip' + (activeCategory === category.name ? ' selected' : '');
      button.title = category.name;
      button.setAttribute('aria-label', category.name);
      if (category.icon) {
        const image = document.createElement('img');
        image.src = url(category.icon);
        image.alt = '';
        image.onerror = () => { image.remove(); button.textContent = category.name.slice(0, 1); };
        button.append(image);
      } else button.textContent = category.name.slice(0, 1);
      button.onclick = () => {
        activeCategory = activeCategory === category.name ? null : category.name;
        $('q').value = '';
        page('catalog');
        render();
      };
      nav.append(button);
    });
  }

  function openSupplier(username) {
    const clean = normalizeUsername(username);
    if (!clean) return;
    const link = 'https://t.me/' + encodeURIComponent(clean);
    if (tg?.openTelegramLink) tg.openTelegramLink(link);
    else window.open(link, '_blank', 'noopener');
  }

  function openApp(app) {
    current = app;
    $('name').textContent = app.name;
    $('short').textContent = app.short || '';
    $('icon').src = app.icon ? url(app.icon) : placeholder(app.name);
    $('cover').style.backgroundImage = app.header ? `url("${url(app.header)}")` : 'linear-gradient(120deg,#050505,#242424)';
    $('meta').textContent = `${app.category} · Версия ${app.version || '—'} · ${(app.vendors || []).length} поставщик(ов)`;
    $('desc').textContent = app.description || 'Описание не добавлено';
    $('shots').innerHTML = (app.screenshots || []).map((shot, index) =>
      `<div class="shot-frame"><img src="${url(shot)}" alt="Скриншот ${index + 1}" loading="lazy"></div>`
    ).join('') || '<span class="muted">Скриншоты пока не добавлены.</span>';
    const vendorRoot = $('vendors');
    vendorRoot.innerHTML = '';
    (app.vendors || []).forEach(vendor => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'vendorrow vendorlink';
      const avatar = document.createElement('img');
      avatar.className = 'avatar';
      avatar.src = vendor.avatar ? url(vendor.avatar) : supplierAvatar(vendor);
      avatar.onerror = () => { avatar.src = 'assets/branding/default-avatar.png'; };
      const name = document.createElement('span');
      name.textContent = vendor.name;
      row.append(avatar, name);
      row.onclick = () => openSupplier(vendor.telegram_username);
      vendorRoot.append(row);
    });
    $('install').innerHTML = '<button class="installbtn" id="detailInstall">Скачать APK</button>';
    $('detailInstall').onclick = () => install(app);
    page('detail');
  }

  function install(app) {
    current = app;
    const vendors = app.vendors || [];
    if (!vendors.length) { toast('APK пока не опубликован'); return; }
    if (vendors.length === 1) { download(app, vendors[0]); return; }
    chosen = null;
    $('choices').innerHTML = '';
    vendors.forEach(vendor => {
      const button = document.createElement('button');
      button.className = 'vendoroption';
      const avatar = document.createElement('img');
      avatar.className = 'avatar';
      avatar.src = vendor.avatar ? url(vendor.avatar) : supplierAvatar(vendor);
      avatar.onerror = () => { avatar.src = 'assets/branding/default-avatar.png'; };
      const name = document.createElement('b');
      name.textContent = vendor.name;
      const version = document.createElement('small');
      version.textContent = vendor.version || '';
      button.append(avatar, name, version);
      button.onclick = () => {
        chosen = vendor;
        document.querySelectorAll('.vendoroption').forEach(item => item.classList.remove('selected'));
        button.classList.add('selected');
        $('continue').disabled = false;
      };
      $('choices').append(button);
    });
    $('continue').disabled = true;
    $('vendorModal').classList.remove('hidden');
  }

  function download(app, vendor) {
    const fileUrl = url(vendor.file);
    const fileName = String(vendor.file || '').split('/').pop() || (app.name.replace(/[^\w.-]+/g, '_') + '.apk');
    // Telegram's native file-download prompt is available from Bot API 8.0.
    if (tg?.downloadFile && (!tg.isVersionAtLeast || tg.isVersionAtLeast('8.0'))) {
      try {
        tg.downloadFile({ url: fileUrl, file_name: fileName }, accepted => {
          toast(accepted ? 'Запрос на скачивание принят Telegram' : 'Скачивание отменено');
        });
        return;
      } catch (error) {
        console.warn('Telegram downloadFile failed; using browser fallback.', error);
      }
    }
    // Outside Telegram, use a normal same-origin download link (no fetch/Blob).
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    toast('Открыта загрузка APK');
  }

  $('continue').onclick = () => {
    if (chosen && current) download(current, chosen);
    $('vendorModal').classList.add('hidden');
  };

  document.querySelectorAll('[data-close]').forEach(button => {
    button.onclick = () => button.closest('.overlay').classList.add('hidden');
  });
  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.classList.add('hidden');
    });
    overlay.querySelector('.modal')?.addEventListener('click', event => event.stopPropagation());
  });
  document.querySelectorAll('[data-back]').forEach(button => {
    button.onclick = () => page(button.closest('#supportpage') ? 'profile' : 'catalog');
  });
  $('q').oninput = () => { if ($('q').value.trim()) activeCategory = null; render(); };
  $('clear').onclick = () => { $('q').value = ''; render(); };
  $('focus').onclick = () => $('q').focus();
  $('home').onclick = () => { activeCategory = null; $('q').value = ''; page('catalog'); render(); };
  $('tabcat').onclick = () => { activeCategory = null; $('q').value = ''; page('catalog'); render(); };
  $('tabprofile').onclick = () => { renderProfile(); page('profile'); };
  $('support').onclick = () => page('supportpage');
  $('publish').onclick = () => window.open('https://t.me/AlaganMarket_Bot', '_blank', 'noopener');
  $('supplier').onclick = () => $('supplierModal').classList.remove('hidden');
  $('copy').onclick = () => toast('Криптоадрес ещё не настроен');

  if (telegramUser) {
    $('user').textContent = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') || 'Пользователь';
    $('username').textContent = telegramUser.username ? '@' + telegramUser.username : 'Telegram';
    if (telegramUser.photo_url) {
      $('avatar').src = telegramUser.photo_url;
      $('navavatar').src = telegramUser.photo_url;
    }
  }

  fetch('data/catalog.json').then(response => {
    if (!response.ok) throw new Error('catalog.json unavailable');
    return response.json();
  }).then(data => {
    apps = data.apps || fallback.apps;
    categories = data.categories || [];
    suppliers = data.suppliers || [];
    render();
    renderProfile();
  }).catch(() => {
    apps = fallback.apps;
    render();
    renderProfile();
  });
})();
