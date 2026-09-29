console.log("script підключено");

//масив з об'єктами. Кожен об'єкт - подорож кудись. Місто, к-ть днів, закладений бюджет.

const trips = [
  { destination: "Warsaw", days: 7, budget: 1050 },
  { destination: "Oslo", days: 4, budget: 3180 },
  { destination: "Dusseldorf", days: 2, budget: 2500 },
  { destination: "Kotelva", days: 10, budget: 400 },
];

//обчислює та повертає значення, скільки грошей витрачається за один день у подорожі

const costPerDay = (trip) => Math.round(trip.budget / trip.days);

//функція виводить найменування всіх подорожей та класифікує їх за вартістю: (дорого/дешево).

function tripList() {
  for (const trip of trips) {
    console.log(trip.destination);
    const dailyCost = costPerDay(trip);
    if (dailyCost < 150) {
      console.log(`Trip to ${trip.destination} is low-cost.`);
    } else {
      console.log(`Trip to ${trip.destination} is expensive.`);
    }
  }
}

tripList();
