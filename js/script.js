// фреймворком обрано React 18 оскільки на фахівців з React більше попит на ринку ніж з Vue
// Поїздки (початкові дані з практикуму 10); пункти маршруту зберігаються в IndexedDB
const TRIPS = [
  { id: 1, destination: "Warsaw",     days: 7,  budget: 7000 },
  { id: 2, destination: "Oslo",       days: 4,  budget: 5405 },
  { id: 3, destination: "Dusseldorf", days: 2,  budget: 5150 },
  { id: 4, destination: "Kotelva",    days: 10, budget: 2020 },
];

const STORAGE_KEY = "tripStops";

function saveToLocalStorage(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Пошкоджені дані в localStorage:", error);
    return [];
  }
}

// Схема IndexedDB: база TravelDB (версія 1), одне сховище tripStops з ключем id
const DB_NAME = "TravelDB";
const DB_VERSION = 1;
const STORE_NAME = "tripStops";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Додає запис або оновлює наявний з тим самим id (put)
async function addItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Оновлення використовує той самий put: запис з таким id буде перезаписано
async function updateItem(item) {
  return addItem(item);
}

// Повертає масив усіх пунктів маршруту зі сховища
async function getAllItems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Видаляє запис за id
async function deleteItem(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Повертає один пункт за id (undefined, якщо запису немає)
async function getItemById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Одноразово переносить пункти маршруту з localStorage в IndexedDB
async function migrateFromLocalStorage() {
  if (localStorage.getItem("migrated") === "true") return; // вже переносили

  const existing = await getAllItems(); // що вже є в IndexedDB
  const old = loadFromLocalStorage(); // що лежить у localStorage

  if (existing.length === 0 && old.length > 0) {
    for (const item of old) {
      await addItem(item);
    }
  }
  localStorage.setItem("migrated", "true"); // прапорець: більше не повторювати
}

const MAP_WIDTH = 600;
const MAP_HEIGHT = 260;
const MAP_PADDING = 40;

// Перетворює назву міста на стабільне число 0..1 (щоб місто завжди було на тому самому місці)
function cityToNumber(text) {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  }
  return hash / 100000;
}

// Обчислює координати точок на полотні за масивом пунктів (вхід уже відсортований за датою)
function getMapPoints(stops) {
  return stops.map((stop, index) => {
    const x =
      stops.length === 1
        ? MAP_WIDTH / 2
        : MAP_PADDING +
          (index * (MAP_WIDTH - 2 * MAP_PADDING)) / (stops.length - 1);
    const y =
      MAP_PADDING + cityToNumber(stop.city) * (MAP_HEIGHT - 2 * MAP_PADDING);
    return { x, y, label: stop.city };
  });
}

// Малює один кадр: progress — скільки відрізків лінії вже «пройдено» (дробове число)
function drawMap(ctx, points, progress) {
  ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT); // стираємо попередній кадр
  ctx.fillStyle = "#083344";
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT); // фон

  if (points.length === 0) {
    ctx.fillStyle = "#f4f1ea";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Додайте пункти маршруту", MAP_WIDTH / 2, MAP_HEIGHT / 2);
    return;
  }

  // 1) лінія маршруту
  const fullSegments = Math.floor(progress); // скільки відрізків намальовано повністю
  ctx.strokeStyle = "#0d9488";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i <= fullSegments; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (fullSegments < points.length - 1) {
    // частково намальований відрізок
    const t = progress - fullSegments; // 0..1: яку частину відрізка вже пройдено
    const from = points[fullSegments];
    const to = points[fullSegments + 1];
    ctx.lineTo(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
  }
  ctx.stroke();

  // 2) точки з номерами та підписами (з'являються, коли лінія до них дійшла)
  points.forEach((point, i) => {
    if (i > progress) return;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();

    ctx.fillStyle = "#083344";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(i + 1, point.x, point.y);

    ctx.fillStyle = "#f4f1ea";
    ctx.font = "13px sans-serif";
    ctx.fillText(point.label, point.x, point.y - 20);
  });
}

// Посилання для клієнтської навігації (обробляється обробником кліку з data-link)
function Link({ to, children }) {
  return <a href={"#" + to} data-link>{children}</a>;
}

// Картка поїздки: props отримано деструктуризацією; costPerDay — похідне значення
function TripCard({ id, destination, days, budget }) {
  const costPerDay = Math.round(budget / days);
  return (
    <article className="route">
      <h3>{destination}</h3>
      <p>{days} днів, {budget} грн</p>
      <p>Витрати на день: {costPerDay} грн</p>
      <p><Link to={`/trip/${id}`}>Пункти маршруту →</Link></p>
    </article>
  );
}

