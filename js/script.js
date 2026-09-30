// програмно видаляємо картки з подорожами
const tripListCard = document.querySelectorAll(".route");

tripListCard.forEach((card) => card.remove());

//масив з об'єктами. Кожен об'єкт - подорож кудись. Місто, к-ть днів, закладений бюджет.

const trips = [
  { destination: "Warsaw", days: 7, budget: 7000 },
  { destination: "Oslo", days: 4, budget: 5405 },
  { destination: "Dusseldorf", days: 2, budget: 5150 },
  { destination: "Kotelva", days: 10, budget: 2020 },
];


//обчислює та повертає значення, скільки грошей витрачається за один день у подорожі
const costPerDay = (trip) => Math.round(trip.budget / trip.days);

// було видалено функцію showTripList(), щоб не повторювати функціонал. Частково логіку перенесено в renderRoutes();

// асоціюємо змінну із айді контейнеру карток_роутів
const listContainer = document.querySelector("#trips_list");

// функція рендеру, що містить цикл, що проходиться по всім об'єктам та формує DOM-вузли
function renderRoutes() {
  // очистка контейнеру від попереднього списку
  listContainer.innerHTML = "";
  
  for (const trip of trips) {
    const article = document.createElement("aritcle");
    article.classList.add("route");
    const h3 = document.createElement("h3");
    const p = document.createElement("p");
    h3.textContent = trip.destination;
    p.textContent = `${trip.days} днів, ${trip.budget} грн`;
    
    const dailyCost = costPerDay(trip);
    article.dataset.costPerDay = dailyCost;
    
    if (dailyCost < MIN_DAILY_BUDGET) {
      article.classList.add("budget");
      console.log(`Trip to ${trip.destination} is low-cost.`);
    } else {
      article.classList.add("expensive");
      console.log(`Trip to ${trip.destination} is expensive.`);
    }
    
    article.append(h3, p);
    listContainer.append(article);
  }
  // логіка лічильнику подорожей
  let tripsCount = document.querySelector("#trips_count");
  if (trips.length > 0) {
    tripsCount.textContent = `Всього подорожей: ${trips.length}`;
  } else {
    tripsCount.textContent = "Ви ще нікуди не подорожували";
  }
}

renderRoutes();

// вибір та обробка форми
const form = document.querySelector("#add_trip_form");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  
  const destinationValue = document.querySelector("#destination").value.trim();
  const daysValue = Number(document.querySelector("#days").value);
  const budgetValue = Number(document.querySelector("#budget").value);
  
  const newTrip = {
    destination: destinationValue,
    days: daysValue,
    budget: budgetValue,
  };
  
  trips.push(newTrip);
  
  renderRoutes();
  
  form.reset();
});

const daysInput = document.querySelector("#days");
const budgetInput = document.querySelector("#budget");

// встановлено мінімальний поріг для порівняння щоденної витрати грошей
// Мінімальний розумний поріг бюджету на день (наприклад, 500 грн)
const MIN_DAILY_BUDGET = 500;

function validateDailyBudget() {
  const days = Number(daysInput.value);
  const budget = Number(budgetInput.value);
  
  // Перевіряємо, коли обидва поля заповнені й дні більші за нуль
  if (days > 0 && budgetInput.value !== "") {
    const daily = Math.round(budget / days);
    
    if (daily < MIN_DAILY_BUDGET) {
      budgetInput.setCustomValidity(
        `Бюджет на день (${daily} грн) занадто малий! Мінімум: ${MIN_DAILY_BUDGET} грн/день.`
      );
    } else {
      budgetInput.setCustomValidity(""); // Обов'язково скидаємо помилку, коли все добре
    }
  } else {
    budgetInput.setCustomValidity("");
  }
}

// Вішаємо перевірку «на льоту» на обидва поля
daysInput.addEventListener("input", validateDailyBudget);
budgetInput.addEventListener("input", validateDailyBudget);

// Вішаємо один обробник кліку на весь контейнер. 
// При кліку на будь-який елемент всередині картки, скрипт знаходить саму картку (.route), 
// дістає з неї текстові дані та атрибут dataset, і виводить їх у блок деталей.
const detailsText = document.querySelector("#route_details_section p");

listContainer.addEventListener("click", (event) => {
  const clickedTrip = event.target.closest(".route");
  if (!clickedTrip) {
    return;
  }

  const destinationName = clickedTrip.querySelector("h3").textContent;
  const tripInfo = clickedTrip.querySelector("p").textContent;
  const dailyCost = clickedTrip.dataset.costPerDay;
  detailsText.textContent = `Обрана подорож ${destinationName}. Умови ${tripInfo}. Витрати на день складуть близько ${dailyCost} грн.`;
});
