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


  // Загрузка каталога
  const catalogUrl = new URL(
    'data/catalog.json',
    document.baseURI
  ).href;

  fetch(catalogUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return response.json();
    })
    .then(data => {
      if (!data || !Array.isArray(data.apps)) {
        throw new Error(
          'Некорректная структура catalog.json: отсутствует массив apps'
        );
      }

      apps = data.apps;
      categories = Array.isArray(data.categories)
        ? data.categories
        : [];

      suppliers = Array.isArray(data.suppliers)
        ? data.suppliers
        : [];

      console.log(
        `[Alagan Market] Загружено приложений: ${apps.length}`
      );

      render();
      renderProfile();
    })
    .catch(error => {
      console.error(
        '[Alagan Market] Ошибка загрузки каталога:',
        error
      );

      apps = [];
      categories = [];
      suppliers = [];

      render();
      renderProfile();

      const emptyEl = $('empty');

      if (emptyEl) {
        emptyEl.textContent =
          'Не удалось загрузить каталог. ' +
          'Подробности доступны в консоли браузера.';
        emptyEl.classList.remove('hidden');
      }
    });
})();