// Міні-карта маршруту на Canvas з анімацією через requestAnimationFrame
function RouteMap({ stops }) {
  const canvasRef = React.useRef(null);
  const [replayCount, setReplayCount] = React.useState(0); // лічильник «програти знову»

  React.useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    const points = getMapPoints(stops);
    const lastIndex = Math.max(points.length - 1, 0); // скільки відрізків у маршруті
    let progress = 0;
    let frameId;

    // Крок 5: цикл анімації — оновити стан, перемалювати кадр, запланувати наступний
    function animate() {
      progress = Math.min(progress + 0.03, lastIndex);
      drawMap(ctx, points, progress);
      if (progress < lastIndex) {
        frameId = requestAnimationFrame(animate);
      }
    }
    animate();

    // Крок 8: прибирання — зупиняємо цикл, коли дані змінились або компонент зник
    return () => cancelAnimationFrame(frameId);
  }, [stops, replayCount]); // Крок 6: перезапуск при зміні пунктів або натисканні кнопки

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        className="route-map"
      ></canvas>
      <button type="button" onClick={() => setReplayCount(replayCount + 1)}>
        Програти маршрут
      </button>
    </div>
  );
}

// Форма, список пунктів обраної поїздки та міні-карта (дані з IndexedDB)
// ще один компонент React'y
function StopsPlanner({ tripId }) {
  const [stops, setStops] = React.useState([]);

  const [dbError, setDbError] = React.useState("");
  // читає всі пункти з IndexedDB і кладе їх у стан (перемальовує список)
  async function refreshStops() {
    const items = await getAllItems();
    setStops(items.filter((item) => item.tripId === tripId));
  }

  // виконається один раз після першого показу компонента
  React.useEffect(() => {
    async function init() {
      try {
        await migrateFromLocalStorage(); // одноразове перенесення старих даних
        await refreshStops(); // завантажуємо список із бази
      } catch (error) {
        console.error("Помилка IndexedDB:", error);
        setDbError(
          "Не вдалося відкрити локальну базу даних. Можливо, браузер блокує сховище (наприклад, у режимі приватного перегляду). Зміни не буде збережено."
        );
      }
    }
    init();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));

    if (data.dateTo < data.dateFrom) {
      alert("Дата завершення не може бути раніше за дату початку");
      return;
    }

    const newStop = {
      id: Date.now(),
      tripId,
      country: data.country.trim(),
      city: data.city.trim(),
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      notes: data.notes.trim(),
    };

    try {
      await addItem(newStop);
      await refreshStops();
      form.reset();
      setDbError("");
    } catch (error) {
      console.error("Помилка збереження:", error);
      setDbError("Не вдалося зберегти пункт маршруту.");
    }
  }

  async function handleDelete(id) {
    try {
      await deleteItem(id);
      await refreshStops();
      setDbError("");
    } catch (error) {
      console.error("Помилка видалення:", error);
      setDbError("Не вдалося видалити пункт маршруту.");
    }
  }

  const sortedStops = React.useMemo(
    () => [...stops].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)),
    [stops]
  );

  return (
    <>
      {dbError && (
        <p role="alert" className="db_error">
          {dbError}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Країна <input type="text" name="country" required />
          </label>
        </div>
        <div>
          <label>
            Місто <input type="text" name="city" required />
          </label>
        </div>
        <div>
          <label>
            Дата початку{" "}
            <input
              type="date"
              name="dateFrom"
              min="1950-01-01"
              max="2100-12-31"
              required
            />
          </label>
        </div>
        <div>
          <label>
            Дата завершення{" "}
            <input
              type="date"
              name="dateTo"
              min="1950-01-01"
              max="2100-12-31"
              required
            />
          </label>
        </div>
        <div>
          <label>
            Нотатки <textarea name="notes"></textarea>
          </label>
        </div>
        <button type="submit">Додати пункт</button>
      </form>

      {sortedStops.length === 0 ? (
        <p>Пунктів маршруту ще немає</p>
      ) : (
        <ul>
          {sortedStops.map((stop) => (
            <li key={stop.id}>
              {stop.dateFrom} – {stop.dateTo}:{" "}
              <Link to={`/trip/${tripId}/stop/${stop.id}`}>
                {stop.city}, {stop.country}
              </Link>
              {stop.notes && ` (${stop.notes})`}
              <button onClick={() => handleDelete(stop.id)}>Видалити</button>
            </li>
          ))}
        </ul>
      )}
      <RouteMap stops={sortedStops} />
    </>
  );
}

// Маршрут «/»: список поїздок (повторно використовує TripCard)
function HomePage() {
  return (
    <>
      <h2>Мої подорожі</h2>
      <p>Всього подорожей: {TRIPS.length}</p>
      <div className="route_container">
        {TRIPS.map((trip) => (
          <TripCard key={trip.id} {...trip} />
        ))}
      </div>
    </>
  );
}

// Маршрут «/trip/:id»: пункти маршруту обраної поїздки
function TripPage({ params }) {
  const tripId = Number(params.id); // параметр — рядок
  const trip = TRIPS.find((t) => t.id === tripId);
  if (!trip) return <NotFoundPage />;
  return (
    <>
      <p><Link to="/">← До списку поїздок</Link></p>
      <h2>{trip.destination}</h2>
      <p>{trip.days} днів, {trip.budget} грн</p>
      <StopsPlanner key={tripId} tripId={tripId} />
    </>
  );
}

// Маршрут «/trip/:id/stop/:stopId»: деталі одного пункту маршруту
function StopPage({ params }) {
  const tripId = Number(params.id);
  const stopId = Number(params.stopId);
  // undefined — ще завантажується, null — запису немає
  const [stop, setStop] = React.useState(undefined);

  React.useEffect(() => {
    getItemById(stopId)
      .then((item) => {
        setStop(item && item.tripId === tripId ? item : null);
      })
      .catch((error) => {
        console.error("Помилка читання пункту:", error);
        setStop(null); // не залишаємо екран на «Завантаження...» при помилці бази
      });
  }, [stopId, tripId]);

  if (stop === undefined) return <p>Завантаження...</p>;
  if (stop === null) return <NotFoundPage />;

  return (
    <>
      <p><Link to={`/trip/${tripId}`}>← До пунктів поїздки</Link></p>
      <h2>{stop.city}, {stop.country}</h2>
      <p>Дати: {stop.dateFrom} – {stop.dateTo}</p>
      <p>Нотатки: {stop.notes || "немає"}</p>
    </>
  );
}

// Сторінка 404: з'являється, коли маршруту чи запису немає
function NotFoundPage() {
  return (
    <>
      <h2>Сторінку не знайдено</h2>
      <p><Link to="/">На головну</Link></p>
    </>
  );
}

// Таблиця маршрутів: патерн шляху → view-функція. Сегмент :name — параметр
const routes = [
  { path: "/", view: HomePage },
  { path: "/trip/:id", view: TripPage },
  { path: "/trip/:id/stop/:stopId", view: StopPage },
];

// Порівнює шлях з патернами; повертає { view, params } або null, якщо маршруту немає
function matchRoute(path) {
  const pathParts = path.split("/").filter(Boolean);
  for (const route of routes) {
    const routeParts = route.path.split("/").filter(Boolean);
    if (routeParts.length !== pathParts.length) continue;

    const params = {};
    const isMatch = routeParts.every((part, i) => {
      if (part.startsWith(":")) {
        params[part.slice(1)] = pathParts[i]; // записуємо значення параметра
        return true;
      }
      return part === pathParts[i];
    });
    if (isMatch) return { view: route.view, params };
  }
  return null;
}

// Зміна «сторінки» без перезавантаження: просто змінюємо хеш
function navigate(path) {
  location.hash = path;
}

// Один обробник на весь документ: перехоплює кліки по посиланнях з data-link
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-link]");
  if (!link) return;
  event.preventDefault();
  navigate(link.getAttribute("href").slice(1)); // "#/trip/2" → "/trip/2"
});

function getPath() {
  return location.hash.slice(1) || "/"; // порожній хеш — головна сторінка
}

// Хук: зберігає поточний шлях у стані й оновлює його при кожній зміні хеша
function useHashPath() {
  const [path, setPath] = React.useState(getPath());
  React.useEffect(() => {
    const onChange = () => setPath(getPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange); // прибираємо слухача
  }, []);
  return path;
}

// Роутер: за поточним шляхом обирає view і малює її в контейнер
function Router() {
  const path = useHashPath();
  const match = matchRoute(path);
  if (!match) return <NotFoundPage />;
  const View = match.view;
  return <View params={match.params} />;
}

// Єдиний запуск React: Router малює потрібну сторінку в контейнер #app
ReactDOM.createRoot(document.getElementById("app")).render(<Router />);