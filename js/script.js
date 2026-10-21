// фреймворком обрано React 18 оскільки на фахівців з React більше попит на ринку ніж з Vue

const API_BASE = "https://api.restcountries.com/countries/v5/name";
const API_KEY = "API_HERE";

//масив з об'єктами. Кожен об'єкт - подорож кудись. Місто, к-ть днів, закладений бюджет.
function App() {
  const [trips, setTrips] = React.useState([
    { id: 1, destination: "Warsaw", days: 7, budget: 7000 },
    { id: 2, destination: "Oslo", days: 4, budget: 5405 },
    { id: 3, destination: "Dusseldorf", days: 2, budget: 5150 },
    { id: 4, destination: "Kotelva", days: 10, budget: 2020 },
  ]);

  return (
    <>
      <button
        onClick={() =>
          setTrips([
            ...trips,
            { id: Date.now(), destination: "Test", days: 2, budget: 3000 },
          ])
        }
      >
        Додати тест
      </button>
      <p>Всього подорожей: {trips.length}</p>
      <div className="route_container">
        {trips.map((trip) => (
          <TripCard
            key={trip.id}
            destination={trip.destination}
            days={trip.days}
            budget={trip.budget}
          />
        ))}
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("trips_list")).render(<App />);

//props.destination, props.days... деструктурізація відбулася
function TripCard({ destination, days, budget }) {
  const costPerDay = Math.round(budget / days);

  return (
    <article className="route">
      <h3>{destination}</h3>
      <p>
        {days} днів, {budget} грн
      </p>
      <p>Витрати на день: {costPerDay} грн</p>
    </article>
  );
}

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

// ще один компонент React'y
function StopsPlanner() {
  const [stops, setStops] = React.useState([]);

  const [dbError, setDbError] = React.useState("");
  // читає всі пункти з IndexedDB і кладе їх у стан (перемальовує список)
  async function refreshStops() {
    const items = await getAllItems();
    setStops(items);
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

  //копія масиву і його зміна - сортування за датою початку
  const sortedStops = [...stops].sort((a, b) =>
    a.dateFrom.localeCompare(b.dateFrom)
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
              {stop.dateFrom} – {stop.dateTo}: {stop.city}, {stop.country}
              {stop.notes && ` (${stop.notes})`}
              <button onClick={() => handleDelete(stop.id)}>Видалити</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("stops_root")).render(
  <StopsPlanner />
);
// // встановлено мінімальний поріг для порівняння щоденної витрати грошей
// // Мінімальний розумний поріг бюджету на день (наприклад, 500 грн)
// const MIN_DAILY_BUDGET = 500;

// //обчислює та повертає значення, скільки грошей витрачається за один день у подорожі
// const costPerDay = (trip) => Math.round(trip.budget / trip.days);

// // асоціюємо змінну із айді контейнеру карток_роутів
// const listContainer = document.querySelector("#trips_list");

// Крок 7: старий ручний DOM-код замінено React-компонентами
// // функція рендеру, що містить цикл, що проходиться по всім об'єктам та формує DOM-вузли
// function renderRoutes() {
//   // очистка контейнеру від попереднього списку
//   listContainer.innerHTML = "";

//   for (const trip of trips) {
//     const article = document.createElement("article");
//     article.classList.add("route");
//     const h3 = document.createElement("h3");
//     const p = document.createElement("p");
//     h3.textContent = trip.destination;
//     p.textContent = `${trip.days} днів, ${trip.budget} грн`;

//     const dailyCost = costPerDay(trip);
//     article.dataset.costPerDay = dailyCost;

//     if (dailyCost < MIN_DAILY_BUDGET) {
//       article.classList.add("budget");
//       console.log(`Trip to ${trip.destination} is low-cost.`);
//     } else {
//       article.classList.add("expensive");
//       console.log(`Trip to ${trip.destination} is expensive.`);
//     }

//     article.append(h3, p);

//     if (trip.capital && trip.population) {
//       const apiInfo = document.createElement("p");
//       apiInfo.textContent = `Столиця: ${trip.capital}, Населення: ${trip.population}`;
//       article.append(apiInfo);
//     }

//     if (trip.flagUrl) {
//       const flagImg = document.createElement("img");
//       flagImg.src = trip.flagUrl;
//       flagImg.alt = `Прапор ${trip.destination}`;
//       flagImg.classList.add("flag");
//       article.append(flagImg);
//     }

//     listContainer.append(article);
//   }
//   // логіка лічильнику подорожей
//   let tripsCount = document.querySelector("#trips_count");
//   if (trips.length > 0) {
//     tripsCount.textContent = `Всього подорожей: ${trips.length}`;
//   } else {
//     tripsCount.textContent = "Ви ще нікуди не подорожували";
//   }
// }

// renderRoutes();

// // вибір та обробка форми
// const form = document.querySelector("#add_trip_form");
// form.addEventListener("submit", (event) => {
//   event.preventDefault();

//   const destinationValue = document.querySelector("#destination").value.trim();
//   const daysValue = Number(document.querySelector("#days").value);
//   const budgetValue = Number(document.querySelector("#budget").value);

//   const newTrip = {
//     destination: destinationValue,
//     days: daysValue,
//     budget: budgetValue,
//   };

//   trips.push(newTrip);

//   renderRoutes();

//   form.reset();
// });

// const daysInput = document.querySelector("#days");
// const budgetInput = document.querySelector("#budget");

// function validateDailyBudget() {
//   const days = Number(daysInput.value);
//   const budget = Number(budgetInput.value);

//   // Перевіряємо, коли обидва поля заповнені й дні більші за нуль
//   if (days > 0 && budgetInput.value !== "") {
//     const daily = Math.round(budget / days);

//     if (daily < MIN_DAILY_BUDGET) {
//       budgetInput.setCustomValidity(
//         `Бюджет на день (${daily} грн) занадто малий! Мінімум: ${MIN_DAILY_BUDGET} грн/день.`
//       );
//     } else {
//       budgetInput.setCustomValidity(""); // Обов'язково скидаємо помилку, коли все добре
//     }
//   } else {
//     budgetInput.setCustomValidity("");
//   }
// }

// // Вішаємо перевірку «на льоту» на обидва поля
// daysInput.addEventListener("input", validateDailyBudget);
// budgetInput.addEventListener("input", validateDailyBudget);

// // Вішаємо один обробник кліку на весь контейнер.
// // При кліку на будь-який елемент всередині картки, скрипт знаходить саму картку (.route),
// // дістає з неї текстові дані та атрибут dataset, і виводить їх у блок деталей.
// const detailsText = document.querySelector("#route_details_section p");

// listContainer.addEventListener("click", (event) => {
//   const clickedTrip = event.target.closest(".route");
//   if (!clickedTrip) {
//     return;
//   }

//   const destinationName = clickedTrip.querySelector("h3").textContent;
//   const tripInfo = clickedTrip.querySelector("p").textContent;
//   const dailyCost = clickedTrip.dataset.costPerDay;
//   detailsText.textContent = `Обрана подорож ${destinationName}. Умови ${tripInfo}. Витрати на день складуть близько ${dailyCost} грн.`;
// });

// // Функція для показу/приховування статусу завантаження
// function showLoading(isLoading) {
//   const statusDiv = document.getElementById("api_status");
//   if (!statusDiv) return;

//   if (isLoading) {
//     statusDiv.textContent = "Завантаження даних...";
//     statusDiv.style.color = "blue"; // Синій колір для процесу
//   } else {
//     // Прибираємо текст тільки якщо там статус завантаження
//     // (щоб не затерти повідомлення про помилку, якщо вона сталася)
//     if (statusDiv.textContent === "Завантаження даних...") {
//       statusDiv.textContent = "";
//     }
//   }
// }

// // Функція для виведення помилки на екран
// function showError(message) {
//   const statusDiv = document.getElementById("api_status");
//   if (statusDiv) {
//     statusDiv.textContent = message;
//     statusDiv.style.color = "red"; // Червоний колір для помилки
//   }
// }

// // функція відповідає за підвантаження по АПІ даних про ту чи іншу країну з Rest Countries апі. Підтягує дані та створює картку з
// // відповідними параметрами країни. Регулює поведінку мережевого індикатора.

// // API: REST Countries v5, https://restcountries.com/docs/countries
// async function loadDataCountry(countryName = "ukraine") {
//   showLoading(true);

//   try {
//     const url = `${API_BASE}?q=${encodeURIComponent(
//       countryName
//     )}&response_fields_omit=names.translations&api-key=${API_KEY}`;
//     const response = await fetch(url);

//     if (response.status === 401 || response.status === 403) {
//       throw new Error("Помилка доступу до API. Перевірте ключ.");
//     }
//     if (response.status === 404) {
//       throw new Error("Країну не знайдено, перевірте написання.");
//     }
//     if (!response.ok) {
//       throw new Error(`Код помилки: ${response.status}`);
//     }

//     const json = await response.json();
//     console.log(json);
//     const countries = json.data?.objects ?? [];

//     // v5 повертає 200 з порожнім масивом, якщо нічого не знайдено
//     if (countries.length === 0) {
//       throw new Error("Країну не знайдено, перевірте написання.");
//     }

//     const country = countries[0];
//     trips.push({
//       destination: country.names.common,
//       capital: country.capitals?.[0]?.name ?? "Немає даних",
//       population: country.population,
//       flagUrl: country.flag?.url_png,
//       days: 5,
//       budget: 15000,
//     });
//     renderRoutes();
//   } catch (error) {
//     if (error.message === "Failed to fetch") {
//       showError(
//         "Не вдалося завантажити дані. Перевірте підключення до Інтернету."
//       );
//     } else {
//       showError(error.message);
//     }
//     console.error(error);
//   } finally {
//     showLoading(false);
//   }
// }

// const reloadButton = document.querySelector("#page_reload");
// const countrySearchInput = document.querySelector("#country_search");

// reloadButton.addEventListener("click", () => {
//   const query =
//     countrySearchInput && countrySearchInput.value.trim() !== ""
//       ? countrySearchInput.value.trim()
//       : "ukraine";
//   loadDataCountry(query);
// });

// loadDataCountry(
//   countrySearchInput ? countrySearchInput.value.trim() : "ukraine"
// );
