// програмно видаляємо картки з подорожами
const tripListCard = document.querySelectorAll(".route");

tripListCard.forEach((card) => card.remove());

//масив з об'єктами. Кожен об'єкт - подорож кудись. Місто, к-ть днів, закладений бюджет.

const trips = [
  { destination: "Warsaw", days: 7, budget: 1050 },
  { destination: "Oslo", days: 4, budget: 3180 },
  { destination: "Dusseldorf", days: 2, budget: 2500 },
  { destination: "Kotelva", days: 10, budget: 400 },
];

// встановлено мінімальний поріг для порівняння щоденної витрати грошей
const lowCostThreshold = 150;

//обчислює та повертає значення, скільки грошей витрачається за один день у подорожі
const costPerDay = (trip) => Math.round(trip.budget / trip.days);

// було видалено функцію showTripList(), щоб не повторювати функціонал. Частково логіку перенесено в renderRoutes();

// асоціюємо змінну із айді контейнеру карток_роутів
const listContainer = document.querySelector("#trips_list");

// функція рендеру, що містить цикл, що проходиться по всім об'єктам та формує DOM-вузли
function renderRoutes() {
  for (const trip of trips) {
    const article = document.createElement("aritcle");
    article.classList.add('route');
    const h3 = document.createElement("h3");
    const p = document.createElement("p");
    h3.textContent = trip.destination;
    p.textContent = `${trip.days} днів, ${trip.budget} грн`;

    const dailyCost = costPerDay(trip);
    article.dataset.costPerDay = dailyCost;

    if (dailyCost < lowCostThreshold) {
      article.classList.add("budget");
      console.log(`Trip to ${trip.destination} is low-cost.`);
    } else {
      article.classList.add("expensive");
      console.log(`Trip to ${trip.destination} is expensive.`);
    }

    article.append(h3, p);
    listContainer.append(article);
  }
}

renderRoutes();

let tripsCount = document.querySelector('#trips_count');
tripsCount.textContent = `Всього подорожей: ${trips.length}`;